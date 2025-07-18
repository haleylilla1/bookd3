import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Edit2, Save, X, DollarSign, Calendar, Users, TrendingUp } from "lucide-react";
import type { Gig, User } from "@shared/schema";

type TimePeriod = "monthly" | "annual";

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingGoal, setEditingGoal] = useState<"monthly" | "annual" | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [showProjectedBreakdown, setShowProjectedBreakdown] = useState(false);
  
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

  // Filter gigs based on selected period
  const currentPeriodGigs = useMemo(() => {
    if (!gigs || !Array.isArray(gigs) || gigs.length === 0) return [];
    
    return gigs.filter(gig => {
      const gigDate = new Date(gig.date);
      
      switch (selectedPeriod) {
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

  // Calculate earnings for current period
  const periodStats = useMemo(() => {
    if (!currentPeriodGigs.length) {
      return {
        actualEarnings: 0,
        projectedEarnings: 0,
        completedGigs: 0,
        upcomingGigs: 0,
        totalGigs: 0
      };
    }

    const completedGigs = Array.isArray(currentPeriodGigs) ? currentPeriodGigs.filter(gig => gig.status === "completed") : [];
    const upcomingGigs = Array.isArray(currentPeriodGigs) ? currentPeriodGigs.filter(gig => gig.status !== "completed") : [];
    
    const actualEarnings = completedGigs.reduce((sum, gig) => 
      sum + parseFloat(gig.actualPay || "0"), 0);
    
    const projectedEarnings = currentPeriodGigs.reduce((sum, gig) => {
      if (gig.status === "completed") {
        return sum + parseFloat(gig.actualPay || "0");
      } else {
        return sum + parseFloat(gig.expectedPay || "0");
      }
    }, 0);

    return {
      actualEarnings,
      projectedEarnings,
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

  // Get breakdown data for modals
  const getActualEarningsBreakdown = () => {
    return currentPeriodGigs
      .filter(gig => gig.status === "completed" && parseFloat(gig.actualPay || "0") > 0)
      .map(gig => ({
        ...gig,
        amount: parseFloat(gig.actualPay || "0")
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getProjectedEarningsBreakdown = () => {
    return currentPeriodGigs
      .map(gig => ({
        ...gig,
        amount: gig.status === "completed" 
          ? parseFloat(gig.actualPay || "0")
          : parseFloat(gig.expectedPay || "0")
      }))
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

      {/* Main Stats Grid */}
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
    </div>
  );
}