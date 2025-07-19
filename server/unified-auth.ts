
import bcrypt from 'bcryptjs';
import { db } from './db';
import { users, userSessions, passwordResetTokens } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { MailService } from '@sendgrid/mail';
import { logger, logError, logAuthEvent, logSecurityEvent } from './logger';

// Generate secure session ID
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate secure password reset token
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Email service for password reset
class EmailService {
  private static mail = new MailService();
  
  static initialize() {
    if (process.env.SENDGRID_API_KEY) {
      this.mail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }
  
  static async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      return false;
    }
    
    try {
      const resetUrl = `https://bookd.tools/?reset_token=${token}`;
      
      await this.mail.send({
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
      
      return true;
    } catch (error) {
      return false;
    }
  }
}

EmailService.initialize();

// Database-backed session management
export class SessionManager {
  static async createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<string> {
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    try {
      await db.insert(userSessions).values({
        userId,
        sessionId,
        expiresAt,
        ipAddress,
        userAgent,
        isActive: true
      });
      
      return sessionId;
    } catch (error) {
      throw new Error('Session creation failed');
    }
  }

  static async validateSession(sessionId: string): Promise<{ userId: number } | null> {
    if (!sessionId) return null;
    
    try {
      const [session] = await db
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.sessionId, sessionId),
            eq(userSessions.isActive, true),
            gt(userSessions.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!session) return null;
      return { userId: session.userId };
    } catch (error) {
      return null;
    }
  }

  static async destroySession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    
    try {
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(eq(userSessions.sessionId, sessionId));
    } catch (error) {
    }
  }

  static async destroyUserSessions(userId: number): Promise<void> {
    try {
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(eq(userSessions.userId, userId));
    } catch (error) {
    }
  }
}

// Password reset functionality
export class PasswordReset {
  static async createResetToken(email: string): Promise<string | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return null;
      }

      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });

      const emailSent = await EmailService.sendPasswordResetEmail(email, token);
      
      if (emailSent) {
      } else {
        
        if (process.env.NODE_ENV !== 'production') {
          const resetUrl = `https://bookd.tools/?reset_token=${token}`;
        }
      }

      return token;
    } catch (error) {
      return null;
    }
  }

  static async validateResetToken(token: string): Promise<{ userId: number } | null> {
    try {
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

      if (!resetToken) return null;
      return { userId: resetToken.userId };
    } catch (error) {
      return null;
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const [resetToken] = await db
        .select({
          userId: passwordResetTokens.userId,
        })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!resetToken) {
        return false;
      }

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

      await SessionManager.destroyUserSessions(resetToken.userId);

      return true;
    } catch (error) {
      return false;
    }
  }
}

// Authentication service
export class AuthService {
  static async createUser(email: string, password: string, name: string): Promise<any> {
    try {
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
    } catch (error) {
      throw new Error('Failed to create user');
    }
  }

  static async validatePassword(email: string, password: string): Promise<any> {
    try {
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

      if (!user || !user.passwordHash) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        return null;
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      return user;
    } catch (error) {
      return null;
    }
  }

  static async getUserById(id: number): Promise<any> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      return user || null;
    } catch (error) {
      return null;
    }
  }
}

// BULLETPROOF auth middleware with validation
export function requireAuth(req: any, res: any, next: any) {
  const sessionId = req.cookies?.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  SessionManager.validateSession(sessionId)
    .then(session => {
      if (!session) {
        return res.status(401).json({ message: "Invalid session" });
      }
      
      // CRITICAL: Set user ID and validate pattern
      req.userId = session.userId;
      
      // BULLETPROOF: Validate authentication pattern
      if (typeof req.userId !== 'number' || req.userId <= 0) {
        logSecurityEvent('Critical auth error - invalid userId set in middleware', {
          userId: req.userId,
          route: req.path
        });
        return res.status(500).json({ message: "Authentication configuration error" });
      }
      
      // BULLETPROOF: Prevent deprecated pattern usage
      if (req.session?.userId) {
        logSecurityEvent('Deprecated auth pattern detected in middleware', {
          sessionUserId: req.session.userId,
          route: req.path
        });
      }
      
      next();
    })
    .catch(error => {
      logError('Authentication error in middleware', error);
      res.status(500).json({ message: "Authentication error" });
    });
}

