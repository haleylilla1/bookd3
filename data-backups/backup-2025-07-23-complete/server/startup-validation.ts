/**
 * Startup Validation System
 * Runs critical checks when server starts to prevent field mismatch issues
 */

import { dbValidator } from './database-consistency-check';

export async function validateSystemOnStartup(): Promise<void> {
  console.log('[STARTUP] Running database consistency validation...');
  
  try {
    const validation = await dbValidator.runAllChecks();
    
    if (validation.passed) {
      console.log('[STARTUP] ✓ All database consistency checks passed');
    } else {
      console.error('[STARTUP] ✗ Database consistency validation FAILED:');
      validation.results.forEach(result => {
        if (!result.passed) {
          console.error(`  - ${result.table}: ${result.description}`, result.error || '');
        }
      });
      
      console.error('[STARTUP] CRITICAL: Server starting with database inconsistencies!');
      console.error('[STARTUP] Users may experience data visibility issues');
      console.error('[STARTUP] Run /api/system/validate to see detailed results');
    }
  } catch (error) {
    console.error('[STARTUP] Failed to run validation checks:', error);
  }
}