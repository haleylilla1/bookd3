/**
 * Secure Input Components
 * Wrappers around UI components with built-in sanitization and validation
 */

import { forwardRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clientValidation, sanitizeText, sanitizeEmail, sanitizeAddress, sanitizePhone, sanitizeCurrency } from "@/utils/validation";
import { cn } from "@/lib/utils";

interface SecureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sanitizationType?: 'text' | 'email' | 'address' | 'phone' | 'currency';
  onSanitizedChange?: (value: string) => void;
  showValidation?: boolean;
  maxLength?: number;
}

// Secure text input with real-time sanitization
export const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(
  ({ 
    sanitizationType = 'text', 
    onSanitizedChange, 
    onChange, 
    showValidation = false,
    maxLength = 500,
    className,
    ...props 
  }, ref) => {
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      let sanitizedValue = e.target.value;
      
      // Apply length limit
      if (sanitizedValue.length > maxLength) {
        sanitizedValue = sanitizedValue.slice(0, maxLength);
      }
      
      // Apply sanitization based on type
      switch (sanitizationType) {
        case 'email':
          sanitizedValue = sanitizeEmail(sanitizedValue);
          break;
        case 'address':
          sanitizedValue = sanitizeAddress(sanitizedValue);
          break;
        case 'phone':
          sanitizedValue = sanitizePhone(sanitizedValue);
          break;
        case 'currency':
          sanitizedValue = sanitizeCurrency(sanitizedValue);
          break;
        default:
          sanitizedValue = sanitizeText(sanitizedValue);
      }
      
      // Update the input value if it was changed by sanitization
      if (e.target.value !== sanitizedValue) {
        e.target.value = sanitizedValue;
      }
      
      // Validation if enabled
      if (showValidation) {
        let error = null;
        switch (sanitizationType) {
          case 'email':
            error = clientValidation.validateEmail(sanitizedValue);
            break;
        }
        setValidationError(error);
      }
      
      // Call callbacks
      onSanitizedChange?.(sanitizedValue);
      onChange?.(e);
    }, [sanitizationType, onSanitizedChange, onChange, showValidation, maxLength]);

    return (
      <div>
        <Input
          ref={ref}
          onChange={handleChange}
          className={cn(
            validationError && "border-destructive",
            className
          )}
          {...props}
        />
        {showValidation && validationError && (
          <p className="text-sm text-destructive mt-1">{validationError}</p>
        )}
      </div>
    );
  }
);

SecureInput.displayName = "SecureInput";

interface SecureTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSanitizedChange?: (value: string) => void;
  maxLength?: number;
}

// Secure textarea with sanitization
export const SecureTextarea = forwardRef<HTMLTextAreaElement, SecureTextareaProps>(
  ({ onSanitizedChange, onChange, maxLength = 1000, className, ...props }, ref) => {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let sanitizedValue = sanitizeText(e.target.value);
      
      // Apply length limit
      if (sanitizedValue.length > maxLength) {
        sanitizedValue = sanitizedValue.slice(0, maxLength);
      }
      
      // Update the textarea value if it was changed by sanitization
      if (e.target.value !== sanitizedValue) {
        e.target.value = sanitizedValue;
      }
      
      onSanitizedChange?.(sanitizedValue);
      onChange?.(e);
    }, [onSanitizedChange, onChange, maxLength]);

    return (
      <Textarea
        ref={ref}
        onChange={handleChange}
        className={className}
        {...props}
      />
    );
  }
);

SecureTextarea.displayName = "SecureTextarea";

// Currency input with formatting
export const CurrencyInput = forwardRef<HTMLInputElement, SecureInputProps>(
  ({ onSanitizedChange, onChange, ...props }, ref) => {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9.]/g, ''); // Allow only numbers and decimal
      const sanitized = sanitizeCurrency(value);
      
      e.target.value = sanitized;
      onSanitizedChange?.(sanitized);
      onChange?.(e);
    }, [onSanitizedChange, onChange]);

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          ref={ref}
          onChange={handleChange}
          className="pl-8"
          placeholder="0.00"
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

// Percentage input with validation
export const PercentageInput = forwardRef<HTMLInputElement, SecureInputProps>(
  ({ onSanitizedChange, onChange, ...props }, ref) => {
    const [error, setError] = useState<string | null>(null);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9.]/g, '');
      const num = parseFloat(value);
      
      if (value && (isNaN(num) || num < 0 || num > 100)) {
        setError('Must be between 0 and 100');
      } else {
        setError(null);
      }
      
      onSanitizedChange?.(value);
      onChange?.(e);
    }, [onSanitizedChange, onChange]);

    return (
      <div>
        <div className="relative">
          <Input
            ref={ref}
            onChange={handleChange}
            className={cn(error && "border-destructive", "pr-8")}
            placeholder="25"
            {...props}
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            %
          </span>
        </div>
        {error && (
          <p className="text-sm text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  }
);

PercentageInput.displayName = "PercentageInput";