// BULLETPROOF Authentication Guard System
// This system prevents authentication pattern violations at runtime

import { Request, Response, NextFunction } from 'express';
import { logger, logError, logSecurityEvent } from './logger';

// Type-safe authenticated request
export interface AuthenticatedRequest extends Request {
  userId: number;
}

// Runtime authentication pattern validator
export function authPatternGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // BULLETPROOF: Validate userId is properly set
  if (!req.userId || typeof req.userId !== 'number' || req.userId <= 0) {
    logSecurityEvent('Authentication guard failed - invalid userId', { 
      userId: req.userId, 
      route: req.path 
    });
    return res.status(500).json({ error: 'Authentication system error' });
  }
  
  // BULLETPROOF: Detect deprecated pattern usage
  if ((req as any).session?.userId) {
    logSecurityEvent('Deprecated auth pattern detected', { 
      route: req.path, 
      sessionUserId: (req as any).session.userId 
    });
  }
  
  next();
}

// Development-only route pattern scanner
export async function scanForDeprecatedPatterns() {
  if (process.env.NODE_ENV === 'development') {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Use import.meta.dirname for ES modules
      const currentDir = import.meta.dirname || process.cwd() + '/server';
      const routesPath = path.join(currentDir, 'routes.ts');
      
      if (fs.existsSync(routesPath)) {
        const routesContent = fs.readFileSync(routesPath, 'utf8');
        
        if (routesContent.includes('req.session.userId')) {
          logSecurityEvent('Deprecated auth pattern found in routes.ts', { 
            pattern: 'req.session.userId',
            file: 'routes.ts' 
          });
          return false;
        }
        
        logger.info('Authentication patterns validated - no deprecated usage found');
        return true;
      }
    } catch (error) {
      logger.debug('Could not scan routes.ts for deprecated patterns', { error });
    }
  }
  return true;
}

// Startup validation
export async function validateAuthSystemOnStartup() {
  logger.info('Validating authentication system...');
  
  const patternsValid = await scanForDeprecatedPatterns();
  
  if (!patternsValid) {
    logSecurityEvent('Authentication system validation failed', { 
      reason: 'Deprecated patterns detected' 
    });
    throw new Error('Authentication pattern validation failed');
  }
  
  logger.info('Authentication system validation passed');
}

// Helper to get user ID safely
export function getUserId(req: AuthenticatedRequest): number {
  if (!req.userId || typeof req.userId !== 'number') {
    throw new Error('User ID not properly set in authenticated request');
  }
  return req.userId;
}

// Type guard
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return 'userId' in req && typeof (req as any).userId === 'number';
}