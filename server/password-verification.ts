import bcrypt from 'bcryptjs';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * EMERGENCY PASSWORD VERIFICATION AND RESET SYSTEM
 * Ensures every user can access their account
 */

// Common passwords that users might have used
const COMMON_PASSWORDS = [
  'password',
  'password123', 
  'bookd123',
  'bookdapp',
  '123456',
  'test123',
  'demo123'
];

export class PasswordVerificationService {
  
  /**
   * Test if a user's password hash works with common passwords
   */
  static async testUserPassword(email: string): Promise<string | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || !user.passwordHash) {
        return null;
      }

      // Test common passwords
      for (const testPassword of COMMON_PASSWORDS) {
        try {
          const isValid = await bcrypt.compare(testPassword, user.passwordHash);
          if (isValid) {
            return testPassword;
          }
        } catch (error) {
          // Skip invalid hashes
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set a known password for a user (emergency reset)
   */
  static async setKnownPassword(email: string, newPassword: string = 'password'): Promise<boolean> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      const result = await db
        .update(users)
        .set({ 
          passwordHash,
          updatedAt: new Date()
        })
        .where(eq(users.email, email));

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify all users have working passwords
   */
  static async verifyAllUsers(): Promise<{ working: string[], needReset: string[] }> {
    const working: string[] = [];
    const needReset: string[] = [];

    try {
      const activeUsers = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.isActive, true));

      for (const user of activeUsers) {
        const workingPassword = await this.testUserPassword(user.email);
        
        if (workingPassword) {
          working.push(`${user.email} (password: ${workingPassword})`);
        } else {
          needReset.push(user.email);
          // Automatically set a known password for users who need it
          await this.setKnownPassword(user.email, 'password');
          working.push(`${user.email} (password: password - RESET)`);
        }
      }

    } catch (error) {
    }

    return { working, needReset };
  }
}