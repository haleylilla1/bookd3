import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertGigSchema, type InsertGig, type User } from "@shared/schema";
import { z } from "zod";
import { X, Loader2, MapPin, Receipt, Calculator, Navigation } from "lucide-react";
import ReceiptUpload from "@/components/receipt-upload";
import { AddressAutocomplete } from "@/components/address-autocomplete";

// Enhanced form schema with mileage, receipt support, and multi-day functionality
const gigFormSchema = z.object({
  gigType: z.string().min(1, "Gig type is required"),
  eventName: z.string().min(1, "Event name is required"),
  clientName: z.string().min(1, "Client name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  expectedPay: z.string().optional(),
  actualPay: z.string().optional(),
  tips: z.string().optional(),
  paymentMethod: z.string().default("Cash"),
  status: z.enum(["upcoming", "pending payment", "completed"]).default("upcoming"),
  duties: z.string().optional(),
  taxPercentage: z.number().min(0).max(50).default(23),
  notes: z.string().optional(),
  // Mileage tracking
  trackMileage: z.boolean().default(false),
  startingAddress: z.string().optional(),
  endingAddress: z.string().optional(),
  mileage: z.number().optional(),
  isRoundTrip: z.boolean().default(false),
  // Expense tracking with receipts
  trackExpenses: z.boolean().default(false),
  parkingExpense: z.string().optional(),
  parkingReceipts: z.array(z.string()).default([]),
  parkingReimbursed: z.boolean().default(false),
  otherExpenses: z.string().optional(),
  otherExpenseReceipts: z.array(z.string()).default([]),
  otherExpensesReimbursed: z.boolean().default(false),
});

type GigFormData = z.infer<typeof gigFormSchema>;

// Multi-day gig helper function
function generateDateRange(startDate: string, endDate?: string): string[] {
  const dates: string[] = [];
  
  // Single day gig
  if (!endDate?.trim() || endDate === startDate) {
    return [startDate];
  }

  // Multi-day gig
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  if (start > end) return [startDate];
  if (start.getTime() === end.getTime()) return [startDate];
  
  const current = new Date(start);
  let dayCount = 0;
  const MAX_DAYS = 30; // Safety limit
  
  while (current <= end && dayCount < MAX_DAYS) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
    dayCount++;
  }
  
  return dates;
}

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

  // Mutation to update user profile with new client
  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      const response = await apiRequest("PUT", "/api/user", userData);
      return response.json();
    },
    onSuccess: async () => {
      // Refresh user data to get updated preferred clients
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  // Enhanced form setup with mileage and expense tracking
  const form = useForm<GigFormData>({
    resolver: zodResolver(gigFormSchema),
    defaultValues: {
      gigType: "",
      eventName: "",
      clientName: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      expectedPay: "",
      actualPay: "",
      tips: "",
      paymentMethod: "Cash",
      status: "upcoming" as const,
      duties: "",
      taxPercentage: 23,
      notes: "",
      trackMileage: false,
      startingAddress: "",
      endingAddress: "",
      mileage: 0,
      isRoundTrip: false,
      trackExpenses: false,
      parkingExpense: "",
      parkingReceipts: [],
      parkingReimbursed: false,
      otherExpenses: "",
      otherExpenseReceipts: [],
      otherExpensesReimbursed: false,
    }
  });

  // Update defaults when user loads
  useEffect(() => {
    if (user) {
      form.setValue("taxPercentage", user.defaultTaxPercentage || 23);
      if (user.homeAddress) {
        form.setValue("startingAddress", user.homeAddress);
      }
    }
  }, [user, form]);

  // Watch form values for conditional rendering
  const trackMileage = form.watch("trackMileage");
  const trackExpenses = form.watch("trackExpenses");
  const startingAddress = form.watch("startingAddress");
  const endingAddress = form.watch("endingAddress");
  const isRoundTrip = form.watch("isRoundTrip");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  // State for mileage calculation
  const [isCalculatingMileage, setIsCalculatingMileage] = useState(false);
  const [mileageError, setMileageError] = useState<string | null>(null);

  // State for client management
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  // MULTI-DAY GIG DETECTION - Simple and clear for users
  const multiDayInfo = useMemo(() => {
    if (!startDate) return { isMultiDay: false, dayCount: 1, dateRange: [] };

    if (!endDate?.trim() || endDate === startDate) {
      return { isMultiDay: false, dayCount: 1, dateRange: [startDate] };
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    if (start > end || start.getTime() === end.getTime()) {
      return { isMultiDay: false, dayCount: 1, dateRange: [startDate] };
    }

    const dateRange = generateDateRange(startDate, endDate);
    const dayCount = dateRange.length;
    
    return { 
      isMultiDay: dayCount > 1, 
      dayCount, 
      dateRange 
    };
  }, [startDate, endDate]);

  // Only auto-calculate when round trip toggle changes (not when typing addresses)
  useEffect(() => {
    // Only auto-calculate if we have a complete previous calculation and round trip changes
    const currentMileage = form.watch("mileage");
    if (trackMileage && startingAddress && endingAddress && currentMileage && currentMileage > 0) {
      calculateMileage();
    }
  }, [isRoundTrip]);

  const calculateMileage = async () => {
    if (!startingAddress || !endingAddress) return;

    setIsCalculatingMileage(true);
    setMileageError(null);

    try {
      const response = await apiRequest('POST', '/api/calculate-distance', {
        startAddress: startingAddress,
        endAddress: endingAddress,
        roundTrip: isRoundTrip
      });

      console.log('🚗 Mileage calculation request:', {
        startAddress: startingAddress,
        endAddress: endingAddress,
        roundTrip: isRoundTrip
      });

      const data = await response.json();
      console.log('🚗 Mileage calculation response:', data);
      
      if (data.status === 'success' && data.distanceMiles) {
        const miles = Math.ceil(data.distanceMiles); // Round up for tax purposes
        form.setValue("mileage", miles);
        
        // Clear any previous errors
        setMileageError(null);
      } else {
        setMileageError(data.error || "Unable to calculate distance");
      }
    } catch (error) {
      setMileageError("Failed to calculate mileage. Please enter manually.");
    } finally {
      setIsCalculatingMileage(false);
    }
  };

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
      // Save new client to preferred clients if it's not already there
      if (data.clientName && user?.workPreferences?.preferredClients) {
        const preferredClients = user.workPreferences.preferredClients as string[];
        if (!preferredClients.includes(data.clientName)) {
          try {
            await apiRequest('POST', '/api/user/add-preferred-client', {
              clientName: data.clientName
            });
            // Update local cache
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          } catch (error) {
            console.log("Note: Could not save client to preferences, but gig will still be created");
          }
        }
      }

      // Create SINGLE gig entry with date range (calendar will show dots on each day)
      const isMultiDay = data.endDate && data.endDate !== data.startDate;
      
      const gigData: InsertGig = {
        userId: user.id,
        date: data.startDate, // Primary date (start date)
        startDate: data.startDate,
        endDate: data.endDate || data.startDate,
        isMultiDay: !!isMultiDay,
        multiDayGroupId: isMultiDay ? crypto.randomUUID() : null,
        gigType: data.gigType,
        eventName: data.eventName,
        clientName: data.clientName,
        expectedPay: data.expectedPay ? (parseFloat(data.expectedPay) || 0).toString() : "0",
        actualPay: data.actualPay ? (parseFloat(data.actualPay) || 0).toString() : "0", 
        tips: data.tips ? (parseFloat(data.tips) || 0).toString() : "0",
        paymentMethod: data.paymentMethod,
        status: data.status,
        duties: data.duties || null,
        taxPercentage: data.taxPercentage,
        mileage: data.mileage || 0,
        notes: data.notes || null,
        parkingExpense: data.parkingExpense ? (parseFloat(data.parkingExpense) || 0).toString() : "0",
        parkingReceipts: data.parkingReceipts || [],
        parkingReimbursed: data.parkingReimbursed || false,
        otherExpenses: data.otherExpenses ? (parseFloat(data.otherExpenses) || 0).toString() : "0",
        otherExpenseReceipts: data.otherExpenseReceipts || [],
        otherExpensesReimbursed: data.otherExpensesReimbursed || false,
      };

      // Create single gig entry
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger 
                          className="min-h-[48px] text-base bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          style={{
                            fontSize: '16px',
                            minHeight: '48px',
                            touchAction: 'manipulation',
                            WebkitAppearance: 'none'
                          }}
                        >
                          <SelectValue placeholder="Select gig type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent 
                        className="max-h-[300px] overflow-y-auto z-50"
                        position="popper"
                        sideOffset={4}
                      >
                        {(() => {
                          console.log("🔍 SimpleGigForm - User data:", user);
                          console.log("🔍 SimpleGigForm - CustomGigTypes:", user?.customGigTypes);
                          return user?.customGigTypes && user.customGigTypes.length > 0;
                        })() ? (
                          <>
                            {user.customGigTypes!.map((gigType) => (
                              <SelectItem 
                                key={gigType} 
                                value={gigType}
                                className="min-h-[44px] text-base cursor-pointer hover:bg-gray-100 focus:bg-gray-100"
                                style={{ fontSize: '16px', minHeight: '44px' }}
                              >
                                {gigType}
                              </SelectItem>
                            ))}
                            <SelectItem 
                              value="other"
                              className="min-h-[44px] text-base cursor-pointer hover:bg-gray-100 focus:bg-gray-100"
                              style={{ fontSize: '16px', minHeight: '44px' }}
                            >
                              Other
                            </SelectItem>
                          </>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            <p className="text-sm">No gig types added yet.</p>
                            <p className="text-xs mt-1">Go to Profile → Add Type to create your custom gig types.</p>
                          </div>
                        )}
                      </SelectContent>
                    </Select>
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
                      {showNewClientInput ? (
                        <div className="space-y-2">
                          <Input 
                            placeholder="Enter new client name"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && newClientName.trim()) {
                                const clientName = newClientName.trim();
                                field.onChange(clientName);
                                
                                // Save new client to user profile
                                try {
                                  await apiRequest('POST', '/api/user/add-preferred-client', {
                                    clientName: clientName
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                                } catch (error) {
                                  console.log("Could not save client to preferences");
                                }
                                
                                setShowNewClientInput(false);
                                setNewClientName("");
                              } else if (e.key === 'Escape') {
                                setShowNewClientInput(false);
                                setNewClientName("");
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button 
                              type="button" 
                              size="sm" 
                              onClick={async () => {
                                if (newClientName.trim()) {
                                  const clientName = newClientName.trim();
                                  field.onChange(clientName);
                                  
                                  // Save new client to user profile
                                  try {
                                    await apiRequest('POST', '/api/user/add-preferred-client', {
                                      clientName: clientName
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                                  } catch (error) {
                                    console.log("Could not save client to preferences");
                                  }
                                  
                                  setShowNewClientInput(false);
                                  setNewClientName("");
                                }
                              }}
                              disabled={!newClientName.trim()}
                            >
                              Add Client
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setShowNewClientInput(false);
                                setNewClientName("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Select 
                          onValueChange={(value) => {
                            if (value === "__new_client__") {
                              setShowNewClientInput(true);
                            } else {
                              field.onChange(value);
                            }
                          }} 
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select client or add new one" />
                          </SelectTrigger>
                          <SelectContent>
                            {(user?.workPreferences?.preferredClients as string[] || []).map((client: string) => (
                              <SelectItem 
                                key={client} 
                                value={client}
                                className="cursor-pointer"
                              >
                                {client}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new_client__" className="font-medium text-blue-600">
                              + Add New Client
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* MULTI-DAY INDICATOR */}
            {multiDayInfo.isMultiDay && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-blue-800 font-medium">
                    Multi-day gig: {multiDayInfo.dayCount} days ({new Date(startDate + 'T00:00:00').toLocaleDateString()} to {new Date(endDate + 'T00:00:00').toLocaleDateString()})
                  </span>
                </div>
                <p className="text-blue-700 text-sm mt-1">
                  This will create one gig spanning {multiDayInfo.dayCount} days. Calendar will show dots on each day in the range.
                </p>
              </div>
            )}

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
                      value={field.value === 0 ? '' : field.value}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          field.onChange(0);
                        } else {
                          const parsed = parseFloat(value);
                          if (!isNaN(parsed)) {
                            field.onChange(parsed);
                          }
                        }
                      }}
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

            {/* Mileage Tracking Toggle */}
            <FormField
              control={form.control}
              name="trackMileage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Track Mileage
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Mileage Fields */}
            {trackMileage && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starting Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            label=""
                            value={field.value || ""}
                            onChange={(address) => {
                              field.onChange(address);
                              setMileageError(null);
                              // Auto-calculate when user selects a complete address from autocomplete
                              if (address && endingAddress && address !== endingAddress) {
                                setTimeout(() => calculateMileage(), 500);
                              }
                            }}
                            placeholder="Enter starting address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ending Address</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            label=""
                            value={field.value || ""}
                            onChange={(address) => {
                              field.onChange(address);
                              setMileageError(null);
                              // Auto-calculate when user selects a complete address from autocomplete
                              if (address && startingAddress && address !== startingAddress) {
                                setTimeout(() => calculateMileage(), 500);
                              }
                            }}
                            placeholder="Enter destination address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Round Trip Toggle */}
                <FormField
                  control={form.control}
                  name="isRoundTrip"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2">
                          <Navigation className="w-4 h-4" />
                          Round Trip (doubles the distance)
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Mileage Calculation Status */}
                {isCalculatingMileage && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Calculating distance...</span>
                  </div>
                )}

                {mileageError && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                    {mileageError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calculator className="w-4 h-4" />
                          Total Miles {isRoundTrip ? "(Round Trip)" : "(One Way)"}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            value={field.value === 0 ? '' : field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                field.onChange(0);
                              } else {
                                const parsed = parseFloat(value);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  field.onChange(parsed);
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={calculateMileage}
                      disabled={!startingAddress || !endingAddress || isCalculatingMileage}
                      className="w-full"
                    >
                      {isCalculatingMileage ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Calculating {isRoundTrip ? 'Round Trip' : 'Distance'}...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          Calculate {isRoundTrip ? 'Round Trip' : 'Distance'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {form.watch("mileage") && form.watch("mileage")! > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm text-green-800">
                      <strong>Tax Deduction:</strong> ${((form.watch("mileage") || 0) * 0.655).toFixed(2)} 
                      <span className="text-green-600 ml-2">(at $0.655 per mile)</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expense Tracking Toggle */}
            <FormField
              control={form.control}
              name="trackExpenses"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Track Expenses
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Expense Fields */}
            {trackExpenses && (
              <div className="space-y-6">
                {/* Parking Section */}
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg border">
                  <h4 className="font-medium text-blue-900">Parking</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="parkingExpense"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="parkingReimbursed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Reimbursed</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                  <ReceiptUpload
                    receipts={form.watch("parkingReceipts") || []}
                    onReceiptsChange={(receipts) => form.setValue("parkingReceipts", receipts)}
                    label="Upload Receipt Photos"
                  />
                </div>

                {/* Other Expenses Section */}
                <div className="space-y-3 p-4 bg-green-50 rounded-lg border">
                  <h4 className="font-medium text-green-900">Other Expenses</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="otherExpenses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="otherExpensesReimbursed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Reimbursed</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <ReceiptUpload
                    receipts={form.watch("otherExpenseReceipts") || []}
                    onReceiptsChange={(receipts) => form.setValue("otherExpenseReceipts", receipts)}
                    label="Upload Receipt Photos"
                  />
                </div>
              </div>
            )}

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
                    Creating gig...
                  </>
                ) : (
                  multiDayInfo.isMultiDay 
                    ? `Save ${multiDayInfo.dayCount}-Day Gig` 
                    : "Save Gig"
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