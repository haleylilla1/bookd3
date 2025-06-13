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

const gigFormSchema = z.object({
  gigType: z.string().min(1, "Gig type is required"),
  eventName: z.string().min(1, "Event name is required"),
  clientName: z.string().min(1, "Client name is required"),
  date: z.string().min(1, "Date is required"),
  expectedPay: z.string().optional(),
  actualPay: z.string().optional(),
  paymentMethod: z.string().optional(),
  duties: z.string().optional(),
  taxPercentage: z.number().min(15).max(35).default(23),
  mileage: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["upcoming", "completed", "pending_payment"]).default("upcoming"),
  transportationExpense: z.string().optional(),
  parkingExpense: z.string().optional(),
  otherExpenses: z.string().optional(),
});

type GigFormData = z.infer<typeof gigFormSchema>;

interface GigFormProps {
  onClose: () => void;
}

export default function GigForm({ onClose }: GigFormProps) {
  const [trackExpenses, setTrackExpenses] = useState(false);
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
      date: new Date().toISOString().split('T')[0],
      expectedPay: "",
      actualPay: "",
      paymentMethod: "",
      duties: "",
      taxPercentage: user?.defaultTaxPercentage || 23,
      mileage: "",
      notes: "",
      status: "upcoming",
      transportationExpense: "",
      parkingExpense: "",
      otherExpenses: "",
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
      toast({
        title: "Success",
        description: "Gig saved successfully!",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GigFormData) => {
    const gigData: InsertGig = {
      userId: 1, // For MVP, using single user
      gigType: data.gigType,
      eventName: data.eventName,
      clientName: data.clientName,
      date: data.date,
      expectedPay: data.expectedPay || null,
      actualPay: data.actualPay || null,
      paymentMethod: data.paymentMethod || null,
      status: data.status,
      duties: data.duties || null,
      taxPercentage: data.taxPercentage,
      mileage: data.mileage ? parseInt(data.mileage) : null,
      notes: data.notes || null,
      transportationExpense: trackExpenses && data.transportationExpense ? data.transportationExpense : null,
      parkingExpense: trackExpenses && data.parkingExpense ? data.parkingExpense : null,
      otherExpenses: trackExpenses && data.otherExpenses ? data.otherExpenses : null,
      includeInResume: true,
    };

    createGigMutation.mutate(gigData);
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

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Information */}
              <div className="grid grid-cols-2 gap-3">
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
                        <Input type="number" placeholder="285" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

              {/* Expenses Toggle */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label>Track Expenses</Label>
                  <Switch checked={trackExpenses} onCheckedChange={setTrackExpenses} />
                </div>
                {trackExpenses && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="transportationExpense"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" placeholder="Transportation" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="parkingExpense"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" placeholder="Parking" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="otherExpenses"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" placeholder="Other expenses..." {...field} />
                          </FormControl>
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
                          min={15}
                          max={35}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="mt-2"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>15%</span>
                        <span>35%</span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Mileage */}
              <FormField
                control={form.control}
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mileage</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Round trip miles..." {...field} />
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
