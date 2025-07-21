import { db } from './db';
import { logger } from './logger';
import { backupSystem } from './backup-system';
import { users, gigs, expenses } from '@shared/schema';
import { eq, count, sql } from 'drizzle-orm';

interface SimpleHealthCheck {
  healthy: boolean;
  message: string;
  userCount: number;
  gigCount: number;
  expenseCount: number;
  lastChecked: string;
}

export class SimpleIntegrityChecker {
  /**
   * Run basic database health check
   */
  async checkHealth(): Promise<SimpleHealthCheck> {
    try {
      logger.info('Running database health check');

      // Get basic counts
      const [userCount, gigCount, expenseCount] = await Promise.all([
        db.select({ count: count() }).from(users).then(r => r[0].count),
        db.select({ count: count() }).from(gigs).then(r => r[0].count),
        db.select({ count: count() }).from(expenses).then(r => r[0].count)
      ]);

      // Check for basic issues
      const issues: string[] = [];

      // Check for orphaned gigs
      const orphanedGigs = await db
        .select({ count: count() })
        .from(gigs)
        .leftJoin(users, eq(gigs.userId, users.id))
        .where(sql`${users.id} IS NULL`)
        .then(r => r[0].count);

      if (orphanedGigs > 0) {
        issues.push(`${orphanedGigs} orphaned gigs`);
      }

      // Check for orphaned expenses
      const orphanedExpenses = await db
        .select({ count: count() })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(sql`${users.id} IS NULL`)
        .then(r => r[0].count);

      if (orphanedExpenses > 0) {
        issues.push(`${orphanedExpenses} orphaned expenses`);
      }

      const healthy = issues.length === 0;
      const message = healthy 
        ? 'Database is healthy'
        : `Issues found: ${issues.join(', ')}`;

      logger.info('Database health check completed', {
        healthy,
        userCount,
        gigCount,
        expenseCount,
        issues: issues.length
      });

      return {
        healthy,
        message,
        userCount,
        gigCount,
        expenseCount,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        healthy: false,
        message: `Health check failed: ${error.message}`,
        userCount: 0,
        gigCount: 0,
        expenseCount: 0,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Fix orphaned records automatically
   */
  async fixOrphanedRecords(): Promise<{ fixed: boolean; message: string }> {
    try {
      // Create backup before fixing
      const backupResult = await backupSystem.createEmergencyBackup('Fix orphaned records');
      if (!backupResult.success) {
        return { fixed: false, message: 'Failed to create backup before fixing' };
      }

      // Remove orphaned gigs
      const deletedGigs = await db
        .delete(gigs)
        .where(sql`user_id NOT IN (SELECT id FROM users)`)
        .returning({ id: gigs.id });

      // Remove orphaned expenses
      const deletedExpenses = await db
        .delete(expenses)
        .where(sql`user_id NOT IN (SELECT id FROM users)`)
        .returning({ id: expenses.id });

      const totalFixed = deletedGigs.length + deletedExpenses.length;

      if (totalFixed > 0) {
        logger.info('Fixed orphaned records', {
          gigs: deletedGigs.length,
          expenses: deletedExpenses.length,
          total: totalFixed
        });
      }

      return {
        fixed: true,
        message: totalFixed > 0 
          ? `Fixed ${totalFixed} orphaned records`
          : 'No orphaned records found'
      };
    } catch (error) {
      logger.error('Failed to fix orphaned records', { error: error.message });
      return { fixed: false, message: `Fix failed: ${error.message}` };
    }
  }

  /**
   * Quick backup before critical operations
   */
  async safeOperation(operation: () => Promise<void>, reason: string): Promise<{ success: boolean; message: string }> {
    try {
      // Create backup first
      const backupResult = await backupSystem.createEmergencyBackup(reason);
      if (!backupResult.success) {
        return { success: false, message: 'Failed to create safety backup' };
      }

      // Run the operation
      await operation();

      return { success: true, message: 'Operation completed successfully' };
    } catch (error) {
      logger.error('Safe operation failed', { error: error.message, reason });
      return { success: false, message: `Operation failed: ${error.message}` };
    }
  }

}

// Export singleton instance
export const integrityChecker = new SimpleIntegrityChecker();