// Setup auth routes
export function setupAuthRoutes(app: any, authLimiter?: any, passwordResetLimiter?: any) {
  // Login
  app.post('/api/auth/login', authLimiter, async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await AuthService.validatePassword(email, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const sessionId = await SessionManager.createSession(
        user.id,
        req.ip,
        req.get('User-Agent')
      );
      
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? 'bookd.tools' : undefined,
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      
      res.json({ 
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed", error: "Server error" });
    }
  });

  // Register
  app.post('/api/auth/register', authLimiter, async (req: any, res: any) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }
      
      const user = await AuthService.createUser(email, password, name);
      
      const sessionId = await SessionManager.createSession(
        user.id,
        req.ip,
        req.get('User-Agent')
      );
      
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? 'bookd.tools' : undefined,
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      
      res.json({ 
        message: "Registration successful",
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Logout - NO AUTH REQUIRED to ensure it works even with corrupted sessions
  app.post('/api/logout', async (req: any, res: any) => {
    try {
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        await SessionManager.destroySession(sessionId);
      }
      
      // Clear cookie completely with all possible configurations
      res.clearCookie('sessionId', {
        domain: process.env.NODE_ENV === 'production' ? 'bookd.tools' : undefined,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      res.json({ message: "Logout successful" });
    } catch (error) {
      // Always succeed logout to prevent users from getting stuck
      res.clearCookie('sessionId', {
        domain: process.env.NODE_ENV === 'production' ? 'bookd.tools' : undefined,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      res.json({ message: "Logout successful" });
    }
  });

  // Get current user
  app.get('/api/auth/user', requireAuth, async (req: any, res: any) => {
    try {
      const user = await AuthService.getUserById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        title: user.title,
        defaultTaxPercentage: user.defaultTaxPercentage,
        customGigTypes: user.customGigTypes || [],
        homeAddress: user.homeAddress,
        businessName: user.businessName,
        businessAddress: user.businessAddress,
        businessPhone: user.businessPhone,
        businessEmail: user.businessEmail
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Request password reset
  app.post('/api/auth/reset-password-request', passwordResetLimiter, async (req: any, res: any) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const token = await PasswordReset.createResetToken(email);
      
      if (process.env.NODE_ENV !== 'production' && token) {
        const resetUrl = `https://bookd.tools/?reset_token=${token}`;
        res.json({ 
          message: "If an account with that email exists, a reset link has been sent to your email",
          developmentResetUrl: resetUrl
        });
      } else {
        res.json({ 
          message: "If an account with that email exists, a reset link has been sent to your email"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Password reset request failed" });
    }
  });

  // Validate reset token
  app.post('/api/auth/validate-reset-token', async (req: any, res: any) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const tokenData = await PasswordReset.validateResetToken(token);

      if (!tokenData) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const user = await AuthService.getUserById(tokenData.userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      res.json({ 
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Token validation failed" });
    }
  });

  // Reset password
  app.post('/api/auth/reset-password', passwordResetLimiter, async (req: any, res: any) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      const success = await PasswordReset.resetPassword(token, newPassword);
      
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      res.json({ message: "Password reset successful" });
    } catch (error) {
      res.status(500).json({ message: "Password reset failed" });
    }
  });
}

// Cleanup expired sessions periodically
setInterval(() => {
  SessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Add cleanup method
SessionManager.cleanupExpiredSessions = async function() {
  try {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(gt(new Date(), userSessions.expiresAt));
  } catch (error) {
  }
};
