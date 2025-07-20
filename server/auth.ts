/**
 * 🛡️ BULLETPROOF AUTHENTICATION SYSTEM
 * 
 * Single file containing ALL authentication logic:
 * - Session management
 * - Password validation
 * - User registration
 * - Password reset
 * - Authentication middleware
 * 
 * PRINCIPLES:
 * 1. Simplicity Over Cleverness
 * 2. One Way to Do Things
 * 3. Fail Loudly
 * 4. User-First Experience
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';
import { users, userSessions, passwordResetTokens } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { MailService } from '@sendgrid/mail';
import type { Express, Request, Response, NextFunction } from 'express';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface AuthenticatedRequest extends Request {
  userId: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
}

// =============================================================================
// CORE AUTHENTICATION SERVICE
// =============================================================================

export class Auth {
  
  // SESSION MANAGEMENT
  // =================
  
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    await db.insert(userSessions).values({
      userId,
      sessionId,
      expiresAt,
      ipAddress,
      userAgent,
      isActive: true
    });
    
    return sessionId;
  }

  static async validateSession(sessionId: string): Promise<{ userId: number } | null> {
    if (!sessionId) return null;
    
    const [session] = await db
      .select({ userId: userSessions.userId })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionId, sessionId),
          eq(userSessions.isActive, true),
          gt(userSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    return session || null;
  }

  static async destroySession(sessionId: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.sessionId, sessionId));
  }

  static async destroyUserSessions(userId: number): Promise<void> {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.userId, userId));
  }

  // USER AUTHENTICATION
  // ==================

  static async createUser(email: string, password: string, name: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        emailVerified: false,
        isActive: true
      })
      .returning();

    return user;
  }

  static async validateUser(email: string, password: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (!user || !user.passwordHash) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return user;
  }

  static async getUser(userId: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user || null;
  }

  // PASSWORD RESET
  // ==============

  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async createResetToken(email: string): Promise<string | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) return null;

    const token = this.generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
      used: false
    });

    return token;
  }

  static async validateResetToken(token: string): Promise<{ userId: number } | null> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    return resetToken ? { userId: resetToken.userId } : null;
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const [resetToken] = await db
      .select({ userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!resetToken) return false;

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({ 
        passwordHash,
        lastLoginAt: new Date()
      })
      .where(eq(users.id, resetToken.userId));

    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));

    await this.destroyUserSessions(resetToken.userId);

    return true;
  }

  // EMAIL SERVICE
  // =============

  static async sendResetEmail(email: string, token: string): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.log(`🔗 Development Reset URL: https://bookd.tools/?reset_token=${token}`);
      return true; // Return true for development
    }

    try {
      const mail = new MailService();
      mail.setApiKey(process.env.SENDGRID_API_KEY);

      const resetUrl = `https://bookd.tools/?reset_token=${token}`;
      
      await mail.send({
        to: email,
        from: 'haleylilla@gmail.com',
        subject: 'Reset Your Bookd Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Bookd Password</h2>
            <p>You requested a password reset for your Bookd account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
        `
      });
      
      console.log(`✅ Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.log(`❌ Failed to send password reset email to ${email}:`, error);
      return false;
    }
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Get user ID safely from authenticated request
export function getUserId(req: AuthenticatedRequest): number {
  if (!req.userId || typeof req.userId !== 'number') {
    throw new Error('User not authenticated - this should never happen');
  }
  return req.userId;
}

// Authentication middleware - ONE WAY TO DO THINGS
export async function requireAuth(req: any, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await Auth.validateSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // SET USER ID - SINGLE SOURCE OF TRUTH
    req.userId = session.userId;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication system error' });
  }
}

// =============================================================================
// EXPRESS ROUTES SETUP
// =============================================================================

export function setupAuthRoutes(app: Express): void {
  
  // REGISTER
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      const user = await Auth.createUser(email, password, name);
      const sessionId = await Auth.createSession(user.id, req.ip, req.get('User-Agent'));

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // LOGIN
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await Auth.validateUser(email, password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const sessionId = await Auth.createSession(user.id, req.ip, req.get('User-Agent'));

      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // LOGOUT
  app.post('/api/logout', async (req: Request, res: Response) => {
    try {
      const sessionId = req.cookies?.sessionId;
      
      if (sessionId) {
        await Auth.destroySession(sessionId);
      }

      res.clearCookie('sessionId');
      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // GET CURRENT USER
  app.get('/api/user', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const user = await Auth.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // PASSWORD RESET REQUEST
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const token = await Auth.createResetToken(email);
      
      if (token) {
        await Auth.sendResetEmail(email, token);
      }

      // Always return success to prevent email enumeration
      res.json({ success: true });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  });

  // PASSWORD RESET CONFIRMATION
  app.post('/api/auth/confirm-reset', async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const success = await Auth.resetPassword(token, password);
      
      if (!success) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Password reset confirmation error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  });
}