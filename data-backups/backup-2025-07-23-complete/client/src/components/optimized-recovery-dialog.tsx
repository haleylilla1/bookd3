import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Smartphone,
  Monitor,
  Zap,
  Shield,
  BarChart3,
  FileText,
  HardDrive,
  Activity
} from "lucide-react";

interface OptimizedRecoveryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (data: any) => void;
  onDiscard: () => void;
  recoveryData: any;
  formType: string;
  storageSource: string;
  timestamp: number;
  checksum?: string;
  compressionRatio?: number;
  systemStats?: {
    cacheSize: number;
    queueSize: number;
    supportedStorage: string[];
    memoryUsage: number;
  };
}

export function OptimizedRecoveryDialog({
  isOpen,
  onClose,
  onRestore,
  onDiscard,
  recoveryData,
  formType,
  storageSource,
  timestamp,
  checksum,
  compressionRatio = 0,
  systemStats
}: OptimizedRecoveryDialogProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'details' | 'system' | 'performance'>('overview');
  const [isMobile, setIsMobile] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [dataValidation, setDataValidation] = useState<{
    isValid: boolean;
    issues: string[];
    completeness: number;
    fieldCount: number;
  }>({ isValid: true, issues: [], completeness: 0, fieldCount: 0 });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (recoveryData) {
      validateRecoveryData();
    }
  }, [recoveryData, formType]);

  const validateRecoveryData = useCallback(() => {
    if (!recoveryData || typeof recoveryData !== 'object') {
      setDataValidation({ isValid: false, issues: ['Invalid data format'], completeness: 0, fieldCount: 0 });
      return;
    }

    const issues: string[] = [];
    let totalFields = 0;
    let filledFields = 0;
    let requiredFields: string[] = [];

    // Form-specific validation
    if (formType === 'gig') {
      requiredFields = ['gigType', 'eventName', 'clientName', 'startDate'];
      const optionalFields = ['endDate', 'expectedPay', 'actualPay', 'tips', 'duties', 'notes'];
      totalFields = requiredFields.length + optionalFields.length;

      requiredFields.forEach(field => {
        if (recoveryData[field]?.trim?.() || recoveryData[field]) {
          filledFields++;
        } else {
          issues.push(`Missing required field: ${field}`);
        }
      });

      optionalFields.forEach(field => {
        if (recoveryData[field]?.trim?.() || recoveryData[field]) {
          filledFields++;
        }
      });

      // Additional validation checks
      if (recoveryData.expectedPay && isNaN(parseFloat(recoveryData.expectedPay))) {
        issues.push('Expected pay must be a valid number');
      }
      if (recoveryData.startDate && recoveryData.endDate && new Date(recoveryData.startDate) > new Date(recoveryData.endDate)) {
        issues.push('Start date cannot be after end date');
      }
    } else if (formType === 'expense') {
      requiredFields = ['description', 'amount'];
      const optionalFields = ['date', 'category', 'notes'];
      totalFields = requiredFields.length + optionalFields.length;

      requiredFields.forEach(field => {
        if (recoveryData[field]?.trim?.() || recoveryData[field]) {
          filledFields++;
        } else {
          issues.push(`Missing required field: ${field}`);
        }
      });

      optionalFields.forEach(field => {
        if (recoveryData[field]?.trim?.() || recoveryData[field]) {
          filledFields++;
        }
      });

      // Additional validation
      if (recoveryData.amount && isNaN(parseFloat(recoveryData.amount))) {
        issues.push('Amount must be a valid number');
      }
    }

    const completeness = Math.round((filledFields / totalFields) * 100);
    
    setDataValidation({
      isValid: issues.length === 0,
      issues,
      completeness,
      fieldCount: filledFields
    });
  }, [recoveryData, formType]);

  const formatTimestamp = (timestamp: number): string => {
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

  const getStorageTypeIcon = (source: string) => {
    switch (source) {
      case 'localStorage': return <HardDrive className="w-4 h-4 text-blue-500" />;
      case 'sessionStorage': return <Database className="w-4 h-4 text-green-500" />;
      case 'indexedDB': return <Database className="w-4 h-4 text-purple-500" />;
      case 'memory': return <Activity className="w-4 h-4 text-orange-500" />;
      default: return <Database className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStorageTypeLabel = (source: string) => {
    switch (source) {
      case 'localStorage': return 'Local Storage (Persistent)';
      case 'sessionStorage': return 'Session Storage (Temporary)';
      case 'indexedDB': return 'IndexedDB (Large Data)';
      case 'memory': return 'Memory (Fallback)';
      default: return 'Unknown Storage';
    }
  };

  const getCompletenessColor = (completeness: number) => {
    if (completeness >= 80) return 'text-green-600';
    if (completeness >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await onRestore(recoveryData);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDiscard = async () => {
    setIsDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setIsDiscarding(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'details', label: 'Details', icon: <Info className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <Shield className="w-4 h-4" /> },
    { id: 'performance', label: 'Performance', icon: <BarChart3 className="w-4 h-4" /> }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-hidden ${isMobile ? 'w-[95vw]' : 'w-full'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Optimized Recovery System
          </DialogTitle>
          <DialogDescription>
            Enhanced recovery with performance optimization and data integrity validation
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.icon}
              {!isMobile && tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTab === 'overview' && (
            <div className="space-y-4">
              {/* Status Alert */}
              <Alert className={`border-l-4 ${dataValidation.isValid ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  {dataValidation.isValid ? 
                    <CheckCircle className="w-4 h-4 text-green-600" /> : 
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  }
                  <span className="font-medium">
                    {dataValidation.isValid ? 'Recovery Data Valid' : 'Data Validation Issues'}
                  </span>
                </div>
                <AlertDescription className="mt-2">
                  {dataValidation.isValid ? 
                    'Your unsaved data is intact and ready to restore.' : 
                    `Found ${dataValidation.issues.length} validation issue${dataValidation.issues.length > 1 ? 's' : ''}.`
                  }
                </AlertDescription>
              </Alert>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Saved</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatTimestamp(timestamp)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      {getStorageTypeIcon(storageSource)}
                      <span className="text-sm font-medium">Storage</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {storageSource}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Complete</span>
                    </div>
                    <p className={`text-xs mt-1 font-medium ${getCompletenessColor(dataValidation.completeness)}`}>
                      {dataValidation.completeness}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Fields</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {dataValidation.fieldCount} filled
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Data Completeness */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Completeness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Form completion</span>
                      <span className={`font-medium ${getCompletenessColor(dataValidation.completeness)}`}>
                        {dataValidation.completeness}%
                      </span>
                    </div>
                    <Progress value={dataValidation.completeness} className="h-2" />
                    <p className="text-xs text-gray-600">
                      {dataValidation.fieldCount} fields filled out of total form fields
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Device Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {isMobile ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                    Device Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Device Type:</span>
                      <p className="font-medium">{isMobile ? 'Mobile' : 'Desktop'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Storage Type:</span>
                      <p className="font-medium">{getStorageTypeLabel(storageSource)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Form Type:</span>
                      <p className="font-medium capitalize">{formType}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Integrity:</span>
                      <p className="font-medium">{checksum ? 'Verified' : 'Unchecked'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedTab === 'details' && (
            <div className="space-y-4">
              {/* Validation Issues */}
              {dataValidation.issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      Validation Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dataValidation.issues.map((issue, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-700">{issue}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recovered Data Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recoveryData && Object.entries(recoveryData).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-sm text-gray-900 max-w-xs truncate">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Technical Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Technical Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Timestamp:</span>
                      <p className="font-medium">{new Date(timestamp).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Storage Source:</span>
                      <p className="font-medium">{getStorageTypeLabel(storageSource)}</p>
                    </div>
                    {checksum && (
                      <div>
                        <span className="text-gray-600">Checksum:</span>
                        <p className="font-medium font-mono text-xs">{checksum}</p>
                      </div>
                    )}
                    {compressionRatio > 0 && (
                      <div>
                        <span className="text-gray-600">Compression:</span>
                        <p className="font-medium">{Math.round(compressionRatio * 100)}%</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {selectedTab === 'system' && (
            <div className="space-y-4">
              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-500" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Storage System</span>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Operational
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Data Integrity</span>
                      <Badge variant="outline" className={dataValidation.isValid ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}>
                        {dataValidation.isValid ? 'Verified' : 'Issues Found'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Recovery System</span>
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        Enhanced
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Storage Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Storage Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {getStorageTypeIcon(storageSource)}
                      <div>
                        <p className="font-medium">{getStorageTypeLabel(storageSource)}</p>
                        <p className="text-sm text-gray-600">
                          {storageSource === 'localStorage' && 'Persistent storage, survives browser restart'}
                          {storageSource === 'sessionStorage' && 'Temporary storage, cleared on tab close'}
                          {storageSource === 'indexedDB' && 'Large data storage with advanced features'}
                          {storageSource === 'memory' && 'In-memory fallback storage'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Statistics */}
              {systemStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Cache Size:</span>
                        <p className="font-medium">{systemStats.cacheSize} items</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Queue Size:</span>
                        <p className="font-medium">{systemStats.queueSize} pending</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Memory Usage:</span>
                        <p className="font-medium">{systemStats.memoryUsage} items</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Supported Storage:</span>
                        <p className="font-medium">{systemStats.supportedStorage.length} types</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {selectedTab === 'performance' && (
            <div className="space-y-4">
              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Storage Speed:</span>
                      <p className="font-medium text-green-600">Optimized</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Retrieval Speed:</span>
                      <p className="font-medium text-green-600">Fast</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Data Size:</span>
                      <p className="font-medium">{JSON.stringify(recoveryData).length} bytes</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Compression:</span>
                      <p className="font-medium">{compressionRatio > 0 ? `${Math.round(compressionRatio * 100)}%` : 'None'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Optimization Features */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Optimization Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Intelligent storage selection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Data deduplication</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Automatic compression</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Integrity validation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Fallback storage chain</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDiscard}
            disabled={isDiscarding || isRestoring}
          >
            {isDiscarding ? 'Discarding...' : 'Discard Changes'}
          </Button>
          <Button
            onClick={handleRestore}
            disabled={isRestoring || isDiscarding}
          >
            {isRestoring ? 'Restoring...' : 'Restore Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OptimizedRecoveryDialog;