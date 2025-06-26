import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Edit2, Save, X, DollarSign, Calendar, Users, TrendingUp, Receipt, Calculator, PiggyBank } from "lucide-react";
import type { Gig, User } from "@shared/schema";

type TimePeriod = "monthly" | "annual";

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingGoal, setEditingGoal] = useState<"monthly" | "annual" | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [showProjectedBreakdown, setShowProjectedBreakdown] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [showTipsBreakdown, setShowTipsBreakdown] = useState(false);
  const [showExpensesBreakdown, setShowExpensesBreakdown] = useState(false);
  
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

  // Filter gigs based on selected period with consistent UTC date handling
  const currentPeriodGigs = useMemo(() => {
    if (!gigs || gigs.length === 0) return [];
    
    return gigs.filter(gig => {
      // Consistent UTC date parsing to avoid timezone issues
      const gigDate = new Date(gig.date + 'T00:00:00.000Z');
      const currentUtcDate = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000);
      
      // Validate date
      if (isNaN(gigDate.getTime())) return false;
      
      switch (selectedPeriod) {
        case "monthly":
          return gigDate.getUTCMonth() === currentUtcDate.getUTCMonth() && 
                 gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
        case "annual":
          return gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
        default:
          return gigDate.getUTCMonth() === currentUtcDate.getUTCMonth() && 
                 gigDate.getUTCFullYear() === currentUtcDate.getUTCFullYear();
      }
    });
  }, [gigs, selectedPeriod, currentDate]);

  // Safe numeric parsing function
  const safeParseFloat = (value: string | null | undefined): number => {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
  };

  // Calculate earnings for current period with proper error handling
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

    const completedGigs = currentPeriodGigs.filter(gig => gig.status === "completed");
    const upcomingGigs = currentPeriodGigs.filter(gig => gig.status !== "completed");
    
    // Calculate actual earnings only from completed gigs
    const actualEarnings = completedGigs.reduce((sum, gig) => {
      const actualPay = safeParseFloat(gig.actualPay);
      const tips = safeParseFloat(gig.tips);
      return sum + actualPay + tips;
    }, 0);
    
    // Calculate total tips from completed gigs
    const totalTips = completedGigs.reduce((sum, gig) => {
      return sum + safeParseFloat(gig.tips);
    }, 0);
    
    // Calculate total expenses from all gigs
    const totalExpenses = currentPeriodGigs.reduce((sum, gig) => {
      const parkingExpense = safeParseFloat(gig.parkingExpense);
      const otherExpenses = safeParseFloat(gig.otherExpenses);
      const mileageDeduction = (gig.mileage || 0) * 0.67; // Standard mileage rate $0.67/mile
      return sum + parkingExpense + otherExpenses + mileageDeduction;
    }, 0);
    
    // Calculate projected earnings: actual for completed, expected for upcoming
    const projectedEarnings = currentPeriodGigs.reduce((sum, gig) => {
      if (gig.status === "completed") {
        const actualPay = safeParseFloat(gig.actualPay);
        const tips = safeParseFloat(gig.tips);
        return sum + actualPay + tips;
      } else {
        const expectedPay = safeParseFloat(gig.expectedPay);
        return sum + expectedPay;
      }
    }, 0);

    // Calculate estimated tax (use average tax percentage from gigs, or default 25%)
    const gigTaxRates = currentPeriodGigs
      .map(gig => gig.taxPercentage || 0)
      .filter(rate => rate > 0);
    const avgTaxRate = gigTaxRates.length > 0 
      ? gigTaxRates.reduce((sum, rate) => sum + rate, 0) / gigTaxRates.length 
      : 25; // Default 25%
    
    const taxableIncome = Math.max(0, actualEarnings - totalExpenses);
    const estimatedTax = (taxableIncome * avgTaxRate) / 100;

    return {
      actualEarnings: Math.round(actualEarnings * 100) / 100,
      projectedEarnings: Math.round(projectedEarnings * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      estimatedTax: Math.round(estimatedTax * 100) / 100,
      completedGigs: completedGigs.length,
      upcomingGigs: upcomingGigs.length,
      totalGigs: currentPeriodGigs.length
    };
  }, [currentPeriodGigs]);

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

  const handleSaveGoal = () => {
    if (!goalAmount.trim()) return;
    updateGoalMutation.mutate({ goalAmount: goalAmount.trim() });
  };

  const startEditingGoal = (period: "monthly" | "annual") => {
    setEditingGoal(period);
    setGoalAmount(currentGoal?.goalAmount || "");
  };

  // Get breakdown data for modals with safe parsing
  const getActualEarningsBreakdown = () => {
    return currentPeriodGigs
      .filter(gig => gig.status === "completed")
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getProjectedEarningsBreakdown = () => {
    return currentPeriodGigs
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
        const taxRate = gig.taxPercentage || 25;
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {/* Actual Earnings */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl"
          onClick={() => setShowEarningsBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actual Earnings</p>
                <p className="text-lg font-bold text-gray-900">
                  ${periodStats.actualEarnings.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projected Earnings */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl"
          onClick={() => setShowProjectedBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projected Earnings</p>
                <p className="text-lg font-bold text-gray-900">
                  ${periodStats.projectedEarnings.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Estimate */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl"
          onClick={() => setShowTaxBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Calculator className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax Estimate</p>
                <p className="text-lg font-bold text-gray-900">
                  ${periodStats.estimatedTax.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Earned */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl"
          onClick={() => setShowTipsBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <PiggyBank className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tips Earned</p>
                <p className="text-lg font-bold text-gray-900">
                  ${periodStats.totalTips.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Breakdown */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 rounded-xl"
          onClick={() => setShowExpensesBreakdown(true)}
        >
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Receipt className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</p>
                <p className="text-lg font-bold text-gray-900">
                  ${periodStats.totalExpenses.toFixed(2)}
                </p>
              </div>
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
                      {new Date(gig.date).toLocaleDateString()}
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
                      {new Date(gig.date).toLocaleDateString()}
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
                      {new Date(gig.date).toLocaleDateString()}
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
                      {new Date(gig.date).toLocaleDateString()}
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
                      {new Date(gig.date).toLocaleDateString()}
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