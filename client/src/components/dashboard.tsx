import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { editExpenseSchema, type ExpenseFormData } from "@/lib/form-schemas";
import { useFormErrorHandler } from "@/hooks/use-form-error-handler";
import { ChevronLeft, ChevronRight, Edit2, Save, X, DollarSign, Calendar, Users, TrendingUp, Receipt, Calculator, PiggyBank, FileText, Download, Trash2 } from "lucide-react";
import { AmountField, MerchantField, BusinessPurposeField, CategoryField, DateField } from "@/components/ui/form-field-wrapper";
import { useToast } from "@/hooks/use-toast";
import type { Gig, User, Expense } from "@shared/schema";
import { BUSINESS_EXPENSE_CATEGORIES } from "@shared/schema";

type TimePeriod = "monthly" | "quarterly" | "annual";

type ExpenseEditFormData = ExpenseFormData;

// Utility function to parse dates consistently across timezones
const parseGigDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

// IRS 2025 Quarterly Tax Dates (Income Earned Periods)
const getQuarterDateRange = (year: number, quarter: number) => {
  const quarterRanges = {
    1: { start: new Date(year, 0, 1), end: new Date(year, 2, 31) }, // Jan 1 - Mar 31
    2: { start: new Date(year, 3, 1), end: new Date(year, 4, 31) }, // Apr 1 - May 31
    3: { start: new Date(year, 5, 1), end: new Date(year, 7, 31) }, // Jun 1 - Aug 31
    4: { start: new Date(year, 8, 1), end: new Date(year, 11, 31) } // Sep 1 - Dec 31
  };
  return quarterRanges[quarter as keyof typeof quarterRanges];
};

