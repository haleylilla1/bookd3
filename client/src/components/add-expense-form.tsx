import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, DollarSign, Store, FileText, Briefcase, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertExpenseSchema, type Gig, BUSINESS_EXPENSE_CATEGORIES } from "@shared/schema";
import { cn } from "@/lib/utils";


const addExpenseFormSchema = insertExpenseSchema.extend({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Amount must be a valid positive number"
  ),
  category: z.string().min(1, "Category is required"),
});

type AddExpenseFormData = z.infer<typeof addExpenseFormSchema>;

interface AddExpenseFormProps {
  onClose: () => void;
  linkedGigId?: number; // For gig-linked flow from "Got Paid"
}

export default function AddExpenseForm({ onClose, linkedGigId }: AddExpenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user's gigs for the dropdown
  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const form = useForm<AddExpenseFormData>({
    resolver: zodResolver(addExpenseFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: "",
      category: "",
      merchant: "",
      businessPurpose: "",
      gigId: linkedGigId,
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: AddExpenseFormData) => {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create expense");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense added successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add expense",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white relative z-50">
        <CardHeader className="flex flex-row items-center space-y-0 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="mr-2 p-2"
          >
            <ArrowLeft className="h-4 w-4" />
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

        <CardContent className="space-y-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Date Picker */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      When did you make this purchase?
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      How much did it cost?
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="text-lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Merchant */}
              <FormField
                control={form.control}
                name="merchant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Who'd you pay?
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Store, vendor, or merchant name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Purpose */}
              <FormField
                control={form.control}
                name="businessPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      What was it for, business-wise?
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Tell us how this helped you do your job (e.g. 'Hotel for 2-day shoot,' 'Gear rental for event,' 'Client dinner before wedding')"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Category - MANDATORY for tax preparation */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Business Category *
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business category for taxes" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUSINESS_EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          <SelectTrigger>
                            <SelectValue placeholder="Select a gig (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No gig selected</SelectItem>
                          {gigs.map((gig) => (
                            <SelectItem key={gig.id} value={gig.id.toString()}>
                              {gig.eventName} - {gig.clientName} ({new Date(gig.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
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

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="flex-1"
                >
                  {createExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}