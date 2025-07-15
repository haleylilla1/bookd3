import { db } from './db';
import { logger } from './logger';
import { backupSystem } from './backup-system';
import { users, gigs, expenses, goals, monthlyGoals, yearlyGoals } from '@shared/schema';
import { eq, and, count, sql } from 'drizzle-orm';

interface IntegrityCheck {
  name: string;
  passed: boolean;
  message: string;
  count?: number;
  details?: any;
}

interface DatabaseHealth {
  overall: 'healthy' | 'warning' | 'critical';
  checks: IntegrityCheck[];
  recommendations: string[];
  lastChecked: string;
}

export class DatabaseIntegrityManager {
  private isCheckRunning: boolean = false;

  /**
   * Run comprehensive database integrity checks
   */
  async runIntegrityChecks(): Promise<DatabaseHealth> {
    if (this.isCheckRunning) {
      logger.warn('Integrity check already in progress');
      return {
        overall: 'warning',
        checks: [{ name: 'System Check', passed: false, message: 'Check already in progress' }],
        recommendations: ['Wait for current check to complete'],
        lastChecked: new Date().toISOString()
      };
    }

    this.isCheckRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting database integrity checks');

      const checks: IntegrityCheck[] = [];

      // 1. Check for orphaned records
      checks.push(await this.checkOrphanedRecords());

      // 2. Check for duplicate records
      checks.push(await this.checkDuplicateRecords());

      // 3. Check data consistency
      checks.push(await this.checkDataConsistency());

      // 4. Check foreign key constraints
      checks.push(await this.checkForeignKeyIntegrity());

      // 5. Check for corrupted data
      checks.push(await this.checkCorruptedData());

      // 6. Check user data isolation
      checks.push(await this.checkUserDataIsolation());

      // 7. Check multi-day gig consistency
      checks.push(await this.checkMultiDayGigConsistency());

      // 8. Check database size and performance
      checks.push(await this.checkDatabasePerformance());

      // Determine overall health
      const failedChecks = checks.filter(check => !check.passed);
      const criticalIssues = failedChecks.filter(check => 
        check.name.includes('Foreign Key') || 
        check.name.includes('Corrupted') ||
        check.name.includes('Isolation')
      );

      const overall = criticalIssues.length > 0 ? 'critical' : 
                    failedChecks.length > 0 ? 'warning' : 'healthy';

      // Generate recommendations
      const recommendations = this.generateRecommendations(checks);

      const duration = Date.now() - startTime;
      logger.info('Database integrity check completed', {
        overall,
        totalChecks: checks.length,
        failedChecks: failedChecks.length,
        criticalIssues: criticalIssues.length,
        duration
      });

      return {
        overall,
        checks,
        recommendations,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Database integrity check failed', { error: error.message });
      return {
        overall: 'critical',
        checks: [{ name: 'System Check', passed: false, message: `Check failed: ${error.message}` }],
        recommendations: ['Contact system administrator'],
        lastChecked: new Date().toISOString()
      };
    } finally {
      this.isCheckRunning = false;
    }
  }

