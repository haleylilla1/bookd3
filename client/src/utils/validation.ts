/**
 * Client-side validation utilities
 * Mirrors server-side validation for immediate user feedback
 */

import { sanitizeText, sanitizeEmail, sanitizeNumber, sanitizeAddress, sanitizeCurrency, sanitizePhone } from '@shared/validation';

// Re-export shared validation functions for client use
export { 
  sanitizeText, 
  sanitizeEmail, 
  sanitizeNumber, 
  sanitizeAddress, 
  sanitizeCurrency, 
  sanitizePhone 
};

/**
 * Client-side form validation helpers
 */
export const clientValidation = {
  // Empty state handlers
  handleEmptyString: (value: string, fallback: string = ''): string => {
    return value?.trim() || fallback;
  },

  handleEmptyNumber: (value: string | number, fallback: number = 0): number => {
    if (typeof value === 'number' && isFinite(value)) return value;
    const parsed = parseFloat(String(value));
    return isFinite(parsed) ? parsed : fallback;
  },

  // Real-time input sanitization
  onInputChange: (value: string, type: 'text' | 'email' | 'address' | 'phone' = 'text'): string => {
    switch (type) {
      case 'email':
        return sanitizeEmail(value);
      case 'address':
        return sanitizeAddress(value);
      case 'phone':
        return sanitizePhone(value);
      default:
        return sanitizeText(value);
    }
  },

  // Form field validation
  validateRequired: (value: string, fieldName: string): string | null => {
    const sanitized = sanitizeText(value);
    if (!sanitized) {
      return `${fieldName} is required`;
    }
    return null;
  },

  validateEmail: (value: string): string | null => {
    const sanitized = sanitizeEmail(value);
    if (!sanitized) {
      return 'Email is required';
    }
    if (!sanitized.includes('@')) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  validateAmount: (value: string | number): string | null => {
    const amount = sanitizeNumber(value, -1);
    if (amount < 0) {
      return 'Please enter a valid amount';
    }
    if (amount === 0) {
      return 'Amount must be greater than 0';
    }
    return null;
  },

  validateDate: (value: string): string | null => {
    if (!value) {
      return 'Date is required';
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Please enter a valid date';
    }
    return null;
  },

  // Length validation
  validateLength: (value: string, min: number, max: number, fieldName: string): string | null => {
    const sanitized = sanitizeText(value);
    if (sanitized.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    if (sanitized.length > max) {
      return `${fieldName} must be less than ${max} characters`;
    }
    return null;
  },

  // Range validation for numbers
  validateRange: (value: number, min: number, max: number, fieldName: string): string | null => {
    if (value < min || value > max) {
      return `${fieldName} must be between ${min} and ${max}`;
    }
    return null;
  }
};

/**
 * Error state management for forms
 */
export class FormErrorHandler {
  private errors: Map<string, string> = new Map();

  setError(field: string, message: string): void {
    this.errors.set(field, message);
  }

  clearError(field: string): void {
    this.errors.delete(field);
  }

  getError(field: string): string | undefined {
    return this.errors.get(field);
  }

  hasErrors(): boolean {
    return this.errors.size > 0;
  }

  getAllErrors(): string[] {
    return Array.from(this.errors.values());
  }

  clear(): void {
    this.errors.clear();
  }

  // Handle API validation errors
  handleAPIErrors(errorResponse: any): void {
    this.clear();
    
    if (errorResponse?.details && Array.isArray(errorResponse.details)) {
      errorResponse.details.forEach((error: string) => {
        const [field, message] = error.split(': ');
        if (field && message) {
          this.setError(field, message);
        }
      });
    } else if (errorResponse?.message) {
      this.setError('general', errorResponse.message);
    }
  }
}

/**
 * Security helpers for preventing XSS in user content display
 */
export const securityHelpers = {
  // Safe display of user-generated content
  displayUserContent: (content: string): string => {
    return sanitizeText(content);
  },

  // Safe display of amounts
  displayCurrency: (amount: string | number): string => {
    const sanitized = sanitizeCurrency(amount);
    return `$${sanitized}`;
  },

  // Safe display of addresses
  displayAddress: (address: string): string => {
    return sanitizeAddress(address);
  },

  // Prevent injection in dynamic content
  escapeForJSON: (value: string): string => {
    return sanitizeText(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
};

/**
 * Rate limiting helper for client-side
 */
export class ClientRateLimit {
  private lastRequest: number = 0;
  private readonly minInterval: number;

  constructor(minIntervalMs: number = 1000) {
    this.minInterval = minIntervalMs;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    return (now - this.lastRequest) >= this.minInterval;
  }

  recordRequest(): void {
    this.lastRequest = Date.now();
  }

  getTimeUntilNext(): number {
    const now = Date.now();
    const timeSince = now - this.lastRequest;
    return Math.max(0, this.minInterval - timeSince);
  }
}