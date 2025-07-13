import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface AutoSaveIndicatorProps {
  isSaving?: boolean;
  lastSaved?: Date | null;
  hasError?: boolean;
  isOnline?: boolean;
  className?: string;
}

export function AutoSaveIndicator({
  isSaving = false,
  lastSaved = null,
  hasError = false,
  isOnline = true,
  className = ""
}: AutoSaveIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isSaving || hasError || !isOnline) {
      setIsVisible(true);
    } else if (lastSaved) {
      setIsVisible(true);
      // Hide after 3 seconds
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, lastSaved, hasError, isOnline]);

  if (!isVisible) return null;

  const getStatusContent = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="w-4 h-4 text-red-500" />,
        text: "Offline - changes saved locally",
        bgColor: "bg-red-50",
        textColor: "text-red-700"
      };
    }

    if (hasError) {
      return {
        icon: <AlertCircle className="w-4 h-4 text-red-500" />,
        text: "Save failed - trying again",
        bgColor: "bg-red-50",
        textColor: "text-red-700"
      };
    }

    if (isSaving) {
      return {
        icon: <Clock className="w-4 h-4 text-blue-500 animate-spin" />,
        text: "Saving...",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700"
      };
    }

    if (lastSaved) {
      const timeDiff = Date.now() - lastSaved.getTime();
      const seconds = Math.floor(timeDiff / 1000);
      const minutes = Math.floor(seconds / 60);
      
      let timeText = "just now";
      if (minutes > 0) {
        timeText = `${minutes}m ago`;
      } else if (seconds > 5) {
        timeText = `${seconds}s ago`;
      }

      return {
        icon: <CheckCircle className="w-4 h-4 text-green-500" />,
        text: `Saved ${timeText}`,
        bgColor: "bg-green-50",
        textColor: "text-green-700"
      };
    }

    return null;
  };

  const statusContent = getStatusContent();
  if (!statusContent) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusContent.bgColor} ${statusContent.textColor} text-sm font-medium ${className}`}>
      {statusContent.icon}
      <span>{statusContent.text}</span>
    </div>
  );
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}