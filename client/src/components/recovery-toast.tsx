import { useState, useEffect } from 'react';
import { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { FileText, Clock, AlertCircle } from "lucide-react";

interface RecoveryToastProps {
  isOpen: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  formType: string;
  timestamp: number;
  completeness: number;
}

export function RecoveryToast({
  isOpen,
  onRestore,
  onDiscard,
  formType,
  timestamp,
  completeness
}: RecoveryToastProps) {
  const [showToast, setShowToast] = useState(isOpen);

  useEffect(() => {
    setShowToast(isOpen);
  }, [isOpen]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return "less than a minute ago";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
  };

  const getFormTypeLabel = (formType: string) => {
    switch (formType) {
      case 'gig': return 'Gig Form';
      case 'expense': return 'Expense Form';
      case 'goal': return 'Goal Form';
      default: return 'Form';
    }
  };

  if (!showToast) return null;

  return (
    <ToastProvider>
      <Toast
        className="border-orange-200 bg-orange-50"
        open={showToast}
        onOpenChange={setShowToast}
      >
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-orange-600 mt-0.5" />
          <div className="flex-1">
            <ToastTitle className="text-orange-900">
              Unsaved Changes Found
            </ToastTitle>
            <ToastDescription className="text-orange-700">
              Your {getFormTypeLabel(formType)} has unsaved changes from {formatTimestamp(timestamp)} 
              ({completeness}% complete)
            </ToastDescription>
          </div>
        </div>
        
        <div className="flex gap-2 mt-3">
          <ToastAction
            altText="Restore changes"
            onClick={onRestore}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            Restore
          </ToastAction>
          <ToastAction
            altText="Discard changes"
            onClick={onDiscard}
            className="bg-gray-600 hover:bg-gray-700 text-white"
          >
            Discard
          </ToastAction>
        </div>
        
        <ToastClose />
      </Toast>
      <ToastViewport className="fixed top-4 right-4 z-[100] max-w-[420px]" />
    </ToastProvider>
  );
}

export default RecoveryToast;