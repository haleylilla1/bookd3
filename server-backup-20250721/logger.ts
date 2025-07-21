// Production-Safe Logging System
// Replaces console.log statements with proper production logging

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: any;
  userId?: number;
}

class ProductionLogger {
  private isDevelopment: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private createLogEntry(level: LogLevel, message: string, metadata?: any, userId?: number): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      userId
    };
  }

  private writeLog(entry: LogEntry): void {
    if (this.isDevelopment) {
      // In development, use console for immediate feedback
      const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
      if (entry.userId) {
        console.log(`${prefix} [User:${entry.userId}] ${entry.message}`, entry.metadata || '');
      } else {
        console.log(`${prefix} ${entry.message}`, entry.metadata || '');
      }
    } else {
      // In production, buffer logs and could send to external service
      this.logBuffer.push(entry);
      if (this.logBuffer.length > this.maxBufferSize) {
        this.logBuffer.shift(); // Remove oldest entry
      }
    }
  }

  // Critical errors that need immediate attention
  error(message: string, metadata?: any, userId?: number): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata, userId);
    this.writeLog(entry);
  }

  // Warning conditions
  warn(message: string, metadata?: any, userId?: number): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, metadata, userId);
    this.writeLog(entry);
  }

  // General information
  info(message: string, metadata?: any, userId?: number): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, metadata, userId);
    this.writeLog(entry);
  }

  // Debug information (only in development)
  debug(message: string, metadata?: any, userId?: number): void {
    if (this.isDevelopment) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata, userId);
      this.writeLog(entry);
    }
  }

  // Authentication-specific logging
  auth(message: string, userId?: number, metadata?: any): void {
    this.info(`AUTH: ${message}`, metadata, userId);
  }

  // Security-related logging
  security(message: string, metadata?: any): void {
    this.error(`SECURITY: ${message}`, metadata);
  }

  // Get recent logs (for monitoring)
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Clear log buffer
  clearLogs(): void {
    this.logBuffer = [];
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Helper functions for common logging patterns
export function logError(message: string, error?: Error, userId?: number): void {
  const metadata = error ? { error: error.message, stack: error.stack } : undefined;
  logger.error(message, metadata, userId);
}

export function logAuthEvent(event: string, userId?: number, details?: any): void {
  logger.auth(event, userId, details);
}

export function logSecurityEvent(event: string, details?: any): void {
  logger.security(event, details);
}