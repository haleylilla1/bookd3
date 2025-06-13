import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PiggyBank, Home, ShirtIcon, Plus, GripVertical, Check, Lightbulb, Edit2, Trash2, Target, DollarSign, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import GigAllocation from "./gig-allocation";
import type { Gig, Goal, Allocation } from "@shared/schema";

export default function GoalTracker() {
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState("savings");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalName, setEditGoalName] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const [allocatingGig, setAllocatingGig] = useState<Gig | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
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
    mutationFn: async (goalData: { category: string; name: string; targetAmount: string }) => {
      const response = await apiRequest("POST", "/api/goals", {
        category: goalData.category,
        name: goalData.name,
        targetAmount: goalData.targetAmount,
        currentAmount: "0",
        isCompleted: false,
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
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create goal. Please try again.",
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update goal. Please try again.",
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete goal. Please try again.",
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

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Gig-to-Goal Tracker</h2>

      {/* Recent Earnings */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Earnings to Allocate</h3>
          {completedGigs.slice(-3).length > 0 ? (
            <div className="space-y-3">
              {completedGigs.slice(-3).reverse().map((gig) => (
                <div 
                  key={gig.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-move"
                >
                  <div className="flex items-center space-x-3">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {gig.eventName || "Event"} - {gig.clientName}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(gig.date).toLocaleDateString()} • Available for allocation</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(parseFloat(gig.actualPay || "0"))}
                  </span>
                </div>
              ))}
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Total Unallocated</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(unallocatedAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Minus {taxPercentage}% taxes ({formatCurrency(suggestedTaxes)})</span>
                  <span className={`font-semibold ${unallocatedAfterTaxes < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(unallocatedAfterTaxes)} available
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <PiggyBank className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No recent earnings to allocate</p>
              <p className="text-sm">Complete some gigs to start allocating funds</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Earnings to Allocate */}
      {recentGigs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Earnings to Allocate</h3>
            <div className="space-y-3">
              {recentGigs.map((gig) => {
                const { totalAllocated, remainingAmount, gigPay } = getGigAllocationStatus(gig);
                const allocationProgress = gigPay > 0 ? (totalAllocated / gigPay) * 100 : 0;
                
                return (
                  <div key={gig.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-gray-900">{gig.clientName}</h4>
                          <Badge variant="secondary">{formatCurrency(gigPay)}</Badge>
                          {remainingAmount <= 0 && (
                            <Badge className="bg-green-100 text-green-800">Fully Allocated</Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(gig.date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            {remainingAmount > 0 ? formatCurrency(remainingAmount) : "Fully allocated"}
                          </div>
                        </div>

                        {/* Allocation Progress */}
                        <div className="mb-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Allocated</span>
                            <span className="font-medium">
                              {formatCurrency(totalAllocated)} / {formatCurrency(gigPay)}
                            </span>
                          </div>
                          <Progress value={allocationProgress} className="h-1.5" />
                        </div>
                      </div>

                      <div className="ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllocatingGig(gig)}
                          disabled={remainingAmount <= 0}
                        >
                          <Target className="w-4 h-4 mr-2" />
                          Allocate
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      <div className="space-y-4">
        {goals.map((goal) => {
          // Calculate progress from allocations instead of currentAmount
          const goalAllocations = allocations.filter(a => a.goalId === goal.id);
          const totalAllocatedToGoal = goalAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
          const targetAmount = parseFloat(goal.targetAmount);
          const progress = targetAmount > 0 ? (totalAllocatedToGoal / targetAmount) * 100 : 0;
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
                          <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                          <p className="text-sm text-gray-500">
                            Goal: {formatCurrency(parseFloat(goal.targetAmount || "0"))}
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
                      <span className="text-xs text-blue-600">
                        {goalAllocations.length} allocation{goalAllocations.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {isCompleted ? (
                  <div className="flex items-center justify-center p-2 bg-success/5 rounded-lg">
                    <Check className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm font-medium text-success">Goal Completed ✓</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-success/5 rounded-lg">
                      <span className="text-sm text-gray-700">Recent allocation</span>
                      <span className="text-sm font-medium text-success">+$0</span>
                    </div>
                  </div>
                )}
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
                  placeholder="e.g. Emergency Fund, New Equipment"
                />
              </div>
              <div>
                <Label htmlFor="goal-amount">Target Amount</Label>
                <Input
                  id="goal-amount"
                  type="number"
                  value={newGoalAmount}
                  onChange={(e) => setNewGoalAmount(e.target.value)}
                  placeholder="1000"
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
              <Button
                onClick={() => createGoalMutation.mutate({
                  category: newGoalCategory,
                  name: newGoalName,
                  targetAmount: newGoalAmount,
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
      </div>
    </div>
  );
}
