import { useState, useCallback, useEffect } from 'react';
import { hasRecoverableData, getAutoSavedData, clearAutoSavedData } from '@/lib/auto-save';

export interface RecoveryData {
  hasData: boolean;
  data: any;
  timestamp: number | null;
  formType: string;
  storageSource: 'primary' | 'backup' | 'session' | 'emergency';
}

export interface RecoverySystemOptions {
  formKey: string;
  formType: string;
  autoCheck?: boolean;
  onRecoveryFound?: (data: RecoveryData) => void;
  onRecoveryCleared?: () => void;
}

/**
 * Comprehensive recovery system hook for managing unsaved data recovery
 * Provides unified interface for all recovery operations
 */
export function useRecoverySystem({
  formKey,
  formType,
  autoCheck = true,
  onRecoveryFound,
  onRecoveryCleared
}: RecoverySystemOptions) {
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check for recoverable data
  const checkForRecovery = useCallback((): RecoveryData | null => {
    try {
      const recoveryResult = hasRecoverableData(formKey);
      
      if (recoveryResult.hasData) {
        // Determine storage source by checking different locations
        let storageSource: 'primary' | 'backup' | 'session' | 'emergency' = 'primary';
        
        try {
          // Check primary storage
          if (localStorage.getItem(`autosave_${formKey}`)) {
            storageSource = 'primary';
          }
          // Check backup storage
          else if (localStorage.getItem(`backup_autosave_${formKey}`)) {
            storageSource = 'backup';
          }
          // Check session storage
          else if (sessionStorage.getItem(`session_autosave_${formKey}`)) {
            storageSource = 'session';
          }
          // Check emergency storage
          else if (sessionStorage.getItem(`emergency_autosave_${formKey}`)) {
            storageSource = 'emergency';
          }
        } catch (error) {
          console.warn('Error determining storage source:', error);
        }
        
        const data: RecoveryData = {
          hasData: true,
          data: recoveryResult.data,
          timestamp: recoveryResult.timestamp,
          formType,
          storageSource
        };
        
        return data;
      }
    } catch (error) {
      console.error('Error checking for recovery data:', error);
    }
    
    return null;
  }, [formKey, formType]);

  // Initialize recovery check
  useEffect(() => {
    if (autoCheck) {
      const data = checkForRecovery();
      if (data) {
        setRecoveryData(data);
        if (onRecoveryFound) {
          onRecoveryFound(data);
        }
      }
    }
  }, [autoCheck, checkForRecovery, onRecoveryFound]);

  // Show recovery dialog
  const showRecoveryDialog = useCallback((data?: RecoveryData) => {
    const dataToShow = data || recoveryData;
    if (dataToShow) {
      setRecoveryData(dataToShow);
      setIsDialogOpen(true);
    }
  }, [recoveryData]);

  // Hide recovery dialog
  const hideRecoveryDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  // Restore data handler
  const handleRestore = useCallback(async (data: any) => {
    setIsProcessing(true);
    try {
      // Return the data to be restored
      return data;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Discard data handler
  const handleDiscard = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Clear all auto-saved data
      clearAutoSavedData(formKey);
      
      // Clear recovery state
      setRecoveryData(null);
      
      if (onRecoveryCleared) {
        onRecoveryCleared();
      }
    } catch (error) {
      console.error('Error discarding recovery data:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [formKey, onRecoveryCleared]);

  // Manual recovery trigger
  const triggerRecovery = useCallback(() => {
    const data = checkForRecovery();
    if (data) {
      showRecoveryDialog(data);
      return true;
    }
    return false;
  }, [checkForRecovery, showRecoveryDialog]);

  // Get recovery status
  const getRecoveryStatus = useCallback(() => {
    const data = checkForRecovery();
    return {
      hasRecovery: !!data,
      timestamp: data?.timestamp || null,
      storageSource: data?.storageSource || null,
      dataAge: data?.timestamp ? Date.now() - data.timestamp : null
    };
  }, [checkForRecovery]);

  // Clear recovery data manually
  const clearRecovery = useCallback(() => {
    clearAutoSavedData(formKey);
    setRecoveryData(null);
    if (onRecoveryCleared) {
      onRecoveryCleared();
    }
  }, [formKey, onRecoveryCleared]);

  return {
    // State
    recoveryData,
    isDialogOpen,
    isProcessing,
    
    // Actions
    showRecoveryDialog,
    hideRecoveryDialog,
    handleRestore,
    handleDiscard,
    triggerRecovery,
    clearRecovery,
    
    // Status
    getRecoveryStatus,
    hasRecovery: !!recoveryData,
    
    // Utilities
    checkForRecovery
  };
}

/**
 * Utility function to clear auto-saved data
 */
export function clearAutoSavedData(formKey: string) {
  const keys = [
    `autosave_${formKey}`,
    `autosave_${formKey}_timestamp`,
    `backup_autosave_${formKey}`,
    `backup_autosave_${formKey}_timestamp`
  ];
  
  keys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage key: ${key}`);
    }
  });
  
  // Clear session storage
  const sessionKeys = [
    `session_autosave_${formKey}`,
    `session_autosave_${formKey}_timestamp`,
    `emergency_autosave_${formKey}`,
    `emergency_autosave_${formKey}_timestamp`
  ];
  
  sessionKeys.forEach(key => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove sessionStorage key: ${key}`);
    }
  });
}

/**
 * Hook for mobile recovery notifications
 */
export function useMobileRecovery(formKey: string, formType: string) {
  const [showMobileNotification, setShowMobileNotification] = useState(false);
  const [mobileRecoveryData, setMobileRecoveryData] = useState<any>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const checkMobileRecovery = useCallback(() => {
    if (!isMobile) return false;
    
    const recoveryResult = hasRecoverableData(formKey);
    if (recoveryResult.hasData) {
      setMobileRecoveryData(recoveryResult.data);
      setShowMobileNotification(true);
      return true;
    }
    return false;
  }, [formKey, isMobile]);

  const hideMobileNotification = useCallback(() => {
    setShowMobileNotification(false);
  }, []);

  const handleMobileRestore = useCallback((onRestore: (data: any) => void) => {
    if (mobileRecoveryData) {
      onRestore(mobileRecoveryData);
      hideMobileNotification();
    }
  }, [mobileRecoveryData, hideMobileNotification]);

  const handleMobileDiscard = useCallback(() => {
    clearAutoSavedData(formKey);
    setMobileRecoveryData(null);
    hideMobileNotification();
  }, [formKey, hideMobileNotification]);

  return {
    showMobileNotification,
    mobileRecoveryData,
    isMobile,
    checkMobileRecovery,
    hideMobileNotification,
    handleMobileRestore,
    handleMobileDiscard
  };
}