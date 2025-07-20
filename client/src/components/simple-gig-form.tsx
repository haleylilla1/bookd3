import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertGigSchema, type InsertGig, type User } from "@shared/schema";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";

// Simple, bulletproof form schema - string inputs for all numeric fields for easier form handling
const gigFormSchema = z.object({
  gigType: z.string().min(1, "Gig type is required"),
  eventName: z.string().min(1, "Event name is required"),
  clientName: z.string().min(1, "Client name is required"),
  date: z.string().min(1, "Date is required"),
  expectedPay: z.string().optional(),
  actualPay: z.string().optional(),
  tips: z.string().optional(),
  paymentMethod: z.string().default("Cash"),
  status: z.enum(["upcoming", "pending payment", "completed"]).default("upcoming"),
  duties: z.string().optional(),
  taxPercentage: z.number().min(0).max(50).default(23),
  notes: z.string().optional(),
  // Simplified - no mileage or complex expense tracking in simple form
});

type GigFormData = z.infer<typeof gigFormSchema>;

interface SimpleGigFormProps {
  onClose: () => void;
}

export default function SimpleGigForm({ onClose }: SimpleGigFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // BULLETPROOF USER FETCHING - Clear error handling, no silent failures
  const { 
    data: user, 
    isLoading: userLoading, 
    error: userError,
    isError
  } = useQuery<User>({
    queryKey: ["/api/user"],
    retry: false, // Don't retry auth failures
    queryFn: async () => {
      const response = await fetch("/api/user", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`Authentication failed (${response.status})`);
      }
      return response.json();
    }
  });

  // BULLETPROOF AUTH HANDLING - Always show clear feedback
  useEffect(() => {
    if (isError && userError) {
      console.log("🚨 Auth error detected:", userError.message);
      toast({
        title: "Authentication Required",
        description: "Please log in to add gigs",
        variant: "destructive"
      });
      
      // Always redirect to login on auth failure
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }, [isError, userError, toast]);

  // SIMPLE FORM SETUP - No complex watchers or auto-save
  const form = useForm<GigFormData>({
    resolver: zodResolver(gigFormSchema),
    defaultValues: {
      gigType: "",
      eventName: "",
      clientName: "",
      date: new Date().toISOString().split('T')[0],
      expectedPay: "",
      actualPay: "",
      tips: "",
      paymentMethod: "Cash",
      status: "upcoming" as const,
      duties: "",
      taxPercentage: 23,
      notes: "",
    }
  });

  // Update defaults when user loads
  useEffect(() => {
    if (user) {
      form.setValue("taxPercentage", user.defaultTaxPercentage || 23);
    }
  }, [user, form]);

  // SIMPLE GIG CREATION MUTATION - No complex retry logic
  const createGigMutation = useMutation({
    mutationFn: async (gigData: InsertGig) => {
      return await apiRequest("POST", "/api/gigs", gigData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Success",
        description: "Gig created successfully!"
      });
      onClose();
    },
    onError: (error) => {
      console.error("Gig creation error:", error);
      toast({
        title: "Error",
        description: "Failed to create gig. Please try again.",
        variant: "destructive"
      });
    }
  });

  // SIMPLE SUBMIT HANDLER - Clear, reliable logic
  const onSubmit = async (data: GigFormData) => {
    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "Please log in to create gigs",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert form data to gig data with safe parsing
      const gigData: InsertGig = {
        userId: user.id,
        date: data.date,
        gigType: data.gigType,
        eventName: data.eventName,
        clientName: data.clientName,
        expectedPay: data.expectedPay ? parseFloat(data.expectedPay) || 0 : 0,
        actualPay: data.actualPay ? parseFloat(data.actualPay) || 0 : 0,
        tips: data.tips ? parseFloat(data.tips) || 0 : 0,
        paymentMethod: data.paymentMethod,
        status: data.status,
        duties: data.duties || null,
        taxPercentage: data.taxPercentage,
        mileage: 0,
        notes: data.notes || null,
        parkingExpense: 0,
        parkingReceipts: [],
        parkingReimbursed: false,
        otherExpenses: 0,
        otherExpenseReceipts: [],
        otherExpensesReimbursed: false,
      };

      await createGigMutation.mutateAsync(gigData);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // CLEAR LOADING STATE
  if (userLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading form...</span>
          </div>
        </div>
      </div>
    );
  }

  // CLEAR ERROR STATE
  if (isError || !user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
          <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
          <p className="text-gray-600 mb-4">Please log in to add gigs</p>
          <Button onClick={() => window.location.href = '/'}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // MAIN FORM - Simple, clean, reliable
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add New Gig</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gigType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gig Type *</FormLabel>
                    <FormControl>
                      <Input placeholder="Brand Ambassador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Product Launch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Company" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Payment Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="expectedPay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Pay</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="250" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actualPay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Pay</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="275" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tips"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tips</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tax Percentage */}
            <FormField
              control={form.control}
              name="taxPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Percentage (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="23" 
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 23)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Duties */}
            <FormField
              control={form.control}
              name="duties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Duties</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Event setup, customer interaction, cleanup..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status and Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="pending payment">Pending Payment</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Check">Check</SelectItem>
                        <SelectItem value="Venmo">Venmo</SelectItem>
                        <SelectItem value="Zelle">Zelle</SelectItem>
                        <SelectItem value="PayPal">PayPal</SelectItem>
                        <SelectItem value="Direct Deposit">Direct Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this gig..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Gig"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}