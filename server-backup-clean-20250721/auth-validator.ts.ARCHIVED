// Authentication Pattern Validator
// This file ensures authentication consistency across the application

export interface AuthenticatedRequest {
  userId: number;
  // Other request properties...
}

// Type guard to ensure routes use the correct pattern
export function validateAuthPattern(req: any): req is AuthenticatedRequest {
  return typeof req.userId === 'number';
}

// Middleware validator to ensure consistent authentication
export function validateAuthMiddleware(req: any, res: any, next: any) {
  if (!validateAuthPattern(req)) {
    console.error('❌ AUTHENTICATION PATTERN ERROR: req.userId not set properly');
    return res.status(500).json({ error: 'Authentication configuration error' });
  }
  next();
}

// Development-only validator to catch auth pattern issues
export function devAuthValidator(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === 'development') {
    // Check if any routes are using the old pattern
    const routeHandler = next.toString();
    if (routeHandler.includes('req.session.userId')) {
      console.error('❌ DEPRECATED AUTH PATTERN DETECTED');
      console.error('Route using req.session.userId instead of req.userId');
      console.error('This will cause user data access failures');
    }
  }
  next();
}

// Constants for authentication patterns
export const AUTH_PATTERNS = {
  CORRECT: 'req.userId',
  DEPRECATED: 'req.session.userId'
} as const;

// Helper function to check authentication consistency
export function checkAuthConsistency(): boolean {
  // In a real implementation, this would scan route files
  // For now, it's a placeholder for future automated checks
  return true;
}