/**
 * BULLETPROOF MOBILE AUTO-SAVE SYSTEM
 * Addresses: Safari tab switching, Android keyboard interference, network timeouts
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface BulletproofAutoSaveConfig<T> {
  key: string;
  data: T;
  enabled?: boolean;
  onSave?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface SaveAttempt {
  timestamp: number;
  data: string;
  success: boolean;
}

export function useBulletproofMobileAutoSave<T>({
  key,
  data,
  enabled = true,
  onSave,
  onError
}: BulletproofAutoSaveConfig<T>) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastDataRef = useRef<string>('');
  const saveAttemptsRef = useRef<SaveAttempt[]>([]);
  const isTabSwitchingRef = useRef(false);
  const keyboardOpenRef = useRef(false);
  const forceSaveRef = useRef(false);

  // Multi-layer storage with immediate verification
  const executeMultiLayerSave = useCallback((dataToSave: T, isEmergency = false) => {
    const serializedData = JSON.stringify(dataToSave);
    const timestamp = Date.now();
    let successCount = 0;
    const errors: string[] = [];

    // Layer 1: Primary localStorage with immediate verification
    try {
      localStorage.setItem(`autosave_${key}`, serializedData);
      localStorage.setItem(`autosave_${key}_timestamp`, timestamp.toString());
      
      // CRITICAL: Immediate verification to catch Safari issues
      const verification = localStorage.getItem(`autosave_${key}`);
      if (verification === serializedData) {
        successCount++;
      } else {
        throw new Error('Primary storage verification failed');
      }
    } catch (error) {
      errors.push(`Primary storage failed: ${error}`);
    }

    // Layer 2: Backup localStorage (different key pattern)
    try {
      localStorage.setItem(`backup_${key}_autosave`, serializedData);
      localStorage.setItem(`backup_${key}_timestamp`, timestamp.toString());
      
      const backupVerification = localStorage.getItem(`backup_${key}_autosave`);
      if (backupVerification === serializedData) {
        successCount++;
      }
    } catch (error) {
      errors.push(`Backup storage failed: ${error}`);
    }

    // Layer 3: Session storage (survives tab switches in most browsers)
    try {
      sessionStorage.setItem(`session_${key}_autosave`, serializedData);
      sessionStorage.setItem(`session_${key}_timestamp`, timestamp.toString());
      
      const sessionVerification = sessionStorage.getItem(`session_${key}_autosave`);
      if (sessionVerification === serializedData) {
        successCount++;
      }
    } catch (error) {
      errors.push(`Session storage failed: ${error}`);
    }

    // Layer 4: Emergency in-memory storage (last resort)
    if (successCount === 0) {
      try {
        (window as any)[`emergency_${key}`] = {
          data: serializedData,
          timestamp: timestamp
        };
        successCount++;
      } catch (error) {
        errors.push(`Emergency storage failed: ${error}`);
      }
    }

    // Record save attempt for analysis
    saveAttemptsRef.current.push({
      timestamp,
      data: serializedData,
      success: successCount > 0
    });

    // Keep only last 10 attempts
    if (saveAttemptsRef.current.length > 10) {
      saveAttemptsRef.current.shift();
    }

    return { success: successCount > 0, successCount, errors };
  }, [key]);

  const performSave = useCallback(async (isEmergency = false) => {
    if (!data || !enabled) return;

    const serializedData = JSON.stringify(data);
    
    // Skip if data hasn't changed (unless it's an emergency save)
    if (!isEmergency && serializedData === lastDataRef.current) {
      return;
    }

    setSaveStatus('saving');

    try {
      const result = executeMultiLayerSave(data, isEmergency);
      
      if (result.success) {
        lastDataRef.current = serializedData;
        setLastSaved(new Date());
        setSaveStatus('saved');
        
        if (onSave) {
          onSave(data);
        }

        // Clear saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } else {
        throw new Error(`All storage layers failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Bulletproof save failed:', error);
      setSaveStatus('error');
      
      if (onError) {
        onError(error as Error);
      }

      // Clear error status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  }, [data, enabled, executeMultiLayerSave, onSave, onError]);

  // Smart delay based on device and context
  const getOptimalDelay = useCallback(() => {
    const isMobile = window.innerWidth <= 768;
    const isSlowConnection = (navigator as any).connection?.effectiveType?.includes('2g');
    
    if (forceSaveRef.current) return 0; // Immediate for emergency saves
    if (isTabSwitchingRef.current) return 50; // Very fast for tab switches
    if (keyboardOpenRef.current) return 200; // Fast for keyboard events
    if (isMobile) return 800; // Mobile optimized
    if (isSlowConnection) return 1500; // Slower for bad connections
    return 1200; // Default
  }, []);

  // Enhanced mobile event detection
  useEffect(() => {
    if (!enabled) return;

    let lastHeight = window.innerHeight;
    let visibilityTimer: NodeJS.Timeout;

    // 1. Tab switching detection (Safari's main weakness)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isTabSwitchingRef.current = true;
        forceSaveRef.current = true;
        
        // Emergency save before tab switch
        performSave(true);
        
        // Reset flags after tab switch
        visibilityTimer = setTimeout(() => {
          isTabSwitchingRef.current = false;
          forceSaveRef.current = false;
        }, 1000);
      }
    };

    // 2. Page unload/hide (iOS Safari specific)
    const handlePageHide = (e: PageTransitionEvent) => {
      forceSaveRef.current = true;
      performSave(true);
    };

    // 3. Before unload (standard browsers)
    const handleBeforeUnload = () => {
      forceSaveRef.current = true;
      performSave(true);
    };

    // 4. Enhanced Android keyboard detection
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = Math.abs(currentHeight - lastHeight);
      
      // Detect keyboard open/close
      if (heightDiff > 150) {
        const keyboardWasOpen = keyboardOpenRef.current;
        keyboardOpenRef.current = currentHeight < lastHeight;
        
        // Save when keyboard closes (user likely finished typing)
        if (keyboardWasOpen && !keyboardOpenRef.current) {
          forceSaveRef.current = true;
          performSave(true);
        }
        
        lastHeight = currentHeight;
      }
    };

    // 5. Network state changes
    const handleOnline = () => {
      // When back online, attempt to save current data
      if (data) {
        forceSaveRef.current = true;
        performSave(true);
      }
    };

    // 6. App focus/blur (PWA behavior)
    const handleFocus = () => {
      forceSaveRef.current = false;
    };

    const handleBlur = () => {
      forceSaveRef.current = true;
      performSave(true);
    };

    // Add all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('pagehide', handlePageHide, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('online', handleOnline, { passive: true });
    window.addEventListener('focus', handleFocus, { passive: true });
    window.addEventListener('blur', handleBlur, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      
      if (visibilityTimer) {
        clearTimeout(visibilityTimer);
      }
    };
  }, [enabled, performSave, data]);

  // Regular auto-save with intelligent delay
  useEffect(() => {
    if (!enabled || !data) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const delay = getOptimalDelay();
    
    saveTimeoutRef.current = setTimeout(() => {
      performSave(false);
    }, delay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, enabled, getOptimalDelay, performSave]);

  // Manual save function
  const saveNow = useCallback(() => {
    forceSaveRef.current = true;
    performSave(true);
  }, [performSave]);

  // Recovery function with enhanced fallback chain
  const recoverData = useCallback((): T | null => {
    const attempts = [
      () => localStorage.getItem(`autosave_${key}`),
      () => localStorage.getItem(`backup_${key}_autosave`),
      () => sessionStorage.getItem(`session_${key}_autosave`),
      () => (window as any)[`emergency_${key}`]?.data
    ];

    for (const attempt of attempts) {
      try {
        const data = attempt();
        if (data) {
          return JSON.parse(typeof data === 'string' ? data : data);
        }
      } catch (error) {
        continue; // Try next fallback
      }
    }

    return null;
  }, [key]);

  // Clear all saved data
  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(`autosave_${key}`);
      localStorage.removeItem(`autosave_${key}_timestamp`);
      localStorage.removeItem(`backup_${key}_autosave`);
      localStorage.removeItem(`backup_${key}_timestamp`);
      sessionStorage.removeItem(`session_${key}_autosave`);
      sessionStorage.removeItem(`session_${key}_timestamp`);
      delete (window as any)[`emergency_${key}`];
    } catch (error) {
      console.warn('Error clearing saved data:', error);
    }
  }, [key]);

  // Get save statistics for debugging
  const getSaveStats = useCallback(() => {
    const recentAttempts = saveAttemptsRef.current.slice(-5);
    const successRate = recentAttempts.length > 0 
      ? recentAttempts.filter(a => a.success).length / recentAttempts.length 
      : 0;

    return {
      lastSaved,
      saveStatus,
      totalAttempts: saveAttemptsRef.current.length,
      recentSuccessRate: Math.round(successRate * 100),
      isTabSwitching: isTabSwitchingRef.current,
      isKeyboardOpen: keyboardOpenRef.current
    };
  }, [lastSaved, saveStatus]);

  return {
    lastSaved,
    saveStatus,
    saveNow,
    recoverData,
    clearSavedData,
    getSaveStats
  };
}