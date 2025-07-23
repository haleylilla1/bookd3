import React from 'react';
import { CheckCircle, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from './auto-save-indicator';

interface MobileAutoSaveIndicatorProps {
  lastSaved: Date | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  storageMethod?: 'localStorage' | 'sessionStorage' | 'backup' | 'emergency';
}

export function MobileAutoSaveIndicator({ 
  lastSaved, 
  isSaving, 
  hasUnsavedChanges,
  storageMethod = 'localStorage'
}: MobileAutoSaveIndicatorProps) {
  const isOnline = useOnlineStatus();
  
  const getStatusColor = () => {
    if (isSaving) return 'text-blue-500';
    if (hasUnsavedChanges) return 'text-amber-500';
    if (lastSaved) return 'text-green-500';
    return 'text-gray-400';
  };

  const getStatusIcon = () => {
    if (isSaving) return <Clock className="w-3 h-3 animate-spin" />;
    if (hasUnsavedChanges) return <AlertCircle className="w-3 h-3" />;
    if (lastSaved) return <CheckCircle className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  const getStatusText = () => {
    if (isSaving) return 'Saving...';
    if (hasUnsavedChanges) return 'Unsaved changes';
    if (lastSaved) {
      const timeAgo = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (timeAgo < 60) return 'Saved just now';
      if (timeAgo < 3600) return `Saved ${Math.floor(timeAgo / 60)}m ago`;
      return `Saved ${Math.floor(timeAgo / 3600)}h ago`;
    }
    return 'Not saved';
  };

  const getStorageIndicator = () => {
    switch (storageMethod) {
      case 'backup':
        return '🔄 Backup';
      case 'sessionStorage':
        return '📱 Session';
      case 'emergency':
        return '⚡ Emergency';
      default:
        return '💾 Local';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border text-xs">
      {/* Connection Status */}
      <div className="flex items-center gap-1">
        {isOnline ? (
          <Wifi className="w-3 h-3 text-green-500" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-500" />
        )}
        <span className="text-gray-600 dark:text-gray-400">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

      {/* Auto-save Status */}
      <div className="flex items-center gap-1">
        <span className={getStatusColor()}>
          {getStatusIcon()}
        </span>
        <span className={getStatusColor()}>
          {getStatusText()}
        </span>
      </div>

      {/* Storage Method Indicator */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-xs">
          {getStorageIndicator()}
        </span>
      </div>
    </div>
  );
}

// Mobile-specific auto-save status hook
export function useMobileAutoSaveStatus(formKey: string) {
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [storageMethod, setStorageMethod] = React.useState<'localStorage' | 'sessionStorage' | 'backup' | 'emergency'>('localStorage');

  // Monitor storage events for mobile
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `autosave_${formKey}_timestamp`) {
        setLastSaved(new Date());
        setStorageMethod('localStorage');
      } else if (e.key === `backup_autosave_${formKey}_timestamp`) {
        setLastSaved(new Date());
        setStorageMethod('backup');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [formKey]);

  // Check for existing saved data on mount
  React.useEffect(() => {
    const checkExistingData = () => {
      // Check primary storage first
      const primaryTimestamp = localStorage.getItem(`autosave_${formKey}_timestamp`);
      if (primaryTimestamp) {
        setLastSaved(new Date(parseInt(primaryTimestamp)));
        setStorageMethod('localStorage');
        return;
      }

      // Check backup storage
      const backupTimestamp = localStorage.getItem(`backup_autosave_${formKey}_timestamp`);
      if (backupTimestamp) {
        setLastSaved(new Date(parseInt(backupTimestamp)));
        setStorageMethod('backup');
        return;
      }

      // Check session storage
      try {
        const sessionTimestamp = sessionStorage.getItem(`session_autosave_${formKey}_timestamp`);
        if (sessionTimestamp) {
          setLastSaved(new Date(parseInt(sessionTimestamp)));
          setStorageMethod('sessionStorage');
          return;
        }

        // Check emergency storage
        const emergencyTimestamp = sessionStorage.getItem(`emergency_autosave_${formKey}_timestamp`);
        if (emergencyTimestamp) {
          setLastSaved(new Date(parseInt(emergencyTimestamp)));
          setStorageMethod('emergency');
          return;
        }
      } catch (error) {
        console.warn('Session storage check failed');
      }
    };

    checkExistingData();
  }, [formKey]);

  return {
    lastSaved,
    isSaving,
    setIsSaving,
    storageMethod,
    setStorageMethod,
    markSaved: () => setLastSaved(new Date())
  };
}

// Mobile-specific recovery notification
export function MobileRecoveryNotification({ 
  hasRecoveryData, 
  onRecover, 
  onDiscard 
}: { 
  hasRecoveryData: boolean;
  onRecover: () => void;
  onDiscard: () => void;
}) {
  if (!hasRecoveryData) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-medium text-blue-900 dark:text-blue-100">
            Unsaved work found
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
            We found work you were doing earlier. Would you like to recover it?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onRecover}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Recover
            </button>
            <button
              onClick={onDiscard}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}