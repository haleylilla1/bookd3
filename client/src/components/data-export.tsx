import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BackupInfo {
  totalFiles: number;
  totalSize: number;
  oldestBackup: string | null;
}

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
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
        description: "Your financial data has been exported as an Excel spreadsheet."
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Export Your Financial Data
          </CardTitle>
          <CardDescription>
            Download all your gig data as an Excel spreadsheet - perfect for taxes, record keeping, and sharing with your accountant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Data Security:</strong> Your exported file contains sensitive financial information. Store it securely and never share it publicly.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col items-center space-y-4">
            <div className="text-center">
              <FileSpreadsheet className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Excel Spreadsheet Export</h3>
              <p className="text-gray-600 mb-4 max-w-md">
                Get all your financial data organized in a professional Excel file with separate sheets for gigs, expenses, goals, and summary totals.
              </p>
            </div>
            
            <Button 
              onClick={handleExportExcel}
              disabled={isExporting}
              size="lg"
              className="px-8 py-4 text-lg"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-3" />
                  Export as Excel
                </>
              )}
            </Button>
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