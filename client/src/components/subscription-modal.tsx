import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string;
}

const plans = [
  {
    id: 'trial',
    name: 'Trial',
    price: 'Free',
    duration: '7 days',
    description: 'Try all premium features',
    features: [
      'Unlimited gigs tracking',
      'Basic expense management',
      'Simple reporting',
      'Mobile access'
    ],
    limitations: [
      'Limited to 10 gigs',
      'Basic support only'
    ],
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    duration: '/month',
    description: 'For serious gig workers',
    features: [
      'Unlimited gigs & expenses',
      'Advanced tax reporting',
      'Export to Excel/PDF',
      'Mileage tracking',
      'Goal setting & tracking',
      'Priority support'
    ],
    limitations: [],
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$19.99',
    duration: '/month',
    description: 'For professional agencies',
    features: [
      'Everything in Pro',
      'Agency portal access',
      'Emergency BA opportunities',
      'Team management',
      'Advanced analytics',
      'Custom integrations',
      'White-label options'
    ],
    limitations: [],
    popular: false
  }
];

export function SubscriptionModal({ isOpen, onClose, currentTier = 'trial' }: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(currentTier);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePlanSelect = async (planId: string) => {
    if (planId === currentTier) return;
    
    setIsLoading(true);
    try {
      // Setup RevenueCat customer if not already done
      await apiRequest('POST', '/api/subscription/setup');
      
      // Update subscription (in a real app, this would integrate with payment processing)
      await apiRequest('POST', '/api/subscription/update', {
        tier: planId,
        status: planId === 'trial' ? 'trial' : 'active',
        expiresAt: planId === 'trial' 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      toast({
        title: "Subscription Updated!",
        description: `You're now on the ${plans.find(p => p.id === planId)?.name} plan.`,
      });

      onClose();
      window.location.reload(); // Refresh to update UI
    } catch (error: any) {
      console.error('Subscription update failed:', error);
      toast({
        title: "Update Failed",
        description: "Unable to update subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            Choose Your Bookd Plan
          </DialogTitle>
          <p className="text-center text-gray-600 mt-2">
            Upgrade to unlock premium features and grow your gig business
          </p>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative border rounded-lg p-6 transition-all duration-200 hover:shadow-lg ${
                plan.popular 
                  ? 'border-blue-500 shadow-md' 
                  : 'border-gray-200'
              } ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-blue-500' 
                  : ''
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                  <Crown className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              )}

              {currentTier === plan.id && (
                <Badge className="absolute -top-3 right-4 bg-green-500">
                  Current Plan
                </Badge>
              )}

              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-gray-600">{plan.duration}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
                
                {plan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{limitation}</span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full ${
                  plan.popular 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-gray-800 hover:bg-gray-900'
                }`}
                onClick={() => handlePlanSelect(plan.id)}
                disabled={isLoading || currentTier === plan.id}
              >
                {isLoading ? (
                  "Processing..."
                ) : currentTier === plan.id ? (
                  "Current Plan"
                ) : plan.id === 'trial' ? (
                  "Start Free Trial"
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center mt-6 text-sm text-gray-600">
          <p>All plans include mobile access and data export.</p>
          <p>Cancel anytime. No long-term contracts.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}