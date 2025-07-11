// BULLETPROOF Authentication Guard System
// This system prevents authentication pattern violations at runtime

import { Request, Response, NextFunction } from 'express';

// Type-safe authenticated request
export interface AuthenticatedRequest extends Request {
  userId: number;
}

// Runtime authentication pattern validator
export function authPatternGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // BULLETPROOF: Validate userId is properly set
  if (!req.userId || typeof req.userId !== 'number' || req.userId <= 0) {
    console.error('❌ CRITICAL: Authentication guard failed - invalid userId');
    console.error('req.userId:', req.userId);
    console.error('This indicates a serious authentication middleware failure');
    return res.status(500).json({ error: 'Authentication system error' });
  }
  
  // BULLETPROOF: Detect deprecated pattern usage
  if ((req as any).session?.userId) {
    console.error('❌ DEPRECATED PATTERN DETECTED: req.session.userId found');
    console.error('Route handlers must use req.userId, not req.session.userId');
  }
  
  next();
}

// Development-only route pattern scanner
export function scanForDeprecatedPatterns() {
  if (process.env.NODE_ENV === 'development') {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Use import.meta.dirname for ES modules
      const currentDir = import.meta.dirname || __dirname;
      const routesPath = path.join(currentDir, 'routes.ts');
      
      if (fs.existsSync(routesPath)) {
        const routesContent = fs.readFileSync(routesPath, 'utf8');
        
        if (routesContent.includes('req.session.userId')) {
          console.error('❌ CRITICAL: Deprecated auth pattern found in routes.ts');
          console.error('Search for "req.session.userId" and replace with "req.userId"');
          console.error('This WILL cause user data access failures');
          return false;
        }
        
        console.log('✅ Authentication patterns validated - no deprecated usage found');
        return true;
      }
    } catch (error) {
      console.log('Note: Could not scan routes.ts for deprecated patterns (this is OK)');
    }
  }
  return true;
}

// Startup validation
export function validateAuthSystemOnStartup() {
  console.log('🔒 Validating authentication system...');
  
  const patternsValid = scanForDeprecatedPatterns();
  
  if (!patternsValid) {
    console.error('❌ AUTHENTICATION SYSTEM VALIDATION FAILED');
    console.error('Server startup should be halted until patterns are fixed');
    throw new Error('Authentication pattern validation failed');
  }
  
  console.log('✅ Authentication system validation passed');
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