/**
 * BULLETPROOF AUTHENTICATION MIDDLEWARE
 * Enhanced security middleware with comprehensive protection
 */

import { Request, Response } from 'express';
import { 
  validateSessionSecurity, 
  logSecurityEvent, 
  detectSuspiciousActivity,
  manageConcurrentSessions
} from './auth-security-hardening';

// Enhanced session interface
declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: {
        id: number;
        email: string;
        supabaseId: string;
        name?: string;
        sessionId: string;
        lastActivity: number;
      };
      currentUser?: {
        id: number;
        email: string;
        name?: string;
        supabaseId: string;
      };
    }
  }
}

/**
 * BULLETPROOF AUTHENTICATION MIDDLEWARE
 */
export async function bulletproofAuth(req: Request, res: Response, next: any) {
  try {
    console.log('🛡️  Bulletproof auth check initiated');
    
    // 1. SUSPICIOUS ACTIVITY CHECK
    if (detectSuspiciousActivity(req)) {
      console.log('🚨 Suspicious activity detected, blocking request');
      return res.status(429).json({ 
        error: { message: 'Request blocked due to suspicious activity' } 
      });
    }
    
    // 2. SESSION SECURITY VALIDATION
    const sessionValidation = validateSessionSecurity(req);
    if (!sessionValidation.valid) {
      console.log('⚠️ Session security validation failed:', sessionValidation.reason);
      
      // Clear invalid session
      if (req.session) {
        req.session.destroy(() => {});
      }
      
      return res.status(401).json({ 
        error: { message: 'Session expired or invalid. Please log in again.' } 
      });
    }
    
    // 3. USER AUTHENTICATION CHECK
    let authenticatedUser = null;
    
    // Try session-based authentication first
    if (req.session?.supabaseUserId) {
      try {
        const { supabaseIdToDatabaseId } = await import('./user-id-mapping');
        const databaseUserId = supabaseIdToDatabaseId(req.session.supabaseUserId);
        
        if (databaseUserId) {
          // Verify concurrent session limit
          const sessionId = req.sessionID || 'unknown';
          if (!manageConcurrentSessions(req.session.supabaseUserId, sessionId)) {
            console.log('🚨 Too many concurrent sessions for user:', req.session.supabaseEmail);
            return res.status(429).json({ 
              error: { message: 'Too many active sessions. Please log out from other devices.' } 
            });
          }
          
          authenticatedUser = {
            id: databaseUserId,
            email: req.session.supabaseEmail || 'unknown',
            supabaseId: req.session.supabaseUserId,
            name: 'User',
            sessionId,
            lastActivity: Date.now()
          };
          
          console.log('✅ Session-based auth successful for user:', authenticatedUser.email);
        }
      } catch (error) {
        console.error('❌ Session auth error:', error);
      }
    }
    
    // 4. FALLBACK AUTHENTICATION (TEMPORARY - FOR TESTING)
    if (!authenticatedUser) {
      console.log('⚠️ No session found - attempting fallback authentication');
      
      // This is a temporary fallback for testing purposes
      // In production, this should be removed or restricted to specific test environments
      if (process.env.NODE_ENV === 'development') {
        const { supabaseIdToDatabaseId } = await import('./user-id-mapping');
        const testSupabaseId = 'ab722bf0-7d67-4797-98ad-754782056231';
        const databaseUserId = supabaseIdToDatabaseId(testSupabaseId);
        
        if (databaseUserId) {
          console.log('🔧 Development fallback: Allowing access for test user');
          authenticatedUser = {
            id: databaseUserId,
            email: 'haleylilla@gmail.com',
            supabaseId: testSupabaseId,
            name: 'Haley (Test)',
            sessionId: 'fallback-session',
            lastActivity: Date.now()
          };
        }
      }
    }
    
    // 5. AUTHENTICATION REQUIRED
    if (!authenticatedUser) {
      console.log('❌ Authentication required - no valid session or fallback');
      return res.status(401).json({ 
        error: { message: 'Authentication required. Please log in.' } 
      });
    }
    
    // 6. SET AUTHENTICATED USER DATA
    req.authenticatedUser = authenticatedUser;
    req.currentUser = {
      id: authenticatedUser.id,
      email: authenticatedUser.email,
      name: authenticatedUser.name,
      supabaseId: authenticatedUser.supabaseId
    };
    
    console.log('✅ Authentication successful for user ID:', authenticatedUser.id);
    next();
    
  } catch (error: any) {
    console.error('🚨 Bulletproof auth middleware error:', error);
    
    // Log security event
    const securityEvent = {
      timestamp: Date.now(),
      type: 'suspicious_activity' as const,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      details: `Auth middleware error: ${error.message}`,
      severity: 'high' as const
    };
    
    return res.status(500).json({ 
      error: { message: 'Authentication system error. Please try again.' } 
    });
  }
}

/**
 * ENHANCED USER ID HELPER
 */
export function getAuthenticatedUserId(req: Request): number {
  if (!req.authenticatedUser) {
    throw new Error('No authenticated user found. Ensure bulletproofAuth middleware is applied.');
  }
  return req.authenticatedUser.id;
}

/**
 * AUTHENTICATION STATUS CHECK
 */
export function isAuthenticated(req: Request): boolean {
  return !!req.authenticatedUser;
}

/**
 * SESSION CLEANUP ON LOGOUT
 */
export function cleanupUserSession(req: Request): void {
  if (req.authenticatedUser && req.session) {
    const { removeSession } = require('./auth-security-hardening');
    removeSession(req.authenticatedUser.supabaseId, req.authenticatedUser.sessionId);
  }
  
  if (req.session) {
    req.session.destroy(() => {
      console.log('🧹 Session cleaned up successfully');
    });
  }
}

console.log('🛡️  Bulletproof Authentication Middleware initialized');