import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Zap, CheckCircle } from "lucide-react";

interface TestWebhookButtonProps {
  className?: string;
}

export function TestWebhookButton({ className }: TestWebhookButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTest, setLastTest] = useState<string | null>(null);
  const { toast } = useToast();

  const testWebhook = async (eventType: string) => {
    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/subscription/test-webhook', { eventType });
      
      setLastTest(eventType);
      toast({
        title: "Webhook Test Successful!",
        description: `${eventType} event processed successfully. Check your subscription status.`,
      });
      
      // Refresh the page to show updated subscription
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Webhook test failed:', error);
      toast({
        title: "Webhook Test Failed",
        description: "Failed to process test webhook. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-medium">Test Webhook Events</span>
        {lastTest && (
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Last: {lastTest}
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => testWebhook('INITIAL_PURCHASE')}
          disabled={isLoading}
          className="text-xs"
        >
          Test Purchase
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => testWebhook('RENEWAL')}
          disabled={isLoading}
          className="text-xs"
        >
          Test Renewal
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => testWebhook('CANCELLATION')}
          disabled={isLoading}
          className="text-xs"
        >
          Test Cancel
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => testWebhook('EXPIRATION')}
          disabled={isLoading}
          className="text-xs"
        >
          Test Expire
        </Button>
      </div>
      
      <p className="text-xs text-gray-600">
        These buttons simulate RevenueCat webhook events for testing subscription flows.
      </p>
    </div>
  );
}