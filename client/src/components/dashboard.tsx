import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Edit2, Save, X, DollarSign, Calendar, Users, TrendingUp, Receipt, Calculator, PiggyBank, FileText, Download, Eye } from "lucide-react";
import type { Gig, User } from "@shared/schema";

type TimePeriod = "monthly" | "annual";

// Utility function to parse dates consistently across timezones
const parseGigDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingGoal, setEditingGoal] = useState<"monthly" | "annual" | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [showProjectedBreakdown, setShowProjectedBreakdown] = useState(false);
  const [mobilePdfReady, setMobilePdfReady] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [showTipsBreakdown, setShowTipsBreakdown] = useState(false);
  const [showExpensesBreakdown, setShowExpensesBreakdown] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Fetch gigs for calculations
  const { data: gigs = [], isLoading: gigsLoading } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
    retry: 1,
  });

  // Fetch period-specific goal
  const { data: currentGoal, refetch: refetchGoal } = useQuery<{ goalAmount: string; id: number }>({
    queryKey: ["/api/goals/period", selectedPeriod, currentDate.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/goals/period?period=${selectedPeriod}&date=${currentDate.toISOString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    },
    retry: 1,
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (goalData: { goalAmount: string }) => {
      const response = await apiRequest("POST", `/api/goals/period/${selectedPeriod}/${currentDate.toISOString()}`, goalData);
      return response.json();
    },
    onSuccess: () => {
      refetchGoal();
      toast({
        title: "Success",
        description: "Goal updated successfully!",
      });
      setEditingGoal(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update goal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Simple period filtering - let calculations handle multi-day logic naturally
  const currentPeriodGigs = useMemo(() => {
    if (!gigs || gigs.length === 0) return [];
    
    return gigs.filter(gig => {
      const gigDate = new Date(gig.date + 'T00:00:00.000Z');
      const currentUtcDate = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000);
      
      if (isNaN(gigDate.getTime())) return false;
      
      if (selectedPeriod === "monthly") {
        return gigDate.getUTCMonth() === currentUtcDate.getUTCMonth() && 
               gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
      } else {
        return gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
      }
    });
  }, [gigs, selectedPeriod, currentDate]);

  // Safe numeric parsing function
  const safeParseFloat = (value: string | null | undefined): number => {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
  };

  // Helper function to group multi-day gigs (prevents double-counting)
  const getGroupedGigs = (gigs: Gig[]): (Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string })[] => {
    if (!gigs || gigs.length === 0) return [];

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
        });
      } else {
        // Single day gig
        grouped.push(currentGig);
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
    
    // Calculate earnings from grouped gigs (no double-counting)
    const actualEarnings = completedGroupedGigs.reduce((sum, gig) => {
      return sum + safeParseFloat(gig.actualPay) + safeParseFloat(gig.tips);
    }, 0);
    
    const totalTips = completedGroupedGigs.reduce((sum, gig) => {
      return sum + safeParseFloat(gig.tips);
    }, 0);
    
    // For expenses, use original gigs since each day has separate expenses
    const totalExpenses = currentPeriodGigs.reduce((sum, gig) => {
      const parkingExpense = safeParseFloat(gig.parkingExpense);
      const otherExpenses = safeParseFloat(gig.otherExpenses);
      const mileageDeduction = (gig.mileage || 0) * 0.67;
      return sum + parkingExpense + otherExpenses + mileageDeduction;
    }, 0);
    
    const projectedEarnings = groupedGigs.reduce((sum, gig) => {
      if (gig.status === "completed") {
        return sum + safeParseFloat(gig.actualPay) + safeParseFloat(gig.tips);
      } else {
        return sum + safeParseFloat(gig.expectedPay);
      }
    }, 0);

    // Use user's default tax rate (23%), but allow per-gig overrides (including 0% for under-the-table)
    const userTaxRate = user?.defaultTaxPercentage || 23;
    
    // Calculate tax estimate using grouped gigs to prevent double-counting
    const estimatedTax = completedGroupedGigs.reduce((sum, gig) => {
      const income = safeParseFloat(gig.actualPay) + safeParseFloat(gig.tips);
      // For multi-day gigs, we need to aggregate expenses from all related days
      let totalExpenses = 0;
      if (gig.isMultiDay) {
        // Find all gigs in the multi-day sequence for accurate expense calculation
        const relatedGigs = currentPeriodGigs.filter(originalGig => 
          originalGig.eventName === gig.eventName &&
          originalGig.clientName === gig.clientName &&
          originalGig.gigType === gig.gigType
        );
        totalExpenses = relatedGigs.reduce((expSum, relatedGig) => {
          return expSum + safeParseFloat(relatedGig.parkingExpense) + 
                 safeParseFloat(relatedGig.otherExpenses) + 
                 ((relatedGig.mileage || 0) * 0.67);
        }, 0);
      } else {
        totalExpenses = safeParseFloat(gig.parkingExpense) + safeParseFloat(gig.otherExpenses) + ((gig.mileage || 0) * 0.67);
      }
      const taxableIncome = Math.max(0, income - totalExpenses);
      const gigTaxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) ? gig.taxPercentage : userTaxRate;
      return sum + (taxableIncome * gigTaxRate / 100);
    }, 0);

    return {
      actualEarnings: Math.round(actualEarnings * 100) / 100,
      projectedEarnings: Math.round(projectedEarnings * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      estimatedTax: Math.round(estimatedTax * 100) / 100,
      completedGigs: completedGroupedGigs.length,
      upcomingGigs: upcomingGroupedGigs.length,
      totalGigs: groupedGigs.length
    };
  }, [currentPeriodGigs, user]);

  // Get period display text
  const getPeriodText = () => {
    switch (selectedPeriod) {
      case "monthly":
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
  const startEditingGoal = (period: "monthly" | "annual") => {
    setEditingGoal(period);
    setGoalAmount(currentGoal?.goalAmount || "");
  };

  const handleSaveGoal = () => {
    if (!goalAmount.trim()) return;
    updateGoalMutation.mutate({ goalAmount: goalAmount.trim() });
  };



  const handleDownloadProfessionalPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      console.log('Starting Professional PDF download...');
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const params = new URLSearchParams({
        period: selectedPeriod,
        year: year.toString(),
        professional: 'true'
      });
      
      if (selectedPeriod === 'monthly') {
        params.append('month', month.toString());
      }
      
      console.log('Requesting Professional PDF with params:', params.toString());
      
      // Enhanced mobile detection for universal compatibility
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent) ||
                       (typeof window.orientation !== 'undefined') ||
                       (window.innerWidth <= 768);
      
      if (isMobile) {
        // Mobile device - use professional HTML report
        console.log('Mobile device detected, using professional HTML report');
        const pdfUrl = `/api/reports/pdf?${params.toString()}`;
        
        // Test the URL first
        const testResponse = await fetch(pdfUrl, { 
          method: 'HEAD', 
          credentials: 'include' 
        });
        
        if (!testResponse.ok) {
          throw new Error(`Failed to generate professional report: ${testResponse.status} ${testResponse.statusText}`);
        }
        
        // Open professional report in new tab/window
        try {
          const newWindow = window.open(pdfUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            // Popup blocked - fallback
            window.location.href = pdfUrl;
          }
        } catch (e) {
          console.log('Professional PDF open failed, using fallback');
          window.location.href = pdfUrl;
        }
        
        toast({
          title: `${selectedPeriod === 'monthly' ? 'Monthly' : 'Annual'} Income Report Opened`,
          description: "Your comprehensive income report has been opened in a new tab.",
          duration: 5000,
        });
        
      } else {
        // Desktop - use PDF endpoint (when available) or fallback to HTML
        console.log('Desktop device, attempting professional PDF download');
        
        // For now, use HTML version until PDF endpoint is created
        const pdfUrl = `/api/reports/pdf?${params.toString()}`;
        window.open(pdfUrl, '_blank');
        
        toast({
          title: `${selectedPeriod === 'monthly' ? 'Monthly' : 'Annual'} Income Report Opened`,
          description: "Your comprehensive income report has been opened in a new tab.",
        });
      }
      
    } catch (error) {
      console.error('Professional PDF error:', error);
      
      let errorMessage = "Failed to generate professional report. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = "Please log in again to access the professional report.";
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
    const completedGigs = currentPeriodGigs.filter(gig => gig.status === "completed");
    const groupedGigs = getGroupedGigs(completedGigs);
    
    return groupedGigs
      .map(gig => {
        const actualPay = safeParseFloat(gig.actualPay);
        const tips = safeParseFloat(gig.tips);
        const totalAmount = actualPay + tips;
        return {
          ...gig,
          amount: totalAmount,
          actualPay,
          tips
        };
      })
      .filter(gig => gig.amount > 0)
      .sort((a, b) => parseGigDate(b.startDate || b.date).getTime() - parseGigDate(a.startDate || a.date).getTime());
  };

  const getProjectedEarningsBreakdown = () => {
    const groupedGigs = getGroupedGigs(currentPeriodGigs);
    
    // Calculate amount and filter/sort
    return groupedGigs
      .map(gig => {
        let amount = 0;
        if (gig.status === "completed") {
          const actualPay = safeParseFloat(gig.actualPay);
          const tips = safeParseFloat(gig.tips);
          amount = actualPay + tips;
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
    return currentPeriodGigs
      .filter(gig => gig.status === "completed")
      .map(gig => {
        const actualPay = safeParseFloat(gig.actualPay);
        const tips = safeParseFloat(gig.tips);
        const income = actualPay + tips;
        const parkingExpense = safeParseFloat(gig.parkingExpense);
        const otherExpenses = safeParseFloat(gig.otherExpenses);
        const mileageDeduction = (gig.mileage || 0) * 0.67;
        const totalExpenses = parkingExpense + otherExpenses + mileageDeduction;
        const taxableIncome = Math.max(0, income - totalExpenses);
        const taxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) ? gig.taxPercentage : (user?.defaultTaxPercentage || 23);
        const estimatedTax = (taxableIncome * taxRate) / 100;
        
        return {
          ...gig,
          amount: estimatedTax,
          taxableIncome,
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
    return currentPeriodGigs
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

  if (gigsLoading) {
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

  return (
    <div className="p-4">
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
      <div className="flex justify-end mb-4 gap-2 flex-wrap">
        <Button
          variant="default"
          size="sm"
          onClick={handleDownloadProfessionalPDF}
          disabled={isGeneratingPDF}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <FileText className="w-4 h-4" />
          {selectedPeriod === 'monthly' ? 'Monthly Income Report' : 'Annual Income Report'}
        </Button>
        
        {/* Mobile PDF View Button - only show if PDF is ready and on mobile */}
        {mobilePdfReady && (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent) || 
                           (typeof window.orientation !== 'undefined') || 
                           (window.innerWidth <= 768)) && (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              const pdfUrl = sessionStorage.getItem('pdfUrl');
              if (pdfUrl) {
                // Try multiple approaches for maximum compatibility
                try {
                  // Method 1: Try window.open first
                  const newWindow = window.open(pdfUrl, '_blank');
                  
                  // Method 2: If popup blocked, create a temporary link
                  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    console.log('Popup blocked, using link method');
                    const link = document.createElement('a');
                    link.href = pdfUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                } catch (error) {
                  // Method 3: Fallback to same-tab navigation
                  console.log('All methods failed, using location.href');
                  window.location.href = pdfUrl;
                }
              }
            }}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Eye className="w-4 h-4" />
            {selectedPeriod === 'monthly' ? 'View Monthly Report' : 'View Annual Report'}
          </Button>
        )}
      </div>

      {/* Main Earnings Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Actual Earnings */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowEarningsBreakdown(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actual Earnings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${periodStats.actualEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  From {periodStats.completedGigs} completed gigs
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
                <p className="text-sm font-medium text-gray-600">Projected Earnings</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${periodStats.projectedEarnings.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  From {periodStats.totalGigs} total gigs
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Tax Estimate */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowTaxBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <Calculator className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-600 mb-1">Tax Estimate</p>
              <p className="text-lg font-bold text-red-600">
                ${periodStats.estimatedTax.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tips Earned */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowTipsBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <PiggyBank className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-600 mb-1">Tips Earned</p>
              <p className="text-lg font-bold text-purple-600">
                ${periodStats.totalTips.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Breakdown */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowExpensesBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <Receipt className="w-6 h-6 text-orange-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-600 mb-1">Expenses</p>
              <p className="text-lg font-bold text-orange-600">
                ${periodStats.totalExpenses.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Section */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {selectedPeriod === "monthly" ? "Monthly" : "Annual"} Goal
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
                  Taxable: ${gig.taxableIncome.toFixed(2)} × {gig.taxRate}%
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
                      {parseGigDate(gig.date).toLocaleDateString()}
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
    </div>
  );
}