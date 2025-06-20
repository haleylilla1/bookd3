import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  Trash2, 
  PieChart, 
  TrendingUp, 
  DollarSign, 
  Target,
  Receipt,
  CreditCard,
  Wallet,
  Home,
  Car
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  Expense, 
  Budget, 
  ExpenseCategory, 
  Gig, 
  Goal,
  InsertExpense,
  InsertBudget 
} from "@shared/schema";

const DEFAULT_CATEGORIES = [
  {
    name: "Income",
    subcategories: ["Ambassador Gigs", "Market Analysis", "Helping John", "Other"],
    icon: DollarSign,
    color: "bg-green-500"
  },
  {
    name: "Bills",
    subcategories: ["Rent", "Insurance", "Phone", "Groceries", "Gas", "Planet Fitness", "Taxes", "Spotify"],
    icon: Home,
    color: "bg-blue-500"
  },
  {
    name: "Expenses", 
    subcategories: ["Fun", "Eating Out", "Random", "Transportation"],
    icon: Receipt,
    color: "bg-orange-500"
  },
  {
    name: "Savings",
    subcategories: ["Emergency Fund", "Retirement Fund", "Vacation"],
    icon: Target,
    color: "bg-purple-500"
  },
  {
    name: "Debt",
    subcategories: ["Credit Card", "Student Loan", "Car Payment"],
    icon: CreditCard,
    color: "bg-red-500"
  }
];

export default function BudgetTracker() {
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: customCategories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  // Merge custom categories with defaults, prioritizing custom categories
  const availableCategories = customCategories.length > 0 
    ? customCategories.map(cat => ({
        name: cat.name,
        subcategories: cat.subcategories || [],
        icon: DEFAULT_CATEGORIES.find(def => def.name.toLowerCase() === cat.name.toLowerCase())?.icon || DollarSign,
        color: DEFAULT_CATEGORIES.find(def => def.name.toLowerCase() === cat.name.toLowerCase())?.color || "bg-gray-500"
      }))
    : DEFAULT_CATEGORIES;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("overview");

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (expenseData: InsertExpense) => {
      const response = await apiRequest("POST", "/api/expenses", expenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense added successfully" });
    },
  });

  // Add budget mutation
  const addBudgetMutation = useMutation({
    mutationFn: async (budgetData: InsertBudget) => {
      const response = await apiRequest("POST", "/api/budgets", budgetData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget updated successfully" });
    },
  });

  // Calculate current month data
  const currentMonthExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() + 1 === selectedMonth && 
           expenseDate.getFullYear() === selectedYear;
  });

  const currentMonthIncome = currentMonthExpenses
    .filter(expense => expense.isIncome)
    .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

  const currentMonthExpenseAmount = currentMonthExpenses
    .filter(expense => !expense.isIncome)
    .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

  const currentMonthBudgets = budgets.filter(budget => 
    budget.month === selectedMonth && budget.year === selectedYear
  );

  const totalBudget = currentMonthBudgets.reduce((sum, budget) => 
    sum + parseFloat(budget.budgetAmount), 0
  );

  const leftToBudget = currentMonthIncome - totalBudget;

  // Calculate category breakdowns
  const categoryBreakdown = availableCategories.map(category => {
    const categoryExpenses = currentMonthExpenses.filter(expense => 
      expense.category === category.name
    );
    const totalAmount = categoryExpenses.reduce((sum, expense) => 
      sum + parseFloat(expense.amount), 0
    );
    const budget = currentMonthBudgets.find(b => b.category === category.name);
    const budgetAmount = budget ? parseFloat(budget.budgetAmount) : 0;
    
    return {
      ...category,
      totalAmount,
      budgetAmount,
      expenses: categoryExpenses,
      subcategoryBreakdown: category.subcategories.map(sub => ({
        name: sub,
        amount: categoryExpenses
          .filter(e => e.subcategory === sub)
          .reduce((sum, e) => sum + parseFloat(e.amount), 0)
      }))
    };
  });

  const ExpenseForm = ({ category, subcategory }: { category?: string; subcategory?: string }) => {
    const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      amount: "",
      category: category || "",
      subcategory: subcategory || "",
      description: "",
      isIncome: false
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addExpenseMutation.mutate({
        date: formData.date,
        amount: formData.amount,
        category: formData.category,
        subcategory: formData.subcategory,
        description: formData.description,
        isIncome: formData.isIncome,
        userId: 1, // Will be set by the server
        gigId: formData.isIncome ? gigs.find(g => g.gigType === formData.subcategory)?.id : undefined
      });
      setFormData({ ...formData, amount: "", description: "" });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Category</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map(cat => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subcategory</Label>
            <Select 
              value={formData.subcategory} 
              onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subcategory" />
              </SelectTrigger>
              <SelectContent>
                {formData.category && availableCategories
                  .find(cat => cat.name === formData.category)?.subcategories
                  .map(sub => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter description"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isIncome"
            checked={formData.isIncome}
            onChange={(e) => setFormData({ ...formData, isIncome: e.target.checked })}
          />
          <Label htmlFor="isIncome">This is income</Label>
        </div>

        <Button type="submit" disabled={addExpenseMutation.isPending}>
          {addExpenseMutation.isPending ? "Adding..." : "Add Entry"}
        </Button>
      </form>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Budget Tracker</h1>
        <div className="flex gap-4">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (
                <SelectItem key={i} value={(new Date().getFullYear() - 2 + i).toString()}>
                  {new Date().getFullYear() - 2 + i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(currentMonthIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(currentMonthExpenseAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalBudget)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Left to Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${leftToBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(leftToBudget)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="expenses">Expense Log</TabsTrigger>
          <TabsTrigger value="budget">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="goals">Goal Allocation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoryBreakdown.map((category) => {
                  const Icon = category.icon;
                  const percentage = currentMonthIncome > 0 ? (category.totalAmount / currentMonthIncome) * 100 : 0;
                  
                  return (
                    <div key={category.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${category.color} text-white`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(category.totalAmount)}</div>
                          <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Quick Add Expense */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Add Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseForm />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentMonthExpenses
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-500">{formatDate(expense.date)}</div>
                        <div>
                          <div className="font-medium">{expense.description || expense.subcategory}</div>
                          <div className="text-sm text-gray-500">
                            {expense.category} • {expense.subcategory}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${expense.isIncome ? 'text-green-600' : 'text-red-600'}`}>
                          {expense.isIncome ? '+' : '-'}{formatCurrency(parseFloat(expense.amount))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <div className="grid gap-6">
            {categoryBreakdown.map((category) => (
              <Card key={category.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <category.icon className="w-5 h-5" />
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-medium mb-2">Budget vs Actual</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Budget:</span>
                          <span className="font-bold">{formatCurrency(category.budgetAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Actual:</span>
                          <span className="font-bold">{formatCurrency(category.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Difference:</span>
                          <span className={`font-bold ${category.budgetAmount - category.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(category.budgetAmount - category.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <h4 className="font-medium mb-2">Subcategory Breakdown</h4>
                      <div className="space-y-2">
                        {category.subcategoryBreakdown.map((sub) => (
                          <div key={sub.name} className="flex justify-between">
                            <span>{sub.name}:</span>
                            <span className="font-medium">{formatCurrency(sub.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Goal Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                Goal allocation feature coming soon - will integrate with existing goals system
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}