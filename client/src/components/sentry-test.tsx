import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/react";

export function SentryTest() {
  const testError = () => {
    Sentry.addBreadcrumb({
      message: 'User triggered test error',
      category: 'test',
      level: 'info',
    });
    
    throw new Error('This is a test error for Sentry integration');
  };

  const testMessage = () => {
    Sentry.captureMessage('Test message sent to Sentry', 'info');
    console.log('Test message sent to Sentry dashboard');
  };

  return (
    <div className="flex gap-2 p-4 border rounded-lg bg-gray-50">
      <Button 
        onClick={testMessage} 
        variant="outline" 
        size="sm"
      >
        Test Sentry Message
      </Button>
      <Button 
        onClick={testError} 
        variant="destructive" 
        size="sm"
      >
        Test Sentry Error
      </Button>
    </div>
  );
}