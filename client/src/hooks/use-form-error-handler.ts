import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

// Centralized error handling for forms with consistent messaging
export function useFormErrorHandler() {
  const { toast } = useToast();

  const handleError = useCallback((error: unknown, context: string) => {
    console.error(`${context} error:`, error);
    
    let errorMessage = `Failed to ${context.toLowerCase()}. Please try again.`;
    
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage = "Please log in again to continue.";
      } else if (error.message.includes('400') || error.message.includes('validation')) {
        errorMessage = "Please check your input and try again.";
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        errorMessage = "Network error - please check your connection.";
      } else if (error.message.includes('500')) {
        errorMessage = "Server error - please try again in a moment.";
      }
    }

    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    });
  }, [toast]);

  const handleSuccess = useCallback((message: string) => {
    toast({
      title: "Success",
      description: message,
    });
  }, [toast]);

  return { handleError, handleSuccess };
}

// Common error recovery patterns
export const ERROR_RECOVERY_ACTIONS = {
  retry: "Please try again",
  refresh: "Try refreshing the page",
  login: "Please log in again",
  network: "Check your internet connection",
  validation: "Please check your input",
} as const;

export type ErrorRecoveryAction = keyof typeof ERROR_RECOVERY_ACTIONS;

export function getRecoveryMessage(action: ErrorRecoveryAction): string {
  return ERROR_RECOVERY_ACTIONS[action];
}