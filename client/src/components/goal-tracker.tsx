import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PiggyBank, Home, ShirtIcon, Plus, GripVertical, Check, Lightbulb, Edit2, Trash2, Target, DollarSign, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import GigAllocation from "./gig-allocation";
import type { Gig, Goal, Allocation } from "@shared/schema";
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

type TimePeriod = "monthly" | "yearly";

export default function GoalTracker() {
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState("savings");
  const [newGoalDuration, setNewGoalDuration] = useState("monthly");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalName, setEditGoalName] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const [allocatingGig, setAllocatingGig] = useState<Gig | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [quickAllocateGoal, setQuickAllocateGoal] = useState<Goal | null>(null);
  const [quickAllocateAmount, setQuickAllocateAmount] = useState("");
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [editAllocationAmount, setEditAllocationAmount] = useState("");
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  // Fetch period-specific goals for current selected period and date
  const { data: periodGoal, refetch: refetchPeriodGoal } = useQuery({
    queryKey: ["/api/goals/period", selectedPeriod, currentDate.toISOString()],
    queryFn: () => fetch(`/api/goals/period/${selectedPeriod}/${currentDate.toISOString()}`).then(res => res.json()),
  });

  const { data: allocations = [] } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations"],
  });

  const { data: piggyBankTotal = 0 } = useQuery<number>({
    queryKey: ["/api/piggy-bank-total"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  // Get recent completed gigs available for allocation
  const completedGigs = gigs.filter(gig => gig.status === "completed" && (gig.actualPay || gig.expectedPay));
  const recentGigs = completedGigs.slice(0, 3); // Show 3 most recent
  
  // Calculate gig allocation status
  const getGigAllocationStatus = (gig: Gig) => {
    const gigAllocations = allocations.filter(a => a.gigId === gig.id);
    const totalAllocated = gigAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const gigPay = parseFloat(gig.actualPay || gig.expectedPay || "0");
    const remainingAmount = gigPay - totalAllocated;
    return { totalAllocated, remainingAmount, gigPay };
  };

  const totalEarnings = completedGigs.reduce((sum, gig) => {
    const actualPay = parseFloat(gig.actualPay || "0");
    const tips = parseFloat(gig.tips || "0");
    return sum + actualPay + tips;
  }, 0);
  
  const totalAllocated = allocations.reduce((sum: number, allocation: any) => sum + parseFloat(allocation.amount || "0"), 0);
  const unallocatedAmount = totalEarnings - totalAllocated;
  
  // Calculate suggested tax estimate for unallocated amount
  const taxPercentage = (user as any)?.defaultTaxPercentage || 23;
  const suggestedTaxes = totalEarnings * (taxPercentage / 100);
  const unallocatedAfterTaxes = unallocatedAmount - suggestedTaxes;

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: { category: string; name: string; targetAmount: string; goalDuration: string }) => {
      const response = await apiRequest("POST", "/api/goals", {
        category: goalData.category,
        name: goalData.name,
        targetAmount: goalData.targetAmount,
        currentAmount: "0",
        isCompleted: false,
        goalDuration: goalData.goalDuration,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Success",
        description: "Goal created successfully!",
      });
      setNewGoalName("");
      setNewGoalAmount("");
      setNewGoalCategory("savings");
      setNewGoalDuration("monthly");
    },
    onError: (error: any) => {
      console.error("Create goal error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create goal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const quickAllocateMutation = useMutation({
    mutationFn: async ({ goalId, amount }: { goalId: number; amount: string }) => {
      // Find a completed gig with remaining funds to allocate from
      const availableGig = completedGigs.find(gig => {
        const gigAllocations = allocations.filter(a => a.gigId === gig.id);
        const totalAllocated = gigAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
        const gigPay = parseFloat(gig.actualPay || "0") + parseFloat(gig.tips || "0");
        return gigPay > totalAllocated;
      });

      if (!availableGig) {
        throw new Error("No available gigs to allocate from");
      }

      const response = await apiRequest("POST", "/api/allocations", {
        gigId: availableGig.id,
        goalId: goalId,
        amount: amount,
        allocationType: "goal"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/piggy-bank-total"] });
      toast({
        title: "Success",
        description: "Allocation completed successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate funds. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (goalData: { id: number; name: string; targetAmount: string }) => {
      const response = await apiRequest("PUT", `/api/goals/${goalData.id}`, {
        name: goalData.name,
        targetAmount: goalData.targetAmount,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Success",
        description: "Goal updated successfully!",
      });
      setEditingGoal(null);
      setEditGoalName("");
      setEditGoalAmount("");
    },
    onError: (error: any) => {
      console.error("Update goal error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update goal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      await apiRequest("DELETE", `/api/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Success",
        description: "Goal deleted successfully!",
      });
    },
    onError: (error: any) => {
      console.error("Delete goal error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to delete goal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async ({ allocationId, amount }: { allocationId: number; amount: string }) => {
      const response = await apiRequest("PUT", `/api/allocations/${allocationId}`, {
        amount: amount
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/piggy-bank-total"] });
      toast({
        title: "Success",
        description: "Allocation updated successfully!",
      });
    },
    onError: (error: any) => {
      console.error("Update allocation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update allocation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: async (allocationId: number) => {
      const response = await apiRequest("DELETE", `/api/allocations/${allocationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/piggy-bank-total"] });
      toast({
        title: "Success",
        description: "Allocation removed successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove allocation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const allocateToGoal = async (goalId: number, amount: number) => {
    try {
      // In a real app, this would create an allocation record
      // For now, we'll update the goal's current amount
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        const newAmount = parseFloat(goal.currentAmount || "0") + amount;
        await apiRequest("PUT", `/api/goals/${goalId}`, {
          currentAmount: newAmount.toString(),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
        toast({
          title: "Success",
          description: `$${amount} allocated to ${goal.name}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to allocate funds. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getGoalIcon = (category: string) => {
    switch (category) {
      case "savings":
        return <PiggyBank className="w-5 h-5 text-success" />;
      case "rent":
        return <Home className="w-5 h-5 text-primary" />;
      case "gear":
        return <ShirtIcon className="w-5 h-5 text-secondary" />;
      default:
        return <PiggyBank className="w-5 h-5 text-gray-400" />;
    }
  };

  const getGoalColor = (category: string) => {
    switch (category) {
      case "savings":
        return "success";
      case "rent":
        return "primary";
      case "gear":
        return "secondary";
      default:
        return "gray";
    }
  };

  const startEditingGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditGoalName(goal.name);
    setEditGoalAmount(goal.targetAmount || "");
  };

  const saveGoalEdit = () => {
    if (editingGoal && editGoalName && editGoalAmount) {
      updateGoalMutation.mutate({
        id: editingGoal.id,
        name: editGoalName,
        targetAmount: editGoalAmount,
      });
    }
  };

  const cancelGoalEdit = () => {
    setEditingGoal(null);
    setEditGoalName("");
    setEditGoalAmount("");
  };

  // Navigation functions
  const navigatePeriod = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      switch (selectedPeriod) {
        case "monthly":
          return direction === "prev" ? addMonths(prev, -1) : addMonths(prev, 1);
        case "yearly":
          return direction === "prev" ? addYears(prev, -1) : addYears(prev, 1);
        default:
          return prev;
      }
    });
  };

  // Get period label
  const getCurrentPeriodLabel = () => {
    switch (selectedPeriod) {
      case "monthly":
        return formatMonth(currentDate);
      case "yearly":
        return formatYear(currentDate);
      default:
        return "";
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 mb-6 border border-blue-100/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Goal Tracker</h2>
              <p className="text-sm text-gray-600">
                Track and allocate money towards your financial goals
              </p>
            </div>
          </div>
          
          <Button 
            onClick={() => setIsNewGoalOpen(true)} 
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Goal
          </Button>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <div className="text-2xl font-bold text-blue-600 mb-1">{goals.length}</div>
            <div className="text-xs text-gray-600 font-medium">Active Goals</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {formatCurrency(goals.reduce((sum, goal) => sum + parseFloat(goal.currentAmount || "0"), 0))}
            </div>
            <div className="text-xs text-gray-600 font-medium">Total Saved</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {formatCurrency(goals.reduce((sum, goal) => sum + parseFloat(goal.targetAmount), 0))}
            </div>
            <div className="text-xs text-gray-600 font-medium">Target Amount</div>
          </div>
        </div>


      </div>

      {/* Period Goal Overview */}
      <Card className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {selectedPeriod === "monthly" ? "Monthly" : "Yearly"} Goal Target
            </h3>
            {periodGoal ? (
              <div className="mb-4">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {formatCurrency(parseFloat(periodGoal.goalAmount || "0"))}
                </div>
                <div className="text-sm text-gray-600">
                  Target for {getCurrentPeriodLabel()}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="text-xl text-gray-500 mb-2">No goal set</div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const amount = prompt(`Enter your ${selectedPeriod} goal amount:`);
                    if (amount && !isNaN(parseFloat(amount))) {
                      fetch(`/api/goals/period/${selectedPeriod}/${currentDate.toISOString()}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ goalAmount: amount })
                      }).then(() => refetchPeriodGoal());
                    }
                  }}
                >
                  Set {selectedPeriod === "monthly" ? "Monthly" : "Yearly"} Goal
                </Button>
              </div>
            )}
          </div>
          
          {/* Period Controls */}
          <div className="flex flex-col items-center space-y-4 mt-6 pt-6 border-t border-purple-200">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Viewing:</span>
              <Select value={selectedPeriod} onValueChange={(value: TimePeriod) => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32 bg-white/80 border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Period Navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigatePeriod("prev")}
                className="p-2 bg-white/80 border-white/20 hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center px-4 py-2 bg-white/80 rounded-lg border border-white/20">
                {getCurrentPeriodLabel()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigatePeriod("next")}
                className="p-2 bg-white/80 border-white/20 hover:bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Money Ready to Allocate */}
      {completedGigs.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="text-center mb-3">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Money Ready to Allocate</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(unallocatedAmount)}
                </div>
                <div className="text-xs text-gray-500">Total unallocated earnings</div>
              </div>
              
              <div className="border-t border-blue-200 pt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Set aside for taxes ({taxPercentage}%)</span>
                  <span className="font-medium text-orange-600">-{formatCurrency(suggestedTaxes)}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-800">Available to allocate to goals</span>
                  <div className={`text-lg font-bold ${unallocatedAfterTaxes < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.max(0, unallocatedAfterTaxes))}
                  </div>
                </div>
                {unallocatedAfterTaxes < 0 && (
                  <div className="mt-2 text-xs text-red-600 text-center">
                    ⚠️ You've allocated more than your after-tax earnings
                  </div>
                )}
                
                {/* Quick Allocation Buttons */}
                {unallocatedAfterTaxes > 0 && goals.length > 0 && (
                  <div className="border-t border-blue-200 pt-3 mt-3">
                    <div className="text-xs text-gray-600 mb-2 text-center">Quick allocate to your goals:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {goals
                        .filter(goal => {
                          // Show goals that match current period or show all goals regardless of period for quick allocation
                          return true;
                        })
                        .slice(0, 4)
                        .map((goal) => (
                        <Button
                          key={goal.id}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (unallocatedAfterTaxes <= 0) {
                              toast({
                                title: "No Funds Available",
                                description: "No funds available for allocation after taxes",
                              });
                              return;
                            }
                            setQuickAllocateGoal(goal);
                            setQuickAllocateAmount("");
                          }}
                          disabled={quickAllocateMutation.isPending}
                          className="text-xs"
                        >
                          {quickAllocateMutation.isPending ? "..." : goal.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals List */}

      {/* Goals */}
      <div className="space-y-4">
        {goals
          .filter(goal => {
            // Show yearly goals only in yearly view, monthly goals in both views
            if (selectedPeriod === "yearly") {
              return goal.goalDuration === "yearly";
            } else {
              return goal.goalDuration === "monthly" || goal.goalDuration === "yearly";
            }
          })
          .map((goal) => {
          // Calculate progress from allocations instead of currentAmount
          const goalAllocations = allocations.filter(a => a.goalId === goal.id);
          const totalAllocatedToGoal = goalAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
          
          // Calculate target amount based on goal duration and current view
          let targetAmount = parseFloat(goal.targetAmount);
          let displayTargetAmount = targetAmount;
          
          if (goal.goalDuration === "yearly" && selectedPeriod === "monthly") {
            // Show monthly breakdown for yearly goals in monthly view
            displayTargetAmount = targetAmount / 12;
          }
          
          const progress = displayTargetAmount > 0 ? (totalAllocatedToGoal / displayTargetAmount) * 100 : 0;
          const isCompleted = progress >= 100;
          const isEditing = editingGoal?.id === goal.id;
          
          return (
            <Card key={goal.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 bg-${getGoalColor(goal.category)}/10 rounded-lg flex items-center justify-center`}>
                      {getGoalIcon(goal.category)}
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editGoalName}
                            onChange={(e) => setEditGoalName(e.target.value)}
                            placeholder="Goal name"
                            className="text-lg font-semibold"
                          />
                          <Input
                            type="number"
                            value={editGoalAmount}
                            onChange={(e) => setEditGoalAmount(e.target.value)}
                            placeholder="Target amount"
                            className="text-sm"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {goal.goalDuration === "yearly" ? "Yearly" : "Monthly"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {goal.goalDuration === "yearly" && selectedPeriod === "monthly" ? (
                              <>
                                Monthly: {formatCurrency(displayTargetAmount)} 
                                <span className="text-gray-400 ml-1">(of {formatCurrency(targetAmount)}/year)</span>
                              </>
                            ) : (
                              <>Target: {formatCurrency(displayTargetAmount)}</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={saveGoalEdit}
                          disabled={updateGoalMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelGoalEdit}
                        >
                          ✕
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingGoal(goal)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGoalMutation.mutate(goal.id)}
                          disabled={deleteGoalMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                        {!isCompleted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => allocateToGoal(goal.id, 50)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">
                      {formatCurrency(totalAllocatedToGoal)} / {formatCurrency(targetAmount)}
                    </span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className={`mb-2 ${isCompleted ? 'bg-green-100' : ''}`} />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {progress.toFixed(1)}% complete
                    </span>
                    {goalAllocations.length > 0 && (
                      <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                        {goalAllocations.length} allocation{goalAllocations.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Allocation Details */}
                {goalAllocations.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-700 mb-2">Recent Allocations:</div>
                    {goalAllocations.slice(-3).map((allocation) => {
                      const allocatedGig = gigs.find(g => g.id === allocation.gigId);
                      return (
                        <div key={allocation.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                          <div>
                            <span className="font-medium">{formatCurrency(parseFloat(allocation.amount))}</span>
                            {allocatedGig && (
                              <span className="text-gray-500 ml-1">from {allocatedGig.clientName}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingAllocation(allocation);
                                setEditAllocationAmount(allocation.amount);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Remove $${allocation.amount} allocation?`)) {
                                  deleteAllocationMutation.mutate(allocation.id);
                                }
                              }}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex items-center justify-between p-2 bg-success/5 rounded-lg">
                  <div className="flex items-center">
                    {isCompleted && <Check className="w-4 h-4 text-success mr-2" />}
                    <span className="text-sm font-medium text-success">
                      {isCompleted ? "Goal Completed ✓" : "In Progress"}
                    </span>
                  </div>
                  {unallocatedAfterTaxes > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const availableGig = completedGigs.find(gig => {
                          const gigAllocations = allocations.filter(a => a.gigId === gig.id);
                          const totalAllocated = gigAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
                          const gigPay = parseFloat(gig.actualPay || "0") + parseFloat(gig.tips || "0");
                          return gigPay > totalAllocated;
                        });
                        if (availableGig) {
                          setAllocatingGig(availableGig);
                        }
                      }}
                    >
                      <Target className="w-3 h-3 mr-1" />
                      Add More
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add New Goal */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-center space-x-2 text-gray-500">
                  <Plus className="w-5 h-5" />
                  <span>Add New Goal</span>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="goal-name">Goal Name</Label>
                <Input
                  id="goal-name"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="e.g., Emergency Fund, Monthly Rent..."
                />
              </div>
              <div>
                <Label htmlFor="goal-category">Category</Label>
                <select
                  id="goal-category"
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="savings">Savings</option>
                  <option value="rent">Rent/Housing</option>
                  <option value="gear">Professional Gear</option>
                  <option value="tax">Tax Fund</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="goal-duration">Goal Duration</Label>
                <select
                  id="goal-duration"
                  value={newGoalDuration}
                  onChange={(e) => setNewGoalDuration(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="monthly">Monthly Goal</option>
                  <option value="yearly">Yearly Goal (with monthly breakdown)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="goal-amount">
                  {newGoalDuration === "yearly" ? "Yearly Target Amount" : "Monthly Target Amount"}
                </Label>
                <Input
                  id="goal-amount"
                  type="number"
                  value={newGoalAmount}
                  onChange={(e) => setNewGoalAmount(e.target.value)}
                  placeholder={newGoalDuration === "yearly" ? "12000" : "1000"}
                />
                {newGoalDuration === "yearly" && newGoalAmount && (
                  <p className="text-sm text-gray-500 mt-1">
                    Monthly target: {formatCurrency(parseFloat(newGoalAmount) / 12)}
                  </p>
                )}
              </div>
              <Button
                onClick={() => createGoalMutation.mutate({
                  category: newGoalCategory,
                  name: newGoalName,
                  targetAmount: newGoalAmount,
                  goalDuration: newGoalDuration,
                })}
                disabled={!newGoalName || !newGoalAmount || createGoalMutation.isPending}
                className="w-full"
              >
                {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Suggested Goal - Tax Fund */}
        {unallocatedAmount > 100 && !goals.some(g => g.category === "tax") && (
          <Card className="bg-gradient-to-r from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Suggested: Tax Fund</h3>
                  <p className="text-sm text-gray-500">Save 23% for taxes</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Based on your earnings, we recommend setting aside{" "}
                <strong>{formatCurrency(unallocatedAmount * 0.23)}</strong> from recent gigs for taxes.
              </p>
              <Button
                onClick={() => createGoalMutation.mutate({
                  category: "tax",
                  name: "Tax Fund",
                  targetAmount: (unallocatedAmount * 0.23).toString(),
                  goalDuration: "monthly",
                })}
                className="w-full bg-warning hover:bg-warning/90"
              >
                Create Tax Goal
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Gig Allocation Dialog */}
        {allocatingGig && (
          <GigAllocation
            gig={allocatingGig}
            isOpen={!!allocatingGig}
            onClose={() => setAllocatingGig(null)}
          />
        )}

        {/* Quick Allocate Dialog */}
        {quickAllocateGoal && (
          <Dialog open={!!quickAllocateGoal} onOpenChange={() => setQuickAllocateGoal(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Allocate to {quickAllocateGoal.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    Available after taxes: <span className="font-medium text-green-600">{formatCurrency(unallocatedAfterTaxes)}</span>
                  </div>
                  {(() => {
                    const goalAllocations = allocations.filter(a => a.goalId === quickAllocateGoal.id);
                    const totalAllocatedToGoal = goalAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
                    let targetAmount = parseFloat(quickAllocateGoal.targetAmount);
                    if (quickAllocateGoal.goalDuration === "yearly" && selectedPeriod === "monthly") {
                      targetAmount = targetAmount / 12;
                    }
                    const remainingForGoal = Math.max(0, targetAmount - totalAllocatedToGoal);
                    
                    return (
                      <div className="text-sm text-gray-600">
                        {remainingForGoal > 0 ? (
                          <>Remaining for goal: <span className="font-medium text-blue-600">{formatCurrency(remainingForGoal)}</span></>
                        ) : (
                          <span className="text-orange-600">Goal complete - you can still add more!</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                
                <div>
                  <Label htmlFor="allocation-amount">Amount to Allocate</Label>
                  <Input
                    id="allocation-amount"
                    type="number"
                    value={quickAllocateAmount}
                    onChange={(e) => setQuickAllocateAmount(e.target.value)}
                    placeholder="Enter amount..."
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setQuickAllocateGoal(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!quickAllocateAmount || isNaN(parseFloat(quickAllocateAmount)) || parseFloat(quickAllocateAmount) <= 0) {
                        toast({
                          title: "Invalid Amount",
                          description: "Please enter a valid amount",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      const allocAmount = parseFloat(quickAllocateAmount);
                      if (allocAmount > unallocatedAfterTaxes) {
                        toast({
                          title: "Error",
                          description: "Amount exceeds available funds after taxes",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      quickAllocateMutation.mutate({
                        goalId: quickAllocateGoal.id,
                        amount: quickAllocateAmount
                      });
                      setQuickAllocateGoal(null);
                      setQuickAllocateAmount("");
                    }}
                    disabled={quickAllocateMutation.isPending}
                    className="flex-1"
                  >
                    {quickAllocateMutation.isPending ? "Allocating..." : "Allocate"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Allocation Dialog */}
        {editingAllocation && (
          <Dialog open={!!editingAllocation} onOpenChange={() => setEditingAllocation(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Allocation</DialogTitle>
                <DialogDescription>
                  Modify the allocation amount for this goal.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Current amount: <span className="font-medium">{formatCurrency(parseFloat(editingAllocation.amount))}</span>
                </div>
                
                <div>
                  <Label htmlFor="edit-allocation-amount">New Amount</Label>
                  <Input
                    id="edit-allocation-amount"
                    type="number"
                    value={editAllocationAmount}
                    onChange={(e) => setEditAllocationAmount(e.target.value)}
                    placeholder="Enter new amount..."
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingAllocation(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!editAllocationAmount || isNaN(parseFloat(editAllocationAmount)) || parseFloat(editAllocationAmount) <= 0) {
                        toast({
                          title: "Invalid Amount",
                          description: "Please enter a valid amount",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      updateAllocationMutation.mutate({
                        allocationId: editingAllocation.id,
                        amount: editAllocationAmount
                      });
                      setEditingAllocation(null);
                      setEditAllocationAmount("");
                    }}
                    disabled={updateAllocationMutation.isPending}
                    className="flex-1"
                  >
                    {updateAllocationMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* New Goal Dialog */}
        {isNewGoalOpen && (
          <Dialog open={isNewGoalOpen} onOpenChange={setIsNewGoalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
                <DialogDescription>
                  Set up a new financial goal to track your progress.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-goal-name">Goal Name</Label>
                  <Input
                    id="new-goal-name"
                    value={newGoalName}
                    onChange={(e) => setNewGoalName(e.target.value)}
                    placeholder="Emergency Fund, New Car, etc."
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-goal-amount">Target Amount</Label>
                  <Input
                    id="new-goal-amount"
                    type="number"
                    value={newGoalAmount}
                    onChange={(e) => setNewGoalAmount(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-goal-category">Category</Label>
                  <Select value={newGoalCategory} onValueChange={setNewGoalCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="gear">Gear</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="new-goal-duration">Duration</Label>
                  <Select value={newGoalDuration} onValueChange={setNewGoalDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly Goal</SelectItem>
                      <SelectItem value="yearly">Yearly Goal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsNewGoalOpen(false);
                      setNewGoalName("");
                      setNewGoalAmount("");
                      setNewGoalCategory("savings");
                      setNewGoalDuration("monthly");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!newGoalName || !newGoalAmount || isNaN(parseFloat(newGoalAmount)) || parseFloat(newGoalAmount) <= 0) {
                        toast({
                          title: "Invalid Input",
                          description: "Please enter a valid goal name and amount",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      createGoalMutation.mutate({
                        name: newGoalName,
                        targetAmount: newGoalAmount,
                        category: newGoalCategory,
                        goalDuration: newGoalDuration,
                      });
                    }}
                    disabled={createGoalMutation.isPending}
                    className="flex-1"
                  >
                    {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
