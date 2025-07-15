import { db } from './db';
import { logger } from './logger';
import fs from 'fs/promises';
import path from 'path';

interface BackupResult {
  success: boolean;
  message: string;
  filePath?: string;
  size?: number;
}

export class SimpleBackupSystem {
  private backupDir: string;
  private maxBackups: number = 5;
  private isBackupRunning: boolean = false;

  constructor() {
    this.backupDir = path.join(process.cwd(), 'data-backups');
    this.ensureBackupDir();
  }

  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create backup directory', { error: error.message });
    }
  }

  /**
   * Create a simple JSON backup of critical data
   */
  async createBackup(): Promise<BackupResult> {
    if (this.isBackupRunning) {
      return { success: false, message: 'Backup already in progress' };
    }

    this.isBackupRunning = true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      logger.info('Starting data backup', { timestamp });

      // Get all critical data
      const [users, gigs, expenses, goals, monthlyGoals, yearlyGoals] = await Promise.all([
        db.query.users.findMany(),
        db.query.gigs.findMany(),
        db.query.expenses.findMany(),
        db.query.goals.findMany(),
        db.query.monthlyGoals.findMany(),
        db.query.yearlyGoals.findMany()
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          users,
          gigs,
          expenses,
          goals,
          monthlyGoals,
          yearlyGoals
        },
        stats: {
          userCount: users.length,
          gigCount: gigs.length,
          expenseCount: expenses.length,
          goalCount: goals.length
        }
      };

      // Save backup file
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));

      // Get file size
      const stats = await fs.stat(backupPath);

      // Cleanup old backups
      await this.cleanupOldBackups();

      logger.info('Data backup completed', {
        fileName: backupFileName,
        size: stats.size,
        records: backupData.stats
      });

      return {
        success: true,
        message: 'Backup completed successfully',
        filePath: backupPath,
        size: stats.size
      };
    } catch (error) {
      logger.error('Data backup failed', { error: error.message });
      
      // Clean up failed backup
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      return {
        success: false,
        message: `Backup failed: ${error.message}`
      };
    } finally {
      this.isBackupRunning = false;
    }
  }



  /**
   * Clean up old backups (keep only maxBackups)
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.json'));
      
      if (backupFiles.length <= this.maxBackups) {
        return;
      }

      // Sort by creation time (oldest first)
      const fileStats = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );

      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // Remove oldest backups
      const toDelete = fileStats.slice(0, fileStats.length - this.maxBackups);
      
      for (const { file } of toDelete) {
        await fs.unlink(path.join(this.backupDir, file));
        logger.info('Removed old backup', { file });
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', { error: error.message });
    }
  }

  /**
   * Get simple backup info
   */
  async getBackupInfo(): Promise<{ count: number; lastBackup: string | null; totalSize: number }> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.json'));
      
      if (backupFiles.length === 0) {
        return { count: 0, lastBackup: null, totalSize: 0 };
      }

      let totalSize = 0;
      let lastBackup = null;
      let newestTime = 0;

      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          lastBackup = stats.mtime.toISOString();
        }
      }

      return { count: backupFiles.length, lastBackup, totalSize };
    } catch (error) {
      logger.error('Failed to get backup info', { error: error.message });
      return { count: 0, lastBackup: null, totalSize: 0 };
    }
  }

  /**
   * Start automatic backup scheduler - simple daily backups
   */
  startBackupScheduler(): void {
    // Create initial backup after 1 minute
    setTimeout(() => {
      this.createBackup().then(result => {
        if (result.success) {
          logger.info('Initial backup completed');
        } else {
          logger.error('Initial backup failed', { message: result.message });
        }
      });
    }, 60000);

    // Schedule daily backups
    setInterval(async () => {
      const result = await this.createBackup();
      if (!result.success) {
        logger.error('Scheduled backup failed', { message: result.message });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    logger.info('Backup scheduler started - daily backups enabled');
  }

  /**
   * Create emergency backup before critical operations
   */
  async createEmergencyBackup(reason: string): Promise<BackupResult> {
    logger.info('Creating emergency backup', { reason });
    const result = await this.createBackup();
    
    if (result.success) {
      logger.info('Emergency backup completed', { reason });
    } else {
      logger.error('Emergency backup failed', { reason, message: result.message });
    }
    
    return result;
  }
}

// Export singleton instance
export const backupSystem = new SimpleBackupSystem();