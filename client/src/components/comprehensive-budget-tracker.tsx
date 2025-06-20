import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Plus, Edit2, Trash2, Calendar, TrendingUp, TrendingDown, DollarSign, Target, PiggyBank } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Gig, Budget, Expense, ExpenseCategory } from "@shared/schema";

interface BudgetData {
  id: number;
  category: string;
  subcategory?: string;
  budgetAmount: number;
  actualAmount: number;
  type: "income" | "expense" | "bill" | "debt";
  frequency: "weekly" | "monthly" | "yearly";
}

interface TransactionEntry {
  date: string;
  amount: number;
  category: string;
  subcategory: string;
  description: string;
  type: "income" | "expense";
}

export default function ComprehensiveBudgetTracker() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<TransactionEntry>>({
    type: "expense",
    category: "",
    subcategory: "",
    amount: 0,
    description: "",
    date: new Date().toISOString().split('T')[0]
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data
  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  // Process budget data for current month
  const currentMonthData = useMemo(() => {
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    
    // Get gigs (income) for the month
    const monthGigs = gigs.filter(gig => {
      const gigDate = new Date(gig.date);
      return gigDate >= monthStart && gigDate <= monthEnd && gig.actualPay;
    });

    // Get expenses for the month
    const monthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= monthStart && expenseDate <= monthEnd;
    });

    // Calculate income
    const totalIncome = monthGigs.reduce((sum, gig) => {
      const actualPay = parseFloat(gig.actualPay || "0");
      const tips = parseFloat(gig.tips || "0");
      return sum + actualPay + tips;
    }, 0);

    // Group expenses by category
    const expensesByCategory = monthExpenses.reduce((acc, expense) => {
      const category = expense.category || "Other";
      
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += parseFloat(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    // Get budget targets for the month
    const monthBudgets = budgets.filter(budget => 
      budget.month === selectedMonth + 1 && budget.year === selectedYear
    );

    return {
      income: {
        budget: monthBudgets.find(b => b.category === "Income")?.budgetAmount || "0",
        actual: totalIncome
      },
      expenses: expensesByCategory,
      budgets: monthBudgets,
      totalExpenses: Object.values(expensesByCategory).reduce((sum, amount) => sum + amount, 0)
    };
  }, [gigs, expenses, categories, budgets, selectedMonth, selectedYear]);

  // Calculate left to budget
  const leftToBudget = currentMonthData.income.actual - currentMonthData.totalExpenses;

  // Prepare chart data
  const expenseChartData = Object.entries(currentMonthData.expenses).map(([category, amount]) => ({
    name: category,
    value: amount,
    color: getColorForCategory(category)
  }));

  const budgetVsActualData = categories.map(category => {
    const budgetAmount = parseFloat(
      currentMonthData.budgets.find(b => b.category === category.name)?.budgetAmount || "0"
    );
    const actualAmount = currentMonthData.expenses[category.name] || 0;
    
    return {
      category: category.name,
      budget: budgetAmount,
      actual: actualAmount,
      percentage: budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0
    };
  }).filter(item => item.budget > 0 || item.actual > 0);

  function getColorForCategory(category: string): string {
    const colors = {
      "Rent": "#8B5CF6",
      "Food": "#06B6D4", 
      "Transportation": "#F59E0B",
      "Bills": "#EF4444",
      "Entertainment": "#10B981",
      "Shopping": "#F97316",
      "Other": "#6B7280"
    };
    return colors[category as keyof typeof colors] || "#6B7280";
  }

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (transaction: Partial<TransactionEntry>) => {
      if (transaction.type === "expense") {
        const expenseData = {
          amount: transaction.amount?.toString() || "0",
          description: transaction.description || "",
          date: transaction.date || new Date().toISOString().split('T')[0],
          category: transaction.category || "Other",
          subcategory: transaction.subcategory || null,
          isIncome: false
        };
        return await apiRequest("POST", "/api/expenses", expenseData);
      }
      // Handle income separately if needed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Transaction added successfully" });
      setIsAddingTransaction(false);
      setNewTransaction({
        type: "expense",
        category: "",
        subcategory: "",
        amount: 0,
        description: "",
        date: new Date().toISOString().split('T')[0]
      });
    }
  });

  const handleAddTransaction = () => {
    createTransactionMutation.mutate(newTransaction);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget Tracker</h1>
          <p className="text-gray-600 mt-1">
            {monthNames[selectedMonth]} {selectedYear} Overview
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isAddingTransaction} onOpenChange={setIsAddingTransaction}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select 
                      value={newTransaction.type} 
                      onValueChange={(value: "income" | "expense") => 
                        setNewTransaction(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newTransaction.amount || ""}
                      onChange={(e) => 
                        setNewTransaction(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Category</Label>
                  <Select 
                    value={newTransaction.category} 
                    onValueChange={(value) => 
                      setNewTransaction(prev => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description</Label>
                  <Input
                    value={newTransaction.description || ""}
                    onChange={(e) => 
                      setNewTransaction(prev => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Transaction description"
                  />
                </div>

                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newTransaction.date || ""}
                    onChange={(e) => 
                      setNewTransaction(prev => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleAddTransaction}
                    disabled={createTransactionMutation.isPending}
                    className="flex-1"
                  >
                    {createTransactionMutation.isPending ? "Adding..." : "Add Transaction"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingTransaction(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Total Income</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(currentMonthData.income.actual)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600 rounded-lg">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-red-700 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-red-900">
                  {formatCurrency(currentMonthData.totalExpenses)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Left to Budget</p>
                <p className={`text-2xl font-bold ${leftToBudget >= 0 ? 'text-blue-900' : 'text-red-900'}`}>
                  {formatCurrency(leftToBudget)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-700 font-medium">Budget Usage</p>
                <p className="text-2xl font-bold text-purple-900">
                  {currentMonthData.income.actual > 0 ? 
                    Math.round((currentMonthData.totalExpenses / currentMonthData.income.actual) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="budget-vs-actual">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {expenseChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Spending Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(currentMonthData.expenses)
                    .sort(([,a], [,b]) => b - a)
                    .map(([category, amount]) => {
                      const percentage = currentMonthData.totalExpenses > 0 ? 
                        (amount / currentMonthData.totalExpenses) * 100 : 0;
                      
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{category}</span>
                            <div className="text-right">
                              <div className="font-bold">{formatCurrency(amount)}</div>
                              <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="budget-vs-actual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget vs Actual Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsActualData}>
                    <XAxis dataKey="category" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="budget" fill="#3B82F6" name="Budget" />
                    <Bar dataKey="actual" fill="#EF4444" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Budget Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {budgetVsActualData.map((item) => (
              <Card key={item.category}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold">{item.category}</h3>
                    <Badge variant={item.percentage > 100 ? "destructive" : item.percentage > 80 ? "secondary" : "default"}>
                      {item.percentage.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Budget:</span>
                      <span className="font-medium">{formatCurrency(item.budget)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Actual:</span>
                      <span className="font-medium">{formatCurrency(item.actual)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Remaining:</span>
                      <span className={`font-medium ${item.budget - item.actual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.budget - item.actual)}
                      </span>
                    </div>
                  </div>
                  <Progress value={Math.min(item.percentage, 100)} className="mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expenses
                  .filter(expense => {
                    const expenseDate = new Date(expense.date);
                    const monthStart = new Date(selectedYear, selectedMonth, 1);
                    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
                    return expenseDate >= monthStart && expenseDate <= monthEnd;
                  })
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((expense) => {
                    const category = expense.category;
                    return (
                      <div key={expense.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">{expense.description || 'Expense'}</div>
                            <div className="text-sm text-gray-500">
                              {category || 'Other'} • {formatDate(expense.date)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">-{formatCurrency(parseFloat(expense.amount))}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Monthly trend analysis coming soon...</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Insights & Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leftToBudget < 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800">Over Budget Alert</h4>
                      <p className="text-sm text-red-600 mt-1">
                        You're {formatCurrency(Math.abs(leftToBudget))} over budget this month.
                      </p>
                    </div>
                  )}
                  
                  {budgetVsActualData.some(item => item.percentage > 100) && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800">Category Over Budget</h4>
                      <p className="text-sm text-yellow-600 mt-1">
                        Some categories are exceeding their budget limits.
                      </p>
                    </div>
                  )}
                  
                  {leftToBudget > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-800">Great Job!</h4>
                      <p className="text-sm text-green-600 mt-1">
                        You have {formatCurrency(leftToBudget)} left in your budget this month.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}