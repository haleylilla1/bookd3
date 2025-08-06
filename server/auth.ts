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
import { sanitizeText, sanitizeEmail } from '@shared/validation';
import { authRateLimit } from './security';

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
  emailVerified: boolean | null;
  isActive: boolean | null;
  lastLoginAt: Date | null;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
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
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      
      const [user] = await db
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          passwordHash,
          name: name.trim(),
          emailVerified: false,
          isActive: true
        })
        .returning();

      if (!user) {
        throw new Error('Failed to create user in database');
      }

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('User creation failed');
    }
  }

  static async validateUser(email: string, password: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, email.toLowerCase().trim()),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      if (!user || !user.passwordHash) return null;

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) return null;

      // Update last login
      try {
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));
      } catch (updateError) {
        // Log but don't fail login if lastLoginAt update fails
        console.error('Failed to update lastLoginAt:', updateError);
      }

      return user;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
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
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!user) return null;

      const token = this.generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing reset tokens for this user first
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.userId, user.id));

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });

      return token;
    } catch (error) {
      console.error('Error creating reset token:', error);
      return null;
    }
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
    try {
      // Track password reset request in Klaviyo first
      try {
        const { KlaviyoService } = await import('./klaviyo');
        await KlaviyoService.trackEvent(email, 'Password Reset Requested', {
          reset_token: token,
          requested_at: new Date().toISOString()
        });
      } catch (error) {
        console.log('Note: Failed to track password reset in Klaviyo');
      }

      // Use SendGrid for actual email delivery (until Klaviyo email templates are set up)
      if (!process.env.SENDGRID_API_KEY) {
        console.log('SendGrid not configured - password reset email would be sent in production');
        return true; // Return true for development
      }

      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const resetUrl = `${process.env.NODE_ENV === 'production' ? 'https://app.bookd.tools' : 'http://localhost:5000'}/?reset_token=${token}`;
      
      await sgMail.send({
        to: email,
        from: 'haleylilla@gmail.com', // Use verified sender
        subject: 'Reset Your Bookd Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; margin: 0;">Bookd</h1>
              <p style="color: #666; margin: 5px 0;">Gig Worker Financial Management</p>
            </div>
            
            <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
            <p style="color: #555; line-height: 1.5;">You requested a password reset for your Bookd account.</p>
            <p style="color: #555; line-height: 1.5;">Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset My Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #007bff; word-break: break-all; font-size: 14px;">${resetUrl}</p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 13px;">⏰ This link will expire in 1 hour</p>
              <p style="color: #999; font-size: 13px;">🔒 If you didn't request this password reset, please ignore this email</p>
              <p style="color: #999; font-size: 13px;">💼 Keep tracking your gig work finances with Bookd</p>
            </div>
          </div>
        `
      });
      
      console.log('Password reset email sent successfully');
      return true;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
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
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const session = await Auth.validateSession(sessionId);
    
    if (!session) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    // SET USER ID - SINGLE SOURCE OF TRUTH
    req.userId = session.userId;
    
    next();
  } catch (error) {
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

      // Input validation
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedName = sanitizeText(name);

      if (!sanitizedEmail.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      if (sanitizedName.length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, sanitizedEmail))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      const user = await Auth.createUser(sanitizedEmail, password, sanitizedName);
      const sessionId = await Auth.createSession(user.id, req.ip, req.get('User-Agent'));

      // Track user signup in Klaviyo
      try {
        const { KlaviyoService } = await import('./klaviyo');
        await KlaviyoService.trackUserSignup(user.email, user.name, {
          signupDate: new Date().toISOString(),
          subscriptionTier: 'trial',
          onboardingCompleted: false
        });
      } catch (error) {
        console.log('Note: Failed to track signup in Klaviyo, but user created successfully');
      }

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
      
      // Handle duplicate email constraint violation  
      if ((error as Error).message?.includes('duplicate') || (error as Error).message?.includes('unique')) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  // LOGIN
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Input validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const sanitizedEmail = sanitizeEmail(email);

      if (!sanitizedEmail.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      const user = await Auth.validateUser(sanitizedEmail, password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
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
      res.status(500).json({ error: 'Login failed. Please try again.' });
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

  // GET CURRENT USER - DISABLED (conflicted with routes.ts endpoint)
  // The full user endpoint is now handled in routes.ts to return complete user profile data
  /*
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
  */

  // PASSWORD RESET REQUEST
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const sanitizedEmail = sanitizeEmail(email);

      if (!sanitizedEmail.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      const token = await Auth.createResetToken(sanitizedEmail);
      
      if (token) {
        await Auth.sendResetEmail(sanitizedEmail, token);
      }

      // Always return success to prevent email enumeration
      res.json({ 
        success: true, 
        message: 'If an account with this email exists, you will receive a password reset link.' 
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ error: 'Password reset failed. Please try again.' });
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