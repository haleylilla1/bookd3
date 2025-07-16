import { useEffect, useRef, useCallback } from 'react';

interface AutoSaveConfig {
  key: string;
  data: any;
  enabled?: boolean;
  delay?: number;
  onSave?: (data: any) => void;
  onError?: (error: Error) => void;
  mobileOptimized?: boolean;
}

// Mobile-optimized auto-save with bulletproof local storage
export function useAutoSave<T>({
  key,
  data,
  enabled = true,
  delay = 1000,
  onSave,
  onError,
  mobileOptimized = true
}: AutoSaveConfig) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const previousDataRef = useRef<string>();
  const persistenceCheckRef = useRef<NodeJS.Timeout>();

  const saveData = useCallback((dataToSave: any) => {
    try {
      const serializedData = JSON.stringify(dataToSave);
      
      // Only save if data has actually changed
      if (serializedData !== previousDataRef.current) {
        const timestamp = Date.now().toString();
        
        if (mobileOptimized) {
          // Efficient mobile storage: Primary + critical backup only
          try {
            // Primary storage with immediate validation
            localStorage.setItem(`autosave_${key}`, serializedData);
            localStorage.setItem(`autosave_${key}_timestamp`, timestamp);
            
            // Verify primary storage immediately
            const verification = localStorage.getItem(`autosave_${key}`);
            if (verification !== serializedData) {
              throw new Error('Primary storage verification failed');
            }
            
            // Only create backup if primary succeeded
            localStorage.setItem(`backup_autosave_${key}`, serializedData);
            localStorage.setItem(`backup_autosave_${key}_timestamp`, timestamp);
            
          } catch (localStorageError) {
            // Fallback to session storage if localStorage fails
            try {
              sessionStorage.setItem(`session_autosave_${key}`, serializedData);
              sessionStorage.setItem(`session_autosave_${key}_timestamp`, timestamp);
            } catch (sessionError) {
              // Final fallback: emergency storage
              sessionStorage.setItem(`emergency_autosave_${key}`, serializedData);
              sessionStorage.setItem(`emergency_autosave_${key}_timestamp`, timestamp);
            }
          }
        } else {
          // Standard storage for desktop
          localStorage.setItem(`autosave_${key}`, serializedData);
          localStorage.setItem(`autosave_${key}_timestamp`, timestamp);
        }
        
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
  }, [key, onSave, onError, mobileOptimized]);

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

  // Mobile-specific: Optimized event handling for critical save scenarios
  useEffect(() => {
    if (!mobileOptimized || !enabled) return;

    let isHandlingEvent = false;
    
    const handleCriticalSave = () => {
      if (data && !isHandlingEvent) {
        isHandlingEvent = true;
        saveData(data);
        // Reset flag after a brief delay
        setTimeout(() => { isHandlingEvent = false; }, 100);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleCriticalSave();
      }
    };

    const handleBeforeUnload = () => {
      handleCriticalSave();
    };

    const handlePageHide = () => {
      handleCriticalSave();
    };

    // Optimized Android keyboard detection
    let lastHeight = window.innerHeight;
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      // Only trigger if height change is significant (keyboard-like)
      if (Math.abs(currentHeight - lastHeight) > 150) {
        handleCriticalSave();
        lastHeight = currentHeight;
      }
    };

    // Add event listeners with passive option for better performance
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload, { passive: true });
    window.addEventListener('pagehide', handlePageHide, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('resize', handleResize);
    };
  }, [data, enabled, mobileOptimized, saveData]);

  return {
    saveNow: () => saveData(data),
    clearSave: () => {
      // Clear all storage locations
      localStorage.removeItem(`autosave_${key}`);
      localStorage.removeItem(`autosave_${key}_timestamp`);
      localStorage.removeItem(`backup_autosave_${key}`);
      localStorage.removeItem(`backup_autosave_${key}_timestamp`);
      try {
        sessionStorage.removeItem(`session_autosave_${key}`);
        sessionStorage.removeItem(`session_autosave_${key}_timestamp`);
        sessionStorage.removeItem(`emergency_autosave_${key}`);
        sessionStorage.removeItem(`emergency_autosave_${key}_timestamp`);
      } catch (error) {
        console.warn('Session storage clear failed');
      }
    }
  };
}

