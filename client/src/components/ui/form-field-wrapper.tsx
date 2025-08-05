import React from "react";
import { Control, FieldPath, FieldValues, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { BUSINESS_EXPENSE_CATEGORIES, FREQUENTLY_USED_CATEGORIES, getCategorySuggestions } from "@shared/schema";
import { CalendarIcon, DollarSign, Store, FileText, Briefcase } from "lucide-react";

// Mobile-optimized form field wrapper with consistent touch sizing
interface FormFieldWrapperProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  type: "text" | "number" | "date" | "textarea" | "select";
  icon?: React.ReactNode;
  step?: string;
  options?: readonly string[];
  className?: string;
}

export function FormFieldWrapper<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type,
  icon,
  step,
  options = BUSINESS_EXPENSE_CATEGORIES,
  className = "",
}: FormFieldWrapperProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="flex items-center gap-2 text-base font-medium">
            {icon}
            {label}
          </FormLabel>
          <FormControl>
            {type === "textarea" ? (
              <Textarea
                {...field}
                value={field.value || ""}
                placeholder={placeholder}
                rows={3}
                className="min-h-[80px] text-base leading-relaxed resize-none touch-manipulation"
              />
            ) : type === "select" ? (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger className="h-12 text-base touch-manipulation">
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {options.map((option) => (
                    <SelectItem 
                      key={option} 
                      value={option}
                      className="h-12 text-base touch-manipulation cursor-pointer"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : type === "date" ? (
              <DateInput
                value={field.value || ""}
                onChange={field.onChange}
                placeholder={placeholder}
              />
            ) : (
              <Input
                {...field}
                value={field.value || ""}
                type={type}
                step={step}
                placeholder={placeholder}
                className="h-12 text-base touch-manipulation"
              />
            )}
          </FormControl>
          <FormMessage className="text-sm" />
        </FormItem>
      )}
    />
  );
}

// Predefined form field components for common expense fields
export function AmountField<T extends FieldValues>({ control }: { control: Control<T> }) {
  return (
    <FormFieldWrapper
      control={control}
      name={"amount" as FieldPath<T>}
      label="How much did it cost?"
      type="number"
      step="0.01"
      placeholder="0.00"
      icon={<DollarSign className="h-4 w-4" />}
    />
  );
}

export function MerchantField<T extends FieldValues>({ control }: { control: Control<T> }) {
  return (
    <FormFieldWrapper
      control={control}
      name={"merchant" as FieldPath<T>}
      label="Who'd you pay? (optional)"
      type="text"
      placeholder="Store, vendor, or merchant name (leave blank if unknown)"
      icon={<Store className="h-4 w-4" />}
    />
  );
}

export function BusinessPurposeField<T extends FieldValues>({ control }: { control: Control<T> }) {
  return (
    <FormFieldWrapper
      control={control}
      name={"businessPurpose" as FieldPath<T>}
      label="What was it for, business-wise?"
      type="textarea"
      placeholder="Tell us how this helped you do your job (e.g. 'Hotel for 2-day shoot,' 'Gear rental for event,' 'Client dinner before wedding')"
      icon={<FileText className="h-4 w-4" />}
    />
  );
}

export function CategoryField<T extends FieldValues>({ control }: { control: Control<T> }) {
  return (
    <SmartCategoryField control={control} name={"category" as FieldPath<T>} />
  );
}

// Smart category field with suggestions to reduce decision fatigue
export function SmartCategoryField<T extends FieldValues>({ control, name }: { control: Control<T>; name: FieldPath<T> }) {
  const watchedValues = useWatch({ control });
  const merchant = watchedValues?.merchant || "";
  const purpose = watchedValues?.businessPurpose || "";
  
  // Get smart suggestions based on merchant and purpose
  const suggestions = getCategorySuggestions(merchant, purpose);
  const frequentlyUsed = Array.from(FREQUENTLY_USED_CATEGORIES);
  
  // Combine suggestions: smart matches first, then frequently used, then all others
  const allCategories = Array.from(BUSINESS_EXPENSE_CATEGORIES);
  const smartSuggestions = suggestions.length > 0 ? suggestions : frequentlyUsed;
  const otherCategories = allCategories.filter(cat => !smartSuggestions.includes(cat));
  
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Business Category *
            {suggestions.length > 0 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Smart suggestions
              </span>
            )}
          </FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger className="h-12 text-base touch-manipulation">
                <SelectValue placeholder="Select business category for taxes" />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="max-h-[400px] overflow-y-auto" sideOffset={4} align="start">
              {/* Smart suggestions or frequently used categories */}
              {smartSuggestions.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                    {suggestions.length > 0 ? "Suggested for you" : "Frequently used"}
                  </div>
                  {smartSuggestions.map((category) => (
                    <SelectItem 
                      key={category} 
                      value={category}
                      className="h-12 text-base touch-manipulation cursor-pointer bg-blue-50 hover:bg-blue-100 focus:bg-blue-100 data-[highlighted]:bg-blue-100"
                    >
                      ⭐ {category}
                    </SelectItem>
                  ))}
                  <div className="border-t my-1" />
                </>
              )}
              
              {/* All other categories */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                All categories
              </div>
              {otherCategories.map((category) => (
                <SelectItem 
                  key={category} 
                  value={category}
                  className="h-12 text-base touch-manipulation cursor-pointer hover:bg-gray-50 focus:bg-gray-50 data-[highlighted]:bg-gray-50"
                >
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField<T extends FieldValues>({ control, label }: { control: Control<T>; label?: string }) {
  return (
    <FormFieldWrapper
      control={control}
      name={"date" as FieldPath<T>}
      label={label || "When did you make this purchase?"}
      type="date"
      icon={<CalendarIcon className="h-4 w-4" />}
    />
  );
}