const getCurrentQuarter = (date: Date): number => {
  const month = date.getMonth() + 1; // Convert to 1-12
  if (month >= 1 && month <= 3) return 1; // Jan-Mar
  if (month >= 4 && month <= 5) return 2; // Apr-May
  if (month >= 6 && month <= 8) return 3; // Jun-Aug
  return 4; // Sep-Dec
};

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingGoal, setEditingGoal] = useState<"monthly" | "quarterly" | "annual" | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [showProjectedBreakdown, setShowProjectedBreakdown] = useState(false);

  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [showTipsBreakdown, setShowTipsBreakdown] = useState(false);
  const [showExpensesBreakdown, setShowExpensesBreakdown] = useState(false);
  const [showNewExpensesBreakdown, setShowNewExpensesBreakdown] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const hasUpdatedStatusesRef = useRef(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingGigExpense, setEditingGigExpense] = useState<any | null>(null);
  
  const { handleError, handleSuccess } = useFormErrorHandler();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ["/api/user"],
    retry: 1,
  });

  // Debug user authentication
  useEffect(() => {
    console.log('User auth state:', { 
      user: user?.email || 'null', 
      userLoading, 
      userError 
    });
  }, [user, userLoading, userError]);

  // Mutation to automatically update gig statuses
  const updateGigStatusesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/gigs/update-statuses");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.updatedCount > 0) {
        console.log(`${data.updatedCount} gigs updated to pending payment`);
        // Refetch gigs to show updated statuses
        queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      }
    },
    onError: (error) => {
      console.error("Failed to update gig statuses:", error);
    },
  });

  // Fetch gigs for calculations (lightweight version for dashboard performance)
  const { data: gigsResponse, isLoading: gigsLoading, error: gigsError } = useQuery<{ gigs: Gig[], total: number }>({
    queryKey: ["/api/gigs", { lightweight: true }],
    queryFn: () => fetch('/api/gigs?lightweight=true&limit=1000').then(res => res.json()),
    retry: 1,
  });

  const gigs = gigsResponse?.gigs || [];

  // Fetch expenses for dashboard
  const { data: expensesResponse, isLoading: expensesLoading } = useQuery<{ expenses: Expense[], total: number }>({
    queryKey: ["/api/expenses"],
    queryFn: () => fetch('/api/expenses?limit=1000').then(res => res.json()),
    retry: 1,
  });

  const expenses = expensesResponse?.expenses || [];



  // Automatically update gig statuses when dashboard loads (once per session)
  useEffect(() => {
    if (gigs.length > 0 && !hasUpdatedStatusesRef.current) {
      hasUpdatedStatusesRef.current = true;
      updateGigStatusesMutation.mutate();
    }
  }, [gigs.length]); // Only run when gigs are initially loaded

  // Fetch period-specific goal
  const { data: currentGoal, refetch: refetchGoal } = useQuery<{ goalAmount: string; id: number } | null>({
    queryKey: ["/api/goals/period", selectedPeriod, currentDate.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/goals/period?period=${selectedPeriod}&date=${currentDate.toISOString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('🎯 Goal query response:', { 
        period: selectedPeriod, 
        date: currentDate.toISOString(), 
        response: data,
        hasGoals: Array.isArray(data) ? data.length : 'not array'
      });
      
      // Backend returns an array, get the first goal if exists
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return null;
    },
    retry: 1,
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (goalData: { amount: string }) => {
      const response = await apiRequest("POST", `/api/goals/period/${selectedPeriod}/${currentDate.toISOString()}`, goalData);
      return response;
    },
    onSuccess: () => {
      // Invalidate cache to force refetch
      queryClient.invalidateQueries({ queryKey: ["/api/goals/period", selectedPeriod, currentDate.toISOString()] });
      handleSuccess("Goal updated successfully!");
      setEditingGoal(null);
    },
    onError: (error) => {
      handleError(error, "update goal");
    },
  });

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async (expenseData: { id: number; data: Partial<Expense> }) => {
      const response = await apiRequest("PUT", `/api/expenses/${expenseData.id}`, expenseData.data);
      return response.json();
    },
    onSuccess: () => {
      handleSuccess("Expense updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditingExpense(null);
    },
    onError: (error) => {
      handleError(error, "update expense");
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      await apiRequest("DELETE", `/api/expenses/${expenseId}`);
    },
    onSuccess: () => {
      handleSuccess("Expense deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      handleError(error, "delete expense");
    },
  });

  // Clear gig expenses function
  const clearGigExpenses = async (gigId: number) => {
    try {
      const response = await apiRequest("PUT", `/api/gigs/${gigId}`, {
        parkingExpense: "0.00",
        parkingDescription: null,
        parkingReimbursed: false,
        otherExpenses: "0.00",
        otherExpenseDescription: null,
        otherExpensesReimbursed: false,
        mileage: 0
      });
      
      handleSuccess("Gig expenses cleared successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch (error) {
      handleError(error, "clear gig expenses");
    }
  };

  // Update gig expenses mutation
  const updateGigExpensesMutation = useMutation({
    mutationFn: async (gigData: { id: number; data: any }) => {
      return await apiRequest("PUT", `/api/gigs/${gigData.id}`, gigData.data);
    },
    onSuccess: () => {
      handleSuccess("Gig expenses updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditingGigExpense(null);
    },
    onError: (error) => {
      handleError(error, "update gig expenses");
    },
  });

  // Safe numeric parsing function
  const safeParseFloat = (value: string | null | undefined): number => {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
  };

  // Simple period filtering - let calculations handle multi-day logic naturally
  const currentPeriodGigs = useMemo(() => {
    if (!gigs || !Array.isArray(gigs) || gigs.length === 0) return [];
    
    return gigs.filter(gig => {
      const gigDate = parseGigDate(gig.date);
      const currentUtcDate = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000);
      
      if (isNaN(gigDate.getTime())) return false;
      
      if (selectedPeriod === "monthly") {
        return gigDate.getUTCMonth() === currentUtcDate.getUTCMonth() && 
               gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
      } else if (selectedPeriod === "quarterly") {
        const quarter = getCurrentQuarter(currentUtcDate);
        const quarterRange = getQuarterDateRange(currentUtcDate.getUTCFullYear(), quarter);
        return gigDate >= quarterRange.start && gigDate <= quarterRange.end;
      } else {
        return gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
      }
    });
  }, [gigs, selectedPeriod, currentDate]);

  // Filter expenses for current period
  const currentPeriodExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return [];
    
    let startDate: Date, endDate: Date;
    
    if (selectedPeriod === "monthly") {
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    } else if (selectedPeriod === "quarterly") {
      const quarter = getCurrentQuarter(currentDate);
      const quarterRange = getQuarterDateRange(currentDate.getFullYear(), quarter);
      startDate = quarterRange.start;
      endDate = quarterRange.end;
    } else {
      startDate = new Date(currentDate.getFullYear(), 0, 1);
      endDate = new Date(currentDate.getFullYear(), 11, 31);
    }

    const filtered = expenses.filter(expense => {
      const expenseDate = new Date(expense.date + 'T00:00:00');
      return expenseDate >= startDate && expenseDate <= endDate;
    });
    

    
    return filtered;
  }, [expenses, selectedPeriod, currentDate]);

  // Helper function to group multi-day gigs (prevents double-counting)
  const getGroupedGigs = (gigs: Gig[]): (Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string })[] => {
    if (!gigs || !Array.isArray(gigs) || gigs.length === 0) return [];

    const sortedGigs = [...gigs].sort((a, b) => parseGigDate(a.date).getTime() - parseGigDate(b.date).getTime());
    const grouped: (Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string })[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < sortedGigs.length; i++) {
      if (processed.has(sortedGigs[i].id)) continue;
      
      const currentGig = sortedGigs[i];
      const similarGigs = [currentGig];
      processed.add(currentGig.id);
      
      // Look for consecutive similar gigs
      for (let j = i + 1; j < sortedGigs.length; j++) {
        const nextGig = sortedGigs[j];
        if (processed.has(nextGig.id)) continue;
        
        const lastGigDate = parseGigDate(similarGigs[similarGigs.length - 1].date);
        const nextDate = parseGigDate(nextGig.date);
        const dayDiff = (nextDate.getTime() - lastGigDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (nextGig.eventName === currentGig.eventName &&
            nextGig.clientName === currentGig.clientName &&
            nextGig.gigType === currentGig.gigType &&
            dayDiff > 0 && dayDiff <= 7) {
          similarGigs.push(nextGig);
          processed.add(nextGig.id);
        }
      }
      
      // Create consolidated gig entry
      if (similarGigs.length > 1) {
        // Multi-day gig - Use only first entry's amount (don't sum duplicates)
        grouped.push({
          ...similarGigs[0], // Use first entry data
          isMultiDay: true,
          startDate: similarGigs[0].date,
          endDate: similarGigs[similarGigs.length - 1].date
        } as Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string });
      } else {
        // Single day gig
        grouped.push({
          ...currentGig,
          isMultiDay: false,
          startDate: currentGig.date,
          endDate: currentGig.date
        } as Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string });
      }
    }
    
    return grouped;
  };

  // Calculate earnings with proper multi-day grouping to prevent double-counting
  const periodStats = useMemo(() => {
    if (!currentPeriodGigs.length) {
      return {
        actualEarnings: 0,
        projectedEarnings: 0,
        totalTips: 0,
        totalExpenses: 0,
        estimatedTax: 0,
        completedGigs: 0,
        upcomingGigs: 0,
        totalGigs: 0
      };
    }

    // Use grouped gigs to prevent double-counting multi-day events
    const groupedGigs = getGroupedGigs(currentPeriodGigs);
    const completedGroupedGigs = groupedGigs.filter(gig => gig.status === "completed");
    const upcomingGroupedGigs = groupedGigs.filter(gig => gig.status !== "completed");
    
    // Tax-smart earnings calculation
    let actualEarnings = 0;
    let totalReceived = 0;
    let businessDeductions = 0;
    
    completedGroupedGigs.forEach(gig => {
      const tips = safeParseFloat(gig.tips);
      
      if (gig.totalReceived && parseFloat(gig.totalReceived) > 0) {
        // New "Got Paid" workflow - use tax-smart calculation
        const received = safeParseFloat(gig.totalReceived);
        const reimbursedParking = safeParseFloat(gig.reimbursedParking);
        const reimbursedOther = safeParseFloat(gig.reimbursedOther);
        const unreimbursedParking = safeParseFloat(gig.unreimbursedParking);
        const unreimbursedOther = safeParseFloat(gig.unreimbursedOther);
        
        totalReceived += received + tips;
        businessDeductions += unreimbursedParking + unreimbursedOther;
        actualEarnings += (received - reimbursedParking - reimbursedOther) + tips; // Taxable income
      } else {
        // Legacy calculation
        const payAmount = gig.actualPay ? safeParseFloat(gig.actualPay) : safeParseFloat(gig.expectedPay);
        totalReceived += payAmount + tips;
        actualEarnings += payAmount + tips;
      }
    });
    
    const totalTips = completedGroupedGigs.reduce((sum, gig) => {
      return sum + safeParseFloat(gig.tips);
    }, 0);
    
    // Calculate expenses from both gigs and standalone expense entries
    const gigExpenses = groupedGigs.reduce((sum, gig) => {
      const parkingExpense = safeParseFloat(gig.parkingExpense);
      const otherExpenses = safeParseFloat(gig.otherExpenses);
      const mileageDeduction = (gig.mileage || 0) * 0.67;
      return sum + parkingExpense + otherExpenses + mileageDeduction;
    }, 0);
    
    const standaloneExpenses = currentPeriodExpenses.reduce((sum, expense) => {
      return sum + safeParseFloat(expense.amount);
    }, 0);
    
    const totalExpenses = gigExpenses + standaloneExpenses;
    

    
    const projectedEarnings = groupedGigs.reduce((sum, gig) => {
      if (gig.status === "completed") {
        const payAmount = gig.actualPay ? safeParseFloat(gig.actualPay) : safeParseFloat(gig.expectedPay);
        return sum + payAmount + safeParseFloat(gig.tips);
      } else {
        // For upcoming/pending gigs, use expected pay (this should show the expected amount, not $0)
        return sum + safeParseFloat(gig.expectedPay) + safeParseFloat(gig.tips);
      }
    }, 0);

    // Use user's default tax rate (23%), but allow per-gig overrides (including 0% for under-the-table)
    const userTaxRate = user?.defaultTaxPercentage || 23;
    
    // Tax-smart tax calculation (only on taxable income)
    const estimatedTax = completedGroupedGigs.reduce((sum, gig) => {
      let taxableIncome = 0;
      
      if (gig.totalReceived && parseFloat(gig.totalReceived) > 0) {
        // New calculation: total received minus reimbursements
        const received = safeParseFloat(gig.totalReceived);
        const reimbursedParking = safeParseFloat(gig.reimbursedParking);
        const reimbursedOther = safeParseFloat(gig.reimbursedOther);
        taxableIncome = received - reimbursedParking - reimbursedOther;
      } else {
        // Legacy calculation
        taxableIncome = gig.actualPay ? safeParseFloat(gig.actualPay) : safeParseFloat(gig.expectedPay);
      }
      
      // Add tips (always taxable)
      taxableIncome += safeParseFloat(gig.tips);
      
      const gigTaxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) ? gig.taxPercentage : userTaxRate;
      return sum + (taxableIncome * gigTaxRate / 100);
    }, 0);

    return {
      actualEarnings: Math.round(actualEarnings * 100) / 100, // Taxable income
      projectedEarnings: Math.round(projectedEarnings * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      estimatedTax: Math.round(estimatedTax * 100) / 100,
      completedGigs: completedGroupedGigs.length,
      upcomingGigs: upcomingGroupedGigs.length,
      totalGigs: groupedGigs.length,
      // New tax-smart fields
      totalReceived: Math.round(totalReceived * 100) / 100,
      businessDeductions: Math.round(businessDeductions * 100) / 100
    };
  }, [currentPeriodGigs, user]);

  // Get period display text
  const getPeriodText = () => {
    switch (selectedPeriod) {
      case "monthly":
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case "quarterly":
        const quarter = getCurrentQuarter(currentDate);
        return `Q${quarter} ${currentDate.getFullYear()}`;
      case "annual":
        return currentDate.getFullYear().toString();
      default:
        return "";
    }
  };

  // Navigate periods
  const navigatePeriod = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    
    if (selectedPeriod === "monthly") {
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
    } else if (selectedPeriod === "quarterly") {
      const currentQuarter = getCurrentQuarter(currentDate);
      let targetQuarter: number;
      
      if (direction === "prev") {
        targetQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
      } else {
        targetQuarter = currentQuarter === 4 ? 1 : currentQuarter + 1;
      }
      
      // Set date to first month of target quarter
      if (targetQuarter === 1) {
        newDate.setMonth(0); // January
        if (direction === "prev" && currentQuarter === 1) {
          newDate.setFullYear(newDate.getFullYear() - 1);
        } else if (direction === "next" && currentQuarter === 4) {
          newDate.setFullYear(newDate.getFullYear() + 1);
        }
      } else if (targetQuarter === 2) {
        newDate.setMonth(3); // April
      } else if (targetQuarter === 3) {
        newDate.setMonth(5); // June
      } else { // targetQuarter === 4
        newDate.setMonth(8); // September
      }
    } else if (selectedPeriod === "annual") {
      if (direction === "prev") {
        newDate.setFullYear(newDate.getFullYear() - 1);
      } else {
        newDate.setFullYear(newDate.getFullYear() + 1);
      }
    }
    
    setCurrentDate(newDate);
  };

  // Goal management functions
  const startEditingGoal = (period: "monthly" | "quarterly" | "annual") => {
    setEditingGoal(period);
    setGoalAmount(currentGoal?.goalAmount || "");
  };

  const handleSaveGoal = () => {
    if (!goalAmount.trim()) return;
    updateGoalMutation.mutate({ amount: goalAmount.trim() });
  };



  const handleViewIncomeReport = async () => {
    try {
      setIsGeneratingPDF(true);
      console.log('Opening HTML income report...');
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const params = new URLSearchParams({
        period: selectedPeriod,
        year: year.toString()
      });
      
      if (selectedPeriod === 'monthly') {
        params.append('month', month.toString());
      } else if (selectedPeriod === 'quarterly') {
        const quarter = getCurrentQuarter(currentDate);
        params.append('quarter', quarter.toString());
      }
      
      console.log('Opening HTML report with params:', params.toString());
      
      // Open HTML report in new tab for maximum compatibility
      const reportUrl = `/api/reports/html?${params.toString()}`;
      window.open(reportUrl, '_blank');
      
      toast({
        title: `${selectedPeriod === 'monthly' ? 'Monthly' : 
               selectedPeriod === 'quarterly' ? 'Quarterly' : 'Annual'} Income Report Opened`,
        description: "Your comprehensive income report has been opened in a new tab.",
        duration: 3000,
      });
      
    } catch (error) {
      console.error('HTML report error:', error);
      
      let errorMessage = "Failed to generate income report. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = "Please log in again to access the income report.";
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = "Network error - please check your connection.";
        }
      }
      
      toast({
        title: "Report Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Get breakdown data for modals with safe parsing
  const getActualEarningsBreakdown = () => {
    if (!Array.isArray(currentPeriodGigs)) return [];
    const completedGigs = currentPeriodGigs.filter(gig => gig.status === "completed");
    const groupedGigs = getGroupedGigs(completedGigs);
    

    
    return groupedGigs
      .map(gig => {
        const payAmount = gig.actualPay ? safeParseFloat(gig.actualPay) : safeParseFloat(gig.expectedPay);
        const tips = safeParseFloat(gig.tips);
        const totalAmount = payAmount + tips;
        return {
          ...gig,
          amount: totalAmount,
          actualPay: payAmount,
          tips
        };
      })
      .filter(gig => gig.amount > 0)
      .sort((a, b) => parseGigDate(b.startDate || b.date).getTime() - parseGigDate(a.startDate || a.date).getTime());
  };

  const getProjectedEarningsBreakdown = () => {
    if (!Array.isArray(currentPeriodGigs)) return [];
    const groupedGigs = getGroupedGigs(currentPeriodGigs);
    
    // Calculate amount and filter/sort
    return groupedGigs
      .map(gig => {
        let amount = 0;
        if (gig.status === "completed") {
          const payAmount = gig.actualPay ? safeParseFloat(gig.actualPay) : safeParseFloat(gig.expectedPay);
          const tips = safeParseFloat(gig.tips);
          amount = payAmount + tips;
        } else {
          amount = safeParseFloat(gig.expectedPay);
        }
        return {
          ...gig,
          amount
        };
      })
      .filter(gig => gig.amount > 0)
      .sort((a, b) => parseGigDate(b.startDate || b.date).getTime() - parseGigDate(a.startDate || a.date).getTime());
  };

  const getTaxBreakdown = () => {
    if (!Array.isArray(currentPeriodGigs)) return [];
    const completedGigs = currentPeriodGigs.filter(gig => gig.status === "completed");
    const groupedGigs = getGroupedGigs(completedGigs);
    
    return groupedGigs.map(gig => {
      const income = safeParseFloat(gig.actualPay) + safeParseFloat(gig.tips);
      const taxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) 
        ? gig.taxPercentage 
        : (user?.defaultTaxPercentage || 23);
      const estimatedTax = income * (taxRate / 100);
      
      return {
        ...gig,
        amount: estimatedTax,
        taxableIncome: income,
        taxRate
      };
    })
    .filter(gig => gig.amount > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getTipsBreakdown = () => {
    return currentPeriodGigs
      .filter(gig => gig.status === "completed" && safeParseFloat(gig.tips) > 0)
      .map(gig => {
        const tips = safeParseFloat(gig.tips);
        return {
          ...gig,
          amount: tips
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getExpensesBreakdown = () => {
    // EXPENSE FIX: Use grouped gigs to prevent showing expenses multiple times for multi-day events
    const groupedGigs = getGroupedGigs(currentPeriodGigs);
    
    return groupedGigs
      .map(gig => {
        const parkingExpense = safeParseFloat(gig.parkingExpense);
        const otherExpenses = safeParseFloat(gig.otherExpenses);
        const mileageDeduction = (gig.mileage || 0) * 0.67;
        const totalExpenses = parkingExpense + otherExpenses + mileageDeduction;
        
        return {
          ...gig,
          amount: totalExpenses,
          parkingExpense,
          otherExpenses,
          mileageDeduction
        };
      })
      .filter(gig => gig.amount > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getNewExpensesBreakdown = () => {
    return currentPeriodExpenses
      .map(expense => ({
        ...expense,
        amount: safeParseFloat(expense.amount),
        date: expense.date
      }))
      .filter(expense => expense.amount > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (gigsLoading || expensesLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show message when no gigs are found
  if (!gigsLoading && !gigs?.length && user) {
    return (
      <div className="p-4 text-center space-y-4">
        <h2 className="text-xl font-semibold text-gray-600">Welcome to Bookd!</h2>
        <p className="text-gray-500">You haven't added any gigs yet. Start tracking your work by adding your first gig!</p>
        <Button 
          onClick={() => window.location.href = '/'}
          variant="default"
        >
          Add Your First Gig
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-0 w-full space-y-6">
      {/* Time Period Selector */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
        <Button 
          variant={selectedPeriod === "monthly" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => setSelectedPeriod("monthly")}
        >
          Monthly
        </Button>
        <Button 
          variant={selectedPeriod === "quarterly" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => setSelectedPeriod("quarterly")}
        >
          Quarterly
        </Button>
        <Button 
          variant={selectedPeriod === "annual" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => setSelectedPeriod("annual")}
        >
          Annual
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6 bg-gray-50 p-3 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigatePeriod("prev")}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="text-center">
          <div className="font-semibold text-lg text-gray-900">{getPeriodText()}</div>
          {selectedPeriod === "quarterly" && (
            <div className="text-xs text-gray-500 mb-1">
              {(() => {
                const quarter = getCurrentQuarter(currentDate);
                const quarterRanges = {
                  1: "Jan 1 - Mar 31 (Due Apr 15)",
                  2: "Apr 1 - May 31 (Due Jun 15)", 
                  3: "Jun 1 - Aug 31 (Due Sep 15)",
                  4: "Sep 1 - Dec 31 (Due Jan 15)"
                };
                return quarterRanges[quarter as keyof typeof quarterRanges];
              })()}
            </div>
          )}
          <div className="text-sm text-gray-600">
            {periodStats.totalGigs} total gigs • {periodStats.completedGigs} completed
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigatePeriod("next")}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Export Options */}
      <div className="mb-4">
        <div className="text-center mb-3">
          <p className="text-sm text-gray-600">
            Generate a comprehensive income report with earnings, expenses, and tax details
          </p>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={handleViewIncomeReport}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <FileText className="w-4 h-4" />
            {selectedPeriod === 'monthly' ? 'View Monthly Report' : 
             selectedPeriod === 'quarterly' ? 'View Quarterly Report' : 'View Annual Report'}
          </Button>

        </div>
      </div>

      {/* Interactive Cards Note */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 text-center">
          💡 Tap on each card below to see detailed breakdowns
        </p>
      </div>

      {/* Main Earnings Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Actual Earnings */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowEarningsBreakdown(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxable Income</p>
                <p className="text-2xl font-bold text-green-600">
                  ${periodStats.actualEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  After reimbursements • {periodStats.completedGigs} completed gigs
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        {/* Projected Earnings */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowProjectedBreakdown(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expected Earnings</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${periodStats.projectedEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  From {periodStats.totalGigs} total gigs (includes upcoming)
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Additional Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Tax Estimate */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowTaxBreakdown(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tax Estimate</p>
                <p className="text-2xl font-bold text-red-600">
                  ${periodStats.estimatedTax.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  From {periodStats.completedGigs} completed gigs
                </p>
              </div>
              <Calculator className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        {/* Tips Earned */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowTipsBreakdown(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tips Earned</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${periodStats.totalTips.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Cash and card tips
                </p>
              </div>
              <PiggyBank className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        {/* Expenses Breakdown */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowNewExpensesBreakdown(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expenses</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${periodStats.totalExpenses.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {currentPeriodExpenses.length} standalone + gig expenses
                </p>
              </div>
              <Receipt className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {selectedPeriod === "monthly" ? "Monthly" : 
               selectedPeriod === "quarterly" ? "Quarterly" : "Annual"} Goal
            </h3>
            {!editingGoal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditingGoal(selectedPeriod)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Goal
              </Button>
            )}
          </div>

          {editingGoal === selectedPeriod ? (
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter goal amount"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveGoal} disabled={updateGoalMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditingGoal(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div>
              {currentGoal?.goalAmount ? (
                <>
                  <div className="text-2xl font-bold mb-2">
                    ${parseFloat(currentGoal.goalAmount).toFixed(2)}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (periodStats.actualEarnings / parseFloat(currentGoal.goalAmount)) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {((periodStats.actualEarnings / parseFloat(currentGoal.goalAmount)) * 100).toFixed(1)}% achieved
                  </p>
                </>
              ) : (
                <p className="text-gray-500">No goal set for this period</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earnings Breakdown Modal */}
      <Dialog open={showEarningsBreakdown} onOpenChange={setShowEarningsBreakdown}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Actual Earnings Breakdown</DialogTitle>
            <DialogDescription>
              View detailed breakdown of completed gigs and their actual earnings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getActualEarningsBreakdown().map((gig, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{gig.eventName || "Unnamed Gig"}</p>
                    <p className="text-sm text-gray-600">{gig.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">${gig.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {gig.isMultiDay 
                        ? `${parseGigDate(gig.startDate!).toLocaleDateString()} - ${parseGigDate(gig.endDate!).toLocaleDateString()}`
                        : parseGigDate(gig.date).toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {gig.gigType}
                </Badge>
              </div>
            ))}
            {getActualEarningsBreakdown().length === 0 && (
              <p className="text-center text-gray-500 py-4">No completed gigs yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Projected Earnings Breakdown Modal */}
      <Dialog open={showProjectedBreakdown} onOpenChange={setShowProjectedBreakdown}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Projected Earnings Breakdown</DialogTitle>
            <DialogDescription>
              View detailed breakdown of all gigs including completed and upcoming.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getProjectedEarningsBreakdown().map((gig, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{gig.eventName || "Unnamed Gig"}</p>
                    <p className="text-sm text-gray-600">{gig.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${gig.status === "completed" ? "text-green-600" : "text-blue-600"}`}>
                      ${gig.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {gig.isMultiDay 
                        ? `${parseGigDate(gig.startDate!).toLocaleDateString()} - ${parseGigDate(gig.endDate!).toLocaleDateString()}`
                        : parseGigDate(gig.date).toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="text-xs">
                    {gig.gigType}
                  </Badge>
                  <Badge 
                    variant={gig.status === "completed" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {gig.status}
                  </Badge>
                </div>
              </div>
            ))}
            {getProjectedEarningsBreakdown().length === 0 && (
              <p className="text-center text-gray-500 py-4">No gigs found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tax Estimate Breakdown Modal */}
      <Dialog open={showTaxBreakdown} onOpenChange={setShowTaxBreakdown}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tax Estimate Breakdown</DialogTitle>
            <DialogDescription>
              View detailed tax calculations for each gig based on income and tax rates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getTaxBreakdown().map((gig, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{gig.eventName || "Unnamed Gig"}</p>
                    <p className="text-sm text-gray-600">{gig.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">${gig.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {parseGigDate(gig.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  Gross Income: ${gig.taxableIncome.toFixed(2)} × {gig.taxRate}%
                </div>
                <Badge variant="secondary" className="text-xs">
                  {gig.gigType}
                </Badge>
              </div>
            ))}
            {getTaxBreakdown().length === 0 && (
              <p className="text-center text-gray-500 py-4">No tax estimates available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tips Breakdown Modal */}
      <Dialog open={showTipsBreakdown} onOpenChange={setShowTipsBreakdown}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tips Earned Breakdown</DialogTitle>
            <DialogDescription>
              View detailed breakdown of tips earned from completed gigs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getTipsBreakdown().map((gig, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{gig.eventName || "Unnamed Gig"}</p>
                    <p className="text-sm text-gray-600">{gig.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-purple-600">${gig.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {parseGigDate(gig.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {gig.gigType}
                </Badge>
              </div>
            ))}
            {getTipsBreakdown().length === 0 && (
              <p className="text-center text-gray-500 py-4">No tips earned yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expenses Breakdown Modal */}
      <Dialog open={showExpensesBreakdown} onOpenChange={setShowExpensesBreakdown}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expenses Breakdown</DialogTitle>
            <DialogDescription>
              View detailed breakdown of expenses including parking, other costs, and mileage deductions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getExpensesBreakdown().map((gig, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{gig.eventName || "Unnamed Gig"}</p>
                    <p className="text-sm text-gray-600">{gig.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">${gig.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {gig.isMultiDay 
                        ? `${parseGigDate(gig.startDate!).toLocaleDateString()} - ${parseGigDate(gig.endDate!).toLocaleDateString()}`
                        : parseGigDate(gig.date).toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-2 space-y-1">
                  {gig.parkingExpense > 0 && <div>Parking: ${gig.parkingExpense.toFixed(2)}</div>}
                  {gig.otherExpenses > 0 && <div>Other: ${gig.otherExpenses.toFixed(2)}</div>}
                  {gig.mileageDeduction > 0 && <div>Mileage: ${gig.mileageDeduction.toFixed(2)} ({gig.mileage} mi)</div>}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {gig.gigType}
                </Badge>
              </div>
            ))}
            {getExpensesBreakdown().length === 0 && (
              <p className="text-center text-gray-500 py-4">No expenses recorded</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Standalone Expenses Breakdown Modal */}
      <Dialog open={showNewExpensesBreakdown} onOpenChange={setShowNewExpensesBreakdown}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Expenses Breakdown</DialogTitle>
            <DialogDescription>
              View all expenses including standalone expenses and gig-related costs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Standalone Expenses Section */}
            {getNewExpensesBreakdown().length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Standalone Expenses</h4>
                <div className="space-y-3">
                  {getNewExpensesBreakdown().map((expense, index) => (
                    <div key={`expense-${expense.id}`} className="border rounded-lg p-3 bg-blue-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{expense.merchant}</p>
                          <p className="text-sm text-gray-600">{expense.businessPurpose}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-blue-600">${typeof expense.amount === 'string' ? parseFloat(expense.amount).toFixed(2) : expense.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(expense.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingExpense({
                              ...expense,
                              amount: typeof expense.amount === 'number' ? expense.amount.toString() : expense.amount
                            })}
                            disabled={updateExpenseMutation.isPending}
                            className="h-8 w-8"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteExpenseMutation.mutate(expense.id)}
                            disabled={deleteExpenseMutation.isPending}
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="text-xs">
                          Standalone Expense
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                          {expense.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gig-Related Expenses Section */}
            {getExpensesBreakdown().length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Gig-Related Expenses</h4>
                <div className="space-y-3">
                  {getExpensesBreakdown().map((gig, index) => (
                    <div key={`gig-${gig.id}`} className="border rounded-lg p-3 bg-orange-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{gig.eventName || "Unnamed Gig"}</p>
                          <p className="text-sm text-gray-600">{gig.clientName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-600">${gig.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            {gig.isMultiDay 
                              ? `${parseGigDate(gig.startDate!).toLocaleDateString()} - ${parseGigDate(gig.endDate!).toLocaleDateString()}`
                              : parseGigDate(gig.date).toLocaleDateString()
                            }
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingGigExpense(gig)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="w-4 h-4 text-orange-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => clearGigExpenses(gig.id)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2 space-y-1">
                        {gig.parkingExpense > 0 && <div>Parking: ${gig.parkingExpense.toFixed(2)}</div>}
                        {gig.otherExpenses > 0 && <div>Other: ${gig.otherExpenses.toFixed(2)}</div>}
                        {gig.mileageDeduction > 0 && <div>Mileage: ${gig.mileageDeduction.toFixed(2)} ({gig.mileage} mi)</div>}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {gig.gigType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No expenses found */}
            {getNewExpensesBreakdown().length === 0 && getExpensesBreakdown().length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No expenses found</p>
                <p className="text-sm">Add expenses to track your business costs</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense details and category information.
            </DialogDescription>
          </DialogHeader>
          {editingExpense && (
            <ExpenseEditForm 
              expense={editingExpense}
              onSave={(data) => updateExpenseMutation.mutate({ id: editingExpense.id, data })}
              onCancel={() => setEditingExpense(null)}
              isLoading={updateExpenseMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Gig Expenses Dialog */}
      <Dialog open={!!editingGigExpense} onOpenChange={() => setEditingGigExpense(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Gig Expenses</DialogTitle>
            <DialogDescription>
              Update parking, other expenses, and mileage for {editingGigExpense?.eventName}.
            </DialogDescription>
          </DialogHeader>
          {editingGigExpense && (
            <GigExpenseEditForm 
              gig={editingGigExpense}
              onSave={(data) => updateGigExpensesMutation.mutate({ id: editingGigExpense.id, data })}
              onCancel={() => setEditingGigExpense(null)}
              isLoading={updateGigExpensesMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Expense Edit Form Component
function ExpenseEditForm({ 
  expense, 
  onSave, 
  onCancel, 
  isLoading 
}: {
  expense: Expense;
  onSave: (data: ExpenseEditFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  console.log("🔍 Expense data for edit form:", expense);
  
  const form = useForm<ExpenseEditFormData>({
    resolver: zodResolver(editExpenseSchema),
    defaultValues: {
      date: expense.date,
      amount: typeof expense.amount === 'string' ? expense.amount : expense.amount?.toString() || "",
      merchant: expense.merchant || "",
      businessPurpose: expense.businessPurpose || "",
      category: expense.category,
    },
  });

  const onSubmit = (data: ExpenseEditFormData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Mobile-optimized form fields using reusable components */}
        <DateField control={form.control} />
        <AmountField control={form.control} />
        <MerchantField control={form.control} />
        <BusinessPurposeField control={form.control} />
        <CategoryField control={form.control} />

        <div className="flex gap-3 pt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            className="flex-1 h-12 text-base font-medium touch-manipulation"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="flex-1 h-12 text-base font-medium touch-manipulation"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Gig Expense Edit Form Component
function GigExpenseEditForm({ 
  gig, 
  onSave, 
  onCancel, 
  isLoading 
}: {
  gig: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  console.log("🔍 Gig data for edit form:", gig);
  
  const form = useForm({
    defaultValues: {
      parkingExpense: typeof gig.parkingExpense === 'string' ? gig.parkingExpense : (gig.parkingExpense || 0).toString(),
      parkingDescription: gig.parkingDescription || "",
      parkingReimbursed: Boolean(gig.parkingReimbursed),
      otherExpenses: typeof gig.otherExpenses === 'string' ? gig.otherExpenses : (gig.otherExpenses || 0).toString(),
      otherExpenseDescription: gig.otherExpenseDescription || "",
      otherExpensesReimbursed: Boolean(gig.otherExpensesReimbursed),
      mileage: gig.mileage || 0,
    },
  });

  const onSubmit = (data: any) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Parking Expense */}
        <FormField
          control={form.control}
          name="parkingExpense"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parking Expense</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="text-base h-12 touch-manipulation"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Parking Description */}
        <FormField
          control={form.control}
          name="parkingDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parking Description</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="e.g., Downtown parking garage"
                  className="text-base h-12 touch-manipulation"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Parking Reimbursed */}
        <FormField
          control={form.control}
          name="parkingReimbursed"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Parking Reimbursed</FormLabel>
                <FormDescription>
                  Was this parking expense reimbursed by the client?
                </FormDescription>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Other Expenses */}
        <FormField
          control={form.control}
          name="otherExpenses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Expenses</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="text-base h-12 touch-manipulation"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Other Expense Description */}
        <FormField
          control={form.control}
          name="otherExpenseDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Expense Description</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="e.g., Equipment rental, supplies"
                  className="text-base h-12 touch-manipulation"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Other Expenses Reimbursed */}
        <FormField
          control={form.control}
          name="otherExpensesReimbursed"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Other Expenses Reimbursed</FormLabel>
                <FormDescription>
                  Were these other expenses reimbursed by the client?
                </FormDescription>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Mileage */}
        <FormField
          control={form.control}
          name="mileage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mileage (Miles)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="text-base h-12 touch-manipulation"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Round-trip mileage for tax deduction (${(0.67 * (field.value || 0)).toFixed(2)} deduction)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            className="flex-1 h-12 text-base font-medium touch-manipulation"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="flex-1 h-12 text-base font-medium touch-manipulation"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}