import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Clock, 
  FileText, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  RotateCcw,
  Save,
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  Database,
  RefreshCw
} from "lucide-react";

interface EnhancedRecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (data: any) => void;
  onDiscard: () => void;
  recoveryData: any;
  timestamp: number;
  formType: string;
  storageSource?: 'primary' | 'backup' | 'session' | 'emergency';
  autoSaveEnabled?: boolean;
  onlineStatus?: boolean;
}

// Enhanced validation with better error messages
function validateRecoveryData(data: any, formType: string): { 
  isValid: boolean; 
  issues: string[]; 
  warnings: string[];
  completeness: number;
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  let totalFields = 0;
  let filledFields = 0;

  if (!data || typeof data !== 'object') {
    return { isValid: false, issues: ['Invalid data format'], warnings: [], completeness: 0 };
  }

  // Form-specific validation with completeness tracking
  if (formType === 'gig') {
    const requiredFields = ['eventName', 'clientName', 'startDate'];
    const optionalFields = ['endDate', 'expectedPay', 'actualPay', 'tips', 'gigType', 'duties', 'notes'];
    
    totalFields = requiredFields.length + optionalFields.length;
    
    // Check required fields
    requiredFields.forEach(field => {
      if (data[field]?.trim?.() || data[field]) {
        filledFields++;
      } else {
        issues.push(`Missing required field: ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      }
    });
    
    // Check optional fields
    optionalFields.forEach(field => {
      if (data[field]?.trim?.() || data[field]) {
        filledFields++;
      }
    });
    
    // Add warnings for incomplete data
    if (!data.expectedPay) warnings.push('No expected pay amount specified');
    if (!data.gigType) warnings.push('Gig type not selected');
    if (!data.duties) warnings.push('No duties/description provided');
    
  } else if (formType === 'expense') {
    const requiredFields = ['description', 'amount'];
    const optionalFields = ['date', 'category', 'notes'];
    
    totalFields = requiredFields.length + optionalFields.length;
    
    requiredFields.forEach(field => {
      if (data[field]?.trim?.() || data[field]) {
        filledFields++;
      } else {
        issues.push(`Missing required field: ${field}`);
      }
    });
    
    optionalFields.forEach(field => {
      if (data[field]?.trim?.() || data[field]) {
        filledFields++;
      }
    });
    
    if (!data.date) warnings.push('No date specified');
    if (!data.category) warnings.push('No category selected');
    
  } else if (formType === 'goal') {
    const requiredFields = ['name', 'targetAmount'];
    const optionalFields = ['deadline', 'description'];
    
    totalFields = requiredFields.length + optionalFields.length;
    
    requiredFields.forEach(field => {
      if (data[field]?.trim?.() || data[field]) {
        filledFields++;
      } else {
        issues.push(`Missing required field: ${field}`);
      }
    });
    
    optionalFields.forEach(field => {
      if (data[field]?.trim?.() || data[field]) {
        filledFields++;
      }
    });
    
    if (!data.deadline) warnings.push('No deadline set');
  }

  const completeness = Math.round((filledFields / totalFields) * 100);
  
  return { 
    isValid: issues.length === 0, 
    issues, 
    warnings,
    completeness
  };
}

export function EnhancedRecoveryDialog({
  isOpen,
  onClose,
  onRestore,
  onDiscard,
  recoveryData,
  timestamp,
  formType,
  storageSource = 'primary',
  autoSaveEnabled = true,
  onlineStatus = true
}: EnhancedRecoveryDialogProps) {
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [validationResult, setValidationResult] = useState<{ 
    isValid: boolean; 
    issues: string[]; 
    warnings: string[];
    completeness: number;
  }>({ isValid: true, issues: [], warnings: [], completeness: 0 });

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
      if (hours < 24) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }
  };

  const getDataAge = () => {
    const now = Date.now();
    const ageInMinutes = (now - timestamp) / (1000 * 60);
    
    if (ageInMinutes < 5) return { level: 'fresh', color: 'text-green-600', badge: 'bg-green-100 text-green-800' };
    if (ageInMinutes < 15) return { level: 'recent', color: 'text-blue-600', badge: 'bg-blue-100 text-blue-800' };
    if (ageInMinutes < 30) return { level: 'older', color: 'text-orange-600', badge: 'bg-orange-100 text-orange-800' };
    return { level: 'old', color: 'text-red-600', badge: 'bg-red-100 text-red-800' };
  };

  const getStorageInfo = () => {
    const storageMap = {
      primary: { icon: Database, label: 'Primary Storage', color: 'text-green-600' },
      backup: { icon: RefreshCw, label: 'Backup Storage', color: 'text-blue-600' },
      session: { icon: Smartphone, label: 'Session Storage', color: 'text-orange-600' },
      emergency: { icon: AlertTriangle, label: 'Emergency Storage', color: 'text-red-600' }
    };
    return storageMap[storageSource] || storageMap.primary;
  };

  const getPreviewData = () => {
    if (!recoveryData) return [];
    
    const preview = [];
    
    // Enhanced preview with better formatting
    if (formType === 'gig') {
      if (recoveryData.eventName) preview.push(['Event Name', recoveryData.eventName, 'primary']);
      if (recoveryData.clientName) preview.push(['Client', recoveryData.clientName, 'primary']);
      if (recoveryData.gigType) preview.push(['Type', recoveryData.gigType, 'secondary']);
      if (recoveryData.startDate) preview.push(['Start Date', new Date(recoveryData.startDate).toLocaleDateString(), 'date']);
      if (recoveryData.endDate && recoveryData.endDate !== recoveryData.startDate) {
        preview.push(['End Date', new Date(recoveryData.endDate).toLocaleDateString(), 'date']);
      }
      if (recoveryData.expectedPay) preview.push(['Expected Pay', `$${recoveryData.expectedPay}`, 'money']);
      if (recoveryData.actualPay) preview.push(['Actual Pay', `$${recoveryData.actualPay}`, 'money']);
      if (recoveryData.tips) preview.push(['Tips', `$${recoveryData.tips}`, 'money']);
      if (recoveryData.duties) {
        const truncated = recoveryData.duties.length > 100 ? 
          recoveryData.duties.substring(0, 100) + '...' : 
          recoveryData.duties;
        preview.push(['Duties', truncated, 'text']);
      }
      if (recoveryData.notes) {
        const truncated = recoveryData.notes.length > 100 ? 
          recoveryData.notes.substring(0, 100) + '...' : 
          recoveryData.notes;
        preview.push(['Notes', truncated, 'text']);
      }
    } else if (formType === 'expense') {
      if (recoveryData.description) preview.push(['Description', recoveryData.description, 'primary']);
      if (recoveryData.amount) preview.push(['Amount', `$${recoveryData.amount}`, 'money']);
      if (recoveryData.date) preview.push(['Date', new Date(recoveryData.date).toLocaleDateString(), 'date']);
      if (recoveryData.category) preview.push(['Category', recoveryData.category, 'secondary']);
      if (recoveryData.notes) preview.push(['Notes', recoveryData.notes, 'text']);
    } else if (formType === 'goal') {
      if (recoveryData.name) preview.push(['Goal Name', recoveryData.name, 'primary']);
      if (recoveryData.targetAmount) preview.push(['Target Amount', `$${recoveryData.targetAmount}`, 'money']);
      if (recoveryData.deadline) preview.push(['Deadline', new Date(recoveryData.deadline).toLocaleDateString(), 'date']);
      if (recoveryData.description) preview.push(['Description', recoveryData.description, 'text']);
    }
    
    return preview;
  };

  const getFieldStyle = (type: string) => {
    switch (type) {
      case 'primary': return 'font-semibold text-gray-900';
      case 'money': return 'font-medium text-green-600';
      case 'date': return 'font-medium text-blue-600';
      case 'secondary': return 'font-medium text-purple-600';
      case 'text': return 'text-gray-700';
      default: return 'text-gray-800';
    }
  };

  const getRawDataPreview = () => {
    if (!recoveryData) return '{}';
    
    try {
      return JSON.stringify(recoveryData, null, 2);
    } catch (error) {
      return 'Error: Unable to display raw data';
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
  const storageInfo = getStorageInfo();
  const StorageIcon = storageInfo.icon;

  const systemInfo = useMemo(() => ({
    isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
    storageAvailable: typeof localStorage !== 'undefined',
    sessionStorageAvailable: typeof sessionStorage !== 'undefined'
  }), []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Unsaved Changes Found
            <Badge variant="outline" className={dataAge.badge}>
              {dataAge.level}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            We found unsaved changes from your previous session. Review and decide what to do with them.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Saved</p>
                  <p className={`font-medium ${dataAge.color}`}>
                    {formatTimestamp(timestamp)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Complete</p>
                  <p className="font-medium text-green-600">{validationResult.completeness}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <StorageIcon className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Storage</p>
                  <p className={`font-medium ${storageInfo.color}`}>{storageInfo.label}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {onlineStatus ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className={`font-medium ${onlineStatus ? 'text-green-600' : 'text-red-600'}`}>
                    {onlineStatus ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Validation Status */}
            {(!validationResult.isValid || validationResult.warnings.length > 0) && (
              <div className="space-y-2">
                {!validationResult.isValid && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Data Issues Found:</div>
                      <ul className="space-y-1">
                        {validationResult.issues.map((issue, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-1 h-1 bg-red-400 rounded-full" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                
                {validationResult.warnings.length > 0 && (
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      <div className="font-medium mb-2">Warnings:</div>
                      <ul className="space-y-1">
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-1 h-1 bg-orange-400 rounded-full" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Data Preview */}
            {previewData.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-blue-500" />
                    <h4 className="font-medium">Saved Data Preview</h4>
                  </div>
                  <div className="space-y-2">
                    {previewData.map(([label, value, type], index) => (
                      <div key={index} className="flex justify-between items-start text-sm">
                        <span className="text-gray-600 font-medium">{label}:</span>
                        <span className={`${getFieldStyle(type || 'default')} text-right flex-1 ml-2`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-gray-500" />
                  <h4 className="font-medium">Raw Data</h4>
                </div>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-64">
                  {getRawDataPreview()}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  {systemInfo.isMobile ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                  <h4 className="font-medium">System Information</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Device Type:</span>
                    <span className="font-medium">{systemInfo.isMobile ? 'Mobile' : 'Desktop'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-save:</span>
                    <span className={`font-medium ${autoSaveEnabled ? 'text-green-600' : 'text-red-600'}`}>
                      {autoSaveEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Storage Source:</span>
                    <span className={`font-medium ${storageInfo.color}`}>{storageInfo.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>localStorage:</span>
                    <span className={`font-medium ${systemInfo.storageAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {systemInfo.storageAvailable ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>sessionStorage:</span>
                    <span className={`font-medium ${systemInfo.sessionStorageAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {systemInfo.sessionStorageAvailable ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network Status:</span>
                    <span className={`font-medium ${onlineStatus ? 'text-green-600' : 'text-red-600'}`}>
                      {onlineStatus ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleRestore}
            className="flex-1"
            disabled={isRestoring}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {isRestoring ? 'Restoring...' : 'Restore Changes'}
          </Button>
          
          <Button 
            onClick={handleDiscard}
            variant="outline"
            className="flex-1"
            disabled={isDiscarding}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDiscarding ? 'Discarding...' : 'Start Fresh'}
          </Button>
        </div>
        
        <p className="text-xs text-gray-500 text-center pt-2">
          Auto-save keeps your work safe. Data is stored locally on your device and never sent to servers.
        </p>
      </DialogContent>
    </Dialog>
  );
}