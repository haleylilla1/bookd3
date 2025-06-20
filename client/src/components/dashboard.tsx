import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, Car, Download, TrendingUp, Edit2, Target, ChevronLeft, ChevronRight, Banknote, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User, Gig } from "@shared/schema";
import { 
  getWeekDates, 
  getMonthDates, 
  getYearDates,
  formatWeekRange,
  formatMonth,
  formatYear,
  addWeeks,
  addMonths,
  addYears
} from "@/lib/dateUtils";

type TimePeriod = "weekly" | "monthly" | "annual";

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingGoal, setEditingGoal] = useState<"weekly" | "monthly" | "annual" | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [showTipsBreakdown, setShowTipsBreakdown] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Fetch period-specific goal
  const { data: currentGoal, refetch: refetchGoal } = useQuery<{ goalAmount: string; id: number }>({
    queryKey: ["/api/goals/period", selectedPeriod, currentDate.toISOString()],
    retry: 1,
  });

  // Fetch gigs for calculations
  const { data: gigs = [], isLoading: gigsLoading } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
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



  // Memoize expensive calculations
  const currentPeriodGigs = useMemo(() => {
    if (!gigs || gigs.length === 0) return [];
    
    return gigs.filter(gig => {
      const gigDate = new Date(gig.date);
      
      switch (selectedPeriod) {
        case "weekly":
          const { startOfWeek, endOfWeek } = getWeekDates(currentDate);
          return gigDate >= startOfWeek && gigDate <= endOfWeek;
        case "monthly":
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
        case "annual":
          return gigDate.getFullYear() === currentDate.getFullYear();
        default:
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
      }
    });
  }, [gigs, selectedPeriod, currentDate]);

  // Calculate tax breakdown per gig for current period
  const getTaxBreakdownData = () => {
    if (!currentPeriodGigs || currentPeriodGigs.length === 0) return [];
    
    return currentPeriodGigs
      .filter((gig: any) => gig.status === "completed" && gig.actualPay)
      .map((gig: any) => {
        const pay = parseFloat(gig.actualPay || "0");
        const taxPercentage = gig.taxPercentage || user?.defaultTaxPercentage || 23;
        const taxAmount = pay * (taxPercentage / 100);
        
        return {
          gigName: gig.eventName || "Unnamed Gig",
          gigType: gig.gigType,
          clientName: gig.clientName,
          actualPay: pay,
          taxPercentage,
          taxAmount,
          date: gig.date
        };
      })
      .filter((item: any) => item.taxAmount > 0)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculate expense breakdown per gig
  const getExpenseBreakdownData = () => {
    if (!currentPeriodGigs || currentPeriodGigs.length === 0) return [];
    
    return currentPeriodGigs
      .filter((gig: any) => gig.status === "completed")
      .map((gig: any) => {
        const mileage = parseInt(String(gig.mileage || "0"));
        const parking = parseFloat(String(gig.parkingExpense || "0"));
        const other = parseFloat(String(gig.otherExpenses || "0"));
        const mileageExpense = mileage * 0.655; // 2024 IRS standard mileage rate
        const totalExpenses = mileageExpense + parking + other;
        
        return {
          gigName: gig.eventName || "Unnamed Gig",
          gigType: gig.gigType,
          clientName: gig.clientName,
          date: gig.date,
          mileage,
          mileageExpense,
          parking,
          other,
          totalExpenses
        };
      })
      .filter(item => item.totalExpenses > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculate client statistics for dashboard (period-specific for monthly/weekly, all-time for annual)
  const getClientData = () => {
    if (!gigs) return [];
    
    // Determine which gigs to include based on period
    let gigsToProcess = gigs as any[];
    
    if (selectedPeriod === "weekly") {
      const { startOfWeek, endOfWeek } = getWeekDates(currentDate);
      gigsToProcess = gigsToProcess.filter(gig => {
        const gigDate = new Date(gig.date);
        return gigDate >= startOfWeek && gigDate <= endOfWeek;
      });
    } else if (selectedPeriod === "monthly") {
      gigsToProcess = gigsToProcess.filter(gig => {
        const gigDate = new Date(gig.date);
        return gigDate.getMonth() === currentDate.getMonth() && 
               gigDate.getFullYear() === currentDate.getFullYear();
      });
    } else if (selectedPeriod === "annual") {
      gigsToProcess = gigsToProcess.filter(gig => {
        const gigDate = new Date(gig.date);
        return gigDate.getFullYear() === currentDate.getFullYear();
      });
    }
    
    // Group by client and calculate totals
    const clientStats = new Map<string, { gigs: any[], total: number, gigCount: number, completedGigs: number }>();
    
    gigsToProcess
      .filter(gig => gig.clientName && gig.clientName.trim() !== "")
      .forEach(gig => {
        const clientName = gig.clientName;
        const earnings = gig.status === "completed" ? parseFloat(gig.actualPay || "0") : 0;
        
        if (!clientStats.has(clientName)) {
          clientStats.set(clientName, { gigs: [], total: 0, gigCount: 0, completedGigs: 0 });
        }
        
        const client = clientStats.get(clientName)!;
        client.gigs.push(gig);
        client.total += earnings;
        client.gigCount++;
        if (gig.status === "completed") {
          client.completedGigs++;
        }
      });
    
    // Convert to array and sort by total earnings, then by gig count
    return Array.from(clientStats.entries())
      .map(([name, data]) => ({
        name,
        gigs: data.gigs,
        total: data.total,
        gigCount: data.gigCount,
        completedGigs: data.completedGigs
      }))
      .sort((a, b) => {
        // Sort by total earnings first, then by total gig count
        if (b.total !== a.total) return b.total - a.total;
        return b.gigCount - a.gigCount;
      });
  };

  // Get all clients ever worked with (for modal view)
  const getAllClientsData = () => {
    if (!gigs) return [];
    
    // Group by client and calculate totals from ALL gigs
    const clientStats = new Map<string, { gigs: any[], total: number, gigCount: number, completedGigs: number }>();
    
    (gigs as any[])
      .filter(gig => gig.clientName && gig.clientName.trim() !== "")
      .forEach(gig => {
        const clientName = gig.clientName;
        const earnings = gig.status === "completed" ? parseFloat(gig.actualPay || "0") : 0;
        
        if (!clientStats.has(clientName)) {
          clientStats.set(clientName, { gigs: [], total: 0, gigCount: 0, completedGigs: 0 });
        }
        
        const client = clientStats.get(clientName)!;
        client.gigs.push(gig);
        client.total += earnings;
        client.gigCount++;
        if (gig.status === "completed") {
          client.completedGigs++;
        }
      });
    
    // Convert to array and sort by total earnings, then by gig count
    return Array.from(clientStats.entries())
      .map(([name, data]) => ({
        name,
        gigs: data.gigs,
        total: data.total,
        gigCount: data.gigCount,
        completedGigs: data.completedGigs
      }))
      .sort((a, b) => {
        // Sort by total earnings first, then by total gig count
        if (b.total !== a.total) return b.total - a.total;
        return b.gigCount - a.gigCount;
      });
  };

  // Get gigs for a specific client
  const getClientGigs = (clientName: string) => {
    const clientData = getClientData();
    const client = clientData.find(c => c.name === clientName);
    return client ? client.gigs : [];
  };

  // Calculate tips breakdown per gig for current period
  const getTipsBreakdownData = () => {
    if (!gigs) return [];
    
    // Filter gigs to current period first
    const currentPeriodGigs = (gigs as any[]).filter(gig => {
      const gigDate = new Date(gig.date);
      
      switch (selectedPeriod) {
        case "weekly":
          const { startOfWeek, endOfWeek } = getWeekDates(currentDate);
          return gigDate >= startOfWeek && gigDate <= endOfWeek;
        case "monthly":
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
        case "annual":
          return gigDate.getFullYear() === currentDate.getFullYear();
        default:
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
      }
    });
    
    return currentPeriodGigs
      .filter(gig => gig.status === "completed" && gig.tips)
      .map(gig => {
        const tips = parseFloat(gig.tips || "0");
        
        return {
          gigName: gig.eventName || "Unnamed Gig",
          gigType: gig.gigType,
          clientName: gig.clientName,
          date: gig.date,
          tips
        };
      })
      .filter(item => item.tips > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculate earnings based on selected period
  const getEarningsForPeriod = () => {
    if (!gigs) return { earnings: 0, gigs: 0, avgPerGig: 0, period: "" };
    
    // Filter gigs to current period
    const currentPeriodGigs = (gigs as any[]).filter(gig => {
      const gigDate = new Date(gig.date);
      
      switch (selectedPeriod) {
        case "weekly":
          const { startOfWeek, endOfWeek } = getWeekDates(currentDate);
          return gigDate >= startOfWeek && gigDate <= endOfWeek;
        case "monthly":
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
        case "annual":
          return gigDate.getFullYear() === currentDate.getFullYear();
        default:
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
      }
    });
    
    // Calculate actual earnings from completed gigs only
    const completedGigs = currentPeriodGigs.filter(gig => gig.status === "completed");
    const totalEarnings = completedGigs.reduce((sum, gig) => sum + parseFloat(gig.actualPay || "0"), 0);
    const avgPerGig = completedGigs.length > 0 ? totalEarnings / completedGigs.length : 0;
    
    switch (selectedPeriod) {
      case "weekly":
        return {
          earnings: totalEarnings,
          gigs: completedGigs.length,
          avgPerGig: avgPerGig,
          period: "This Week"
        };
      case "annual":
        return {
          earnings: totalEarnings,
          gigs: completedGigs.length,
          avgPerGig: avgPerGig,
          period: "This Year"
        };
      default:
        return {
          earnings: totalEarnings,
          gigs: completedGigs.length,
          avgPerGig: avgPerGig,
          period: "This Month"
        };
    }
  };

  // Calculate projected earnings based on selected period (actual + expected, but NOT tips)
  const getProjectedEarningsForPeriod = () => {
    if (!gigs) return { projectedEarnings: 0, period: "" };
    
    // Filter gigs to current period
    const currentPeriodGigs = (gigs as any[]).filter(gig => {
      const gigDate = new Date(gig.date);
      
      switch (selectedPeriod) {
        case "weekly":
          const { startOfWeek, endOfWeek } = getWeekDates(currentDate);
          return gigDate >= startOfWeek && gigDate <= endOfWeek;
        case "monthly":
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
        case "annual":
          return gigDate.getFullYear() === currentDate.getFullYear();
        default:
          return gigDate.getMonth() === currentDate.getMonth() && 
                 gigDate.getFullYear() === currentDate.getFullYear();
      }
    });
    
    // Calculate actual earnings (completed gigs only, without tips)
    const actualEarnings = currentPeriodGigs
      .filter(gig => gig.status === "completed")
      .reduce((sum, gig) => sum + parseFloat(gig.actualPay || "0"), 0);
    
    const actualTips = currentPeriodGigs
      .filter(gig => gig.status === "completed")
      .reduce((sum, gig) => sum + parseFloat(gig.tips || "0"), 0);
    
    // Calculate expected earnings (upcoming/pending gigs)
    const expectedEarnings = currentPeriodGigs
      .filter(gig => gig.status === "upcoming" || gig.status === "pending" || gig.status === "confirmed")
      .reduce((sum, gig) => sum + parseFloat(gig.expectedPay || "0"), 0);
    
    const actualWithoutTips = actualEarnings - actualTips;
    const projectedTotal = actualWithoutTips + expectedEarnings;
    
    switch (selectedPeriod) {
      case "weekly":
        return {
          projectedEarnings: projectedTotal,
          period: "This Week"
        };
      case "annual":
        return {
          projectedEarnings: projectedTotal,
          period: "This Year"
        };
      default:
        return {
          projectedEarnings: projectedTotal,
          period: "This Month"
        };
    }
  };

  // Navigation functions
  const navigatePeriod = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      switch (selectedPeriod) {
        case "weekly":
          return direction === "prev" ? addWeeks(prev, -1) : addWeeks(prev, 1);
        case "monthly":
          return direction === "prev" ? addMonths(prev, -1) : addMonths(prev, 1);
        case "annual":
          return direction === "prev" ? addYears(prev, -1) : addYears(prev, 1);
        default:
          return prev;
      }
    });
  };

  const getCurrentPeriodLabel = () => {
    switch (selectedPeriod) {
      case "weekly":
        const { startOfWeek, endOfWeek } = getWeekDates(currentDate);
        return formatWeekRange(startOfWeek, endOfWeek);
      case "monthly":
        return formatMonth(currentDate);
      case "annual":
        return formatYear(currentDate);
      default:
        return "";
    }
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case "weekly":
        const { startOfWeek: currentWeekStart, endOfWeek: currentWeekEnd } = getWeekDates(now);
        const { startOfWeek: selectedWeekStart, endOfWeek: selectedWeekEnd } = getWeekDates(currentDate);
        return currentWeekStart.getTime() === selectedWeekStart.getTime();
      case "monthly":
        return now.getMonth() === currentDate.getMonth() && now.getFullYear() === currentDate.getFullYear();
      case "annual":
        return now.getFullYear() === currentDate.getFullYear();
      default:
        return true;
    }
  };

  const currentData = getEarningsForPeriod();
  const projectedData = getProjectedEarningsForPeriod();
  const goalTarget = parseFloat(currentGoal?.goalAmount || "0");
  const goalProgress = projectedData.projectedEarnings && goalTarget ? (projectedData.projectedEarnings / goalTarget) * 100 : 0;

  const handleEditGoal = (period: "weekly" | "monthly" | "annual") => {
    setEditingGoal(period);
    setGoalAmount(currentGoal?.goalAmount || "");
  };

  const handleSaveGoal = () => {
    if (!editingGoal) return;
    
    const amount = parseFloat(goalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid goal amount.",
        variant: "destructive",
      });
      return;
    }

    updateGoalMutation.mutate({ goalAmount });
  };

  const exportTaxData = () => {
    if (!gigs) return;

    const taxData = getTaxBreakdownData();
    
    if (taxData.length === 0) {
      toast({
        title: "No Tax Data",
        description: "No completed gigs found for the current period.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ['Date', 'Event Name', 'Client', 'Earnings', 'Tax Rate (%)', 'Tax Amount'];
    const csvContent = [
      headers.join(','),
      ...taxData.map(item => [
        item.date,
        `"${item.gigName}"`,
        `"${item.clientName}"`,
        item.actualPay.toFixed(2),
        item.taxPercentage,
        item.taxAmount.toFixed(2)
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-data-${getCurrentPeriodLabel().replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Tax Data Exported",
      description: `Downloaded ${taxData.length} tax records for ${getCurrentPeriodLabel()}`,
    });
  };

  const exportMonthlyReport = () => {
    if (!gigs) return;

    const currentData = getEarningsForPeriod();
    const projectedData = getProjectedEarningsForPeriod();
    const taxData = getTaxBreakdownData();
    const tipsData = getTipsBreakdownData();
    const expenseData = getExpenseBreakdownData();
    const clientData = getClientData();

    // Create comprehensive report content
    const reportContent = [
      `${getCurrentPeriodLabel()} Report`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'EARNINGS SUMMARY',
      `Actual Earnings: $${currentData.earnings.toFixed(2)}`,
      `Projected Earnings: $${projectedData.projectedEarnings.toFixed(2)}`,
      `Completed Gigs: ${currentData.gigs}`,
      `Average per Gig: $${currentData.avgPerGig.toFixed(2)}`,
      '',
      'TAX INFORMATION',
      `Total Tax Estimate: $${taxData.reduce((sum, item) => sum + item.taxAmount, 0).toFixed(2)}`,
      `Default Tax Rate: ${user?.defaultTaxPercentage || 23}%`,
      '',
      'TIPS & EXPENSES',
      `Total Tips: $${tipsData.reduce((sum, item) => sum + item.tips, 0).toFixed(2)}`,
      `Total Expenses: $${expenseData.reduce((sum, item) => sum + item.totalExpenses, 0).toFixed(2)}`,
      '',
      'TOP CLIENTS',
      ...clientData.slice(0, 5).map((client, index) => 
        `${index + 1}. ${client.name}: $${client.total.toFixed(2)} (${client.gigCount} gigs)`
      ),
      '',
      'GOAL PROGRESS',
      currentGoal ? 
        `Goal: $${parseFloat(currentGoal.goalAmount).toFixed(2)} | Progress: ${((projectedData.projectedEarnings / parseFloat(currentGoal.goalAmount)) * 100).toFixed(1)}%` :
        'No goal set for this period',
    ].join('\n');

    // Download file
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthly-report-${getCurrentPeriodLabel().replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Monthly Report Exported",
      description: `Downloaded comprehensive report for ${getCurrentPeriodLabel()}`,
    });
  };

  const exportMonthlyExcel = () => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    
    const link = document.createElement('a');
    link.href = `/api/reports/monthly/excel?month=${month}&year=${year}`;
    link.download = `monthly-report-${month}-${year}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Excel Report Downloaded",
      description: `Downloaded Excel report for ${getCurrentPeriodLabel()}`,
    });
  };

  const exportMonthlyPDF = () => {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    
    const link = document.createElement('a');
    link.href = `/api/reports/monthly/pdf?month=${month}&year=${year}`;
    link.download = `monthly-report-${month}-${year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "PDF Report Downloaded",
      description: `Downloaded PDF report for ${getCurrentPeriodLabel()}`,
    });
  };

  const exportAnnualExcel = () => {
    const year = currentDate.getFullYear();
    
    const link = document.createElement('a');
    link.href = `/api/reports/annual/excel?year=${year}`;
    link.download = `annual-report-${year}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Annual Excel Report Downloaded",
      description: `Downloaded comprehensive annual report for ${year}`,
    });
  };

  const exportAnnualPDF = () => {
    const year = currentDate.getFullYear();
    
    const link = document.createElement('a');
    link.href = `/api/reports/annual/pdf?year=${year}`;
    link.download = `annual-report-${year}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Annual PDF Report Downloaded",
      description: `Downloaded comprehensive annual report for ${year}`,
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Time Period Selector */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
        <Button 
          variant={selectedPeriod === "weekly" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => {
            setSelectedPeriod("weekly");
            setCurrentDate(new Date());
          }}
        >
          Weekly
        </Button>
        <Button 
          variant={selectedPeriod === "monthly" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => {
            setSelectedPeriod("monthly");
            setCurrentDate(new Date());
          }}
        >
          Monthly
        </Button>
        <Button 
          variant={selectedPeriod === "annual" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => {
            setSelectedPeriod("annual");
            setCurrentDate(new Date());
          }}
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
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900">
            {getCurrentPeriodLabel()}
          </div>
          {!isCurrentPeriod() && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="text-xs text-blue-600 p-0 h-auto"
            >
              Back to current
            </Button>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigatePeriod("next")}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>



      {/* Earnings Overview */}
      <div className="gradient-primary rounded-xl p-6 mb-4 text-white">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-sm font-medium opacity-90 mb-1">Actual Earnings</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(currentData.earnings)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-75 mb-1">
              {getCurrentPeriodLabel()}
            </div>
            {!isCurrentPeriod() && (
              <Badge variant="secondary" className="text-xs">
                Historical
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm opacity-90">
          <span>{Math.round(currentData.gigs)} gigs completed</span>
          <span>•</span>
          <span>{formatCurrency(currentData.avgPerGig)} avg/gig</span>
        </div>
      </div>

      {/* Projected Earnings */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-sm font-medium opacity-90 mb-1">Total Projected</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(getProjectedEarningsForPeriod().projectedEarnings)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-75 mb-1">
              {getCurrentPeriodLabel()}
            </div>
            {isCurrentPeriod() && (
              <Badge variant="secondary" className="text-xs bg-white/20">
                Current
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm opacity-90">
          <span>Expected Pay Only (tips not projected)</span>
          <span>•</span>
          <span>{(stats as any)?.upcomingGigs || 0} upcoming gigs</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="mb-2">
        <p className="text-sm text-gray-600 text-center">
          💡 Click on each card below for detailed breakdowns
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card 
          className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-200 border-2 border-transparent"
          onClick={() => setShowTaxBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tax Estimate</span>
              <Receipt className="w-5 h-5 text-orange-500 hover:text-orange-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(getTaxBreakdownData().reduce((sum, item) => sum + item.taxAmount, 0))}
            </p>
            <p className="text-xs text-gray-500">{user?.defaultTaxPercentage || 23}% of earnings</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-200 border-2 border-transparent"
          onClick={() => setShowTipsBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tips Earned</span>
              <Banknote className="w-5 h-5 text-green-500 hover:text-green-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(getTipsBreakdownData().reduce((sum, item) => sum + item.tips, 0))}
            </p>
            <p className="text-xs text-gray-500">Cash tips received</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all duration-200 border-2 border-transparent"
          onClick={() => setShowExpenseBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Expenses</span>
              <Car className="w-5 h-5 text-gray-500 hover:text-gray-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(getExpenseBreakdownData().reduce((sum, item) => sum + item.totalExpenses, 0))}
            </p>
            <p className="text-xs text-gray-500">Mileage + costs</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedPeriod === "weekly" ? "Weekly" : selectedPeriod === "annual" ? "Annual" : "Monthly"} Goal
            </h3>
            <div className="flex items-center gap-2">
              {currentGoal ? (
                <span className="text-sm text-gray-500">
                  {formatCurrency(projectedData.projectedEarnings)} / {formatCurrency(goalTarget)}
                </span>
              ) : (
                <span className="text-sm text-gray-500">
                  Set your {selectedPeriod} goal
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditGoal(selectedPeriod)}
                className="p-1 h-8 w-8"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {currentGoal ? (
            <>
              <div className="relative mb-2">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(goalProgress, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {goalProgress.toFixed(1)}%
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {goalProgress >= 100 ? (
                  <>
                    <span className="font-medium text-green-600">
                      Congratulations! You've exceeded your goal by {formatCurrency(projectedData.projectedEarnings - goalTarget)}
                    </span>
                    {" - keep up the great work!"}
                  </>
                ) : (
                  <>
                    With what is scheduled, you have{" "}
                    <span className="font-medium text-primary">
                      {formatCurrency(Math.max(0, goalTarget - projectedData.projectedEarnings))} to go
                    </span>
                    {goalProgress >= 95 ? " - you're almost there!" : ""}
                  </>
                )}
              </p>
            </>
          ) : (
            <div className="text-sm text-gray-500 py-4 text-center">
              Click the edit button to set your {selectedPeriod} goal for {getCurrentPeriodLabel()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Breakdown Modal */}
      <Dialog open={showTaxBreakdown} onOpenChange={setShowTaxBreakdown}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tax Breakdown by Gig</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {getTaxBreakdownData().length > 0 ? (
              <div className="space-y-3">
                {getTaxBreakdownData().map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {item.gigName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.clientName} • {item.gigType} • {new Date(item.date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatCurrency(item.actualPay)} × {item.taxPercentage}% tax
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-orange-600">
                        {formatCurrency(item.taxAmount)}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total Tax Estimate:</span>
                    <span className="text-orange-600">
                      {formatCurrency(getTaxBreakdownData().reduce((sum, item) => sum + item.taxAmount, 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No completed gigs with tax amounts to show</p>
                <p className="text-sm">Complete some gigs to see your tax breakdown</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Breakdown Modal */}
      <Dialog open={showExpenseBreakdown} onOpenChange={setShowExpenseBreakdown}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Expense Breakdown by Gig</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {getExpenseBreakdownData().length > 0 ? (
              <div className="space-y-3">
                {getExpenseBreakdownData().map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {item.gigName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.clientName} • {item.gigType} • {new Date(item.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-blue-600">
                          {formatCurrency(item.totalExpenses)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      {item.mileage > 0 && (
                        <div>Mileage: {item.mileage} mi × $0.655 = {formatCurrency(item.mileageExpense)}</div>
                      )}

                      {item.parking > 0 && (
                        <div>Parking: {formatCurrency(item.parking)}</div>
                      )}
                      {item.other > 0 && (
                        <div>Other: {formatCurrency(item.other)}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total Expenses:</span>
                    <span className="text-blue-600">
                      {formatCurrency(getExpenseBreakdownData().reduce((sum, item) => sum + item.totalExpenses, 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No completed gigs with expenses to show</p>
                <p className="text-sm">Add expenses to your gigs to see the breakdown</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tips Breakdown Modal */}
      <Dialog open={showTipsBreakdown} onOpenChange={setShowTipsBreakdown}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tips Breakdown by Gig</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {getTipsBreakdownData().length > 0 ? (
              <div className="space-y-3">
                {getTipsBreakdownData().map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {item.gigName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.clientName} • {item.gigType} • {new Date(item.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-green-600">
                          {formatCurrency(item.tips)}
                        </div>
                        <div className="text-xs text-gray-500">Tips</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total Tips:</span>
                    <span className="text-green-600">
                      {formatCurrency(getTipsBreakdownData().reduce((sum, item) => sum + item.tips, 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Banknote className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No completed gigs with tips to show</p>
                <p className="text-sm">Add tips to your gigs to see the breakdown</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Clients Leaderboard */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Clients</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary"
              onClick={() => setShowClientsModal(true)}
            >
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {getClientData().length > 0 ? (
              getClientData().slice(0, 3).map((client, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedClient(client.name);
                    setShowClientsModal(true);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={index === 0 ? "default" : "secondary"}
                      className="w-8 h-8 rounded-full flex items-center justify-center p-0"
                    >
                      {index + 1}
                    </Badge>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.gigCount} gigs</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(client.total)}
                  </span>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No client data yet</p>
                <p className="text-sm">Complete some gigs to see your top clients</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export & Reports</h3>
          {selectedPeriod === "monthly" ? (
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant="outline" 
                onClick={exportTaxData}
                className="flex items-center justify-center space-x-2 p-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">Tax Data</span>
              </Button>
              <Button 
                variant="outline"
                onClick={exportMonthlyExcel}
                className="flex items-center justify-center space-x-2 p-3 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">Excel Report</span>
              </Button>
              <Button 
                variant="outline"
                onClick={exportMonthlyPDF}
                className="flex items-center justify-center space-x-2 p-3 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">PDF Report</span>
              </Button>
            </div>
          ) : selectedPeriod === "annual" ? (
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant="outline" 
                onClick={exportTaxData}
                className="flex items-center justify-center space-x-2 p-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">Tax Data</span>
              </Button>
              <Button 
                variant="outline"
                onClick={exportAnnualExcel}
                className="flex items-center justify-center space-x-2 p-3 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">Annual Excel</span>
              </Button>
              <Button 
                variant="outline"
                onClick={exportAnnualPDF}
                className="flex items-center justify-center space-x-2 p-3 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">Annual PDF</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                onClick={exportTaxData}
                className="flex items-center justify-center space-x-2 p-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Export Tax Data</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clients Modal */}
      <Dialog open={showClientsModal} onOpenChange={(open) => {
        setShowClientsModal(open);
        if (!open) setSelectedClient(null);
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedClient ? `${selectedClient} - Gig History` : `All Clients (${getAllClientsData().length} total)`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {selectedClient ? (
              // Individual client gig history
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ← Back to All Clients
                  </Button>
                  <div className="text-sm text-gray-500">
                    {getClientGigs(selectedClient).length} gigs • {formatCurrency(
                      getClientGigs(selectedClient).reduce((sum, gig) => sum + parseFloat(gig.actualPay || "0"), 0)
                    )} total
                  </div>
                </div>
                {getClientGigs(selectedClient).map((gig, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {gig.eventName || "Unnamed Gig"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {gig.gigType} • {new Date(gig.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-green-600">
                          {formatCurrency(parseFloat(gig.actualPay || "0"))}
                        </div>
                        {parseFloat(gig.tips || "0") > 0 && (
                          <div className="text-xs text-gray-500">
                            +{formatCurrency(parseFloat(gig.tips || "0"))} tips
                          </div>
                        )}
                      </div>
                    </div>
                    {gig.notes && (
                      <div className="text-xs text-gray-600 mt-2">
                        Notes: {gig.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // All clients list
              <div className="space-y-3">
                {getAllClientsData().length > 0 ? (
                  getAllClientsData().map((client, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedClient(client.name)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={index === 0 ? "default" : "secondary"}
                          className="w-8 h-8 rounded-full flex items-center justify-center p-0"
                        >
                          {index + 1}
                        </Badge>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.completedGigs} completed • {client.gigCount} total gigs</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency(client.total)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Avg: {formatCurrency(client.total / client.gigCount)}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No client data available</p>
                    <p className="text-sm">Complete gigs with clients to see them here</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Edit Dialog */}
      <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {editingGoal === "monthly" ? "Monthly" : "Annual"} Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="goalAmount" className="text-sm font-medium">
                Goal Amount
              </label>
              <Input
                id="goalAmount"
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder={editingGoal === "monthly" ? "3000" : "36000"}
                min="0"
                step="100"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleSaveGoal} 
                disabled={updateGoalMutation.isPending}
                className="flex-1"
              >
                <Target className="w-4 h-4 mr-2" />
                Save Goal
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditingGoal(null)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
