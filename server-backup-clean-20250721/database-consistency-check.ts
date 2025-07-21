/**
 * Database Consistency Validation System
 * Prevents field naming mismatches that can break data visibility
 */

import { db } from './db';
import { gigs, users, monthlyGoals, weeklyGoals, yearlyGoals } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface ConsistencyCheck {
  table: string;
  description: string;
  check: () => Promise<boolean>;
  fix?: () => Promise<void>;
}

export class DatabaseConsistencyValidator {
  private checks: ConsistencyCheck[] = [
    {
      table: 'gigs',
      description: 'Verify gigs.userId field mapping works correctly',
      check: async () => {
        try {
          // Test that we can query by userId and get results
          const testGigs = await db.select().from(gigs).limit(1);
          if (testGigs.length === 0) return true; // No data to check
          
          const firstGig = testGigs[0];
          const userId = firstGig.userId;
          
          // Verify we can query by this userId
          const userGigs = await db.select().from(gigs)
            .where(eq(gigs.userId, userId))
            .limit(1);
          
          return userGigs.length > 0;
        } catch (error) {
          console.error('Gigs field mapping check failed:', error);
          return false;
        }
      }
    },
    {
      table: 'users',
      description: 'Verify users table authentication fields work',
      check: async () => {
        try {
          const testUsers = await db.select().from(users).limit(1);
          if (testUsers.length === 0) return true;
          
          const firstUser = testUsers[0];
          // Verify required auth fields exist
          return firstUser.email !== undefined && 
                 firstUser.passwordHash !== undefined &&
                 firstUser.id !== undefined;
        } catch (error) {
          console.error('Users field mapping check failed:', error);
          return false;
        }
      }
    },
    {
      table: 'goals',
      description: 'Verify goals tables userId mapping works',
      check: async () => {
        try {
          // Check monthly goals
          const monthlyTest = await db.select().from(monthlyGoals).limit(1);
          if (monthlyTest.length > 0) {
            const monthlyGoal = monthlyTest[0];
            const userGoals = await db.select().from(monthlyGoals)
              .where(eq(monthlyGoals.userId, monthlyGoal.userId))
              .limit(1);
            if (userGoals.length === 0) return false;
          }
          
          // Check yearly goals
          const yearlyTest = await db.select().from(yearlyGoals).limit(1);
          if (yearlyTest.length > 0) {
            const yearlyGoal = yearlyTest[0];
            const userYearlyGoals = await db.select().from(yearlyGoals)
              .where(eq(yearlyGoals.userId, yearlyGoal.userId))
              .limit(1);
            if (userYearlyGoals.length === 0) return false;
          }
          
          return true;
        } catch (error) {
          console.error('Goals field mapping check failed:', error);
          return false;
        }
      }
    }
  ];

  async runAllChecks(): Promise<{ passed: boolean; results: Array<{ table: string; description: string; passed: boolean; error?: string }> }> {
    const results = [];
    let allPassed = true;

    for (const check of this.checks) {
      try {
        const passed = await check.check();
        results.push({
          table: check.table,
          description: check.description,
          passed
        });
        if (!passed) allPassed = false;
      } catch (error) {
        results.push({
          table: check.table,
          description: check.description,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        allPassed = false;
      }
    }

    return { passed: allPassed, results };
  }

  async validateUserDataAccess(userId: number): Promise<boolean> {
    try {
      // Test that user can access their own data
      const userGigs = await db.select().from(gigs)
        .where(eq(gigs.userId, userId))
        .limit(1);
      
      // This should not throw an error
      return true;
    } catch (error) {
      console.error(`User ${userId} data access validation failed:`, error);
      return false;
    }
  }
}

export const dbValidator = new DatabaseConsistencyValidator();