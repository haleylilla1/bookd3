import { db } from './db';
import { users, gigs, expenses, goals } from '../shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import * as archiver from 'archiver';

export interface UserBackupData {
  user: any;
  gigs: any[];
  expenses: any[];
  goals: any[];
  exportDate: string;
  version: string;
}

export class BackupManager {
  private backupDir = path.join(process.cwd(), 'backups');

  constructor() {
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory() {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a complete backup of a user's data
   */
  async createUserBackup(userId: number): Promise<UserBackupData> {
    try {
      console.log(`🔄 Creating backup for user ${userId}`);
      
      // Fetch all user data
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const [userGigs, userExpenses, userGoals] = await Promise.all([
        db.select().from(gigs).where(eq(gigs.userId, userId)),
        db.select().from(expenses).where(eq(expenses.userId, userId)),
        db.select().from(goals).where(eq(goals.userId, userId))
      ]);

      const backupData: UserBackupData = {
        user: {
          ...user,
          // Remove sensitive fields
          password: '[REDACTED]'
        },
        gigs: userGigs,
        expenses: userExpenses,
        goals: userGoals,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      console.log(`✅ Backup created for user ${userId}: ${userGigs.length} gigs, ${userExpenses.length} expenses`);
      return backupData;

    } catch (error) {
      console.error(`❌ Backup failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Export user data as downloadable JSON file
   */
  async exportUserData(userId: number): Promise<string> {
    const backupData = await this.createUserBackup(userId);
    const filename = `bookd-export-${userId}-${Date.now()}.json`;
    const filepath = path.join(this.backupDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
    console.log(`📁 User export saved: ${filepath}`);
    
    return filepath;
  }

  /**
   * Create compressed backup archive
   */
  async createBackupArchive(userId: number): Promise<string> {
    const backupData = await this.createUserBackup(userId);
    const filename = `bookd-backup-${userId}-${Date.now()}.zip`;
    const filepath = path.join(this.backupDir, filename);
    
    return new Promise((resolve, reject) => {
      const output = createWriteStream(filepath);
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        console.log(`📦 Backup archive created: ${filepath} (${archive.pointer()} bytes)`);
        resolve(filepath);
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      // Add JSON data to archive
      archive.append(JSON.stringify(backupData, null, 2), { name: 'backup.json' });
      
      // Add metadata
      archive.append(JSON.stringify({
        exportDate: new Date().toISOString(),
        userId,
        recordCounts: {
          gigs: backupData.gigs.length,
          expenses: backupData.expenses.length,
          goals: backupData.goals.length
        }
      }, null, 2), { name: 'metadata.json' });
      
      archive.finalize();
    });
  }

  /**
   * Validate backup data integrity
   */
  async validateBackup(backupData: UserBackupData): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check required fields
    if (!backupData.user || !backupData.user.id) {
      errors.push('Missing user data');
    }
    
    if (!Array.isArray(backupData.gigs)) {
      errors.push('Invalid gigs data');
    }
    
    if (!Array.isArray(backupData.expenses)) {
      errors.push('Invalid expenses data');
    }
    
    if (!backupData.exportDate) {
      errors.push('Missing export date');
    }
    
    // Check data consistency
    const userId = backupData.user?.id;
    if (userId) {
      const invalidGigs = backupData.gigs.filter(gig => gig.userId !== userId);
      if (invalidGigs.length > 0) {
        errors.push(`${invalidGigs.length} gigs belong to different user`);
      }
      
      const invalidExpenses = backupData.expenses.filter(expense => expense.userId !== userId);
      if (invalidExpenses.length > 0) {
        errors.push(`${invalidExpenses.length} expenses belong to different user`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Restore user data from backup (DANGEROUS - USE WITH CAUTION)
   */
  async restoreUserData(backupData: UserBackupData, targetUserId: number): Promise<void> {
    console.log(`⚠️  RESTORE OPERATION: Restoring data for user ${targetUserId}`);
    
    // Validate backup first
    const validation = await this.validateBackup(backupData);
    if (!validation.valid) {
      throw new Error(`Invalid backup data: ${validation.errors.join(', ')}`);
    }
    
    try {
      // Begin transaction-like operations
      console.log('🔄 Starting restore process...');
      
      // Clear existing data (DANGEROUS)
      await Promise.all([
        db.delete(gigs).where(eq(gigs.userId, targetUserId)),
        db.delete(expenses).where(eq(expenses.userId, targetUserId)),
        db.delete(goals).where(eq(goals.userId, targetUserId))
      ]);
      
      console.log('🗑️  Cleared existing data');
      
      // Restore data with updated user IDs
      const restorePromises = [];
      
      if (backupData.gigs.length > 0) {
        const gigsToRestore = backupData.gigs.map(gig => ({ ...gig, userId: targetUserId }));
        restorePromises.push(db.insert(gigs).values(gigsToRestore));
      }
      
      if (backupData.expenses.length > 0) {
        const expensesToRestore = backupData.expenses.map(expense => ({ ...expense, userId: targetUserId }));
        restorePromises.push(db.insert(expenses).values(expensesToRestore));
      }
      
      if (backupData.goals.length > 0) {
        const goalsToRestore = backupData.goals.map(goal => ({ ...goal, userId: targetUserId }));
        restorePromises.push(db.insert(goals).values(goalsToRestore));
      }
      

      
      await Promise.all(restorePromises);
      
      console.log(`✅ Restore completed for user ${targetUserId}`);
      console.log(`📊 Restored: ${backupData.gigs.length} gigs, ${backupData.expenses.length} expenses, ${backupData.goals.length} goals`);
      
    } catch (error) {
      console.error(`❌ Restore failed for user ${targetUserId}:`, error);
      throw error;
    }
  }

  /**
   * Get backup directory info and cleanup old backups
   */
  async getBackupInfo(): Promise<{ totalFiles: number; totalSize: number; oldestBackup: string | null }> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.includes('bookd-backup-') || f.includes('bookd-export-'));
      
      let totalSize = 0;
      let oldestBackup: string | null = null;
      let oldestTime = Infinity;
      
      for (const file of backupFiles) {
        const filepath = path.join(this.backupDir, file);
        const stats = await fs.stat(filepath);
        totalSize += stats.size;
        
        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          oldestBackup = file;
        }
      }
      
      return {
        totalFiles: backupFiles.length,
        totalSize,
        oldestBackup
      };
    } catch {
      return { totalFiles: 0, totalSize: 0, oldestBackup: null };
    }
  }

  /**
   * Cleanup old backup files (keep last 10 per user)
   */
  async cleanupOldBackups(maxFiles: number = 10): Promise<number> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.includes('bookd-backup-') || f.includes('bookd-export-'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: parseInt(f.split('-').pop()?.split('.')[0] || '0')
        }))
        .sort((a, b) => b.time - a.time);
      
      const filesToDelete = backupFiles.slice(maxFiles);
      
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`🗑️  Deleted old backup: ${file.name}`);
      }
      
      return filesToDelete.length;
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return 0;
    }
  }
}

export const backupManager = new BackupManager();