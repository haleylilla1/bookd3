/**
 * BULLETPROOF AUTHENTICATION SECURITY HARDENING
 * Comprehensive security measures for production-ready authentication
 */

import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    lastActivity?: number;
    fingerprint?: string;
  }
}

// Security configuration
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT: 2 * 60 * 60 * 1000, // 2 hours
  MAX_CONCURRENT_SESSIONS: 3,
  SUSPICIOUS_ACTIVITY_THRESHOLD: 10,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_ATTEMPTS: 5
};

// In-memory tracking (in production, use Redis)
const securityTracker = {
  failedAttempts: new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>(),
  activeSessions: new Map<string, Set<string>>(),
  suspiciousIPs: new Set<string>(),
  securityEvents: [] as SecurityEvent[]
};

interface SecurityEvent {
  timestamp: number;
  type: 'failed_login' | 'successful_login' | 'session_hijack' | 'suspicious_activity' | 'account_lockout';
  email?: string;
  ip: string;
  userAgent: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * BULLETPROOF RATE LIMITING
 */
export const authRateLimit = rateLimit({
  windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW,
  max: SECURITY_CONFIG.RATE_LIMIT_MAX_ATTEMPTS,
  message: { error: { message: 'Too many authentication attempts. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent(req, 'suspicious_activity', 'Rate limit exceeded', 'medium');
    res.status(429).json({ error: { message: 'Too many attempts. Account temporarily locked.' } });
  }
});

/**
 * ACCOUNT LOCKOUT PROTECTION
 */
export function checkAccountLockout(email: string, ip: string): { locked: boolean; remainingTime?: number } {
  const key = `${email}:${ip}`;
  const attempt = securityTracker.failedAttempts.get(key);
  
  if (!attempt) return { locked: false };
  
  if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    return { 
      locked: true, 
      remainingTime: Math.ceil((attempt.lockedUntil - Date.now()) / 1000)
    };
  }
  
  // Clear expired lockout
  if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
    securityTracker.failedAttempts.delete(key);
  }
  
  return { locked: false };
}

/**
 * RECORD FAILED LOGIN ATTEMPT
 */
export function recordFailedAttempt(email: string, ip: string, req: Request): void {
  const key = `${email}:${ip}`;
  const attempt = securityTracker.failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
  
  attempt.count++;
  attempt.lastAttempt = Date.now();
  
  if (attempt.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION;
    logSecurityEvent(req, 'account_lockout', `Account locked after ${attempt.count} failed attempts`, 'high', email);
  }
  
  securityTracker.failedAttempts.set(key, attempt);
  logSecurityEvent(req, 'failed_login', `Failed login attempt ${attempt.count}/${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS}`, 'medium', email);
}

/**
 * CLEAR FAILED ATTEMPTS ON SUCCESSFUL LOGIN
 */
export function clearFailedAttempts(email: string, ip: string): void {
  const key = `${email}:${ip}`;
  securityTracker.failedAttempts.delete(key);
}

/**
 * SESSION HIJACKING PROTECTION
 */
export function validateSessionSecurity(req: Request): { valid: boolean; reason?: string } {
  if (!req.session) return { valid: false, reason: 'No session' };
  
  // Check session timeout
  if (req.session.lastActivity && Date.now() - req.session.lastActivity > SECURITY_CONFIG.SESSION_TIMEOUT) {
    return { valid: false, reason: 'Session expired' };
  }
  
  // Update last activity
  req.session.lastActivity = Date.now();
  
  // Check for session hijacking indicators
  const currentFingerprint = generateSessionFingerprint(req);
  if (req.session.fingerprint && req.session.fingerprint !== currentFingerprint) {
    logSecurityEvent(req, 'session_hijack', 'Session fingerprint mismatch', 'critical');
    return { valid: false, reason: 'Session security violation' };
  }
  
  req.session.fingerprint = currentFingerprint;
  return { valid: true };
}

/**
 * GENERATE SESSION FINGERPRINT
 */
function generateSessionFingerprint(req: Request): string {
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Simple fingerprint (in production, use more sophisticated methods)
  return Buffer.from(`${userAgent}:${acceptLanguage}:${ip}`).toString('base64');
}

/**
 * CONCURRENT SESSION MANAGEMENT
 */
export function manageConcurrentSessions(userId: string, sessionId: string): boolean {
  const userSessions = securityTracker.activeSessions.get(userId) || new Set();
  
  if (userSessions.size >= SECURITY_CONFIG.MAX_CONCURRENT_SESSIONS && !userSessions.has(sessionId)) {
    return false; // Too many concurrent sessions
  }
  
  userSessions.add(sessionId);
  securityTracker.activeSessions.set(userId, userSessions);
  return true;
}

