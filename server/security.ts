/**
 * Security Middleware and Utilities
 * 
 * Comprehensive security layer for input validation, rate limiting,
 * and protection against common web vulnerabilities.
 */

import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { validateInput, sanitizeText, sanitizeEmail } from '@shared/validation';
import { z } from 'zod';

// =============================================================================
// RATE LIMITING
// =============================================================================

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path.startsWith('/health'),
});

// Authentication endpoints rate limiting (stricter)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Data export rate limiting (very strict)
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 exports per hour
  message: {
    error: 'Too many export requests. Please wait before requesting another export.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// =============================================================================
// INPUT VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Middleware to validate request body against Zod schema
 */
export function validateRequestBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log('🔍 Validating request body:', req.body);
    const validation = validateInput(req.body, schema);
    
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.errors);
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('✅ Validation passed, sanitized data:', validation.data);
    // Replace request body with sanitized data
    req.body = validation.data;
    next();
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validation = validateInput(req.query, schema);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    req.query = validation.data as any;
    next();
  };
}

// =============================================================================
// SECURITY HEADERS MIDDLEWARE
// =============================================================================

/**
 * Set comprehensive security headers
 */
export function setSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent information leakage
  res.setHeader('X-Powered-By', '');
  
  // Content Security Policy (strict for production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isDevelopment) {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.openai.com https://maps.googleapis.com;"
    );
  }
  
  // HSTS for HTTPS (production only)
  if (!isDevelopment && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

// =============================================================================
// REQUEST SANITIZATION MIDDLEWARE
// =============================================================================

/**
 * Sanitize all string inputs in request body
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Sanitize all string inputs in query parameters
 */
export function sanitizeQueryParams(req: Request, res: Response, next: NextFunction) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys as well to prevent property pollution
      const sanitizedKey = sanitizeText(key);
      if (sanitizedKey) {
        sanitized[sanitizedKey] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// =============================================================================
// REQUEST SIZE LIMITING
// =============================================================================

/**
 * Validate request size to prevent DoS attacks
 */
export function validateRequestSize(maxSizeKB: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxSizeBytes = maxSizeKB * 1024;
    
    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        error: 'Request too large',
        maxSize: `${maxSizeKB}KB`,
        receivedSize: `${Math.round(contentLength / 1024)}KB`,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

/**
 * Global error handler that prevents information leakage
 */
export function secureErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log the full error for debugging (server-side only)
  console.error('Security Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Sentry error tracking
  if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    Sentry.captureException(err, {
      tags: {
        component: 'security',
        endpoint: req.path
      },
      extra: {
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  }
  
  // Send sanitized error response (don't leak internal details)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
    requestId: req.get('X-Request-ID') || 'unknown'
  });
}

// =============================================================================
// INPUT VALIDATION SCHEMAS
// =============================================================================

// Common validation schemas for API endpoints
export const commonSchemas = {
  pagination: z.object({
    page: z.coerce.number().min(1).max(1000).default(1),
    limit: z.coerce.number().min(1).max(100).default(50)
  }),
  
  dateRange: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }),
  
  id: z.object({
    id: z.coerce.number().min(1)
  }),
  
  search: z.object({
    q: z.string().min(1).max(100).transform(sanitizeText)
  })
};

export { validateInput, sanitizeText, sanitizeEmail };