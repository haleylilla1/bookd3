import { z } from "zod";
import { insertExpenseSchema, insertGigSchema } from "@shared/schema";

// Centralized form validation schemas to eliminate duplication

// Common validation helpers
const requiredString = (message: string) => z.string().min(1, message);
const optionalString = () => z.string().optional();
const positiveNumber = (message: string) => z.string().min(1, "Amount is required").refine(
  (val) => !isNaN(Number(val)) && Number(val) >= 0,
  message
);

// Expense form schemas - shared between add and edit
export const baseExpenseSchema = z.object({
  date: requiredString("Date is required"),
  amount: positiveNumber("Amount must be a valid number (0 or greater)"),
  merchant: optionalString(),
  businessPurpose: requiredString("Business purpose is required"),
  category: requiredString("Category is required"),
  gigId: z.number().optional(),
});

export const addExpenseSchema = baseExpenseSchema;
export const editExpenseSchema = baseExpenseSchema;

export type ExpenseFormData = z.infer<typeof baseExpenseSchema>;

// Gig form schemas - simplified for planning
export const gigFormSchema = z.object({
  gigType: requiredString("Gig type is required"),
  eventName: requiredString("Event name is required"),
  clientName: requiredString("Client name is required"),
  startDate: requiredString("Start date is required"),
  endDate: optionalString(),
  expectedPay: requiredString("Expected pay is required"),
  status: z.enum(["upcoming", "pending payment", "completed"]).default("upcoming"),
  duties: optionalString(),
  notes: optionalString(),
});

export type GigFormData = z.infer<typeof gigFormSchema>;

// Date utility functions for consistent date handling
export const getTodayISO = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const formatDateForAPI = (dateStr: string): string => {
  if (!dateStr) return getTodayISO();
  
  // Ensure YYYY-MM-DD format for API consistency
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toISOString().split('T')[0];
  } catch {
    return getTodayISO();
  }
};

// Common form field configurations for consistent UX
export const FORM_FIELD_CONFIGS = {
  merchant: {
    label: "Who'd you pay? (optional)",
    placeholder: "Store, vendor, or merchant name (leave blank if unknown)",
    type: "text" as const,
  },
  amount: {
    label: "How much did it cost?",
    placeholder: "0.00",
    type: "number" as const,
    step: "0.01",
  },
  businessPurpose: {
    label: "What was it for, business-wise?",
    placeholder: "Tell us how this helped you do your job (e.g. 'Hotel for 2-day shoot,' 'Gear rental for event')",
    type: "textarea" as const,
  },
  category: {
    label: "Business Category *",
    placeholder: "Select business category for taxes",
    type: "select" as const,
  },
  date: {
    label: "When did you make this purchase?",
    placeholder: "Select date",
    type: "date" as const,
  },
} as const;