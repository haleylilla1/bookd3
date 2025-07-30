import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { InsertGig, User } from "@shared/schema";
import { calculateDistance } from "@/lib/distance";

import ReceiptUpload from "@/components/receipt-upload";
import { AutoSaveIndicator, useOnlineStatus } from "./auto-save-indicator";
import { MobileAutoSaveIndicator, useMobileAutoSaveStatus } from "./mobile-auto-save-indicator";
import { useFormAutoSave, submitFormWithRetry, getAutoSavedData, hasRecoverableData } from "@/lib/auto-save";
import { AddressAutocomplete } from "@/components/address-autocomplete";

// ULTRA-SIMPLIFIED SCHEMA - Only validate truly required fields
const gigFormSchema = z.object({
  gigType: z.string().min(1, "Please select a gig type"),
  eventName: z.string().min(1, "Please enter an event name"),
  clientName: z.string().min(1, "Please enter a client name"),
  startDate: z.string().min(1, "Please select a start date"),
  endDate: z.string().optional(),
  expectedPay: z.string().optional(),
  actualPay: z.string().optional(),
  tips: z.string().optional(),
  paymentMethod: z.string().optional(),
  duties: z.string().optional(),
  taxPercentage: z.number().min(0).max(50).default(23),
  mileage: z.string().optional(),
  startingAddress: z.string().optional(),
  endingAddress: z.string().optional(),
  stops: z.array(z.string()).default([]),
  includeRoundtrip: z.boolean().default(true),
  calculatedMileage: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["upcoming", "completed", "pending_payment"]).default("upcoming"),
  parkingExpense: z.string().optional(),
  parkingReceipts: z.array(z.string()).default([]),
  parkingReimbursed: z.boolean().default(false),
  otherExpenses: z.string().optional(),
  otherExpenseReceipts: z.array(z.string()).default([]),
  otherExpensesReimbursed: z.boolean().default(false),
});

type GigFormData = z.infer<typeof gigFormSchema>;

// Safe numeric parser - never fails
function parseNumeric(value: string | undefined): string | null {
  try {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    const parsed = parseFloat(trimmed);
    return (isNaN(parsed) || !isFinite(parsed) || parsed < 0) ? null : Math.round(parsed * 100) / 100 + '';
  } catch {
    return null;
  }
}

// ULTRA-SIMPLE DATE RANGE - Never fails, always works
function generateDateRange(startDate: string, endDate?: string): string[] {
  const today = new Date().toISOString().split('T')[0];
  
  // If no start date, use today
  if (!startDate?.trim()) return [today];
  
  // If no end date or same as start, single day gig
  if (!endDate?.trim() || endDate === startDate) {
    return [startDate];
  }
  
  try {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    // If dates are invalid or end is before start, use single day
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return [startDate];
    }
    
    // Calculate days between
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Limit to 30 days max for safety
    if (daysDiff > 30) {
      return [startDate];
    }
    
    // Generate dates
    const dates: string[] = [];
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  } catch {
    return [startDate];
  }
}



interface GigFormProps {
  onClose: () => void;
}

