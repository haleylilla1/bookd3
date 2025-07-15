import { db } from './db';
import { logger } from './logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

interface BackupMetadata {
  timestamp: string;
  size: number;
  checksum: string;
  version: string;
  tableCount: number;
  userCount: number;
  gigCount: number;
  expenseCount: number;
}

interface BackupStats {
  totalBackups: number;
  lastBackup: string | null;
  backupSizes: number[];
  oldestBackup: string | null;
  newestBackup: string | null;
}

export class DatabaseBackupSystem {
  private backupDir: string;
  private maxBackups: number;
  private backupInterval: number; // in hours
  private isBackupRunning: boolean = false;

  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.maxBackups = 10; // Keep 10 most recent backups
    this.backupInterval = 6; // Backup every 6 hours
    this.initializeBackupDirectory();
  }

  private async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      logger.info('Backup directory initialized', { path: this.backupDir });
    } catch (error) {
      logger.error('Failed to initialize backup directory', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a complete database backup
   */
  async createBackup(): Promise<string> {
    if (this.isBackupRunning) {
      logger.warn('Backup already in progress, skipping');
      return '';
    }

    this.isBackupRunning = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `bookd_backup_${timestamp}.sql`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      logger.info('Starting database backup', { timestamp, backupPath });

      // Get database URL
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      // Create backup using pg_dump
      const command = `pg_dump "${databaseUrl}" > "${backupPath}"`;
      await execAsync(command);

      // Verify backup file was created
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      // Calculate checksum
      const backupContent = await fs.readFile(backupPath);
      const checksum = createHash('sha256').update(backupContent).digest('hex');

      // Get database statistics
      const metadata = await this.getBackupMetadata(checksum, stats.size);
      await this.saveBackupMetadata(backupFileName, metadata);

      // Clean up old backups
      await this.cleanupOldBackups();

      const duration = Date.now() - startTime;
      logger.info('Database backup completed successfully', {
        fileName: backupFileName,
        size: stats.size,
        duration,
        checksum: checksum.substring(0, 16),
        ...metadata
      });

      return backupPath;
    } catch (error) {
      logger.error('Database backup failed', { error: error.message, timestamp });
      
      // Clean up failed backup file
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        logger.error('Failed to cleanup failed backup file', { error: cleanupError.message });
      }
      
      throw error;
    } finally {
      this.isBackupRunning = false;
    }
  }

  /**
   * Get metadata for the backup
   */
  private async getBackupMetadata(checksum: string, size: number): Promise<BackupMetadata> {
    try {
      // Get table counts
      const userCount = await db.query.users.findMany().then(users => users.length);
      const gigCount = await db.query.gigs.findMany().then(gigs => gigs.length);
      const expenseCount = await db.query.expenses.findMany().then(expenses => expenses.length);

      // Get table count from information schema
      const tableCountResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`,
        args: []
      });
      const tableCount = Number(tableCountResult.rows[0]?.count || 0);

      return {
        timestamp: new Date().toISOString(),
        size,
        checksum,
        version: '1.0.0',
        tableCount,
        userCount,
        gigCount,
        expenseCount
      };
    } catch (error) {
      logger.error('Failed to get backup metadata', { error: error.message });
      return {
        timestamp: new Date().toISOString(),
        size,
        checksum,
        version: '1.0.0',
        tableCount: 0,
        userCount: 0,
        gigCount: 0,
        expenseCount: 0
      };
    }
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(fileName: string, metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this.backupDir, `${fileName}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Clean up old backups (keep only maxBackups)
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.sql'));
      
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
        const backupPath = path.join(this.backupDir, file);
        const metadataPath = path.join(this.backupDir, `${file}.metadata.json`);
        
        await fs.unlink(backupPath);
        try {
          await fs.unlink(metadataPath);
        } catch (error) {
          // Metadata file might not exist, ignore error
        }
        
        logger.info('Removed old backup', { file });
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', { error: error.message });
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<BackupStats> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.sql'));
      
      if (backupFiles.length === 0) {
        return {
          totalBackups: 0,
          lastBackup: null,
          backupSizes: [],
          oldestBackup: null,
          newestBackup: null
        };
      }

      const fileStats = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime, size: stats.size };
        })
      );

      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      return {
        totalBackups: backupFiles.length,
        lastBackup: fileStats[fileStats.length - 1].mtime.toISOString(),
        backupSizes: fileStats.map(f => f.size),
        oldestBackup: fileStats[0].mtime.toISOString(),
        newestBackup: fileStats[fileStats.length - 1].mtime.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get backup stats', { error: error.message });
      return {
        totalBackups: 0,
        lastBackup: null,
        backupSizes: [],
        oldestBackup: null,
        newestBackup: null
      };
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupFileName: string): Promise<boolean> {
    const backupPath = path.join(this.backupDir, backupFileName);
    
    try {
      // Verify backup file exists
      await fs.access(backupPath);
      
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      logger.info('Starting database restore', { backupFileName });

      // Create restore command
      const command = `psql "${databaseUrl}" < "${backupPath}"`;
      await execAsync(command);

      logger.info('Database restore completed successfully', { backupFileName });
      return true;
    } catch (error) {
      logger.error('Database restore failed', { error: error.message, backupFileName });
      return false;
    }
  }

  /**
   * Start automatic backup scheduler
   */
  startBackupScheduler(): void {
    // Create initial backup on startup
    setTimeout(() => {
      this.createBackup().catch(error => {
        logger.error('Initial backup failed', { error: error.message });
      });
    }, 30000); // Wait 30 seconds after startup

    // Schedule regular backups
    setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        logger.error('Scheduled backup failed', { error: error.message });
      }
    }, this.backupInterval * 60 * 60 * 1000); // Convert hours to milliseconds

    logger.info('Backup scheduler started', {
      interval: `${this.backupInterval} hours`,
      maxBackups: this.maxBackups
    });
  }

  /**
   * Create emergency backup (for critical operations)
   */
  async createEmergencyBackup(reason: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `emergency_backup_${timestamp}.sql`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      logger.info('Creating emergency backup', { reason, timestamp });

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not found');
      }

      const command = `pg_dump "${databaseUrl}" > "${backupPath}"`;
      await execAsync(command);

      // Verify backup
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Emergency backup file is empty');
      }

      logger.info('Emergency backup created successfully', {
        fileName: backupFileName,
        size: stats.size,
        reason
      });

      return backupPath;
    } catch (error) {
      logger.error('Emergency backup failed', { error: error.message, reason });
      throw error;
    }
  }
}

// Export singleton instance
export const backupSystem = new DatabaseBackupSystem();