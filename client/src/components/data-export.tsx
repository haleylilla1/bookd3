import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, FileJson, Archive, Info, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BackupInfo {
  totalFiles: number;
  totalSize: number;
  oldestBackup: string | null;
}

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const { toast } = useToast();

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/backup/export?format=excel', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookd-export-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your data has been exported as Excel spreadsheet."
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/backup/export?format=json', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookd-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your data has been exported as JSON file."
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/backup/download', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Backup download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookd-backup-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Backup Downloaded",
        description: "Your complete backup archive has been downloaded."
      });
    } catch (error) {
      console.error('Backup download failed:', error);
      toast({
        title: "Backup Failed",
        description: "Failed to create backup archive. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGetBackupInfo = async () => {
    try {
      const response = await fetch('/api/backup/info', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get backup info');
      }

      const info = await response.json();
      setBackupInfo(info);
      setShowInfo(true);
    } catch (error) {
      console.error('Failed to get backup info:', error);
      toast({
        title: "Info Failed",
        description: "Failed to get backup information.",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Data Backup & Export
          </CardTitle>
          <CardDescription>
            Export your data for backup, migration, or personal records. All exports include your gigs, expenses, and financial goals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Data Security:</strong> Exported files contain sensitive financial information. Store them securely and never share them publicly.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold">Excel Export</h3>
                    <p className="text-sm text-gray-600">Spreadsheet with separate sheets</p>
                  </div>
                </div>
                <Button 
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? (
                    <>Exporting...</>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export as Excel
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <FileJson className="w-8 h-8 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">JSON Export</h3>
                    <p className="text-sm text-gray-600">Raw data format</p>
                  </div>
                </div>
                <Button 
                  onClick={handleExportJSON}
                  disabled={isExporting}
                  className="w-full"
                  variant="outline"
                >
                  {isExporting ? (
                    <>Exporting...</>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export as JSON
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <Archive className="w-8 h-8 text-purple-500" />
                  <div>
                    <h3 className="font-semibold">Complete Backup</h3>
                    <p className="text-sm text-gray-600">ZIP archive with metadata</p>
                  </div>
                </div>
                <Button 
                  onClick={handleDownloadBackup}
                  disabled={isDownloading}
                  className="w-full"
                  variant="outline"
                >
                  {isDownloading ? (
                    <>Creating Backup...</>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Backup
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button 
              onClick={handleGetBackupInfo}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Info className="w-4 h-4" />
              View Backup Information
            </Button>
          </div>

          {showInfo && backupInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Backup Status:</strong> {backupInfo.totalFiles} backup files, 
                {formatFileSize(backupInfo.totalSize)} total size
                {backupInfo.oldestBackup && (
                  <>, oldest backup: {backupInfo.oldestBackup}</>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excel Export Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Excel Sheets Included:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• <strong>Profile</strong> - Your account information</li>
                <li>• <strong>Gigs</strong> - All gig records with payments</li>
                <li>• <strong>Expenses</strong> - Business expenses by category</li>
                <li>• <strong>Goals</strong> - Income goals by month/year</li>
                <li>• <strong>Summary</strong> - Total income, expenses, mileage</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Perfect for:</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Tax preparation and filing</li>
                <li>• Accountant collaboration</li>
                <li>• Financial analysis and budgeting</li>
                <li>• Backup and record keeping</li>
                <li>• Import into other software</li>
              </ul>
            </div>
          </div>
          
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Privacy Notice:</strong> Sensitive information like passwords are automatically excluded from exports.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}