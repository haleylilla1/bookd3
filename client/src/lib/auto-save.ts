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
        // Mobile-optimized: Multiple storage attempts with validation
        if (mobileOptimized) {
          // Primary storage attempt
          localStorage.setItem(`autosave_${key}`, serializedData);
          localStorage.setItem(`autosave_${key}_timestamp`, Date.now().toString());
          
          // Mobile Safari fix: Additional backup with alternate key
          localStorage.setItem(`backup_autosave_${key}`, serializedData);
          localStorage.setItem(`backup_autosave_${key}_timestamp`, Date.now().toString());
          
          // Session storage fallback for mobile browsers
          try {
            sessionStorage.setItem(`session_autosave_${key}`, serializedData);
            sessionStorage.setItem(`session_autosave_${key}_timestamp`, Date.now().toString());
          } catch (sessionError) {
            console.warn('Session storage failed, continuing with localStorage only');
          }
          
          // Mobile-specific: Validate storage immediately
          const verification = localStorage.getItem(`autosave_${key}`);
          if (verification !== serializedData) {
            console.warn('Storage verification failed, retrying...');
            // Retry once more
            localStorage.setItem(`autosave_${key}`, serializedData);
            localStorage.setItem(`autosave_${key}_timestamp`, Date.now().toString());
          }
        } else {
          // Standard storage
          localStorage.setItem(`autosave_${key}`, serializedData);
          localStorage.setItem(`autosave_${key}_timestamp`, Date.now().toString());
        }
        
        previousDataRef.current = serializedData;
        
        if (onSave) {
          onSave(dataToSave);
        }
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      
      // Mobile fallback: Try session storage if localStorage fails
      if (mobileOptimized) {
        try {
          const serializedData = JSON.stringify(dataToSave);
          sessionStorage.setItem(`emergency_autosave_${key}`, serializedData);
          sessionStorage.setItem(`emergency_autosave_${key}_timestamp`, Date.now().toString());
          console.log('Emergency fallback storage succeeded');
        } catch (fallbackError) {
          console.error('All storage methods failed');
        }
      }
      
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

  // Mobile-specific: Add visibility change listener for tab switching
  useEffect(() => {
    if (!mobileOptimized || !enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && data) {
        // Mobile Safari fix: Force save when tab becomes hidden
        saveData(data);
      }
    };

    const handleBeforeUnload = () => {
      if (data) {
        // Final save attempt before page unload
        saveData(data);
      }
    };

    const handlePageHide = () => {
      if (data) {
        // iOS Safari specific: Save on page hide
        saveData(data);
      }
    };

    // Add mobile-specific event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Mobile keyboard handling
    const handleResize = () => {
      // Android keyboard detection: Save data when viewport changes
      if (data && window.innerHeight < screen.height * 0.75) {
        saveData(data);
      }
    };

    window.addEventListener('resize', handleResize);

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

// Bulletproof retrieval with multiple fallback sources
export function getAutoSavedData<T>(key: string): { data: T | null; timestamp: number | null } {
  // Try primary storage first
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
    console.error('Primary storage failed:', error);
  }
  
  // Try backup storage
  try {
    const backupData = localStorage.getItem(`backup_autosave_${key}`);
    const backupTimestamp = localStorage.getItem(`backup_autosave_${key}_timestamp`);
    
    if (backupData && backupTimestamp) {
      console.log('Recovered from backup storage');
      return {
        data: JSON.parse(backupData),
        timestamp: parseInt(backupTimestamp)
      };
    }
  } catch (error) {
    console.error('Backup storage failed:', error);
  }
  
  // Try session storage fallback
  try {
    const sessionData = sessionStorage.getItem(`session_autosave_${key}`);
    const sessionTimestamp = sessionStorage.getItem(`session_autosave_${key}_timestamp`);
    
    if (sessionData && sessionTimestamp) {
      console.log('Recovered from session storage');
      return {
        data: JSON.parse(sessionData),
        timestamp: parseInt(sessionTimestamp)
      };
    }
  } catch (error) {
    console.error('Session storage failed:', error);
  }
  
  // Try emergency storage
  try {
    const emergencyData = sessionStorage.getItem(`emergency_autosave_${key}`);
    const emergencyTimestamp = sessionStorage.getItem(`emergency_autosave_${key}_timestamp`);
    
    if (emergencyData && emergencyTimestamp) {
      console.log('Recovered from emergency storage');
      return {
        data: JSON.parse(emergencyData),
        timestamp: parseInt(emergencyTimestamp)
      };
    }
  } catch (error) {
    console.error('Emergency storage failed:', error);
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

// Auto-save form data hook with mobile-optimized recovery
export function useFormAutoSave<T>(
  formKey: string,
  formData: T,
  enabled: boolean = true
) {
  const { saveNow, clearSave } = useAutoSave({
    key: formKey,
    data: formData,
    enabled,
    delay: 1500, // Mobile-optimized: Save every 1.5 seconds
    mobileOptimized: true
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