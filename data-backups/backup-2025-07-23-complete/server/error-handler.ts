// Production-Safe Error Handling System
// Replaces try-catch blocks with proper error management

import { Request, Response, NextFunction } from 'express';
import { logger, logError } from './logger';

// Custom error types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication errors
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

// Authorization errors
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
  }
}

// Database errors
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500);
  }
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Safe database operation wrapper
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Database operation failed',
  userId?: number
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    logError(errorMessage, error as Error, userId);
    return null;
  }
}

// Safe API call wrapper
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  errorMessage: string = 'API call failed',
  userId?: number
): Promise<T | null> {
  try {
    return await apiCall();
  } catch (error) {
    logError(errorMessage, error as Error, userId);
    return null;
  }
}

// Global error handler middleware
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  // Log the error
  logError(`Error in ${req.method} ${req.path}`, error, (req as any).userId);

  // Send error response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

// Handle unhandled promise rejections
export function handleUnhandledRejections() {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', { reason, promise });
    
    // In production, might want to gracefully shut down
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}

// Handle uncaught exceptions
export function handleUncaughtExceptions() {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    
    // Must exit process after uncaught exception
    process.exit(1);
  });
}

// Validation helpers
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

export function validateUserId(userId: any): number {
  const id = parseInt(userId);
  if (isNaN(id) || id <= 0) {
    throw new ValidationError('Invalid user ID');
  }
  return id;
}

export function validateNumericId(id: any, fieldName: string = 'ID'): number {
  const numericId = parseInt(id);
  if (isNaN(numericId) || numericId <= 0) {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
  return numericId;
}