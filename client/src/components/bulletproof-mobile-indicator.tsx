/**
 * Visual indicator for bulletproof mobile auto-save status
 */

import React from 'react';
import { Check, Save, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

interface BulletproofMobileIndicatorProps {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  className?: string;
  showDetails?: boolean;
}

export function BulletproofMobileIndicator({ 
  saveStatus, 
  lastSaved, 
  className = '',
  showDetails = false 
}: BulletproofMobileIndicatorProps) {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusConfig = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: Save,
          text: 'Saving...',
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          textColor: 'text-blue-800 dark:text-blue-200',
          iconClass: 'animate-pulse'
        };
      case 'saved':
        return {
          icon: Check,
          text: 'Saved',
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          textColor: 'text-green-800 dark:text-green-200',
          iconClass: ''
        };
      case 'error':
        return {
          icon: AlertTriangle,
          text: 'Error',
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          textColor: 'text-red-800 dark:text-red-200',
          iconClass: ''
        };
      default:
        return {
          icon: Save,
          text: 'Auto-save active',
          bgColor: 'bg-gray-100 dark:bg-gray-800/20',
          textColor: 'text-gray-600 dark:text-gray-400',
          iconClass: 'opacity-50'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const NetworkIcon = isOnline ? Wifi : WifiOff;

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 10) return 'just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className={`
      fixed top-4 right-4 z-50 
      ${config.bgColor} ${config.textColor}
      rounded-lg border border-current/20 shadow-lg
      px-3 py-2 flex items-center gap-2 text-sm font-medium
      transition-all duration-200 ease-in-out
      ${className}
    `}>
      {/* Save status icon */}
      <Icon size={16} className={config.iconClass} />
      
      {/* Network status (mobile only) */}
      {window.innerWidth <= 768 && (
        <NetworkIcon 
          size={12} 
          className={isOnline ? 'text-current' : 'text-red-500'} 
        />
      )}
      
      {/* Status text */}
      <span>{config.text}</span>
      
      {/* Last saved time (when showing details) */}
      {showDetails && lastSaved && saveStatus !== 'saving' && (
        <span className="text-xs opacity-75 ml-1">
          {formatLastSaved(lastSaved)}
        </span>
      )}
    </div>
  );
}

export function useBulletproofMobileIndicator(formKey: string) {
  const [showIndicator, setShowIndicator] = React.useState(false);
  const [lastActivity, setLastActivity] = React.useState<Date | null>(null);

  // Show indicator when user is actively using the form
  React.useEffect(() => {
    let activityTimer: NodeJS.Timeout;

    const handleActivity = () => {
      setLastActivity(new Date());
      setShowIndicator(true);
      
      // Hide indicator after 5 seconds of inactivity
      if (activityTimer) clearTimeout(activityTimer);
      activityTimer = setTimeout(() => {
        setShowIndicator(false);
      }, 5000);
    };

    const events = ['input', 'change', 'focus', 'blur'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (activityTimer) clearTimeout(activityTimer);
    };
  }, []);

  return {
    showIndicator,
    lastActivity
  };
}