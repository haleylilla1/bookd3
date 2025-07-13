import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, FileText, Trash2 } from "lucide-react";

interface RecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (data: any) => void;
  onDiscard: () => void;
  recoveryData: any;
  timestamp: number;
  formType: string;
}

export function RecoveryDialog({
  isOpen,
  onClose,
  onRestore,
  onDiscard,
  recoveryData,
  timestamp,
  formType
}: RecoveryDialogProps) {
  const [isDiscarding, setIsDiscarding] = useState(false);

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

  const getPreviewData = () => {
    if (!recoveryData) return [];
    
    const preview = [];
    
    // Show key fields based on form type
    if (formType === 'gig') {
      if (recoveryData.eventName) preview.push(['Event', recoveryData.eventName]);
      if (recoveryData.clientName) preview.push(['Client', recoveryData.clientName]);
      if (recoveryData.expectedPay) preview.push(['Expected Pay', `$${recoveryData.expectedPay}`]);
      if (recoveryData.startDate) preview.push(['Date', recoveryData.startDate]);
    } else if (formType === 'expense') {
      if (recoveryData.description) preview.push(['Description', recoveryData.description]);
      if (recoveryData.amount) preview.push(['Amount', `$${recoveryData.amount}`]);
      if (recoveryData.date) preview.push(['Date', recoveryData.date]);
    } else if (formType === 'goal') {
      if (recoveryData.name) preview.push(['Goal Name', recoveryData.name]);
      if (recoveryData.targetAmount) preview.push(['Target', `$${recoveryData.targetAmount}`]);
    }
    
    return preview;
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    onDiscard();
    setIsDiscarding(false);
    onClose();
  };

  const handleRestore = () => {
    onRestore(recoveryData);
    onClose();
  };

  const previewData = getPreviewData();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Unsaved Changes Found
          </DialogTitle>
          <DialogDescription>
            We found unsaved changes from your previous session. Would you like to restore them?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Last saved: {formatTimestamp(timestamp)}</span>
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Preview of saved data:</h4>
                <div className="space-y-1">
                  {previewData.map(([label, value], index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{label}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleRestore}
              className="flex-1"
              variant="default"
            >
              Restore Changes
            </Button>
            
            <Button 
              onClick={handleDiscard}
              variant="outline"
              className="flex-1"
              disabled={isDiscarding}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Start Fresh
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Auto-save keeps your work safe. Data is stored locally on your device.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}