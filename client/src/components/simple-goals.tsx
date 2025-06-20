import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, DollarSign, Calendar, Edit2, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Goal, Gig, Allocation } from "@shared/schema";

export default function SimpleGoals() {
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalAmount, setNewGoalAmount] = useState("");
  const [newGoalDuration, setNewGoalDuration] = useState("monthly");
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [allocationAmount, setAllocationAmount] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [editAllocationAmount, setEditAllocationAmount] = useState("");
  
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
    retry: false,
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

  // Create allocation mutation
  const createAllocationMutation = useMutation({
    mutationFn: async (allocationData: any) => {
      const response = await apiRequest("POST", "/api/allocations", allocationData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Funds allocated successfully" });
      setSelectedGig(null);
      setSelectedGoal(null);
      setAllocationAmount("");
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/goals/${id}`);
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
      category: "savings",
      goalDuration: newGoalDuration,
    });
  };

  const handleAllocate = () => {
    if (!selectedGig || !selectedGoal || !allocationAmount) return;

    createAllocationMutation.mutate({
      gigId: selectedGig.id,
      goalId: selectedGoal.id,
      amount: allocationAmount,
      allocationType: "goal"
    });
  };

  // Update allocation mutation
  const updateAllocationMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: string }) => {
      const response = await apiRequest("PUT", `/api/allocations/${id}`, { amount });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Allocation updated successfully" });
      setEditingAllocation(null);
      setEditAllocationAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Error updating allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete allocation mutation
  const deleteAllocationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/allocations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Allocation deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting allocation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditAllocation = (allocation: Allocation) => {
    setEditingAllocation(allocation);
    setEditAllocationAmount(allocation.amount);
  };

  const handleUpdateAllocation = () => {
    if (!editingAllocation || !editAllocationAmount) return;
    updateAllocationMutation.mutate({
      id: editingAllocation.id,
      amount: editAllocationAmount
    });
  };

  const getGoalProgress = (goal: Goal) => {
    const goalAllocations = allocations.filter(a => a.goalId === goal.id);
    const totalAllocated = goalAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const targetAmount = parseFloat(goal.targetAmount);
    const progress = targetAmount > 0 ? (totalAllocated / targetAmount) * 100 : 0;
    return { totalAllocated, progress: Math.min(progress, 100) };
  };

  // Get available gigs (completed with pay)
  const availableGigs = gigs.filter(gig => 
    gig.status === "completed" && (gig.actualPay || gig.expectedPay)
  );

  // Calculate monthly earnings and available after tax
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const currentMonthGigs = gigs.filter(gig => {
    const gigDate = new Date(gig.date);
    return gigDate.getMonth() + 1 === currentMonth && 
           gigDate.getFullYear() === currentYear &&
           gig.status === "completed";
  });

  const totalMonthlyEarnings = currentMonthGigs.reduce((sum, gig) => {
    const pay = parseFloat(gig.actualPay || gig.expectedPay || "0");
    const tips = parseFloat(gig.tips || "0");
    return sum + pay + tips;
  }, 0);

  const totalAllocatedThisMonth = allocations
    .filter(allocation => {
      const gig = gigs.find(g => g.id === allocation.gigId);
      if (!gig) return false;
      const gigDate = new Date(gig.date);
      return gigDate.getMonth() + 1 === currentMonth && 
             gigDate.getFullYear() === currentYear;
    })
    .reduce((sum, allocation) => sum + parseFloat(allocation.amount), 0);

  // Calculate after-tax amount (using 23% default tax rate)
  const taxRate = 0.23;
  const afterTaxEarnings = totalMonthlyEarnings * (1 - taxRate);
  const availableToAllocate = afterTaxEarnings - totalAllocatedThisMonth;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Monthly Earnings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            This Month's Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Total Earned</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(totalMonthlyEarnings)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">After Tax (23%)</p>
              <p className="text-xl font-semibold text-green-600">{formatCurrency(afterTaxEarnings)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Allocated</p>
              <p className="text-xl font-semibold text-blue-600">{formatCurrency(totalAllocatedThisMonth)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Available</p>
              <p className={`text-xl font-semibold ${availableToAllocate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(availableToAllocate)}
              </p>
            </div>
          </div>
          {availableToAllocate < 0 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                You've allocated more than your after-tax earnings this month.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Goals</h1>
          <p className="text-gray-600 text-sm mt-1">Allocate gig earnings to your monthly and yearly goals</p>
        </div>
        <Dialog open={isNewGoalOpen} onOpenChange={setIsNewGoalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Goal Name</Label>
                <Input
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="Emergency Fund"
                />
              </div>
              <div>
                <Label>Target Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newGoalAmount}
                  onChange={(e) => setNewGoalAmount(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div>
                <Label>Time Period</Label>
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
              <div className="flex gap-3">
                <Button
                  onClick={handleCreateGoal}
                  disabled={!newGoalName || !newGoalAmount || createGoalMutation.isPending}
                  className="flex-1"
                >
                  Create Goal
                </Button>
                <Button variant="outline" onClick={() => setIsNewGoalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals List */}
      {goals.length > 0 ? (
        <div className="space-y-4">
          {goals.map((goal) => {
            const { totalAllocated, progress } = getGoalProgress(goal);
            const targetAmount = parseFloat(goal.targetAmount);
            const remaining = targetAmount - totalAllocated;
            const isCompleted = progress >= 100;

            return (
              <Card key={goal.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Target className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Target: {formatCurrency(targetAmount)}</span>
                          <Badge variant={goal.goalDuration === "monthly" ? "default" : "secondary"}>
                            {goal.goalDuration === "monthly" ? "Monthly" : "Yearly"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGoalMutation.mutate(goal.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Progress</span>
                      <span className="text-gray-600">{progress.toFixed(1)}%</span>
                    </div>
                    
                    <Progress value={progress} className="h-3" />
                    
                    <div className="flex justify-between text-sm">
                      <span>Saved: <span className="font-medium">{formatCurrency(totalAllocated)}</span></span>
                      <span>Remaining: <span className="font-medium">{formatCurrency(remaining)}</span></span>
                    </div>

                    {/* Show recent allocations for this goal */}
                    {allocations.filter(a => a.goalId === goal.id).length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="text-xs font-medium text-gray-700 mb-2">Recent allocations:</div>
                        <div className="space-y-1">
                          {allocations
                            .filter(a => a.goalId === goal.id)
                            .slice(-3)
                            .map((allocation) => {
                              const gig = gigs.find(g => g.id === allocation.gigId);
                              return (
                                <div key={allocation.id} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded">
                                  <span>
                                    {gig ? `${gig.clientName}` : 'Unknown gig'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{formatCurrency(parseFloat(allocation.amount))}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditAllocation(allocation)}
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteAllocationMutation.mutate(allocation.id)}
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {isCompleted && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700 font-medium text-center">
                          🎉 Goal completed!
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
        <Card>
          <CardContent className="text-center py-12">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No goals yet</h3>
            <p className="text-gray-600 mb-6">Create your first financial goal to start saving</p>
            <Button onClick={() => setIsNewGoalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Allocation Section */}
      {availableGigs.length > 0 && goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Allocate Gig Earnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm">Select Gig</Label>
                <Select 
                  value={selectedGig?.id.toString() || ""} 
                  onValueChange={(value) => {
                    const gig = availableGigs.find(g => g.id === parseInt(value));
                    setSelectedGig(gig || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose gig..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGigs.map(gig => {
                      const gigPay = parseFloat(gig.actualPay || gig.expectedPay || "0");
                      const tips = parseFloat(gig.tips || "0");
                      const total = gigPay + tips;
                      
                      return (
                        <SelectItem key={gig.id} value={gig.id.toString()}>
                          <div className="flex justify-between w-full">
                            <span className="truncate">{gig.clientName}</span>
                            <span className="ml-2 font-medium">{formatCurrency(total)}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Select Goal</Label>
                <Select 
                  value={selectedGoal?.id.toString() || ""} 
                  onValueChange={(value) => {
                    const goal = goals.find(g => g.id === parseInt(value));
                    setSelectedGoal(goal || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose goal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map(goal => (
                      <SelectItem key={goal.id} value={goal.id.toString()}>
                        {goal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Button
              onClick={handleAllocate}
              disabled={!selectedGig || !selectedGoal || !allocationAmount || createAllocationMutation.isPending}
              className="w-full"
            >
              {createAllocationMutation.isPending ? "Allocating..." : "Allocate Funds"}
            </Button>
            
            {/* Show gig payment info */}
            {selectedGig && (
              <div className="text-sm text-gray-600 text-center">
                Total available: {formatCurrency(
                  parseFloat(selectedGig.actualPay || selectedGig.expectedPay || "0") + 
                  parseFloat(selectedGig.tips || "0")
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Allocation Dialog */}
      <Dialog open={!!editingAllocation} onOpenChange={() => setEditingAllocation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Allocation</DialogTitle>
          </DialogHeader>
          {editingAllocation && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Editing allocation from {gigs.find(g => g.id === editingAllocation.gigId)?.clientName || 'Unknown gig'} 
                to {goals.find(g => g.id === editingAllocation.goalId)?.name || 'Unknown goal'}
              </div>
              
              <div>
                <Label>New Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editAllocationAmount}
                  onChange={(e) => setEditAllocationAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateAllocation}
                  disabled={!editAllocationAmount || updateAllocationMutation.isPending}
                  className="flex-1"
                >
                  {updateAllocationMutation.isPending ? "Updating..." : "Update"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingAllocation(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}