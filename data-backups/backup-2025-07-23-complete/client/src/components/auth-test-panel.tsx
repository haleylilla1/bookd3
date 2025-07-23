import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { 
  LogOut, 
  Download, 
  User, 
  Shield, 
  Calendar,
  Crown,
  CheckCircle
} from "lucide-react";

export default function AuthTestPanel() {
  const { user, logout, exportData, isLoggingOut, isExporting } = useAuth();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  // Google OAuth test removed - using simple email/password authentication only

  const testDataExport = async () => {
    addTestResult("Starting data export...");
    try {
      await exportData();
      addTestResult("Data export completed successfully");
    } catch (error) {
      addTestResult("Data export failed");
    }
  };

  const testLogout = async () => {
    addTestResult("Logging out user...");
    try {
      await logout();
      addTestResult("Logout successful");
    } catch (error) {
      addTestResult("Logout failed");
    }
  };

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Authentication Test Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">User not authenticated. Please sign in to test authentication features.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              disabled
              className="flex items-center gap-2 opacity-50"
            >
              Google Login Disabled
            </Button>
            
            <Button variant="outline">
              Test Email Registration
            </Button>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Test Results:</h4>
            <div className="space-y-1 text-sm text-gray-600 max-h-32 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-400">No tests run yet</p>
              ) : (
                testResults.map((result, index) => (
                  <p key={index}>{result}</p>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrialDaysLeft = () => {
    if (!user.trialEndDate) return 0;
    const endDate = new Date(user.trialEndDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getSubscriptionBadge = () => {
    if (user.subscriptionTier === 'premium') {
      return (
        <Badge className="bg-blue-600">
          <Crown className="w-3 h-3 mr-1" />
          Premium User
        </Badge>
      );
    }
    // Removed trial system - keep simple for now
    return <Badge variant="secondary">User</Badge>;
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Authentication Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Information */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-800">Authentication Successful</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">User ID:</span>
              <span className="font-medium">#{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account Status:</span>
              {getSubscriptionBadge()}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Joined:</span>
              <span className="font-medium">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
            {/* Google OAuth integration removed - using simple email/password authentication only */}
          </div>
        </div>

        {/* Test Actions */}
        <div className="space-y-3">
          <h4 className="font-medium">Test Authentication Features:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button 
              onClick={testDataExport}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Test Data Export'}
            </Button>
            
            <Button 
              onClick={testLogout}
              disabled={isLoggingOut}
              variant="outline"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? 'Logging out...' : 'Test Logout'}
            </Button>
          </div>
        </div>



        {/* Test Results Log */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Test Results Log:</h4>
          <div className="space-y-1 text-sm text-gray-600 max-h-32 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-400">No tests run yet</p>
            ) : (
              testResults.map((result, index) => (
                <p key={index} className="font-mono text-xs">{result}</p>
              ))
            )}
          </div>
        </div>

        {/* Quick Access to App Features */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Access App Features:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button size="sm" variant="ghost" className="justify-start">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </Button>
            <Button size="sm" variant="ghost" className="justify-start">
              <User className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button size="sm" variant="ghost" className="justify-start">
              Goals
            </Button>
            <Button size="sm" variant="ghost" className="justify-start">
              Dashboard
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}