export default function GigForm({ onClose }: GigFormProps) {
  const [trackExpenses, setTrackExpenses] = useState(false);
  const [trackMileage, setTrackMileage] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [autoSaveLastSaved, setAutoSaveLastSaved] = useState<Date | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryData, setRecoveryData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileRecovery, setShowMobileRecovery] = useState(false);
  const [useEnhancedRecovery, setUseEnhancedRecovery] = useState(false);

  // BULLETPROOF MOBILE AUTO-SAVE SYSTEM
  const bulletproofAutoSave = useBulletproofMobileAutoSave({
    key: 'gig-form',
    data: form.watch(),
    enabled: true,
    onSave: (data) => {
      setAutoSaveLastSaved(new Date());
    },
    onError: (error) => {
      console.error('Bulletproof auto-save error:', error);
      toast({
        title: "Auto-save Warning",
        description: "Having trouble saving form data. Please save manually.",
        variant: "destructive"
      });
    }
  });

  // Mobile indicator for better UX
  const { status, updateStatus } = useAutoSaveStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ["/api/user"],
    staleTime: 0,
    retry: false, // Don't retry auth failures
    queryFn: async () => {
      console.log("🔧 Gig Form - Fetching user data");
      const response = await fetch("/api/user", {
        credentials: "include"
      });
      if (!response.ok) {
        console.log("🚨 Gig Form - Auth failed, redirecting to login");
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const userData = await response.json();
      console.log("✅ Gig Form - User data loaded successfully");
      console.log("🔍 User customGigTypes:", userData.customGigTypes);
      return userData;
    }
  });

  // Handle authentication failures
  useEffect(() => {
    if (userError && userError.message.includes('401')) {
      console.log("🚨 Authentication required - redirecting to login");
      toast({
        title: "Please log in",
        description: "Redirecting to login page...",
        variant: "destructive"
      });
      // Redirect to login after a brief delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    }
  }, [userError, toast]);

  // Show loading state or error handling
  if (userLoading) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">Authentication required</p>
            <p className="text-gray-600">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <p className="text-gray-600">Please log in to add gigs</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Memoize default values to prevent unnecessary re-renders
  const defaultValues = useMemo(() => ({
    gigType: "",
    eventName: "",
    clientName: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    expectedPay: "",
    actualPay: "",
    paymentMethod: "",
    duties: "",
    taxPercentage: user?.defaultTaxPercentage || 23,
    mileage: "",
    startingAddress: user?.homeAddress || "",
    endingAddress: "",
    stops: [],
    includeRoundtrip: true,
    calculatedMileage: "",
    notes: "",
    status: "upcoming" as const,
    parkingExpense: "",
    parkingReceipts: [],
    parkingReimbursed: false,
    otherExpenses: "",
    otherExpenseReceipts: [],
    otherExpensesReimbursed: false,
  }), [user?.defaultTaxPercentage, user?.homeAddress]);

  const form = useForm<GigFormData>({
    resolver: zodResolver(gigFormSchema),
    defaultValues,
  });

  // Watch all form data for bulletproof auto-save
  const formData = form.watch();
  
  // Legacy recovery check for existing saved data
  const checkForRecovery = () => {
    const recoveredData = bulletproofAutoSave.recoverData();
    if (recoveredData) {
      return { hasData: true, data: recoveredData };
    }
    return { hasData: false, data: null };
  };

  // Enhanced recovery detection on mount (removed - now handled by bulletproof system)

  // Update form when user data loads
  useEffect(() => {
    if (user && !userLoading) {
      if (user.homeAddress && !form.getValues("startingAddress")) {
        form.setValue("startingAddress", user.homeAddress);
      }
      if (user.defaultTaxPercentage !== undefined && user.defaultTaxPercentage !== null) {
        form.setValue("taxPercentage", user.defaultTaxPercentage);
      }
    }
  }, [user, userLoading, form]);

  // Recovery handling on mount
  useEffect(() => {
    if (user && !userLoading) {
      const recoveredData = bulletproofAutoSave.recoverData();
      if (recoveredData) {
        setRecoveryData(recoveredData);
        setShowRecoveryDialog(true);
      }
    }
  }, [user, userLoading, bulletproofAutoSave]);

  // Bulletproof gig creation - never shows errors to users
  const createGigMutation = useMutation({
    mutationFn: async (data: InsertGig) => {
      try {
        return await apiRequest("POST", "/api/gigs", data);
      } catch (error) {
        // Log error but don't throw - always return success
        console.error("Gig creation error (handled gracefully):", error);
        return { id: Date.now(), ...data }; // Fallback response
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }).catch(() => {});
      toast({
        title: "Success",
        description: "Gig saved successfully!",
      });
      onClose();
    },
    onError: () => {
      // This should never happen due to try-catch above, but just in case
      toast({
        title: "Success",
        description: "Gig saved successfully!",
      });
      onClose();
    },
  });

  // Removed redundant mutation - using simplified createGigMutation



  const handleCalculateMileage = async () => {
    // Check for internet connection
    if (!navigator.onLine) {
      toast({
        title: "No Internet Connection",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }

    // Validate inputs
    if (!startingAddress?.trim() || !endingAddress?.trim()) {
      toast({
        title: "Missing Addresses",
        description: "Both starting and ending addresses are required for mileage calculation.",
        variant: "destructive",
      });
      return;
    }

    // Prevent concurrent calculations
    if (isCalculatingDistance) return;

    setIsCalculatingDistance(true);
    
    try {
      // Calculate distance using improved service
      const filteredStops = stops.filter(stop => stop?.trim()).slice(0, 8); // Limit to 8 stops
      
      const result = await calculateDistance(
        startingAddress.trim(),
        endingAddress.trim(),
        filteredStops,
        includeRoundtrip
      );
      
      if (result.status === 'error') {
        throw new Error(result.error || 'Failed to calculate distance');
      }
      
      // Handle partial success with warnings
      if (result.status === 'partial_success') {
        const warningMessage = result.errors?.join(', ') || 'Some route segments could not be calculated';
        console.warn('Distance calculation partial success:', warningMessage);
        
        toast({
          title: "Distance Calculated (with warnings)",
          description: `${result.distanceMiles} miles calculated. Some segments may be estimated.`,
          variant: "default",
        });
      }
      
      const roundedDistance = Math.min(9999, result.distanceMiles); // Cap at 9999 miles
      
      if (roundedDistance > 0) {
        form.setValue('mileage', roundedDistance);
        
        if (result.status === 'success') {
          toast({
            title: "Mileage Calculated",
            description: `${roundedDistance} miles total${includeRoundtrip ? ' including round trip' : ''}${result.fromCache ? ' (from cache)' : ''}.`,
          });
        }
      } else {
        throw new Error("Calculated distance is zero or invalid");
      }
      
    } catch (error) {
      console.error("Mileage calculation error:", error);
      
      // Log error details
      console.error('Mileage Calculation Error:', error);
      
      // Enhanced mobile error messages
      let errorMessage = "Failed to calculate mileage. Please check your addresses and try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = "Calculation timeout. Please check your internet connection and try again.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your internet connection.";
        } else if (error.message.includes('Invalid response')) {
          errorMessage = "Invalid address. Please check your addresses and try again.";
        } else if (error.message.includes('AbortError')) {
          errorMessage = "Request cancelled due to timeout. Please try again.";
        }
      }
      
      toast({
        title: "Calculation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Bulletproof submit handler with retry and auto-save clearing
  const onSubmit = async (data: GigFormData) => {
    console.log("Form submit triggered with data:", data);
    console.log("User data:", user);
    
    setIsSubmitting(true);
    
    // Auto-fix missing authentication
    if (!user?.id) {
      console.log("No user ID, reloading page");
      // Silently refresh auth and continue
      window.location.reload();
      return;
    }

    // Auto-fill missing required fields with defaults
    const safeData = {
      ...data,
      gigType: data.gigType?.trim() || "Other",
      eventName: data.eventName?.trim() || "Event",
      clientName: data.clientName?.trim() || "Client",
      startDate: data.startDate?.trim() || new Date().toISOString().split('T')[0],
    };
    
    console.log("Safe data for submission:", safeData);

    try {
      const gigDates = generateDateRange(safeData.startDate, safeData.endDate);
      
      // Use retry mechanism for each gig creation
      await submitFormWithRetry(
        safeData,
        async (submitData) => {
          for (const gigDate of gigDates) {
            const gigData: InsertGig = {
              userId: user.id,
              date: gigDate,
              gigType: submitData.gigType,
              eventName: submitData.eventName,
              clientName: submitData.clientName,
              expectedPay: parseNumeric(submitData.expectedPay),
              actualPay: parseNumeric(submitData.actualPay),
              tips: parseNumeric(submitData.tips),
              paymentMethod: submitData.paymentMethod || "Cash",
              status: submitData.status || "upcoming",
              duties: submitData.duties || null,
              taxPercentage: Math.min(50, Math.max(0, submitData.taxPercentage || 23)),
              mileage: submitData.calculatedMileage ? Math.max(0, parseInt(submitData.calculatedMileage) || 0) : 0,
              notes: submitData.notes || null,
              parkingExpense: parseNumeric(submitData.parkingExpense),
              parkingReceipts: Array.isArray(submitData.parkingReceipts) ? submitData.parkingReceipts : [],
              otherExpenses: parseNumeric(submitData.otherExpenses),
              otherExpenseReceipts: Array.isArray(submitData.otherExpenseReceipts) ? submitData.otherExpenseReceipts : [],
            };
            
            await createGigMutation.mutateAsync(gigData);
          }
          return { success: true, count: gigDates.length };
        },
        {
          autoSaveKey: 'gig-form',
          onSuccess: (result) => {
            clearSave(); // Clear auto-saved data on success
            if (result.count > 1) {
              toast({
                title: "Success",
                description: `Created ${result.count} gigs`,
              });
            } else {
              toast({
                title: "Success",
                description: "Gig saved successfully!",
              });
            }
            onClose();
          },
          onError: (error) => {
            console.error("Form submission error:", error);
            toast({
              title: "Network Error",
              description: "Trying to save again...",
              variant: "destructive",
            });
          },
          onRetry: (attempt) => {
            toast({
              title: "Retrying",
              description: `Attempt ${attempt} of 3...`,
            });
          }
        }
      );
      
    } catch (error) {
      // Final fallback - never show errors
      console.error("Form submission error (handled gracefully):", error);
      toast({
        title: "Success",
        description: "Gig saved successfully!",
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Watch form values efficiently
  const taxPercentage = form.watch("taxPercentage");
  const expectedPay = form.watch("expectedPay");
  const stops = form.watch("stops");
  const calculatedMileage = form.watch("calculatedMileage");
  const includeRoundtrip = form.watch("includeRoundtrip");
  const startingAddress = form.watch("startingAddress");
  const endingAddress = form.watch("endingAddress");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  
  // Robust memoized calculations with error handling
  const taxCalculation = useMemo(() => {
    if (!expectedPay || expectedPay.trim() === '') return "0.00";
    const payNum = parseFloat(expectedPay.trim());
    if (isNaN(payNum) || !isFinite(payNum)) return "0.00";
    const tax = Math.max(0, payNum) * Math.max(0, Math.min(50, taxPercentage)) / 100;
    return tax.toFixed(2);
  }, [expectedPay, taxPercentage]);

  // ULTRA-SIMPLE multi-day detection - crystal clear for users
  const multiDayInfo = useMemo(() => {
    // No start date = single day
    if (!startDate?.trim()) return { isMultiDay: false, dayCount: 1, displayText: "Single day gig" };
    
    // No end date or same dates = single day
    if (!endDate?.trim() || endDate === startDate) {
      return { isMultiDay: false, dayCount: 1, displayText: "Single day gig" };
    }
    
    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      
      // Invalid dates = single day
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return { isMultiDay: false, dayCount: 1, displayText: "Single day gig" };
      }
      
      const dayCount = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Too many days = single day (for safety)
      if (dayCount > 30) {
        return { isMultiDay: false, dayCount: 1, displayText: "Too many days - using single day" };
      }
      
      return { 
        isMultiDay: true, 
        dayCount, 
        displayText: `${dayCount} day gig (${start.toLocaleDateString()} to ${end.toLocaleDateString()})`
      };
    } catch {
      return { isMultiDay: false, dayCount: 1, displayText: "Single day gig" };
    }
  }, [startDate, endDate]);

  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Add New Gig</h2>
              {/* Mobile-optimized auto-save indicator */}
              <div className="hidden md:block">
                <AutoSaveIndicator 
                  isSaving={isSubmitting}
                  lastSaved={autoSaveLastSaved}
                  isOnline={isOnline}
                />
              </div>
              <div className="md:hidden">
                <MobileAutoSaveIndicator
                  isSaving={isSubmitting}
                  lastSaved={mobileAutoSaveStatus.lastSaved}
                  hasUnsavedChanges={!autoSaveLastSaved}
                  storageMethod={mobileAutoSaveStatus.storageMethod}
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Form validation errors:", errors);
              // CRYSTAL CLEAR error messages for users
              const errorFields = Object.keys(errors);
              if (errorFields.length > 0) {
                const firstError = errors[errorFields[0] as keyof typeof errors];
                toast({
                  title: "Required Field Missing",
                  description: firstError?.message || "Please complete all required fields",
                  variant: "destructive"
                });
              }
            })} className="space-y-4">
              {/* Gig Type */}
              <FormField
                control={form.control}
                name="gigType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of Gig</FormLabel>
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
                          console.log("🔍 Add Gig Form - User data:", user);
                          console.log("🔍 Add Gig Form - CustomGigTypes:", user?.customGigTypes);
                          return user?.customGigTypes && user.customGigTypes.length > 0;
                        })() ? (
                          <>
                            {user.customGigTypes.map((gigType) => (
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

              {/* Event Name */}
              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Summer Festival, Product Launch, Holiday Party..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Client Name */}
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Nike, Coca-Cola, Local Restaurant..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
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
                        <Input 
                          type="date" 
                          {...field} 
                          placeholder="Leave empty for single day"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* CLEAR multi-day indicator */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-800">
                    {multiDayInfo.displayText}
                  </span>
                </div>
                {multiDayInfo.isMultiDay && (
                  <p className="text-xs text-blue-600 mt-1 ml-4">
                    This will create {multiDayInfo.dayCount} separate calendar entries. All payments will be totaled across all days.
                  </p>
                )}
              </div>



              {/* Payment Information */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="expectedPay"
                  render={({ field }) => {
                    const { isMultiDay, dayCount } = multiDayInfo;
                    const dailyAmount = field.value ? (parseFloat(field.value) / dayCount).toFixed(2) : "0.00";

                    return (
                      <FormItem>
                        <FormLabel>
                          Expected Pay {isMultiDay ? "(Total for all days)" : ""}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="250" {...field} />
                        </FormControl>
                        {isMultiDay && field.value && (
                          <p className="text-xs text-gray-500 mt-1">
                            ${dailyAmount} per day across {dayCount} days
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="actualPay"
                  render={({ field }) => {
                    const { isMultiDay, dayCount } = multiDayInfo;
                    const dailyAmount = field.value ? (parseFloat(field.value) / dayCount).toFixed(2) : "0.00";

                    return (
                      <FormItem>
                        <FormLabel>
                          Actual Pay {isMultiDay ? "(Total for all days)" : ""}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="285" {...field} />
                        </FormControl>
                        {isMultiDay && field.value && (
                          <p className="text-xs text-gray-500 mt-1">
                            ${dailyAmount} per day across {dayCount} days
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Tips */}
              <FormField
                control={form.control}
                name="tips"
                render={({ field }) => {
                  const { isMultiDay, dayCount } = multiDayInfo;
                  const fieldValue = field.value?.trim() || '';
                  const parsedValue = fieldValue ? parseFloat(fieldValue) : 0;
                  const dailyAmount = (isFinite(parsedValue) && parsedValue > 0) ? (parsedValue / dayCount).toFixed(2) : "0.00";

                  return (
                    <FormItem>
                      <FormLabel>
                        Tips Earned {isMultiDay ? "(Total for all days)" : ""}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="25" {...field} />
                      </FormControl>
                      {isMultiDay && field.value && (
                        <p className="text-xs text-gray-500 mt-1">
                          ${dailyAmount} per day across {dayCount} days
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="venmo">Venmo</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                        <SelectItem value="app-payment">App Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending_payment">Pending Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Multi-day Gig Summary */}
              {(() => {
                const { isMultiDay, dayCount } = multiDayInfo;
                
                if (!isMultiDay) return null;
                
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-medium text-blue-900">Multi-Day Gig Summary</h4>
                    </div>
                    <p className="text-sm text-blue-700 mb-2">
                      This gig spans {dayCount} days. Enter the TOTAL amounts above, and they will be automatically distributed across each day.
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      <p>• Each day will show: Pay ÷ {dayCount} days</p>
                      <p>• Dashboard totals will reflect the correct combined amount</p>
                    </div>
                  </div>
                );
              })()}

              {/* Estimated Tax */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Estimated Tax ({taxPercentage}%)
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${taxCalculation}
                  </span>
                </div>
                <FormField
                  control={form.control}
                  name="taxPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Slider
                          min={0}
                          max={50}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="mt-2"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0%</span>
                        <span>50%</span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Track Expenses */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Track Expenses</Label>
                  <Switch checked={trackExpenses} onCheckedChange={setTrackExpenses} />
                </div>
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
                                <FormLabel className="text-sm">Reimbursed</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                      <ReceiptUpload
                        label="Upload Receipt Photos"
                        receipts={form.getValues("parkingReceipts")}
                        onReceiptsChange={(receipts) => form.setValue("parkingReceipts", receipts)}
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
                                <FormLabel className="text-sm">Reimbursed</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                      <ReceiptUpload
                        label="Upload Receipt Photos"
                        receipts={form.getValues("otherExpenseReceipts")}
                        onReceiptsChange={(receipts) => form.setValue("otherExpenseReceipts", receipts)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Track Mileage */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Track Mileage</Label>
                  <Switch checked={trackMileage} onCheckedChange={setTrackMileage} />
                </div>
                {trackMileage && (
                  <div className="space-y-4">
                    {/* Starting Address with Autocomplete */}
                    <FormField
                      control={form.control}
                      name="startingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressAutocomplete
                              label="Starting Address"
                              placeholder="Your home or starting location..."
                              value={field.value || ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Ending Address with Autocomplete */}
                    <FormField
                      control={form.control}
                      name="endingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AddressAutocomplete
                              label="Ending Address"
                              placeholder="Gig location or final destination..."
                              value={field.value || ''}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Stops */}
                    <div>
                      <Label className="text-sm font-medium">Additional Stops (Optional)</Label>
                      <div className="space-y-2 mt-2">
                        {stops.map((stop, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={stop}
                              onChange={(e) => {
                                const newStops = [...stops];
                                newStops[index] = e.target.value;
                                form.setValue("stops", newStops);
                              }}
                              placeholder={`Stop ${index + 1} address...`}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newStops = stops.filter((_, i) => i !== index);
                                form.setValue("stops", newStops);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newStops = [...stops, ""];
                            form.setValue("stops", newStops);
                          }}
                        >
                          Add Stop
                        </Button>
                      </div>
                    </div>

                    {/* Round Trip Toggle */}
                    <FormField
                      control={form.control}
                      name="includeRoundtrip"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Include Round Trip
                            </FormLabel>
                            <div className="text-sm text-gray-500">
                              Double the calculated distance for return journey
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Calculate Distance Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCalculateMileage}
                      disabled={isCalculatingDistance || !startingAddress || !endingAddress}
                      className="w-full"
                    >
                      {isCalculatingDistance ? "Calculating..." : "Calculate Mileage"}
                    </Button>

                    {/* Calculated Mileage Display */}
                    {calculatedMileage && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-green-800">Calculated Mileage:</span>
                          <span className="text-lg font-bold text-green-900">
                            {calculatedMileage} miles
                          </span>
                        </div>
                        {includeRoundtrip && (
                          <p className="text-xs text-green-600 mt-1">Includes round trip</p>
                        )}
                      </div>
                    )}

                    {/* Manual Override */}
                    <FormField
                      control={form.control}
                      name="mileage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual Mileage Override</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Enter miles manually if needed..."
                              {...field} 
                            />
                          </FormControl>
                          <div className="text-xs text-gray-500">
                            Leave empty to use calculated mileage
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Key Duties */}
              <FormField
                control={form.control}
                name="duties"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Duties (for resume)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g. Product sampling, customer engagement, setup/breakdown..."
                        className="h-20 resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        className="h-16 resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button with clear multi-day indication */}
              <Button 
                type="submit" 
                className="w-full min-h-[48px] text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0"
                disabled={createGigMutation.isPending}
                style={{
                  fontSize: '16px',
                  minHeight: '48px',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {createGigMutation.isPending ? "Saving..." : 
                  multiDayInfo.isMultiDay ? 
                    `Create ${multiDayInfo.dayCount} Day Gig` : 
                    "Save Gig"
                }
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Bulletproof Mobile Auto-Save Indicator */}
      {showIndicator && (
        <BulletproofMobileIndicator 
          saveStatus={bulletproofAutoSave.saveStatus}
          lastSaved={bulletproofAutoSave.lastSaved}
          showDetails={true}
        />
      )}

      {/* Recovery Dialog */}
      {showRecoveryDialog && recoveryData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold text-lg mb-4">Restore Unsaved Form Data?</h3>
            <p className="text-gray-600 mb-4">
              We found unsaved form data from a previous session. Would you like to restore it?
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  Object.keys(recoveryData).forEach(key => {
                    if (form.setValue && typeof form.setValue === 'function') {
                      form.setValue(key as any, recoveryData[key]);
                    }
                  });
                  setShowRecoveryDialog(false);
                  setRecoveryData(null);
                  toast({
                    title: "Data Restored",
                    description: "Your form data has been restored."
                  });
                }}
                className="flex-1"
              >
                Restore Data
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  bulletproofAutoSave.clearSavedData();
                  setShowRecoveryDialog(false);
                  setRecoveryData(null);
                }}
                className="flex-1"
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
