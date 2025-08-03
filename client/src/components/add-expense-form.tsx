import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { insertExpenseSchema, type InsertExpense, type Gig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Category mapping from your specifications
const EXPENSE_CATEGORIES = [
  { ui: "Promo & Marketing", irs: "Advertising" },
  { ui: "Car or Mileage", irs: "Car and Truck Expenses" },
  { ui: "Platform or Payment Fees", irs: "Commissions and Fees" },
  { ui: "Hired Help (Assistants, DJs, etc.)", irs: "Contract Labor" },
  { ui: "Big Gear or Equipment (Over $500)", irs: "Depreciation" },
  { ui: "Business Insurance", irs: "Insurance (other than health)" },
  { ui: "Pro Services (Accounting, Legal)", irs: "Legal and Professional Services" },
  { ui: "Office & Admin Stuff", irs: "Office Expenses" },
  { ui: "Rented Gear or Spaces", irs: "Rent or Lease" },
  { ui: "Fixing or Cleaning Gear", irs: "Repairs and Maintenance" },
  { ui: "Event Supplies", irs: "Supplies" },
  { ui: "Travel (Out-of-Town Gigs)", irs: "Travel" },
  { ui: "Work Meals", irs: "Meals" },
  { ui: "Phone/Wi-Fi (Work Portion)", irs: "Utilities" },
  { ui: "Other Work Stuff", irs: "Other Expenses" },
];

const formSchema = insertExpenseSchema.extend({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
});

interface AddExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  linkedGigId?: number; // Auto-filled when coming from "Got Paid" flow
  gigName?: string; // Display name for the linked gig
}

export function AddExpenseForm({ isOpen, onClose, linkedGigId, gigName }: AddExpenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Get user's gigs for the dropdown (manual entry only)
  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
    enabled: isOpen && !linkedGigId, // Only fetch if manual entry
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: "",
      vendor: "",
      description: "",
      categoryUi: "",
      irsCategory: "",
      linkedGigId: linkedGigId,
      receiptNote: "",
      isReimbursed: false,
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      const response = await apiRequest("POST", `/api/expenses`, {
        ...data,
        amount: parseFloat(data.amount).toString(), // Convert back to string for decimal field
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Expense Added",
        description: "Your business expense has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add expense. Please try again.",
        variant: "destructive",
      });
      console.error("Error creating expense:", error);
    },
  });

  const handleCategoryChange = (categoryUi: string) => {
    setSelectedCategory(categoryUi);
    const category = EXPENSE_CATEGORIES.find(cat => cat.ui === categoryUi);
    if (category) {
      form.setValue("categoryUi", category.ui);
      form.setValue("irsCategory", category.irs);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createExpenseMutation.mutate({
      ...data,
      userId: 0, // Will be set by the backend from session
    });
  };

  const isLoading = createExpenseMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Add Business Expense
          </DialogTitle>
          {linkedGigId && gigName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Linked to: {gigName}
            </p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Date Field */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>When did you make this purchase?</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount Field */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How much did it cost?</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vendor Field */}
            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Who'd you pay?</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Delta Airlines" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What was it for, business-wise?</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the business purpose..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category Dropdown */}
            <FormField
              control={form.control}
              name="categoryUi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Category</FormLabel>
                  <Select onValueChange={handleCategoryChange} value={selectedCategory}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category.ui} value={category.ui}>
                          {category.ui}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Gig Link Dropdown (Manual Entry Only) */}
            {!linkedGigId && (
              <FormField
                control={form.control}
                name="linkedGigId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Gig (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a gig (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No gig link</SelectItem>
                        {gigs.map((gig) => (
                          <SelectItem key={gig.id} value={gig.id.toString()}>
                            {gig.eventName} - {gig.clientName} ({gig.date})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Receipt Note Field */}
            <FormField
              control={form.control}
              name="receiptNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notes about the receipt or documentation..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reimbursed Checkbox */}
            <FormField
              control={form.control}
              name="isReimbursed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Did you get reimbursed for this?</FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Adding..." : "Add Expense"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}