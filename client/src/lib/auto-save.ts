import { useEffect, useRef, useCallback } from 'react';

interface AutoSaveConfig {
  key: string;
  data: any;
  enabled?: boolean;
  delay?: number;
  onSave?: (data: any) => void;
  onError?: (error: Error) => void;
}

// Local storage auto-save hook
export function useAutoSave<T>({
  key,
  data,
  enabled = true,
  delay = 1000,
  onSave,
  onError
}: AutoSaveConfig) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const previousDataRef = useRef<string>();

  const saveData = useCallback((dataToSave: any) => {
    try {
      const serializedData = JSON.stringify(dataToSave);
      
      // Only save if data has actually changed
      if (serializedData !== previousDataRef.current) {
        localStorage.setItem(`autosave_${key}`, serializedData);
        localStorage.setItem(`autosave_${key}_timestamp`, Date.now().toString());
        previousDataRef.current = serializedData;
        
        if (onSave) {
          onSave(dataToSave);
        }
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }, [key, onSave, onError]);

  useEffect(() => {
    if (!enabled || !data) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      saveData(data);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, delay, saveData]);

  return {
    saveNow: () => saveData(data),
    clearSave: () => {
      localStorage.removeItem(`autosave_${key}`);
      localStorage.removeItem(`autosave_${key}_timestamp`);
    }
  };
}

// Retrieve auto-saved data
export function getAutoSavedData<T>(key: string): { data: T | null; timestamp: number | null } {
  try {
    const savedData = localStorage.getItem(`autosave_${key}`);
    const timestamp = localStorage.getItem(`autosave_${key}_timestamp`);
    
    if (savedData && timestamp) {
      return {
        data: JSON.parse(savedData),
        timestamp: parseInt(timestamp)
      };
    }
  } catch (error) {
    console.error('Failed to retrieve auto-saved data:', error);
  }
  
  return { data: null, timestamp: null };
}

// Clear auto-saved data
export function clearAutoSavedData(key: string) {
  localStorage.removeItem(`autosave_${key}`);
  localStorage.removeItem(`autosave_${key}_timestamp`);
}

// Network error retry system
export class NetworkRetryHandler {
  private retryCount = 0;
  private maxRetries = 3;
  private baseDelay = 1000;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number) => void,
    onError?: (error: Error, attempt: number) => void
  ): Promise<T> {
    try {
      const result = await operation();
      this.retryCount = 0; // Reset on success
      return result;
    } catch (error) {
      this.retryCount++;
      
      if (onError) {
        onError(error as Error, this.retryCount);
      }

      if (this.retryCount >= this.maxRetries) {
        throw new Error(`Operation failed after ${this.maxRetries} attempts: ${(error as Error).message}`);
      }

      if (onRetry) {
        onRetry(this.retryCount);
      }

      // Exponential backoff
      const delay = this.baseDelay * Math.pow(2, this.retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.executeWithRetry(operation, onRetry, onError);
    }
  }

  reset() {
    this.retryCount = 0;
  }
}

// Form submission with auto-save and retry
export async function submitFormWithRetry<T>(
  data: T,
  submitFunction: (data: T) => Promise<any>,
  options: {
    autoSaveKey?: string;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<any> {
  const retryHandler = new NetworkRetryHandler();
  
  try {
    const result = await retryHandler.executeWithRetry(
      () => submitFunction(data),
      options.onRetry,
      options.onError
    );
    
    // Clear auto-saved data on successful submission
    if (options.autoSaveKey) {
      clearAutoSavedData(options.autoSaveKey);
    }
    
    if (options.onSuccess) {
      options.onSuccess(result);
    }
    
    return result;
  } catch (error) {
    if (options.onError) {
      options.onError(error as Error);
    }
    throw error;
  }
}

// Enhanced recovery detection
export function hasRecoverableData(formKey: string): { hasData: boolean; timestamp: number | null; data: any } {
  try {
    const { data, timestamp } = getAutoSavedData(formKey);
    
    if (data && timestamp) {
      const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
      
      // Only consider data recoverable if it's less than 30 minutes old
      if (ageInMinutes < 30) {
        // Check if data has meaningful content (not just empty/default values)
        const hasContent = Object.values(data).some(value => 
          value !== null && value !== undefined && value !== '' && value !== 0
        );
        
        if (hasContent) {
          return { hasData: true, timestamp, data };
        }
      }
    }
  } catch (error) {
    console.error('Error checking recoverable data:', error);
  }
  
  return { hasData: false, timestamp: null, data: null };
}

// Auto-save form data hook with enhanced recovery detection
export function useFormAutoSave<T>(
  formKey: string,
  formData: T,
  enabled: boolean = true
) {
  const { saveNow, clearSave } = useAutoSave({
    key: formKey,
    data: formData,
    enabled,
    delay: 2000 // Auto-save every 2 seconds
  });

  const restoreData = useCallback(() => {
    const { data, timestamp } = getAutoSavedData<T>(formKey);
    
    if (data && timestamp) {
      const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
      
      // Only restore if data is less than 30 minutes old
      if (ageInMinutes < 30) {
        return data;
      }
    }
    
    return null;
  }, [formKey]);

  const checkForRecovery = useCallback(() => {
    return hasRecoverableData(formKey);
  }, [formKey]);

  return {
    saveNow,
    clearSave,
    restoreData,
    checkForRecovery
  };
}