// Optimized retrieval with smart fallback chain
export function getAutoSavedData<T>(key: string): { data: T | null; timestamp: number | null } {
  const storageSources = [
    { name: 'primary', storage: localStorage, prefix: 'autosave_' },
    { name: 'backup', storage: localStorage, prefix: 'backup_autosave_' },
    { name: 'session', storage: sessionStorage, prefix: 'session_autosave_' },
    { name: 'emergency', storage: sessionStorage, prefix: 'emergency_autosave_' }
  ];
  
  for (const source of storageSources) {
    try {
      const savedData = source.storage.getItem(`${source.prefix}${key}`);
      const timestamp = source.storage.getItem(`${source.prefix}${key}_timestamp`);
      
      if (savedData && timestamp) {
        const parsedData = JSON.parse(savedData);
        const parsedTimestamp = parseInt(timestamp);
        
        // Validate data integrity
        if (parsedData && parsedTimestamp && !isNaN(parsedTimestamp)) {
          if (source.name !== 'primary') {
            console.log(`Recovered from ${source.name} storage`);
          }
          return {
            data: parsedData,
            timestamp: parsedTimestamp
          };
        }
      }
    } catch (error) {
      console.error(`${source.name} storage failed:`, error);
      continue;
    }
  }
  
  return { data: null, timestamp: null };
}

// Clear auto-saved data from all storage locations
export function clearAutoSavedData(key: string) {
  // Clear localStorage
  localStorage.removeItem(`autosave_${key}`);
  localStorage.removeItem(`autosave_${key}_timestamp`);
  localStorage.removeItem(`backup_autosave_${key}`);
  localStorage.removeItem(`backup_autosave_${key}_timestamp`);
  
  // Clear sessionStorage
  try {
    sessionStorage.removeItem(`session_autosave_${key}`);
    sessionStorage.removeItem(`session_autosave_${key}_timestamp`);
    sessionStorage.removeItem(`emergency_autosave_${key}`);
    sessionStorage.removeItem(`emergency_autosave_${key}_timestamp`);
  } catch (error) {
    console.warn('Session storage clear failed');
  }
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

// Simple form submission with retry
export async function submitFormWithRetry<T>(
  data: T,
  url: string,
  options: {
    autoSaveKey?: string;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<any> {
  try {
    const { fetchWithRetry } = await import('./mobile-optimization');
    
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
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

// Optimized recovery detection with smart content validation
export function hasRecoverableData(formKey: string): { hasData: boolean; timestamp: number | null; data: any } {
  try {
    const { data, timestamp } = getAutoSavedData(formKey);
    
    if (data && timestamp) {
      const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
      
      // Only consider data recoverable if it's less than 30 minutes old
      if (ageInMinutes < 30) {
        // Smart content validation: check for meaningful form data
        const hasContent = Object.entries(data).some(([key, value]) => {
          // Skip empty values and default form states
          if (value === null || value === undefined || value === '' || value === 0) return false;
          
          // Check for meaningful string content (not just whitespace)
          if (typeof value === 'string' && value.trim().length > 0) return true;
          
          // Check for non-empty arrays
          if (Array.isArray(value) && value.length > 0) return true;
          
          // Check for boolean values (meaningful for form fields)
          if (typeof value === 'boolean') return true;
          
          // Check for meaningful numbers (not just 0)
          if (typeof value === 'number' && value !== 0) return true;
          
          return false;
        });
        
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

// Auto-save form data hook with intelligent timing and mobile optimization
export function useFormAutoSave<T>(
  formKey: string,
  formData: T,
  enabled: boolean = true
) {
  // Smart delay: Shorter for mobile, longer for desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const optimizedDelay = isMobile ? 1200 : 2000; // 1.2s mobile, 2s desktop
  
  const { saveNow, clearSave } = useAutoSave({
    key: formKey,
    data: formData,
    enabled,
    delay: optimizedDelay,
    mobileOptimized: isMobile
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