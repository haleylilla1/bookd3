import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, Car, Download, TrendingUp, Edit2, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Fetch period-specific goal
  const { data: currentGoal, refetch: refetchGoal } = useQuery({
    queryKey: ["/api/goals/period", selectedPeriod, currentDate.toISOString()],
    queryFn: () => fetch(`/api/goals/period/${selectedPeriod}/${currentDate.toISOString()}`).then(res => res.json()),
  });

  // Fetch gigs for tax breakdown
  const { data: gigs } = useQuery({
    queryKey: ["/api/gigs"],
    queryFn: () => fetch("/api/gigs").then(res => res.json()),
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

  // Calculate tax breakdown per gig
  const getTaxBreakdownData = () => {
    if (!gigs) return [];
    
    return (gigs as any[])
      .filter(gig => gig.status === "completed" && gig.actualPay)
      .map(gig => {
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
      .filter(item => item.taxAmount > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculate expense breakdown per gig
  const getExpenseBreakdownData = () => {
    if (!gigs) return [];
    
    return (gigs as any[])
      .filter(gig => gig.status === "completed")
      .map(gig => {
        const mileage = parseInt(gig.mileage || "0");
        const transportation = parseFloat(gig.transportationExpense || "0");
        const parking = parseFloat(gig.parkingExpense || "0");
        const other = parseFloat(gig.otherExpenses || "0");
        const mileageExpense = mileage * 0.655; // 2024 IRS standard mileage rate
        const totalExpenses = mileageExpense + transportation + parking + other;
        
        return {
          gigName: gig.eventName || "Unnamed Gig",
          gigType: gig.gigType,
          clientName: gig.clientName,
          date: gig.date,
          mileage,
          mileageExpense,
          transportation,
          parking,
          other,
          totalExpenses
        };
      })
      .filter(item => item.totalExpenses > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Calculate earnings based on selected period
  const getEarningsForPeriod = () => {
    if (!stats) return { earnings: 0, gigs: 0, avgPerGig: 0, period: "" };
    
    const monthlyEarnings = (stats as any).monthlyEarnings || 0;
    const completedGigs = (stats as any).completedGigs || 0;
    const avgPerGig = (stats as any).avgPerGig || 0;
    
    switch (selectedPeriod) {
      case "weekly":
        // Estimate weekly from monthly data
        const weeklyEarnings = monthlyEarnings / 4.33; // Average weeks per month
        const weeklyGigs = completedGigs / 4.33;
        return {
          earnings: weeklyEarnings,
          gigs: weeklyGigs,
          avgPerGig: avgPerGig,
          period: "This Week"
        };
      case "annual":
        // Estimate annual from monthly data
        const annualEarnings = monthlyEarnings * 12;
        const annualGigs = completedGigs * 12;
        return {
          earnings: annualEarnings,
          gigs: annualGigs,
          avgPerGig: avgPerGig,
          period: "This Year"
        };
      default:
        return {
          earnings: monthlyEarnings,
          gigs: completedGigs,
          avgPerGig: avgPerGig,
          period: "This Month"
        };
    }
  };

  // Calculate projected earnings based on selected period (actual + expected)
  const getProjectedEarningsForPeriod = () => {
    if (!stats) return { projectedEarnings: 0, period: "" };
    
    const monthlyActual = (stats as any).monthlyEarnings || 0;
    const monthlyExpected = (stats as any).projectedEarnings || 0;
    const monthlyTotal = monthlyActual + monthlyExpected;
    
    switch (selectedPeriod) {
      case "weekly":
        return {
          projectedEarnings: monthlyTotal / 4.33,
          period: "This Week"
        };
      case "annual":
        return {
          projectedEarnings: monthlyTotal * 12,
          period: "This Year"
        };
      default:
        return {
          projectedEarnings: monthlyTotal,
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
  const goalTarget = parseFloat(currentGoal?.goalAmount || "0");
  const goalProgress = currentData.earnings && goalTarget ? (currentData.earnings / goalTarget) * 100 : 0;

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
          <span>Actual + Expected Pay</span>
          <span>•</span>
          <span>{(stats as any)?.upcomingGigs || 0} upcoming gigs</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tax Estimate</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTaxBreakdown(true)}
                className="p-1 h-8 w-8 hover:bg-orange-100"
              >
                <Receipt className="w-5 h-5 text-warning" />
              </Button>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(((stats as any)?.taxEstimate || 0) * (selectedPeriod === "weekly" ? 1/4.33 : selectedPeriod === "annual" ? 12 : 1))}
            </p>
            <p className="text-xs text-gray-500">{user?.defaultTaxPercentage || 23}% of earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Expenses</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExpenseBreakdown(true)}
                className="p-1 h-8 w-8 hover:bg-blue-100"
              >
                <Car className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(((stats as any)?.totalExpenses || 0) * (selectedPeriod === "weekly" ? 1/4.33 : selectedPeriod === "annual" ? 12 : 1))}
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
                  {formatCurrency(currentData.earnings)} / {formatCurrency(goalTarget)}
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
              <Progress value={goalProgress} className="mb-2" />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-primary">
                  {formatCurrency(Math.max(0, goalTarget - currentData.earnings))} to go
                </span>
                {goalProgress >= 95 ? " - You're almost there!" : ""}
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
                      {item.transportation > 0 && (
                        <div>Transportation: {formatCurrency(item.transportation)}</div>
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

      {/* Top Clients Leaderboard */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Clients</h3>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {(stats as any)?.topClients?.length > 0 ? (
              (stats as any).topClients.slice(0, 3).map((client: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={index === 0 ? "default" : "secondary"}
                      className="w-8 h-8 rounded-full flex items-center justify-center p-0"
                    >
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.gigs} gigs</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(client.total)}
                  </span>
                </div>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="flex items-center justify-center space-x-2 p-3 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export Tax Data</span>
            </Button>
            <Button 
              variant="outline"
              className="flex items-center justify-center space-x-2 p-3 bg-success/10 text-success border-success/20 hover:bg-success/20"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Monthly Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>

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
