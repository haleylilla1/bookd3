#!/usr/bin/env node
/**
 * Change Validator - Safety protocol for validating changes before AI sessions
 * Part of Daily Practice Protocol
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface ValidationResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

class ChangeValidator {
  private logPath = './validation-log.txt';

  async validateChanges(): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    console.log('🔍 CHANGE VALIDATOR - Starting validation...');
    
    // 1. Check for TypeScript errors
    await this.checkTypeScriptErrors(result);
    
    // 2. Check critical file integrity
    await this.checkCriticalFiles(result);
    
    // 3. Check authentication system
    await this.checkAuthenticationSystem(result);
    
    // 4. Check memory management
    await this.checkMemoryStatus(result);
    
    // 5. Test critical endpoints
    await this.testCriticalEndpoints(result);
    
    // 6. Check for security issues
    await this.checkSecurityIssues(result);

    // Log results
    await this.logResults(result);
    
    return result;
  }

  private async checkTypeScriptErrors(result: ValidationResult): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit');
      if (stderr) {
        result.issues.push(`TypeScript errors: ${stderr}`);
        result.passed = false;
      }
    } catch (error: any) {
      if (error.stdout || error.stderr) {
        result.issues.push(`TypeScript compilation issues: ${error.stderr || error.stdout}`);
        result.passed = false;
      }
    }
  }

  private async checkCriticalFiles(result: ValidationResult): Promise<void> {
    const criticalFiles = [
      'server/routes.ts',
      'server/auth.ts', 
      'server/storage.ts',
      'server/professional-html-generator.ts',
      'shared/schema.ts',
      'replit.md'
    ];

    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        result.issues.push(`Critical file missing: ${file}`);
        result.passed = false;
      }
    }
  }

  private async checkAuthenticationSystem(result: ValidationResult): Promise<void> {
    try {
      // Check if auth endpoints exist
      const routesContent = fs.readFileSync('server/routes.ts', 'utf8');
      
      if (!routesContent.includes('requireAuth')) {
        result.issues.push('Authentication middleware missing from routes');
        result.passed = false;
      }
      
      if (!routesContent.includes('setupAuthRoutes')) {
        result.issues.push('Auth routes setup missing');
        result.passed = false;
      }
    } catch (error) {
      result.issues.push(`Failed to validate auth system: ${error}`);
      result.passed = false;
    }
  }

  private async checkMemoryStatus(result: ValidationResult): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const utilization = (heapUsedMB / heapTotalMB) * 100;
      
      if (utilization > 90) {
        result.warnings.push(`High memory utilization: ${utilization.toFixed(1)}%`);
      }
      
      if (utilization > 95) {
        result.issues.push(`Critical memory utilization: ${utilization.toFixed(1)}%`);
      }
    } catch (error) {
      result.warnings.push(`Could not check memory status: ${error}`);
    }
  }

  private async testCriticalEndpoints(result: ValidationResult): Promise<void> {
    const endpoints = [
      { path: '/health', expectAuth: false },
      { path: '/api/user', expectAuth: true }
    ];

    for (const endpoint of endpoints) {
      try {
        const { stdout } = await execAsync(`curl -s http://localhost:5000${endpoint.path}`);
        
        if (endpoint.expectAuth && !stdout.includes('Not authenticated')) {
          result.warnings.push(`Endpoint ${endpoint.path} may have auth issues`);
        }
        
        if (!endpoint.expectAuth && stdout.includes('error')) {
          result.warnings.push(`Endpoint ${endpoint.path} returning errors`);
        }
      } catch (error) {
        result.warnings.push(`Could not test endpoint ${endpoint.path}: ${error}`);
      }
    }
  }

  private async checkSecurityIssues(result: ValidationResult): Promise<void> {
    try {
      const routesContent = fs.readFileSync('server/routes.ts', 'utf8');
      
      // Check for potential security issues
      if (routesContent.includes('console.log') && routesContent.includes('password')) {
        result.warnings.push('Potential password logging detected');
      }
      
      if (routesContent.includes('skip: (req) => true')) {
        result.issues.push('Rate limiting completely disabled');
        result.passed = false;
      }
      
      if (routesContent.includes('NODE_ENV') && !routesContent.includes('production')) {
        result.warnings.push('NODE_ENV handling may need review');
      }
    } catch (error) {
      result.warnings.push(`Could not check security issues: ${error}`);
    }
  }

  private async logResults(result: ValidationResult): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = `
=== CHANGE VALIDATION ${timestamp} ===
PASSED: ${result.passed}
ISSUES: ${result.issues.length}
${result.issues.map(issue => `  ❌ ${issue}`).join('\n')}
WARNINGS: ${result.warnings.length}
${result.warnings.map(warning => `  ⚠️  ${warning}`).join('\n')}
RECOMMENDATIONS: ${result.recommendations.length}
${result.recommendations.map(rec => `  💡 ${rec}`).join('\n')}
=======================================
`;

    try {
      fs.appendFileSync(this.logPath, logEntry);
    } catch (error) {
      console.error('Failed to write validation log:', error);
    }
  }

  async printSummary(result: ValidationResult): Promise<void> {
    console.log('\n📋 VALIDATION SUMMARY');
    console.log('====================');
    console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Issues: ${result.issues.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    
    if (result.issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      result.issues.forEach(issue => console.log(`  • ${issue}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      result.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      result.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    console.log('\n====================');
  }
}

// Run if called directly
if (require.main === module) {
  const validator = new ChangeValidator();
  validator.validateChanges().then(result => {
    validator.printSummary(result);
    process.exit(result.passed ? 0 : 1);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { ChangeValidator };