import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  let d: Date;
  
  if (typeof date === 'string') {
    // Handle date strings (YYYY-MM-DD) to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    d = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    d = new Date(date);
  }
  
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function calculateTaxEstimate(amount: number, percentage: number): number {
  return (amount * percentage) / 100;
}
