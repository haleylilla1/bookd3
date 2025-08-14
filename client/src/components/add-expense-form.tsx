import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { type Gig } from "@shared/schema";
import { addExpenseSchema, type ExpenseFormData, getTodayISO } from "@/lib/form-schemas";
import { AmountField, MerchantField, BusinessPurposeField, CategoryField, DateField } from "@/components/ui/form-field-wrapper";
import { useFormErrorHandler } from "@/hooks/use-form-error-handler";

// Utility function to parse dates consistently across timezones
const parseGigDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

interface AddExpenseFormProps {
  onClose: () => void;
  linkedGigId?: number; // For gig-linked flow from "Got Paid"
}

export default function AddExpenseForm({ onClose, linkedGigId }: AddExpenseFormProps) {
  const { handleError, handleSuccess } = useFormErrorHandler();
  const queryClient = useQueryClient();

  // Get user's gigs for the dropdown  
  const { data: gigsResponse } = useQuery({
    queryKey: ["/api/gigs"],
  });
  
  // Handle both nested and direct array formats
  const gigs = Array.isArray(gigsResponse) 
    ? gigsResponse 
    : (gigsResponse && typeof gigsResponse === 'object' && 'gigs' in gigsResponse 
       ? (gigsResponse as any).gigs || [] 
       : []);
  
  // Debug log to understand data format
  console.log("🔍 Add Expense - Gigs data:", { gigsResponse, gigs: gigs.slice(0, 3), gigsLength: gigs.length });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      date: getTodayISO(),
      amount: "",
      category: "",
      merchant: "",
      businessPurpose: "",
      gigId: linkedGigId,
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      // Transform frontend fields to match API expectations
      const apiData = {
        description: `${data.merchant ? data.merchant + ' - ' : ''}${data.businessPurpose || data.merchant || 'Business expense'}`,
        merchant: data.merchant || 'Unknown', // Database requires merchant field
        businessPurpose: data.businessPurpose || 'Business expense', // Database requires business_purpose field
        amount: data.amount,
        category: data.category,
        date: data.date,
        notes: data.businessPurpose || '',
        gigId: data.gigId
      };
      
      console.log("🔍 Sending expense data:", apiData);
      
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(`Failed to create expense: ${errorData.error || 'Unknown error'}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Immediately close to prevent UI freeze
      onClose();
      
      // Safari-optimized cache refresh - no setTimeout delay
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      handleSuccess("Expense added successfully!");
    },
    onError: (error) => {
      handleError(error, "add expense");
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
      <Card className="w-full max-w-sm max-h-[85vh] overflow-hidden bg-white relative z-50 touch-manipulation rounded-lg flex flex-col">
        <CardHeader className="flex flex-row items-center space-y-0 pb-4 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="mr-2 h-10 w-10 touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <CardTitle className="text-lg">
              {linkedGigId ? "Add Gig Expense" : "Add Expense"}
            </CardTitle>
            <CardDescription>
              {linkedGigId 
                ? "Track expenses for this gig"
                : "Add a business expense to track your spending"
              }
            </CardDescription>
          </div>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-6 min-h-0">
              <div className="space-y-6 py-4">
                {/* Mobile-optimized form fields with consistent touch sizing */}
                <DateField control={form.control} />
                <AmountField control={form.control} />
                <MerchantField control={form.control} />
                <BusinessPurposeField control={form.control} />
                <CategoryField control={form.control} />

                {/* Gig Linking (Optional) */}
                {!linkedGigId && (
                  <FormField
                    control={form.control}
                    name="gigId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Link to gig? (optional)
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 text-base touch-manipulation">
                              <SelectValue placeholder="Select a gig (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            <SelectItem value="none" className="h-12 text-base touch-manipulation cursor-pointer">No gig selected</SelectItem>
                            {Array.isArray(gigs) && gigs.map((gig) => (
                              <SelectItem key={gig.id} value={gig.id.toString()} className="h-12 text-base touch-manipulation cursor-pointer">
                                {gig.eventName} - {gig.clientName} ({parseGigDate(gig.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {linkedGigId && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">
                      This expense will be linked to your selected gig
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Fixed bottom buttons - always visible */}
            <div className="border-t bg-white p-4 rounded-b-lg shrink-0">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-12 text-base font-medium touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="flex-1 h-12 text-base font-medium touch-manipulation"
                >
                  {createExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}