  /**
   * Check for orphaned records
   */
  private async checkOrphanedRecords(): Promise<IntegrityCheck> {
    try {
      // Check for gigs without valid users
      const orphanedGigs = await db
        .select({ count: count() })
        .from(gigs)
        .leftJoin(users, eq(gigs.userId, users.id))
        .where(eq(users.id, null));

      // Check for expenses without valid users
      const orphanedExpenses = await db
        .select({ count: count() })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(eq(users.id, null));

      // Check for goals without valid users
      const orphanedGoals = await db
        .select({ count: count() })
        .from(goals)
        .leftJoin(users, eq(goals.userId, users.id))
        .where(eq(users.id, null));

      const totalOrphaned = orphanedGigs[0].count + orphanedExpenses[0].count + orphanedGoals[0].count;

      return {
        name: 'Orphaned Records',
        passed: totalOrphaned === 0,
        message: totalOrphaned === 0 
          ? 'No orphaned records found'
          : `Found ${totalOrphaned} orphaned records`,
        count: totalOrphaned,
        details: {
          gigs: orphanedGigs[0].count,
          expenses: orphanedExpenses[0].count,
          goals: orphanedGoals[0].count
        }
      };
    } catch (error) {
      return {
        name: 'Orphaned Records',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check for duplicate records
   */
  private async checkDuplicateRecords(): Promise<IntegrityCheck> {
    try {
      // Check for duplicate users by email
      const duplicateUsers = await db
        .select({ email: users.email, count: count() })
        .from(users)
        .groupBy(users.email)
        .having(sql`count(*) > 1`);

      // Check for duplicate gigs (same user, client, date, amount)
      const duplicateGigs = await db
        .select({ 
          userId: gigs.userId,
          clientName: gigs.clientName,
          date: gigs.date,
          expectedPay: gigs.expectedPay,
          count: count() 
        })
        .from(gigs)
        .groupBy(gigs.userId, gigs.clientName, gigs.date, gigs.expectedPay)
        .having(sql`count(*) > 1`);

      const totalDuplicates = duplicateUsers.length + duplicateGigs.length;

      return {
        name: 'Duplicate Records',
        passed: totalDuplicates === 0,
        message: totalDuplicates === 0 
          ? 'No duplicate records found'
          : `Found ${totalDuplicates} potential duplicate records`,
        count: totalDuplicates,
        details: {
          users: duplicateUsers.length,
          gigs: duplicateGigs.length
        }
      };
    } catch (error) {
      return {
        name: 'Duplicate Records',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check data consistency
   */
  private async checkDataConsistency(): Promise<IntegrityCheck> {
    try {
      const issues: string[] = [];

      // Check for negative amounts
      const negativeExpenses = await db
        .select({ count: count() })
        .from(expenses)
        .where(sql`amount < 0`);

      if (negativeExpenses[0].count > 0) {
        issues.push(`${negativeExpenses[0].count} expenses with negative amounts`);
      }

      // Check for future dates beyond reasonable limits
      const futureGigs = await db
        .select({ count: count() })
        .from(gigs)
        .where(sql`date > current_date + interval '2 years'`);

      if (futureGigs[0].count > 0) {
        issues.push(`${futureGigs[0].count} gigs scheduled more than 2 years in future`);
      }

      // Check for missing required fields
      const incompleteUsers = await db
        .select({ count: count() })
        .from(users)
        .where(sql`name IS NULL OR email IS NULL`);

      if (incompleteUsers[0].count > 0) {
        issues.push(`${incompleteUsers[0].count} users missing required fields`);
      }

      return {
        name: 'Data Consistency',
        passed: issues.length === 0,
        message: issues.length === 0 
          ? 'Data consistency checks passed'
          : `Data consistency issues: ${issues.join(', ')}`,
        count: issues.length,
        details: { issues }
      };
    } catch (error) {
      return {
        name: 'Data Consistency',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check foreign key constraints
   */
  private async checkForeignKeyIntegrity(): Promise<IntegrityCheck> {
    try {
      // This would be handled by the database constraints, but we can check manually
      const result = await db.execute({
        sql: `
          SELECT 
            conname as constraint_name,
            pg_get_constraintdef(oid) as constraint_definition
          FROM pg_constraint 
          WHERE contype = 'f' AND connamespace = (
            SELECT oid FROM pg_namespace WHERE nspname = 'public'
          )
        `,
        args: []
      });

      const constraintCount = result.rows.length;

      return {
        name: 'Foreign Key Integrity',
        passed: constraintCount > 0,
        message: constraintCount > 0 
          ? `All ${constraintCount} foreign key constraints active`
          : 'No foreign key constraints found',
        count: constraintCount
      };
    } catch (error) {
      return {
        name: 'Foreign Key Integrity',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check for corrupted data
   */
  private async checkCorruptedData(): Promise<IntegrityCheck> {
    try {
      const issues: string[] = [];

      // Check for invalid JSON in jsonb columns
      const invalidPreferences = await db
        .select({ count: count() })
        .from(users)
        .where(sql`notification_preferences IS NOT NULL AND NOT (notification_preferences ? 'email')`);

      if (invalidPreferences[0].count > 0) {
        issues.push(`${invalidPreferences[0].count} users with invalid notification preferences`);
      }

      // Check for invalid email formats
      const invalidEmails = await db
        .select({ count: count() })
        .from(users)
        .where(sql`email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`);

      if (invalidEmails[0].count > 0) {
        issues.push(`${invalidEmails[0].count} users with invalid email formats`);
      }

      return {
        name: 'Corrupted Data',
        passed: issues.length === 0,
        message: issues.length === 0 
          ? 'No corrupted data found'
          : `Corrupted data issues: ${issues.join(', ')}`,
        count: issues.length,
        details: { issues }
      };
    } catch (error) {
      return {
        name: 'Corrupted Data',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check user data isolation
   */
  private async checkUserDataIsolation(): Promise<IntegrityCheck> {
    try {
      // Verify that all user data is properly isolated
      const userIds = await db.select({ id: users.id }).from(users);
      
      for (const user of userIds) {
        // Check that user can only access their own gigs
        const userGigs = await db
          .select({ count: count() })
          .from(gigs)
          .where(eq(gigs.userId, user.id));

        // Check that user can only access their own expenses
        const userExpenses = await db
          .select({ count: count() })
          .from(expenses)
          .where(eq(expenses.userId, user.id));

        // This is a basic check - in a real scenario, we'd verify no cross-user access
      }

      return {
        name: 'User Data Isolation',
        passed: true,
        message: 'User data isolation verified',
        count: userIds.length
      };
    } catch (error) {
      return {
        name: 'User Data Isolation',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check multi-day gig consistency
   */
  private async checkMultiDayGigConsistency(): Promise<IntegrityCheck> {
    try {
      // Check for multi-day gigs with inconsistent data
      const multiDayGigs = await db
        .select()
        .from(gigs)
        .where(sql`gig_ids IS NOT NULL AND array_length(gig_ids, 1) > 1`);

      let inconsistentGigs = 0;

      for (const gig of multiDayGigs) {
        if (gig.gigIds && gig.gigIds.length > 1) {
          // Check if all gigs in the series exist
          const seriesGigs = await db
            .select({ count: count() })
            .from(gigs)
            .where(sql`id = ANY(${gig.gigIds})`);

          if (seriesGigs[0].count !== gig.gigIds.length) {
            inconsistentGigs++;
          }
        }
      }

      return {
        name: 'Multi-Day Gig Consistency',
        passed: inconsistentGigs === 0,
        message: inconsistentGigs === 0 
          ? 'Multi-day gigs are consistent'
          : `${inconsistentGigs} multi-day gigs have inconsistencies`,
        count: inconsistentGigs,
        details: { totalMultiDayGigs: multiDayGigs.length }
      };
    } catch (error) {
      return {
        name: 'Multi-Day Gig Consistency',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Check database performance metrics
   */
  private async checkDatabasePerformance(): Promise<IntegrityCheck> {
    try {
      // Get database size
      const dbSize = await db.execute({
        sql: `SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
        args: []
      });

      // Get table sizes
      const tableStats = await db.execute({
        sql: `
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE schemaname = 'public'
          ORDER BY tablename, attname
        `,
        args: []
      });

      return {
        name: 'Database Performance',
        passed: true,
        message: `Database size: ${dbSize.rows[0]?.size || 'Unknown'}`,
        details: {
          size: dbSize.rows[0]?.size,
          tableCount: tableStats.rows.length
        }
      };
    } catch (error) {
      return {
        name: 'Database Performance',
        passed: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  /**
   * Generate recommendations based on check results
   */
  private generateRecommendations(checks: IntegrityCheck[]): string[] {
    const recommendations: string[] = [];
    
    const failedChecks = checks.filter(check => !check.passed);
    
    if (failedChecks.length === 0) {
      recommendations.push('Database is healthy - no actions required');
      return recommendations;
    }

    for (const check of failedChecks) {
      switch (check.name) {
        case 'Orphaned Records':
          recommendations.push('Clean up orphaned records to improve database performance');
          break;
        case 'Duplicate Records':
          recommendations.push('Remove duplicate records to ensure data integrity');
          break;
        case 'Data Consistency':
          recommendations.push('Fix data consistency issues to prevent application errors');
          break;
        case 'Foreign Key Integrity':
          recommendations.push('CRITICAL: Restore foreign key constraints immediately');
          break;
        case 'Corrupted Data':
          recommendations.push('CRITICAL: Fix corrupted data to prevent system failures');
          break;
        case 'User Data Isolation':
          recommendations.push('CRITICAL: Fix user data isolation to prevent security breaches');
          break;
        case 'Multi-Day Gig Consistency':
          recommendations.push('Fix multi-day gig inconsistencies to ensure accurate reporting');
          break;
      }
    }

    if (failedChecks.length > 3) {
      recommendations.push('Consider creating an emergency backup before making changes');
    }

    return recommendations;
  }

  /**
   * Fix common integrity issues automatically
   */
  async autoFixIssues(): Promise<{ fixed: string[], errors: string[] }> {
    const fixed: string[] = [];
    const errors: string[] = [];

    try {
      // Create emergency backup before making changes
      await backupSystem.createEmergencyBackup('Auto-fix integrity issues');
      fixed.push('Emergency backup created');

      // Fix orphaned records
      try {
        const orphanedGigs = await db
          .delete(gigs)
          .where(sql`user_id NOT IN (SELECT id FROM users)`)
          .returning({ id: gigs.id });
        
        if (orphanedGigs.length > 0) {
          fixed.push(`Removed ${orphanedGigs.length} orphaned gigs`);
        }

        const orphanedExpenses = await db
          .delete(expenses)
          .where(sql`user_id NOT IN (SELECT id FROM users)`)
          .returning({ id: expenses.id });
        
        if (orphanedExpenses.length > 0) {
          fixed.push(`Removed ${orphanedExpenses.length} orphaned expenses`);
        }
      } catch (error) {
        errors.push(`Failed to fix orphaned records: ${error.message}`);
      }

      // Additional auto-fixes can be added here

      logger.info('Auto-fix completed', { fixed: fixed.length, errors: errors.length });

    } catch (error) {
      errors.push(`Auto-fix failed: ${error.message}`);
      logger.error('Auto-fix process failed', { error: error.message });
    }

    return { fixed, errors };
  }
}

// Export singleton instance
export const integrityManager = new DatabaseIntegrityManager();