import { useState } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { InsertGig, User } from "@shared/schema";
import { calculateDistance } from "@/lib/distance";
import ReceiptUpload from "@/components/receipt-upload";

const gigFormSchema = z.object({
  gigType: z.string().min(1, "Gig type is required"),
  eventName: z.string().min(1, "Event name is required"),
  clientName: z.string().min(1, "Client name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  gigAddress: z.string().optional(),
  expectedPay: z.string().optional(),
  actualPay: z.string().optional(),
  tips: z.string().optional(),
  paymentMethod: z.string().optional(),
  duties: z.string().optional(),
  taxPercentage: z.number().min(0).max(50).default(23),
  mileage: z.string().optional(),
  // Enhanced mileage tracking
  startingAddress: z.string().optional(),
  endingAddress: z.string().optional(),
  stops: z.array(z.string()).default([]),
  includeRoundtrip: z.boolean().default(true),
  calculatedMileage: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["upcoming", "completed", "pending_payment"]).default("upcoming"),
  parkingExpense: z.string().optional(),
  parkingReceipts: z.array(z.string()).default([]),
  otherExpenses: z.string().optional(),
  otherExpenseReceipts: z.array(z.string()).default([]),
});

type GigFormData = z.infer<typeof gigFormSchema>;

interface GigFormProps {
  onClose: () => void;
}

