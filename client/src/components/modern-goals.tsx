import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PiggyBank, Target, Plus, Edit2, Trash2, DollarSign, Calendar, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Goal, Gig, Allocation } from "@shared/schema";

export default function ModernGoals() {
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState("savings");
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editGoalName, setEditGoalName] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const { data: allocations = [] } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations"],
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const response = await apiRequest("POST", "/api/goals", goalData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal created successfully" });
      setNewGoalName("");
      setNewGoalAmount("");
      setIsNewGoalOpen(false);
    },
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: any) => {
      const response = await apiRequest("PUT", `/api/goals/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal updated successfully" });
      setEditingGoal(null);
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/goals/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal deleted successfully" });
    },
  });

  const handleCreateGoal = () => {
    if (!newGoalName.trim() || !newGoalAmount) return;

    createGoalMutation.mutate({
      name: newGoalName.trim(),
      targetAmount: newGoalAmount,
      category: newGoalCategory,
      goalDuration: "monthly",
    });
  };

  const startEditingGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditGoalName(goal.name);
    setEditGoalAmount(goal.targetAmount);
  };

  const saveGoalEdit = () => {
    if (!editingGoal || !editGoalName.trim() || !editGoalAmount) return;

    updateGoalMutation.mutate({
      id: editingGoal.id,
      name: editGoalName.trim(),
      targetAmount: editGoalAmount,
    });
  };

  const getGoalIcon = (category: string) => {
    switch (category) {
      case "savings": return <PiggyBank className="w-5 h-5 text-green-600" />;
      case "emergency": return <Target className="w-5 h-5 text-red-600" />;
      case "vacation": return <Calendar className="w-5 h-5 text-blue-600" />;
      case "purchase": return <Wallet className="w-5 h-5 text-purple-600" />;
      default: return <Target className="w-5 h-5 text-gray-600" />;
    }
  };

  const getGoalProgress = (goal: Goal) => {
    const goalAllocations = allocations.filter(a => a.goalId === goal.id);
    const totalAllocated = goalAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const targetAmount = parseFloat(goal.targetAmount);
    const progress = targetAmount > 0 ? (totalAllocated / targetAmount) * 100 : 0;
    return { totalAllocated, progress: Math.min(progress, 100) };
  };

  // Calculate available funds
  const completedGigs = gigs.filter(gig => gig.status === "completed");
  const totalEarnings = completedGigs.reduce((sum, gig) => {
    const actualPay = parseFloat(gig.actualPay || "0");
    const tips = parseFloat(gig.tips || "0");
    return sum + actualPay + tips;
  }, 0);
  
  const totalAllocated = allocations.reduce((sum, allocation) => 
    sum + parseFloat(allocation.amount || "0"), 0);
  const availableFunds = totalEarnings - totalAllocated;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Goals</h1>
          <p className="text-gray-600 mt-1">Track your progress and reach your financial targets</p>
        </div>
        <Dialog open={isNewGoalOpen} onOpenChange={setIsNewGoalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6">
              <Plus className="w-4 h-4 mr-2" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goalName">Goal Name</Label>
                <Input
                  id="goalName"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="e.g., Emergency Fund, Vacation"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalAmount">Target Amount</Label>
                <Input
                  id="goalAmount"
                  type="number"
                  step="0.01"
                  value={newGoalAmount}
                  onChange={(e) => setNewGoalAmount(e.target.value)}
                  placeholder="0.00"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalCategory">Category</Label>
                <Select value={newGoalCategory} onValueChange={setNewGoalCategory}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="emergency">Emergency Fund</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="purchase">Major Purchase</SelectItem>
                    <SelectItem value="debt">Debt Payment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleCreateGoal}
                  disabled={!newGoalName || !newGoalAmount || createGoalMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                </Button>
                <Button variant="outline" onClick={() => setIsNewGoalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Available Funds</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(availableFunds)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Active Goals</p>
                <p className="text-2xl font-bold text-blue-900">{goals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-700 font-medium">Total Allocated</p>
                <p className="text-2xl font-bold text-purple-900">{formatCurrency(totalAllocated)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      {goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const { totalAllocated, progress } = getGoalProgress(goal);
            const targetAmount = parseFloat(goal.targetAmount);
            const isCompleted = progress >= 100;
            const isEditing = editingGoal?.id === goal.id;

            return (
              <Card key={goal.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getGoalIcon(goal.category)}
                      <div>
                        {isEditing ? (
                          <Input
                            value={editGoalName}
                            onChange={(e) => setEditGoalName(e.target.value)}
                            className="font-semibold text-lg mb-2"
                          />
                        ) : (
                          <h3 className="font-semibold text-lg text-gray-900">{goal.name}</h3>
                        )}
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editGoalAmount}
                            onChange={(e) => setEditGoalAmount(e.target.value)}
                            placeholder="Target amount"
                          />
                        ) : (
                          <p className="text-sm text-gray-600">Target: {formatCurrency(targetAmount)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={saveGoalEdit}
                            disabled={updateGoalMutation.isPending}
                            className="h-8 w-8 p-0"
                          >
                            ✓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingGoal(null)}
                            className="h-8 w-8 p-0"
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
                            className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteGoalMutation.mutate(goal.id)}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(totalAllocated)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    
                    <Progress 
                      value={progress} 
                      className="h-3"
                    />
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Saved</span>
                      <span>{formatCurrency(targetAmount - totalAllocated)} remaining</span>
                    </div>

                    {isCompleted && (
                      <div className="mt-3 p-2 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 font-medium text-center">
                          🎉 Goal Completed!
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No goals yet</h3>
            <p className="text-gray-600 mb-6">Create your first financial goal to start tracking your progress</p>
            <Button 
              onClick={() => setIsNewGoalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}