import { Request, Response, NextFunction } from 'express';
import { getUserInfo } from '@replit/repl-auth';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Extended Request interface for Replit Auth
export interface ReplitAuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
    displayName?: string;
    profileImageUrl?: string;
  };
  userId?: number; // Our internal user ID
}

// Middleware to authenticate with Replit Auth
export async function replitAuthMiddleware(
  req: ReplitAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get user info from Replit Auth
    const userInfo = getUserInfo(req);
    
    if (!userInfo) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Set user info on request
    req.user = {
      id: userInfo.id,
      username: userInfo.name,
      email: userInfo.email,
      displayName: userInfo.displayName,
      profileImageUrl: userInfo.profileImageUrl
    };

    // Find or create user in our database
    const internalUser = await findOrCreateUser(userInfo);
    req.userId = internalUser.id;

    next();
  } catch (error) {
    console.error('Replit Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Find or create user in our database
async function findOrCreateUser(userInfo: any): Promise<{ id: number; email: string }> {
  try {
    // Try to find existing user by Replit ID
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, userInfo.email || `${userInfo.id}@replit.com`))
      .limit(1);

    if (existingUser.length > 0) {
      // Update user info if needed
      await db
        .update(users)
        .set({
          name: userInfo.displayName || userInfo.name,
          lastLoginAt: new Date()
        })
        .where(eq(users.id, existingUser[0].id));

      return existingUser[0];
    }

    // Create new user
    const newUser = await db
      .insert(users)
      .values({
        email: userInfo.email || `${userInfo.id}@replit.com`,
        name: userInfo.displayName || userInfo.name,
        password: 'replit-auth', // Placeholder - not used with Replit Auth
        createdAt: new Date(),
        lastLoginAt: new Date(),
        gigTypes: '[]', // Default empty array
        taxRate: 23, // Default tax rate
        homeAddress: null
      })
      .returning();

    return newUser[0];
  } catch (error) {
    console.error('Database error in findOrCreateUser:', error);
    throw error;
  }
}

// Get login URL for Replit Auth
export function getLoginUrl(req: Request): string {
  return 'https://replit.com/auth/oauth2/authorize';
}

// Get logout URL for Replit Auth
export function getLogoutUrl(req: Request): string {
  return 'https://replit.com/logout';
}

// Check if user is authenticated
export function isAuthenticated(req: ReplitAuthRequest): boolean {
  return !!req.user;
}

// Get user ID helper
export function getUserId(req: ReplitAuthRequest): number {
  if (!req.userId) {
    throw new Error('User not authenticated');
  }
  return req.userId;
}

// Auth routes
export function setupAuthRoutes(app: any): void {
  // Traditional login endpoint that redirects to Replit Auth
  app.post('/api/auth/login', (req: Request, res: Response) => {
    // For traditional interface, we redirect to Replit Auth
    res.json({ 
      success: true, 
      redirectUrl: '/auth/login',
      message: 'Redirecting to authentication...' 
    });
  });

  // Traditional register endpoint that redirects to Replit Auth
  app.post('/api/auth/register', (req: Request, res: Response) => {
    // For traditional interface, we redirect to Replit Auth
    res.json({ 
      success: true, 
      redirectUrl: '/auth/login',
      message: 'Redirecting to authentication...' 
    });
  });

  // Replit Auth login endpoint
  app.get('/auth/login', (req: Request, res: Response) => {
    const loginUrl = getLoginUrl(req);
    res.redirect(loginUrl);
  });

  // Logout endpoint
  app.get('/auth/logout', (req: Request, res: Response) => {
    const logoutUrl = getLogoutUrl(req);
    res.redirect(logoutUrl);
  });

  // Get current user endpoint
  app.get('/api/user', replitAuthMiddleware, (req: ReplitAuthRequest, res: Response) => {
    res.json({
      id: req.userId,
      replitId: req.user?.id,
      username: req.user?.username,
      email: req.user?.email,
      displayName: req.user?.displayName,
      profileImageUrl: req.user?.profileImageUrl
    });
  });

  // Auth status endpoint (without auth middleware for checking status)
  app.get('/api/auth/status', async (req: Request, res: Response) => {
    try {
      const userInfo = getUserInfo(req);
      if (userInfo) {
        const internalUser = await findOrCreateUser(userInfo);
        res.json({
          authenticated: true,
          user: {
            id: userInfo.id,
            username: userInfo.name,
            email: userInfo.email,
            displayName: userInfo.displayName,
            profileImageUrl: userInfo.profileImageUrl
          }
        });
      } else {
        res.json({ authenticated: false });
      }
    } catch (error) {
      res.json({ authenticated: false });
    }
  });
}

export default {
  replitAuthMiddleware,
  getLoginUrl,
  getLogoutUrl,
  isAuthenticated,
  getUserId,
  setupAuthRoutes
};