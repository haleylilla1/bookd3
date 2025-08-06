import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { MessageSquare, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

const supportFormSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  category: z.enum(["bug", "feature", "account", "billing", "general"]),
  message: z.string().min(10, "Please provide more details (at least 10 characters)"),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
});

type SupportFormData = z.infer<typeof supportFormSchema>;

interface ContactSupportProps {
  trigger?: React.ReactNode;
}

export default function ContactSupport({ trigger }: ContactSupportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Get current user for context
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const form = useForm<SupportFormData>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: {
      subject: "",
      category: "general",
      message: "",
      urgency: "medium",
    }
  });

  const sendSupportMessage = useMutation({
    mutationFn: async (data: SupportFormData) => {
      return await apiRequest("POST", "/api/support/contact", data);
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your support request has been sent. We'll get back to you soon!",
      });
      form.reset();
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to Send",
        description: "Please try again or email haleylilla@gmail.com directly.",
        variant: "destructive",
      });
      console.error("Support message error:", error);
    }
  });

  const onSubmit = (data: SupportFormData) => {
    sendSupportMessage.mutate(data);
  };

  const defaultTrigger = (
    <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-3 px-4">
      <MessageSquare className="w-4 h-4" />
      Contact Support
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* User context display */}
            {user && (
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <p><strong>Account:</strong> {user.name} ({user.email})</p>
                <p><strong>Subscription:</strong> {user.subscriptionTier || 'trial'}</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="account">Account Issue</SelectItem>
                      <SelectItem value="billing">Billing Question</SelectItem>
                      <SelectItem value="general">General Question</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low - General inquiry</SelectItem>
                      <SelectItem value="medium">Medium - Standard support</SelectItem>
                      <SelectItem value="high">High - Urgent issue</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Brief description of your issue"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or specific questions you have."
                      className="min-h-[120px] resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={sendSupportMessage.isPending}
                className="min-w-[100px]"
              >
                {sendSupportMessage.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </Button>
            </div>
          </form>
        </Form>

        <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
          <p><strong>Need immediate help?</strong></p>
          <p>Email directly: <a href="mailto:haleylilla@gmail.com" className="text-blue-600 hover:underline">haleylilla@gmail.com</a></p>
        </div>
      </DialogContent>
    </Dialog>
  );
}