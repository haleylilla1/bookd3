/**
 * FIELD MAPPING VALIDATION SYSTEM
 * Prevents future database field mapping issues that cause data access failures
 */

import { db } from "./db";
import { users, gigs, goals, monthlyGoals, yearlyGoals } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ValidationResult {
  table: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
  details?: any;
}

/**
 * Validates that schema field mappings work with actual database queries
 */
export class FieldMappingValidator {
  static async validateAllTables(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    console.log('[STARTUP] Running database consistency validation...');
    
    try {
      // Test users table field mapping
      await this.testUsersTable(results);
      
      // Test gigs table field mapping  
      await this.testGigsTable(results);
      
      // Test goals tables field mapping
      await this.testGoalsTables(results);
      
      // Summary
      const errors = results.filter(r => r.status === 'error');
      const warnings = results.filter(r => r.status === 'warning');
      
      if (errors.length > 0) {
        console.error('[STARTUP] ❌ CRITICAL: Database field mapping errors detected:');
        errors.forEach(e => console.error(`  - ${e.table}: ${e.message}`));
        throw new Error('Database field mapping validation failed');
      }
      
      if (warnings.length > 0) {
        console.warn('[STARTUP] ⚠️ Database field mapping warnings:');
        warnings.forEach(w => console.warn(`  - ${w.table}: ${w.message}`));
      }
      
      console.log('[STARTUP] ✓ All database consistency checks passed');
      
    } catch (error) {
      console.error('[STARTUP] Database validation failed:', error);
      results.push({
        table: 'system',
        status: 'error',
        message: `Validation system failure: ${error.message}`
      });
    }
    
    return results;
  }
  
  private static async testUsersTable(results: ValidationResult[]): Promise<void> {
    try {
      // Test basic user query with schema fields
      const testUser = await db.select({
        id: users.id,
        email: users.email,
        name: users.name
      }).from(users).limit(1);
      
      results.push({
        table: 'users',
        status: 'pass',
        message: 'Schema field mapping validated successfully'
      });
      
    } catch (error) {
      results.push({
        table: 'users',
        status: 'error',
        message: `User table field mapping failed: ${error.message}`
      });
    }
  }
  
  private static async testGigsTable(results: ValidationResult[]): Promise<void> {
    try {
      // Test critical gig query with userId field mapping
      const testGig = await db.select({
        id: gigs.id,
        userId: gigs.userId,
        gigType: gigs.gigType,
        clientName: gigs.clientName
      }).from(gigs).limit(1);
      
      // Test the critical userId WHERE clause that was failing
      if (testGig.length > 0) {
        const userIdTest = await db.select()
          .from(gigs)
          .where(eq(gigs.userId, testGig[0].userId))
          .limit(1);
          
        if (userIdTest.length === 0) {
          results.push({
            table: 'gigs',
            status: 'error',
            message: 'userId field mapping broken - WHERE clause fails'
          });
        } else {
          results.push({
            table: 'gigs',
            status: 'pass',
            message: 'Gig userId field mapping validated successfully'
          });
        }
      } else {
        results.push({
          table: 'gigs',
          status: 'warning',
          message: 'No gigs in database to test field mapping'
        });
      }
      
    } catch (error) {
      results.push({
        table: 'gigs',
        status: 'error',
        message: `Gig table field mapping failed: ${error.message}`
      });
    }
  }
  
  private static async testGoalsTables(results: ValidationResult[]): Promise<void> {
    try {
      // Test monthly goals
      await db.select({
        id: monthlyGoals.id,
        userId: monthlyGoals.userId,
        month: monthlyGoals.month
      }).from(monthlyGoals).limit(1);
      
      // Test yearly goals  
      await db.select({
        id: yearlyGoals.id,
        userId: yearlyGoals.userId,
        year: yearlyGoals.year
      }).from(yearlyGoals).limit(1);
      
      results.push({
        table: 'goals',
        status: 'pass',
        message: 'Goals table field mapping validated successfully'
      });
      
    } catch (error) {
      results.push({
        table: 'goals',
        status: 'error',
        message: `Goals table field mapping failed: ${error.message}`
      });
    }
  }
  
  /**
   * Real-time validation endpoint for monitoring
   */
  static async validateFieldMappingHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    checks: ValidationResult[];
    timestamp: string;
  }> {
    const checks = await this.validateAllTables();
    const errors = checks.filter(c => c.status === 'error');
    const warnings = checks.filter(c => c.status === 'warning');
    
    let status: 'healthy' | 'degraded' | 'critical';
    if (errors.length > 0) {
      status = 'critical';
    } else if (warnings.length > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    return {
      status,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}