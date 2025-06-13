import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PiggyBank, Target, DollarSign, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Gig, Goal, Allocation } from "@shared/schema";

interface GigAllocationProps {
  gig: Gig;
  isOpen: boolean;
  onClose: () => void;
}

export default function GigAllocation({ gig, isOpen, onClose }: GigAllocationProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [allocationAmount, setAllocationAmount] = useState<string>("");
  const [allocationType, setAllocationType] = useState<"goal" | "piggy_bank">("goal");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: allocations = [] } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations"],
  });

  const { data: piggyBankTotal = 0 } = useQuery({
    queryKey: ["/api/piggy-bank-total"],
  });

  const createAllocationMutation = useMutation({
    mutationFn: async (allocationData: any) => {
      const response = await apiRequest("POST", "/api/allocations", allocationData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/piggy-bank-total"] });
      toast({
        title: "Success",
        description: "Funds allocated successfully!",
      });
      setAllocationAmount("");
      setSelectedGoalId("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to allocate funds. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Calculate how much of this gig has been allocated
  const gigAllocations = allocations.filter(a => a.gigId === gig.id);
  const totalAllocated = gigAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const gigPay = parseFloat(gig.actualPay || gig.expectedPay || "0");
  const remainingAmount = gigPay - totalAllocated;

  const handleAllocate = () => {
    const amount = parseFloat(allocationAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (amount > remainingAmount) {
      toast({
        title: "Insufficient Funds",
        description: `Only ${formatCurrency(remainingAmount)} remaining from this gig.`,
        variant: "destructive",
      });
      return;
    }

    if (allocationType === "goal" && !selectedGoalId) {
      toast({
        title: "No Goal Selected",
        description: "Please select a goal to allocate funds to.",
        variant: "destructive",
      });
      return;
    }

    createAllocationMutation.mutate({
      gigId: gig.id,
      goalId: allocationType === "goal" ? parseInt(selectedGoalId) : null,
      amount: amount.toString(),
      allocationType,
    });
  };

  const getGoalProgress = (goal: Goal) => {
    const goalAllocations = allocations.filter(a => a.goalId === goal.id);
    const totalAllocatedToGoal = goalAllocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const targetAmount = parseFloat(goal.targetAmount);
    return {
      current: totalAllocatedToGoal,
      target: targetAmount,
      percentage: targetAmount > 0 ? (totalAllocatedToGoal / targetAmount) * 100 : 0
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Funds from {gig.eventName || "Event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gig Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{gig.eventName || "Event"}</h3>
                  <p className="text-sm text-gray-600">{gig.clientName}</p>
                </div>
                <Badge variant="secondary">{formatCurrency(gigPay)} total</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Allocated:</span>
                  <span className="font-medium">{formatCurrency(totalAllocated)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(remainingAmount)}</span>
                </div>
                <Progress 
                  value={gigPay > 0 ? (totalAllocated / gigPay) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Allocation Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Allocation Type</label>
              <Select value={allocationType} onValueChange={(value: "goal" | "piggy_bank") => setAllocationType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goal">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Allocate to Goal
                    </div>
                  </SelectItem>
                  <SelectItem value="piggy_bank">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="w-4 h-4" />
                      Save to Piggy Bank
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {allocationType === "goal" && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Goal</label>
                <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a goal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map((goal) => {
                      const progress = getGoalProgress(goal);
                      return (
                        <SelectItem key={goal.id} value={goal.id.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span>{goal.name}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {progress.percentage.toFixed(0)}% complete
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-9"
                  max={remainingAmount}
                />
              </div>
              <div className="flex justify-between mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllocationAmount((remainingAmount / 4).toFixed(2))}
                  className="text-xs"
                >
                  25%
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllocationAmount((remainingAmount / 2).toFixed(2))}
                  className="text-xs"
                >
                  50%
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllocationAmount(remainingAmount.toFixed(2))}
                  className="text-xs"
                >
                  All
                </Button>
              </div>
            </div>

            <Button
              onClick={handleAllocate}
              disabled={createAllocationMutation.isPending || remainingAmount <= 0}
              className="w-full"
            >
              {createAllocationMutation.isPending ? "Allocating..." : "Allocate Funds"}
            </Button>
          </div>

          {/* Goals Overview */}
          {allocationType === "goal" && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700">Your Goals</h4>
              {goals.map((goal) => {
                const progress = getGoalProgress(goal);
                const isCompleted = progress.percentage >= 100;
                
                return (
                  <Card key={goal.id} className={isCompleted ? "bg-green-50 border-green-200" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{goal.name}</span>
                          {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatCurrency(progress.current)} / {formatCurrency(progress.target)}
                        </span>
                      </div>
                      <Progress value={progress.percentage} className="h-2" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Piggy Bank Summary */}
          {allocationType === "piggy_bank" && (
            <Card className="bg-pink-50 border-pink-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <PiggyBank className="w-8 h-8 text-pink-600" />
                  <div>
                    <h4 className="font-medium">Piggy Bank</h4>
                    <p className="text-2xl font-bold text-pink-600">{formatCurrency(piggyBankTotal)}</p>
                    <p className="text-xs text-gray-600">Unallocated savings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Allocations for this Gig */}
          {gigAllocations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Current Allocations</h4>
              {gigAllocations.map((allocation) => {
                const goal = goals.find(g => g.id === allocation.goalId);
                return (
                  <div key={allocation.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <span>
                      {allocation.allocationType === "piggy_bank" ? "Piggy Bank" : goal?.name || "Unknown Goal"}
                    </span>
                    <span className="font-medium">{formatCurrency(parseFloat(allocation.amount))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}