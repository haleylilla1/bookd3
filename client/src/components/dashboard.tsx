import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Receipt, Car, Download, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
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

  const goalTarget = 3000; // This would come from user settings
  const goalProgress = stats?.monthlyEarnings ? (stats.monthlyEarnings / goalTarget) * 100 : 0;

  return (
    <div className="p-4">
      {/* Time Period Selector */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
        <Button variant="default" size="sm" className="flex-1">Monthly</Button>
        <Button variant="ghost" size="sm" className="flex-1">Weekly</Button>
        <Button variant="ghost" size="sm" className="flex-1">Annual</Button>
      </div>

      {/* Earnings Overview */}
      <div className="gradient-primary rounded-xl p-6 mb-6 text-white">
        <h3 className="text-sm font-medium opacity-90 mb-1">January Earnings</h3>
        <p className="text-3xl font-bold mb-2">
          {formatCurrency(stats?.monthlyEarnings || 0)}
        </p>
        <div className="flex items-center space-x-4 text-sm opacity-90">
          <span>{stats?.completedGigs || 0} gigs completed</span>
          <span>•</span>
          <span>{formatCurrency(stats?.avgPerGig || 0)} avg/gig</span>
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
              {formatCurrency(stats?.taxEstimate || 0)}
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
              {formatCurrency(stats?.totalExpenses || 0)}
            </p>
            <p className="text-xs text-gray-500">Mileage + costs</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Goal</h3>
            <span className="text-sm text-gray-500">
              {formatCurrency(stats?.monthlyEarnings || 0)} / {formatCurrency(goalTarget)}
            </span>
          </div>
          <Progress value={goalProgress} className="mb-2" />
          <p className="text-sm text-gray-600">
            <span className="font-medium text-primary">
              {formatCurrency(goalTarget - (stats?.monthlyEarnings || 0))} to go
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
            {stats?.topClients?.length > 0 ? (
              stats.topClients.slice(0, 3).map((client: any, index: number) => (
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
    </div>
  );
}
