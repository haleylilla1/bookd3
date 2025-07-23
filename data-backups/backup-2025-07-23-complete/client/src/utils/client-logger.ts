// Client-side Production-Safe Logging
// Replaces console.log statements with proper error handling

interface ClientLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  metadata?: any;
  userId?: number;
  url?: string;
  userAgent?: string;
}

class ClientLogger {
  private isDevelopment: boolean;
  private logBuffer: ClientLogEntry[] = [];
  private maxBufferSize = 50;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  private createLogEntry(level: 'error' | 'warn' | 'info' | 'debug', message: string, metadata?: any): ClientLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }

  private writeLog(entry: ClientLogEntry): void {
    if (this.isDevelopment) {
      // In development, use console for immediate feedback
      const prefix = `[${entry.level.toUpperCase()}]`;
      console.log(`${prefix} ${entry.message}`, entry.metadata || '');
    } else {
      // In production, buffer logs (could send to monitoring service)
      this.logBuffer.push(entry);
      if (this.logBuffer.length > this.maxBufferSize) {
        this.logBuffer.shift();
      }
    }
  }

  // Critical errors
  error(message: string, metadata?: any): void {
    const entry = this.createLogEntry('error', message, metadata);
    this.writeLog(entry);
    
    // In production, could send to error tracking service
    if (!this.isDevelopment) {
      // TODO: Send to error tracking service like Sentry
    }
  }

  // Warnings
  warn(message: string, metadata?: any): void {
    const entry = this.createLogEntry('warn', message, metadata);
    this.writeLog(entry);
  }

  // Information
  info(message: string, metadata?: any): void {
    const entry = this.createLogEntry('info', message, metadata);
    this.writeLog(entry);
  }

  // Debug (development only)
  debug(message: string, metadata?: any): void {
    if (this.isDevelopment) {
      const entry = this.createLogEntry('debug', message, metadata);
      this.writeLog(entry);
    }
  }

  // Authentication events
  auth(message: string, metadata?: any): void {
    this.info(`AUTH: ${message}`, metadata);
  }

  // API call logging
  api(message: string, metadata?: any): void {
    this.debug(`API: ${message}`, metadata);
  }

  // Form submission logging
  form(message: string, metadata?: any): void {
    this.debug(`FORM: ${message}`, metadata);
  }

  // Get recent logs for debugging
  getRecentLogs(): ClientLogEntry[] {
    return this.logBuffer.slice();
  }
}

// Export singleton instance
export const clientLogger = new ClientLogger();

// Helper functions for common patterns
export function logClientError(message: string, error?: Error, metadata?: any): void {
  const errorMetadata = error ? { 
    error: error.message, 
    stack: error.stack,
    ...metadata 
  } : metadata;
  clientLogger.error(message, errorMetadata);
}

export function logApiCall(endpoint: string, method: string, status?: number): void {
  clientLogger.api(`${method} ${endpoint}`, { status });
}

export function logFormSubmission(formName: string, success: boolean, error?: string): void {
  clientLogger.form(`${formName} submission`, { success, error });
}

export function logAuthEvent(event: string, details?: any): void {
  clientLogger.auth(event, details);
}