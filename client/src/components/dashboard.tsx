import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, Car, Download, TrendingUp, Edit2, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

type TimePeriod = "monthly" | "annual";

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingGoal, setEditingGoal] = useState<"monthly" | "annual" | null>(null);
  const [goalAmount, setGoalAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

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

  const updateGoalMutation = useMutation({
    mutationFn: async (goalData: { monthlyGoal?: string; yearlyGoal?: string }) => {
      const response = await apiRequest("PUT", "/api/user", goalData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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

  // Calculate earnings based on selected period
  const getEarningsForPeriod = () => {
    if (!stats) return { earnings: 0, gigs: 0, avgPerGig: 0, period: "" };
    
    const monthlyEarnings = (stats as any).monthlyEarnings || 0;
    const completedGigs = (stats as any).completedGigs || 0;
    const avgPerGig = (stats as any).avgPerGig || 0;
    
    switch (selectedPeriod) {
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

  const currentData = getEarningsForPeriod();
  const goalTarget = selectedPeriod === "annual" 
    ? parseFloat(user?.yearlyGoal || "36000")
    : parseFloat(user?.monthlyGoal || "3000");
  const goalProgress = currentData.earnings ? (currentData.earnings / goalTarget) * 100 : 0;

  const handleEditGoal = (period: "monthly" | "annual") => {
    setEditingGoal(period);
    const currentGoal = period === "monthly" ? user?.monthlyGoal : user?.yearlyGoal;
    setGoalAmount(currentGoal || (period === "monthly" ? "3000" : "36000"));
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

    const updateData = editingGoal === "monthly" 
      ? { monthlyGoal: goalAmount }
      : { yearlyGoal: goalAmount };
    
    updateGoalMutation.mutate(updateData);
  };

  return (
    <div className="p-4">
      {/* Time Period Selector */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
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

      {/* Earnings Overview */}
      <div className="gradient-primary rounded-xl p-6 mb-6 text-white">
        <h3 className="text-sm font-medium opacity-90 mb-1">{currentData.period} Earnings</h3>
        <p className="text-3xl font-bold mb-2">
          {formatCurrency(currentData.earnings)}
        </p>
        <div className="flex items-center space-x-4 text-sm opacity-90">
          <span>{currentData.gigs} gigs completed</span>
          <span>•</span>
          <span>{formatCurrency(currentData.avgPerGig)} avg/gig</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Tax Estimate</span>
              <Receipt className="w-5 h-5 text-warning" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(((stats as any)?.taxEstimate || 0) * (selectedPeriod === "annual" ? 12 : 1))}
            </p>
            <p className="text-xs text-gray-500">23% of earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Expenses</span>
              <Car className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(((stats as any)?.totalExpenses || 0) * (selectedPeriod === "annual" ? 12 : 1))}
            </p>
            <p className="text-xs text-gray-500">Mileage + costs</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{selectedPeriod === "annual" ? "Annual" : "Monthly"} Goal</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {formatCurrency(currentData.earnings)} / {formatCurrency(goalTarget)}
              </span>
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
          <Progress value={goalProgress} className="mb-2" />
          <p className="text-sm text-gray-600">
            <span className="font-medium text-primary">
              {formatCurrency(goalTarget - currentData.earnings)} to go
            </span>
            {goalProgress >= 95 ? " - You're almost there! 🎉" : ""}
          </p>
        </CardContent>
      </Card>

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