/**
 * REMOVE SESSION ON LOGOUT
 */
export function removeSession(userId: string, sessionId: string): void {
  const userSessions = securityTracker.activeSessions.get(userId);
  if (userSessions) {
    userSessions.delete(sessionId);
    if (userSessions.size === 0) {
      securityTracker.activeSessions.delete(userId);
    }
  }
}

/**
 * SECURITY EVENT LOGGING
 */
export function logSecurityEvent(req: Request, type: SecurityEvent['type'], details: string, severity: SecurityEvent['severity'], email?: string): void {
  const event: SecurityEvent = {
    timestamp: Date.now(),
    type,
    email,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    details,
    severity
  };
  
  securityTracker.securityEvents.push(event);
  
  // Keep only last 1000 events to prevent memory bloat
  if (securityTracker.securityEvents.length > 1000) {
    securityTracker.securityEvents.shift();
  }
  
  // Log critical events immediately
  if (severity === 'critical' || severity === 'high') {
    console.warn(`🚨 SECURITY ALERT [${severity.toUpperCase()}]: ${type} - ${details}`, {
      email,
      ip: event.ip,
      userAgent: event.userAgent
    });
  }
}

/**
 * INPUT VALIDATION & SANITIZATION
 */
export function validateAuthInput(email: string, password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Email validation
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
    if (email.length > 254) {
      errors.push('Email too long');
    }
  }
  
  // Password validation
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else {
    if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    if (password.length > 128) {
      errors.push('Password too long');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * SUSPICIOUS ACTIVITY DETECTION
 */
export function detectSuspiciousActivity(req: Request): boolean {
  const ip = req.ip || 'unknown';
  
  // Check if IP is already marked as suspicious
  if (securityTracker.suspiciousIPs.has(ip)) {
    return true;
  }
  
  // Analyze recent activity from this IP
  const recentEvents = securityTracker.securityEvents.filter(event => 
    event.ip === ip && Date.now() - event.timestamp < 60 * 60 * 1000 // Last hour
  );
  
  if (recentEvents.length > SECURITY_CONFIG.SUSPICIOUS_ACTIVITY_THRESHOLD) {
    securityTracker.suspiciousIPs.add(ip);
    logSecurityEvent(req, 'suspicious_activity', `IP marked as suspicious (${recentEvents.length} events in 1 hour)`, 'high');
    return true;
  }
  
  return false;
}

/**
 * SECURITY MONITORING ENDPOINTS
 */
export function getSecurityMetrics() {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  
  const recentEvents = securityTracker.securityEvents.filter(event => event.timestamp > last24h);
  
  return {
    totalEvents: securityTracker.securityEvents.length,
    recentEvents: recentEvents.length,
    eventsByType: {
      failed_login: recentEvents.filter(e => e.type === 'failed_login').length,
      successful_login: recentEvents.filter(e => e.type === 'successful_login').length,
      session_hijack: recentEvents.filter(e => e.type === 'session_hijack').length,
      suspicious_activity: recentEvents.filter(e => e.type === 'suspicious_activity').length,
      account_lockout: recentEvents.filter(e => e.type === 'account_lockout').length,
    },
    activeSessions: securityTracker.activeSessions.size,
    lockedAccounts: Array.from(securityTracker.failedAttempts.entries())
      .filter(([, attempt]) => attempt.lockedUntil && attempt.lockedUntil > now)
      .length,
    suspiciousIPs: securityTracker.suspiciousIPs.size,
    criticalEvents: recentEvents.filter(e => e.severity === 'critical').length
  };
}

/**
 * CLEANUP OLD DATA
 */
export function cleanupSecurityData(): void {
  const now = Date.now();
  
  // Clean up expired lockouts
  for (const [key, attempt] of Array.from(securityTracker.failedAttempts.entries())) {
    if (attempt.lockedUntil && attempt.lockedUntil < now) {
      securityTracker.failedAttempts.delete(key);
    }
  }
  
  // Clean up old security events (keep only last 7 days)
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  securityTracker.securityEvents = securityTracker.securityEvents.filter(
    event => event.timestamp > sevenDaysAgo
  );
  
  // Clean up suspicious IPs after 24 hours with no activity
  const suspiciousIPs = Array.from(securityTracker.suspiciousIPs);
  for (const ip of suspiciousIPs) {
    const recentActivity = securityTracker.securityEvents.some(
      event => event.ip === ip && now - event.timestamp < 24 * 60 * 60 * 1000
    );
    
    if (!recentActivity) {
      securityTracker.suspiciousIPs.delete(ip);
    }
  }
}

// Auto-cleanup every hour
setInterval(cleanupSecurityData, 60 * 60 * 1000);

console.log('🛡️  Authentication Security Hardening initialized');