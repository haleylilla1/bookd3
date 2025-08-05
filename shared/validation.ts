/**
 * Comprehensive Input Validation and Sanitization Utilities
 * 
 * This module provides security-focused validation and sanitization
 * to prevent XSS, injection attacks, and handle edge cases gracefully.
 */

import { z } from 'zod';

// =============================================================================
// SANITIZATION UTILITIES
// =============================================================================

/**
 * Sanitize text input to prevent XSS attacks
 * Removes potentially harmful HTML/script tags and normalizes input
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script/style content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove common XSS vectors
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize and validate email addresses
 */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .toLowerCase()
    // Remove potentially harmful characters while preserving valid email chars
    .replace(/[^a-z0-9@._+-]/g, '')
    .slice(0, 254); // RFC 5321 email length limit
}

/**
 * Sanitize numeric input and convert to number
 */
export function sanitizeNumber(input: unknown, defaultValue: number = 0): number {
  if (typeof input === 'number' && isFinite(input)) {
    return input;
  }
  
  if (typeof input === 'string') {
    const cleaned = input.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isFinite(parsed) ? parsed : defaultValue;
  }
  
  return defaultValue;
}

/**
 * Sanitize currency amounts (dollars)
 */
export function sanitizeCurrency(input: unknown): string {
  const num = sanitizeNumber(input, 0);
  // Clamp to reasonable currency range
  const clamped = Math.max(0, Math.min(999999.99, num));
  return clamped.toFixed(2);
}

/**
 * Sanitize phone numbers
 */
export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    // Keep only digits, spaces, dashes, parentheses, plus
    .replace(/[^0-9\s\-\(\)\+]/g, '')
    .slice(0, 20); // Reasonable phone number length limit
}

/**
 * Sanitize addresses and locations
 */
