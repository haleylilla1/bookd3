import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RotateCcw, X } from "lucide-react";

interface MobileRecoveryNotificationProps {
  hasRecoveryData: boolean;
  onRecover: () => void;
  onDiscard: () => void;
}

export function MobileRecoveryNotification({ 
  hasRecoveryData, 
  onRecover, 
  onDiscard 
}: MobileRecoveryNotificationProps) {
  const [isVisible, setIsVisible] = useState(hasRecoveryData);

  if (!isVisible || !hasRecoveryData) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:hidden">
      <Alert className="bg-blue-50 border-blue-200 shadow-lg">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Previous form data found!
            </span>
            <button
              onClick={() => setIsVisible(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onRecover();
                setIsVisible(false);
              }}
              className="text-blue-600 border-blue-200 hover:bg-blue-100"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Recover
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onDiscard();
                setIsVisible(false);
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              Discard
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}