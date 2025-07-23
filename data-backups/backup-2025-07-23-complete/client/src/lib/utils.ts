import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "$0";
  }
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return "";
  
  let d: Date;
  
  if (typeof date === 'string') {
    // Handle date strings (YYYY-MM-DD) to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return "";
    d = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function calculateTaxEstimate(amount: number, percentage: number): number {
  return (amount * percentage) / 100;
}
