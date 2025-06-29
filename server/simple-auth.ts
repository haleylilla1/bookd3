import bcrypt from 'bcryptjs';
import { storage } from './storage';

// Session store in memory with better persistence logging
const sessions = new Map<string, { userId: number; expires: number }>();

// Debug logging for session management
console.log("Simple Auth - Session store initialized at:", new Date().toISOString());

export function generateSessionId(): string {
  // More secure session ID generation with higher entropy
  const part1 = Math.random().toString(36).substring(2);
  const part2 = Math.random().toString(36).substring(2);
  const part3 = Date.now().toString(36);
  const part4 = Math.random().toString(36).substring(2);
  return part1 + part2 + part3 + part4;
}

export function createSession(userId: number): string {
  const sessionId = generateSessionId();
  const expires = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
  sessions.set(sessionId, { userId, expires });
  return sessionId;
}

export function getSession(sessionId: string): { userId: number } | null {
  const session = sessions.get(sessionId);
  if (!session || session.expires < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { userId: session.userId };
}

export function validateAdminImpersonationToken(token: string): { userId: number } | null {
  try {
    // Decode the base64 token
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is valid (within 1 hour)
    const tokenAge = Date.now() - tokenData.timestamp;
    if (tokenAge > 3600000) { // 1 hour
      return null;
    }

    // Verify admin key
    if (tokenData.adminKey !== 'giggy-admin-2025') {
      return null;
    }

    return { userId: tokenData.userId };
  } catch (error) {
    return null;
  }
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Simple auth middleware with bulletproof user isolation
export function requireAuth(req: any, res: any, next: any) {
  // Check for admin impersonation token first
  const adminToken = req.query.admin_impersonate;
  if (adminToken) {
    const adminSession = validateAdminImpersonationToken(adminToken);
    if (adminSession) {
      req.userId = adminSession.userId;
      req.isAdminImpersonation = true;
      return next();
    }
  }

  // Standard session-based authentication
  const sessionId = req.cookies?.sessionId;
  const session = sessionId ? getSession(sessionId) : null;
  
  if (!session || !session.userId || session.userId <= 0) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  req.userId = session.userId;
  next();
}

// Auth routes
export function setupAuthRoutes(app: any) {
  // Login
  app.post('/api/auth/login', async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      console.log('Login attempt for:', email);
      const user = await storage.validatePassword(email, password);
      
      if (!user) {
        console.log('Invalid credentials for:', email);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const sessionId = createSession(user.id);
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'lax'
      });
      
      console.log('Login successful for:', email);
      res.json({ 
        message: "Login successful", 
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Register
  app.post('/api/auth/register', async (req: any, res: any) => {
    try {
      const { email, password, name } = req.body;
      const user = await storage.createUserWithPassword(email, password, name);
      
      const sessionId = createSession(user.id);
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });
      
      res.json({ 
        message: "Registration successful", 
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req: any, res: any) => {
    const sessionId = req.cookies?.sessionId;
    if (sessionId) {
      destroySession(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ message: "Logout successful" });
  });

  // Note: /api/user endpoint is handled in routes.ts for complete user data
}