export default function GigForm({ onClose }: GigFormProps) {
  const [trackExpenses, setTrackExpenses] = useState(false);
  const [trackMileage, setTrackMileage] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const form = useForm<GigFormData>({
    resolver: zodResolver(gigFormSchema),
    defaultValues: {
      gigType: "",
      eventName: "",
      clientName: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      gigAddress: "",
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
      status: "upcoming",
      parkingExpense: "",
      parkingReceipts: [],
      otherExpenses: "",
      otherExpenseReceipts: [],
    },
  });

  const createGigMutation = useMutation({
    mutationFn: async (data: InsertGig) => {
      const response = await apiRequest("POST", "/api/gigs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Success",
        description: "Gig saved successfully!",
      });
      onClose();
    },
    onError: (error) => {
      console.error("Failed to create gig:", error);
      toast({
        title: "Error",
        description: "Failed to save gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCalculateDistance = async () => {
    const gigAddress = form.getValues("gigAddress");
    const homeAddress = user?.homeAddress;

    if (!gigAddress || !homeAddress) {
      toast({
        title: "Missing Address",
        description: "Both home address and gig address are needed for distance calculation.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingDistance(true);
    
    try {
      const result = await calculateDistance(homeAddress, gigAddress);
      
      if (result.status === 'success') {
        // Auto-populate mileage field with calculated distance
        form.setValue("mileage", Math.round(result.distanceMiles * 2).toString()); // Round trip
        
        toast({
          title: "Distance Calculated",
          description: `${result.distanceMiles} miles (${result.travelTimeMinutes} min travel time). Round trip mileage has been set.`,
        });
      } else {
        toast({
          title: "Distance Calculation Failed",
          description: result.error || "Could not calculate distance.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to calculate distance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const handleCalculateMileage = async () => {
    const startingAddress = form.getValues("startingAddress");
    const endingAddress = form.getValues("endingAddress");
    const stops = form.getValues("stops").filter(stop => stop.trim());
    const includeRoundtrip = form.getValues("includeRoundtrip");

    if (!startingAddress || !endingAddress) {
      toast({
        title: "Missing Addresses",
        description: "Both starting and ending addresses are required for mileage calculation.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingDistance(true);
    
    try {
      let totalDistance = 0;
      let totalTime = 0;
      
      // Create the complete route: start -> stops -> end
      const waypoints = [startingAddress, ...stops, endingAddress];
      
      // Calculate distance between each consecutive pair of waypoints
      for (let i = 0; i < waypoints.length - 1; i++) {
        const result = await calculateDistance(waypoints[i], waypoints[i + 1]);
        
        if (result.status === 'success') {
          totalDistance += result.distanceMiles;
          totalTime += result.travelTimeMinutes;
        } else {
          throw new Error(`Failed to calculate distance between ${waypoints[i]} and ${waypoints[i + 1]}`);
        }
      }
      
      // Double the distance if round trip is included
      if (includeRoundtrip) {
        totalDistance *= 2;
        totalTime *= 2;
      }
      
      // Round to 1 decimal place
      const roundedDistance = Math.round(totalDistance * 10) / 10;
      
      // Set the calculated mileage
      form.setValue("calculatedMileage", roundedDistance.toString());
      
      toast({
        title: "Mileage Calculated",
        description: `${roundedDistance} miles total (${Math.round(totalTime)} min travel time)${includeRoundtrip ? ' including round trip' : ''}.`,
      });
      
    } catch (error) {
      console.error("Mileage calculation error:", error);
      toast({
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "Failed to calculate mileage. Please check your addresses.",
        variant: "destructive",
      });
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const onSubmit = async (data: GigFormData) => {
    let distanceMiles = null;
    let travelTimeMinutes = null;

    // Calculate distance if both addresses are available
    if (data.gigAddress && user?.homeAddress) {
      const result = await calculateDistance(user.homeAddress, data.gigAddress);
      if (result.status === 'success') {
        distanceMiles = result.distanceMiles.toString();
        travelTimeMinutes = result.travelTimeMinutes;
      }
    }

    // Generate array of dates for the gig
    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : startDate;
    const gigDates: string[] = [];
    
    // Add all dates from start to end (inclusive)
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      gigDates.push(date.toISOString().split('T')[0]);
    }

    // Calculate daily amounts for multi-day gigs
    const totalDays = gigDates.length;
    const dailyExpectedPay = data.expectedPay ? (parseFloat(data.expectedPay) / totalDays).toFixed(2) : null;
    const dailyActualPay = data.actualPay ? (parseFloat(data.actualPay) / totalDays).toFixed(2) : null;
    const dailyTips = data.tips ? (parseFloat(data.tips) / totalDays).toFixed(2) : null;
    const dailyParkingExpense = (trackExpenses && data.parkingExpense) ? (parseFloat(data.parkingExpense) / totalDays).toFixed(2) : null;
    const dailyOtherExpenses = (trackExpenses && data.otherExpenses) ? (parseFloat(data.otherExpenses) / totalDays).toFixed(2) : null;
    
    // Use calculated mileage if available, otherwise use manual override
    const totalMileage = data.calculatedMileage || data.mileage;
    const dailyMileage = totalMileage ? Math.round(parseFloat(totalMileage) / totalDays) : null;

    // Create a gig entry for each date
    for (const gigDate of gigDates) {
      const gigData: InsertGig = {
        userId: 1, // For MVP, using single user
        gigType: data.gigType,
        eventName: data.eventName,
        clientName: data.clientName,
        date: gigDate,
        gigAddress: data.gigAddress || null,
        distanceMiles,
        travelTimeMinutes,
        expectedPay: dailyExpectedPay,
        actualPay: dailyActualPay,
        tips: dailyTips,
        paymentMethod: data.paymentMethod || null,
        status: data.status,
        duties: data.duties || null,
        taxPercentage: data.taxPercentage,
        mileage: dailyMileage,
        notes: data.notes || null,
        parkingExpense: dailyParkingExpense,
        parkingReceipts: trackExpenses ? data.parkingReceipts : [],
        otherExpenses: dailyOtherExpenses,
        otherExpenseReceipts: trackExpenses ? data.otherExpenseReceipts : [],
        includeInResume: true,
      };

      try {
        await createGigMutation.mutateAsync(gigData);
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to create gig for ${gigDate}. Please try again.`,
          variant: "destructive",
        });
        return; // Stop creating more gigs if one fails
      }
    }

    // Success message for multi-day gigs
    if (gigDates.length > 1) {
      toast({
        title: "Success",
        description: `Created ${gigDates.length} gig entries for ${data.startDate} to ${data.endDate}`,
      });
    }
    
    onClose();
  };

  const taxPercentage = form.watch("taxPercentage");
  const expectedPay = form.watch("expectedPay");
  const taxEstimate = expectedPay ? (parseFloat(expectedPay) * taxPercentage / 100).toFixed(2) : "0.00";

  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Add New Gig</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Gig Type */}
              <FormField
                control={form.control}
                name="gigType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of Gig</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gig type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {user?.customGigTypes && user.customGigTypes.length > 0 ? (
                          user.customGigTypes.map((gigType) => (
                            <SelectItem key={gigType} value={gigType}>
                              {gigType}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="brand-ambassador">Brand Ambassador</SelectItem>
                            <SelectItem value="bartender">Bartender</SelectItem>
                            <SelectItem value="server">Server/Catering</SelectItem>
                            <SelectItem value="promo">Promo Rep</SelectItem>
                            <SelectItem value="event-staff">Event Staff</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </>
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

              {/* Gig Address */}
              <FormField
                control={form.control}
                name="gigAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gig Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 123 Main St, City, State 12345" {...field} />
                    </FormControl>
                    {user?.homeAddress && field.value && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCalculateDistance}
                        disabled={isCalculatingDistance}
                        className="mt-2"
                      >
                        {isCalculatingDistance ? "Calculating..." : "Calculate Distance"}
                      </Button>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Information */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="expectedPay"
                  render={({ field }) => {
                    const startDate = form.watch("startDate");
                    const endDate = form.watch("endDate");
                    const isMultiDay = startDate && endDate && startDate !== endDate;
                    const dayCount = isMultiDay ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
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
                    const startDate = form.watch("startDate");
                    const endDate = form.watch("endDate");
                    const isMultiDay = startDate && endDate && startDate !== endDate;
                    const dayCount = isMultiDay ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
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
                  const startDate = form.watch("startDate");
                  const endDate = form.watch("endDate");
                  const isMultiDay = startDate && endDate && startDate !== endDate;
                  const dayCount = isMultiDay ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
                  const dailyAmount = field.value ? (parseFloat(field.value) / dayCount).toFixed(2) : "0.00";

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
                const startDate = form.watch("startDate");
                const endDate = form.watch("endDate");
                const isMultiDay = startDate && endDate && startDate !== endDate;
                const dayCount = isMultiDay ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;
                
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

              {/* Expenses Toggle */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Track Expenses</Label>
                  <Switch checked={trackExpenses} onCheckedChange={setTrackExpenses} />
                </div>
                {trackExpenses && (
                  <div className="space-y-4">
                    {/* Parking Expense */}
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="parkingExpense"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parking Expense</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0.00" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <ReceiptUpload
                        label="Parking Receipts"
                        receipts={form.watch("parkingReceipts")}
                        onReceiptsChange={(receipts) => form.setValue("parkingReceipts", receipts)}
                      />
                    </div>

                    {/* Other Expenses */}
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="otherExpenses"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Other Expenses</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0.00" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <ReceiptUpload
                        label="Other Expense Receipts"
                        receipts={form.watch("otherExpenseReceipts")}
                        onReceiptsChange={(receipts) => form.setValue("otherExpenseReceipts", receipts)}
                      />
                    </div>
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

              {/* Tax Estimate */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Estimated Tax ({taxPercentage}%)
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${taxEstimate}
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

              {/* Enhanced Mileage Tracking */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Track Mileage</Label>
                  <Switch checked={trackMileage} onCheckedChange={setTrackMileage} />
                </div>
                {trackMileage && (
                  <div className="space-y-4">
                    {/* Starting Address */}
                    <FormField
                      control={form.control}
                      name="startingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Starting Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your home or starting location..."
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Ending Address */}
                    <FormField
                      control={form.control}
                      name="endingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ending Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Gig location or final destination..."
                              {...field} 
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
                        {form.watch("stops").map((stop, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={stop}
                              onChange={(e) => {
                                const stops = [...form.watch("stops")];
                                stops[index] = e.target.value;
                                form.setValue("stops", stops);
                              }}
                              placeholder={`Stop ${index + 1} address...`}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const stops = form.watch("stops").filter((_, i) => i !== index);
                                form.setValue("stops", stops);
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
                            const stops = [...form.watch("stops"), ""];
                            form.setValue("stops", stops);
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
                      disabled={isCalculatingDistance || !form.watch("startingAddress") || !form.watch("endingAddress")}
                      className="w-full"
                    >
                      {isCalculatingDistance ? "Calculating..." : "Calculate Mileage"}
                    </Button>

                    {/* Calculated Mileage Display */}
                    {form.watch("calculatedMileage") && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-green-800">Calculated Mileage:</span>
                          <span className="text-lg font-bold text-green-900">
                            {form.watch("calculatedMileage")} miles
                          </span>
                        </div>
                        {form.watch("includeRoundtrip") && (
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

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full"
                disabled={createGigMutation.isPending}
              >
                {createGigMutation.isPending ? "Saving..." : "Save Gig"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
