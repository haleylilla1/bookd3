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

  const testGoogleAuth = () => {
    addTestResult("Redirecting to Google OAuth...");
    window.location.href = "/api/auth/google";
  };

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
              onClick={testGoogleAuth}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Test Google Login
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
            {user.googleId && (
              <div className="flex justify-between">
                <span className="text-gray-600">Google Account:</span>
                <span className="text-green-600 font-medium">Linked</span>
              </div>
            )}
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