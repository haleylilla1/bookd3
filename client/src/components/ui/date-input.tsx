import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Cross-browser compatible date input with fallback
export function DateInput({ value, onChange, placeholder, className, disabled }: DateInputProps) {
  const [inputType, setInputType] = useState<"date" | "text">("date");
  const [displayValue, setDisplayValue] = useState(value || "");

  // Test date input support on mount
  useEffect(() => {
    const testInput = document.createElement("input");
    testInput.type = "date";
    
    // Check if browser supports date input properly
    const supportsDateInput = testInput.type === "date" && 
      testInput.valueAsDate !== undefined;
    
    setInputType(supportsDateInput ? "date" : "text");
  }, []);

  // Format date for display in text mode
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    
    try {
      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) return dateStr;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Parse text input back to YYYY-MM-DD format
  const parseTextToDate = (text: string): string => {
    if (!text) return "";
    
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    
    try {
      const date = new Date(text);
      if (isNaN(date.getTime())) return text;
      
      return date.toISOString().split('T')[0];
    } catch {
      return text;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    if (inputType === "date") {
      setDisplayValue(newValue);
      onChange?.(newValue);
    } else {
      setDisplayValue(newValue);
      const parsedDate = parseTextToDate(newValue);
      onChange?.(parsedDate);
    }
  };

  const openNativePicker = () => {
    // For mobile devices, try to trigger native date picker
    const input = document.createElement("input");
    input.type = "date";
    input.value = value || "";
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    
    input.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      onChange?.(target.value);
      setDisplayValue(target.value);
      document.body.removeChild(input);
    });
    
    input.focus();
    input.click();
  };

  useEffect(() => {
    if (inputType === "text" && value) {
      setDisplayValue(formatDateForDisplay(value));
    } else {
      setDisplayValue(value || "");
    }
  }, [value, inputType]);

  return (
    <div className="relative">
      <Input
        type={inputType}
        value={displayValue}
        onChange={handleChange}
        placeholder={inputType === "date" ? undefined : (placeholder || "MM/DD/YYYY")}
        className={cn("h-12 text-base touch-manipulation pr-12", className)}
        disabled={disabled}
        style={inputType === "date" ? { colorScheme: 'light dark' } : undefined}
      />
      
      {/* Calendar button for text mode or as backup */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10 p-0 hover:bg-gray-100"
        onClick={inputType === "text" ? openNativePicker : undefined}
        disabled={disabled}
      >
        <CalendarIcon className="h-4 w-4 text-gray-400" />
      </Button>
    </div>
  );
}

// Helper function to get today's date in YYYY-MM-DD format
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper function to format date for display
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  
  try {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}