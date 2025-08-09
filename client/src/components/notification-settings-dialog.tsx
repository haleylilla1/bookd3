import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Smartphone, Calendar, DollarSign, Briefcase } from 'lucide-react';

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  reminders: boolean;
  gigReminders: boolean;
  paymentReminders: boolean;
  newOpportunities: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  notificationPreferences: NotificationPreferences;
  pushTokens: string[];
}

interface NotificationSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSettingsDialog({ isOpen, onClose }: NotificationSettingsDialogProps) {
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Initialize preferences from user data or defaults
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => ({
    email: true,
    push: true,
    reminders: true,
    gigReminders: true,
    paymentReminders: true,
    newOpportunities: false,
  }));

  // Update local state when user data loads
  React.useEffect(() => {
    if (user?.notificationPreferences) {
      setPreferences(user.notificationPreferences);
    }
  }, [user]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: NotificationPreferences) => {
      const response = await apiRequest('POST', '/api/user/notification-preferences', {
        notificationPreferences: newPreferences
      });
      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not save your notification preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    
    // If turning off email, also turn off specific email notifications
    if (key === 'email' && !value) {
      newPreferences.gigReminders = false;
      newPreferences.paymentReminders = false;
      newPreferences.newOpportunities = false;
    }
    
    // If turning off push, also turn off push-specific notifications
    if (key === 'push' && !value) {
      newPreferences.reminders = false;
    }
    
    setPreferences(newPreferences);
  };

  const handleSave = () => {
    updatePreferencesMutation.mutate(preferences);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Settings
            </DialogTitle>
          </DialogHeader>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!user) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <p>Please log in to access notification settings.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Settings
          </DialogTitle>
          <DialogDescription>
            Control how and when you receive notifications about your gigs and earnings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Master Controls */}
          <div>
            <h3 className="text-sm font-medium mb-3">Master Controls</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <div>
                    <Label htmlFor="email-notifications" className="text-sm font-medium">
                      Email Notifications
                    </Label>
                    <p className="text-xs text-gray-600">
                      Receive notifications via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-notifications"
                  checked={preferences.email}
                  onCheckedChange={(value: boolean) => handlePreferenceChange('email', value)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4 h-4 text-green-600" />
                  <div>
                    <Label htmlFor="push-notifications" className="text-sm font-medium">
                      Push Notifications
                    </Label>
                    <p className="text-xs text-gray-600">
                      {user.pushTokens.length > 0 
                        ? `Enabled on ${user.pushTokens.length} device(s)`
                        : "Enable when you install the mobile app"
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="push-notifications"
                  checked={preferences.push}
                  onCheckedChange={(value: boolean) => handlePreferenceChange('push', value)}
                  disabled={user.pushTokens.length === 0}
                />
              </div>
            </div>
          </div>

          {/* Specific Notification Types */}
          <div>
            <h3 className="text-sm font-medium mb-3">Notification Types</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <div>
                    <Label htmlFor="gig-reminders" className="text-sm font-medium">
                      Gig Reminders
                    </Label>
                    <p className="text-xs text-gray-600">
                      Get reminders about upcoming gigs
                    </p>
                  </div>
                </div>
                <Switch
                  id="gig-reminders"
                  checked={preferences.gigReminders}
                  onCheckedChange={(value: boolean) => handlePreferenceChange('gigReminders', value)}
                  disabled={!preferences.email}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <div>
                    <Label htmlFor="payment-reminders" className="text-sm font-medium">
                      Payment Reminders
                    </Label>
                    <p className="text-xs text-gray-600">
                      Reminders to track payments for completed gigs
                    </p>
                  </div>
                </div>
                <Switch
                  id="payment-reminders"
                  checked={preferences.paymentReminders}
                  onCheckedChange={(value: boolean) => handlePreferenceChange('paymentReminders', value)}
                  disabled={!preferences.email}
                />
              </div>

              <Separator />

              {/* Hidden - Emergency opportunities feature not yet ready for users */}
              {/* <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-orange-600" />
                  <div>
                    <Label htmlFor="new-opportunities" className="text-sm font-medium">
                      New Opportunities
                    </Label>
                    <p className="text-xs text-gray-600">
                      Get notified about new emergency BA opportunities
                    </p>
                  </div>
                </div>
                <Switch
                  id="new-opportunities"
                  checked={preferences.newOpportunities}
                  onCheckedChange={(value: boolean) => handlePreferenceChange('newOpportunities', value)}
                  disabled={!preferences.email}
                />
              </div>

              <Separator /> */}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <div>
                    <Label htmlFor="general-reminders" className="text-sm font-medium">
                      General Reminders
                    </Label>
                    <p className="text-xs text-gray-600">
                      App updates, tips, and general reminders
                    </p>
                  </div>
                </div>
                <Switch
                  id="general-reminders"
                  checked={preferences.reminders}
                  onCheckedChange={(value: boolean) => handlePreferenceChange('reminders', value)}
                />
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <Smartphone className="w-4 h-4 text-blue-600 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Mobile App Coming Soon</h4>
                <p className="text-xs text-blue-700 mt-1">
                  Push notifications will be available when you install the Bookd mobile app. 
                  For now, you'll receive important updates via email.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updatePreferencesMutation.isPending}
              className="flex-1"
            >
              {updatePreferencesMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}