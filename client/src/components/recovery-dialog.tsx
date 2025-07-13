import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, FileText, Trash2, AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface RecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (data: any) => void;
  onDiscard: () => void;
  recoveryData: any;
  timestamp: number;
  formType: string;
}

// Enhanced data validation for recovery
function validateRecoveryData(data: any, formType: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { isValid: false, issues: ['Invalid data format'] };
  }

  // Form-specific validation
  if (formType === 'gig') {
    if (!data.eventName?.trim()) issues.push('Missing event name');
    if (!data.clientName?.trim()) issues.push('Missing client name');
    if (!data.startDate) issues.push('Missing date');
  } else if (formType === 'expense') {
    if (!data.description?.trim()) issues.push('Missing description');
    if (!data.amount) issues.push('Missing amount');
  } else if (formType === 'goal') {
    if (!data.name?.trim()) issues.push('Missing goal name');
    if (!data.targetAmount) issues.push('Missing target amount');
  }

  return { isValid: issues.length === 0, issues };
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
  const [isRestoring, setIsRestoring] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; issues: string[] }>({ isValid: true, issues: [] });

  // Validate recovery data on mount and when data changes
  useEffect(() => {
    if (recoveryData && isOpen) {
      const result = validateRecoveryData(recoveryData, formType);
      setValidationResult(result);
    }
  }, [recoveryData, formType, isOpen]);

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

  const getDataAge = () => {
    const now = Date.now();
    const ageInMinutes = (now - timestamp) / (1000 * 60);
    
    if (ageInMinutes < 5) return { level: 'fresh', color: 'text-green-600' };
    if (ageInMinutes < 15) return { level: 'recent', color: 'text-blue-600' };
    if (ageInMinutes < 30) return { level: 'older', color: 'text-orange-600' };
    return { level: 'old', color: 'text-red-600' };
  };

  const getDataCompleteness = () => {
    if (!recoveryData) return 0;
    
    const totalFields = formType === 'gig' ? 10 : formType === 'expense' ? 5 : 3;
    const filledFields = Object.values(recoveryData).filter(value => 
      value !== null && value !== undefined && value !== ''
    ).length;
    
    return Math.round((filledFields / totalFields) * 100);
  };

  const getPreviewData = () => {
    if (!recoveryData) return [];
    
    const preview = [];
    
    // Show key fields based on form type with enhanced formatting
    if (formType === 'gig') {
      if (recoveryData.eventName) preview.push(['Event', recoveryData.eventName, 'primary']);
      if (recoveryData.clientName) preview.push(['Client', recoveryData.clientName, 'primary']);
      if (recoveryData.expectedPay) preview.push(['Expected Pay', `$${recoveryData.expectedPay}`, 'money']);
      if (recoveryData.startDate) preview.push(['Date', recoveryData.startDate, 'date']);
      if (recoveryData.endDate && recoveryData.endDate !== recoveryData.startDate) {
        preview.push(['End Date', recoveryData.endDate, 'date']);
      }
      if (recoveryData.gigType) preview.push(['Type', recoveryData.gigType, 'secondary']);
      if (recoveryData.tips) preview.push(['Tips', `$${recoveryData.tips}`, 'money']);
      if (recoveryData.duties) preview.push(['Duties', recoveryData.duties.substring(0, 50) + '...', 'text']);
    } else if (formType === 'expense') {
      if (recoveryData.description) preview.push(['Description', recoveryData.description, 'primary']);
      if (recoveryData.amount) preview.push(['Amount', `$${recoveryData.amount}`, 'money']);
      if (recoveryData.date) preview.push(['Date', recoveryData.date, 'date']);
      if (recoveryData.category) preview.push(['Category', recoveryData.category, 'secondary']);
    } else if (formType === 'goal') {
      if (recoveryData.name) preview.push(['Goal Name', recoveryData.name, 'primary']);
      if (recoveryData.targetAmount) preview.push(['Target', `$${recoveryData.targetAmount}`, 'money']);
      if (recoveryData.deadline) preview.push(['Deadline', recoveryData.deadline, 'date']);
    }
    
    return preview;
  };

  const getFieldStyle = (type: string) => {
    switch (type) {
      case 'primary': return 'font-semibold text-gray-900';
      case 'money': return 'font-medium text-green-600';
      case 'date': return 'font-medium text-blue-600';
      case 'secondary': return 'text-gray-700';
      default: return 'text-gray-800';
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await onDiscard();
    } catch (error) {
      console.error('Error during discard:', error);
    } finally {
      setIsDiscarding(false);
      onClose();
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(recoveryData);
    } catch (error) {
      console.error('Error during restore:', error);
    } finally {
      setIsRestoring(false);
      onClose();
    }
  };

  const previewData = getPreviewData();
  const dataAge = getDataAge();
  const completeness = getDataCompleteness();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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
          {/* Data Quality Indicators */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span className="text-gray-600">Saved:</span>
              <span className={`font-medium ${dataAge.color}`}>
                {formatTimestamp(timestamp)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Complete:</span>
              <span className="font-medium text-green-600">{completeness}%</span>
            </div>
          </div>

          {/* Validation Status */}
          {!validationResult.isValid && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Data Issues Found:</span>
                </div>
                <ul className="mt-2 text-sm text-orange-600 space-y-1">
                  {validationResult.issues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-orange-400 rounded-full" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Preview */}
          {previewData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-500" />
                  <h4 className="font-medium">Preview of saved data:</h4>
                </div>
                <div className="space-y-2">
                  {previewData.map(([label, value, type], index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{label}:</span>
                      <span className={getFieldStyle(type || 'default')}>
                        {value}
                      </span>
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
              disabled={isRestoring}
            >
              {isRestoring ? 'Restoring...' : 'Restore Changes'}
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