import bcrypt from 'bcryptjs';
import { db } from './db';
import { users, userSessions, passwordResetTokens } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

// Generate secure session ID
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate secure password reset token
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Database-backed session management
export class SessionManager {
  // Create a new session
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
      console.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  // Validate session and return user ID
  static async validateSession(sessionId: string): Promise<{ userId: number } | null> {
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

      if (!session) {
        return null;
      }

      return { userId: session.userId };
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  // Destroy a session
  static async destroySession(sessionId: string): Promise<void> {
    try {
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(eq(userSessions.sessionId, sessionId));
    } catch (error) {
      console.error('Failed to destroy session:', error);
    }
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(gt(new Date(), userSessions.expiresAt));
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  // Destroy all sessions for a user (useful for logout all devices)
  static async destroyUserSessions(userId: number): Promise<void> {
    try {
      await db
        .update(userSessions)
        .set({ isActive: false })
        .where(eq(userSessions.userId, userId));
    } catch (error) {
      console.error('Failed to destroy user sessions:', error);
    }
  }
}

// Password reset functionality
export class PasswordReset {
  // Create password reset token
  static async createResetToken(email: string): Promise<string | null> {
    try {
      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return null; // Don't reveal if email exists
      }

      // Generate reset token
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });

      return token;
    } catch (error) {
      console.error('Failed to create reset token:', error);
      return null;
    }
  }

  // Validate reset token
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

      if (!resetToken) {
        return null;
      }

      return { userId: resetToken.userId };
    } catch (error) {
      console.error('Reset token validation error:', error);
      return null;
    }
  }

  // Reset password using token
  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Validate token
      const tokenData = await this.validateResetToken(token);
      if (!tokenData) {
        return false;
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, tokenData.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.token, token));

      // Destroy all sessions for this user (force re-login)
      await SessionManager.destroyUserSessions(tokenData.userId);

      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      return false;
    }
  }
}

// Enhanced authentication functions
export class AuthService {
  // Create user with password
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
      console.error('User creation error:', error);
      throw new Error('Failed to create user');
    }
  }

  // Validate password and return user
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

      // Update last login
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      return user;
    } catch (error) {
      console.error('Password validation error:', error);
      return null;
    }
  }

  // Get user by ID
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
      console.error('Get user error:', error);
      return null;
    }
  }
}

// Auth middleware
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
      
      req.userId = session.userId;
      next();
    })
    .catch(error => {
      console.error('Auth middleware error:', error);
      res.status(500).json({ message: "Authentication error" });
    });
}

// Setup auth routes
export function setupAuthRoutes(app: any) {
  // Login
  app.post('/api/auth/login', async (req: any, res: any) => {
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
      
      // Set secure cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Register
  app.post('/api/auth/register', async (req: any, res: any) => {
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
      
      // Set secure cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
      console.error('Registration error:', error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Logout
  app.post('/api/auth/logout', requireAuth, async (req: any, res: any) => {
    try {
      const sessionId = req.cookies?.sessionId;
      if (sessionId) {
        await SessionManager.destroySession(sessionId);
      }
      
      res.clearCookie('sessionId');
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: "Logout failed" });
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
      console.error('Get user error:', error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Request password reset
  app.post('/api/auth/reset-password-request', async (req: any, res: any) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const token = await PasswordReset.createResetToken(email);
      
      // Always return success to prevent email enumeration
      res.json({ 
        message: "If an account with that email exists, a reset link has been sent",
        token: token // In production, this would be sent via email
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ message: "Password reset request failed" });
    }
  });

  // Reset password
  app.post('/api/auth/reset-password', async (req: any, res: any) => {
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
      console.error('Password reset error:', error);
      res.status(500).json({ message: "Password reset failed" });
    }
  });
}

// Cleanup expired sessions periodically
setInterval(() => {
  SessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000); // Every hour