export function sanitizeAddress(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    // Remove HTML/script tags
    .replace(/<[^>]*>/g, '')
    // Keep alphanumeric, spaces, and common address punctuation
    .replace(/[^a-zA-Z0-9\s\-,.'#&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500); // Reasonable address length limit
}

/**
 * Sanitize date strings
 */
export function sanitizeDate(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Only allow ISO date format (YYYY-MM-DD)
  const dateMatch = input.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!dateMatch) {
    return '';
  }
  
  // Validate it's a real date
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return input;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

// User input validation schemas
export const userValidation = {
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform(sanitizeText)
    .refine(val => val.length > 0, 'Name cannot be empty after sanitization'),
    
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email must be less than 254 characters')
    .transform(sanitizeEmail)
    .refine(val => val.includes('@'), 'Email must contain @ symbol'),
    
  phone: z.string()
    .optional()
    .transform(val => val ? sanitizePhone(val) : ''),
    
  homeAddress: z.string()
    .optional()
    .transform(val => val ? sanitizeAddress(val) : ''),
    
  businessName: z.string()
    .optional()
    .transform(val => val ? sanitizeText(val) : ''),
    
  businessAddress: z.string()
    .optional()
    .transform(val => val ? sanitizeAddress(val) : ''),
    
  businessPhone: z.string()
    .optional()
    .transform(val => val ? sanitizePhone(val) : ''),
    
  businessEmail: z.string()
    .optional()
    .transform(val => val ? sanitizeEmail(val) : '')
    .refine(val => !val || val.includes('@'), 'Business email must be valid if provided'),
    
  defaultTaxPercentage: z.union([z.string(), z.number()])
    .transform(val => sanitizeNumber(val, 23))
    .refine(val => val >= 0 && val <= 100, 'Tax percentage must be between 0 and 100'),
    
  customGigTypes: z.array(z.string().transform(sanitizeText))
    .optional()
    .refine(val => !val || val.length <= 50, 'Cannot have more than 50 custom gig types')
    .refine(val => !val || val.every(type => type.length > 0 && type.length <= 100), 'Each gig type must be 1-100 characters')
};

// Gig input validation schemas
export const gigValidation = {
  clientName: z.string()
    .min(1, 'Client name is required')
    .max(200, 'Client name must be less than 200 characters')
    .transform(sanitizeText)
    .refine(val => val.length > 0, 'Client name cannot be empty'),
    
  gigType: z.string()
    .min(1, 'Gig type is required')
    .max(100, 'Gig type must be less than 100 characters')
    .transform(sanitizeText)
    .refine(val => val.length > 0, 'Gig type cannot be empty'),
    
  location: z.string()
    .min(1, 'Location is required')
    .max(500, 'Location must be less than 500 characters')
    .transform(sanitizeAddress)
    .refine(val => val.length > 0, 'Location cannot be empty'),
    
  date: z.string()
    .transform(sanitizeDate)
    .refine(val => val.length > 0, 'Valid date is required'),
    
  amount: z.union([z.string(), z.number()])
    .transform(val => sanitizeCurrency(val))
    .refine(val => parseFloat(val) >= 0, 'Amount must be positive'),
    
  notes: z.string()
    .optional()
    .transform(val => val ? sanitizeText(val) : '')
    .refine(val => val.length <= 1000, 'Notes must be less than 1000 characters'),
    
  mileage: z.union([z.string(), z.number()])
    .optional()
    .transform(val => val ? sanitizeNumber(val, 0) : 0)
    .refine(val => val >= 0 && val <= 9999, 'Mileage must be between 0 and 9999'),
    
  // Payment tracking fields
  totalReceived: z.union([z.string(), z.number()])
    .optional()
    .transform(val => val ? sanitizeCurrency(val) : '0.00'),
    
  reimbursedParking: z.union([z.string(), z.number()])
    .optional()
    .transform(val => val ? sanitizeCurrency(val) : '0.00'),
    
  reimbursedOther: z.union([z.string(), z.number()])
    .optional()
    .transform(val => val ? sanitizeCurrency(val) : '0.00'),
    
  unreimbursedParking: z.union([z.string(), z.number()])
    .optional()
    .transform(val => val ? sanitizeCurrency(val) : '0.00'),
    
  unreimbursedOther: z.union([z.string(), z.number()])
    .optional()
    .transform(val => val ? sanitizeCurrency(val) : '0.00')
};

// Expense input validation schemas
export const expenseValidation = {
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .transform(sanitizeText)
    .refine(val => val.length > 0, 'Description cannot be empty'),
    
  merchant: z.string()
    .min(1, 'Merchant is required')
    .max(200, 'Merchant must be less than 200 characters')
    .transform(sanitizeText)
    .refine(val => val.length > 0, 'Merchant cannot be empty'),
    
  amount: z.union([z.string(), z.number()])
    .transform(val => sanitizeCurrency(val))
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than 0'),
    
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category must be less than 100 characters')
    .transform(sanitizeText)
    .refine(val => val.length > 0, 'Category cannot be empty'),
    
  date: z.string()
    .transform(sanitizeDate)
    .refine(val => val.length > 0, 'Valid date is required'),
    
  notes: z.string()
    .optional()
    .transform(val => val ? sanitizeText(val) : '')
    .refine(val => val.length <= 1000, 'Notes must be less than 1000 characters')
};

// Goal input validation schemas
export const goalValidation = {
  month: z.union([z.string(), z.number()])
    .transform(val => sanitizeNumber(val, 1))
    .refine(val => val >= 1 && val <= 12, 'Month must be between 1 and 12'),
    
  year: z.union([z.string(), z.number()])
    .transform(val => sanitizeNumber(val, new Date().getFullYear()))
    .refine(val => val >= 2020 && val <= 2030, 'Year must be between 2020 and 2030'),
    
  goalAmount: z.union([z.string(), z.number()])
    .transform(val => sanitizeCurrency(val))
    .refine(val => parseFloat(val) > 0, 'Goal amount must be greater than 0')
};

// =============================================================================
// VALIDATION HELPER FUNCTIONS
// =============================================================================

/**
 * Validate and sanitize request body against schema
 */
export function validateInput<T>(data: unknown, schema: z.ZodSchema<T>): { 
  success: true; 
  data: T; 
} | { 
  success: false; 
  errors: string[]; 
} {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

/**
 * Check for empty states and provide default values
 */
export function handleEmptyState<T>(value: T | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return defaultValue;
  }
  
  if (Array.isArray(value) && value.length === 0) {
    return defaultValue;
  }
  
  return value;
}

/**
 * Sanitize arrays of strings (for multi-select inputs)
 */
export function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  
  return input
    .filter(item => typeof item === 'string')
    .map(item => sanitizeText(item))
    .filter(item => item.length > 0)
    .slice(0, 20); // Reasonable array size limit
}

/**
 * Rate limiting validation - check if too many requests
 */
export function validateRequestFrequency(lastRequestTime: number, minInterval: number = 1000): boolean {
  const now = Date.now();
  return (now - lastRequestTime) >= minInterval;
}