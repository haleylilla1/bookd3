import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  FileText, 
  Clock, 
  RotateCcw, 
  X,
  Database,
  Smartphone,
  Monitor 
} from "lucide-react";
import { useRecoverySystemContext } from './recovery-system-provider';

interface GlobalRecoveryIndicatorProps {
  className?: string;
}

export function GlobalRecoveryIndicator({ className }: GlobalRecoveryIndicatorProps) {
  const { activeRecoveries, globalRecoveryCount } = useRecoverySystemContext();
  const [showDetails, setShowDetails] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (globalRecoveryCount === 0) {
    return null;
  }

  const getFormTypeLabel = (formType: string) => {
    switch (formType) {
      case 'gig': return 'Gig Form';
      case 'expense': return 'Expense Form';
      case 'goal': return 'Goal Form';
      default: return 'Form';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return "< 1 min ago";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {showDetails && (
        <Card className="mb-2 w-80 max-w-[calc(100vw-2rem)] shadow-lg border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-sm">Unsaved Changes</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Array.from(activeRecoveries.entries()).map(([formKey, data]) => {
                const { timestamp, formType, storageSource } = data;
                const DeviceIcon = isMobile ? Smartphone : Monitor;
                
                return (
                  <div 
                    key={formKey}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <DeviceIcon className="w-3 h-3 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getFormTypeLabel(formType)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(timestamp)}</span>
                          <Database className="w-3 h-3" />
                          <span className="capitalize">{storageSource}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700"
                      onClick={() => {
                        // This would trigger the recovery dialog for this specific form
                        // Implementation depends on how forms are structured
                      }}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-3 pt-3 border-t text-xs text-gray-500">
              <p>Auto-save keeps your work safe. Click restore to recover unsaved changes.</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Badge
        variant="destructive"
        className="cursor-pointer hover:bg-red-600 transition-colors shadow-lg"
        onClick={() => setShowDetails(!showDetails)}
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        {globalRecoveryCount} unsaved
      </Badge>
    </div>
  );
}

export default GlobalRecoveryIndicator;