import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Filter, Edit, Trash2, Plus, CheckCircle, XCircle } from "lucide-react";
import type { Expense, Gig } from "@shared/schema";
import { AddExpenseForm } from "./add-expense-form";

// Category mapping for display
const EXPENSE_CATEGORIES = [
  { ui: "Promo & Marketing", irs: "Advertising" },
  { ui: "Car or Mileage", irs: "Car and Truck Expenses" },
  { ui: "Platform or Payment Fees", irs: "Commissions and Fees" },
  { ui: "Hired Help (Assistants, DJs, etc.)", irs: "Contract Labor" },
  { ui: "Big Gear or Equipment (Over $500)", irs: "Depreciation" },
  { ui: "Business Insurance", irs: "Insurance (other than health)" },
  { ui: "Pro Services (Accounting, Legal)", irs: "Legal and Professional Services" },
  { ui: "Office & Admin Stuff", irs: "Office Expenses" },
  { ui: "Rented Gear or Spaces", irs: "Rent or Lease" },
  { ui: "Fixing or Cleaning Gear", irs: "Repairs and Maintenance" },
  { ui: "Event Supplies", irs: "Supplies" },
  { ui: "Travel (Out-of-Town Gigs)", irs: "Travel" },
  { ui: "Work Meals", irs: "Meals" },
  { ui: "Phone/Wi-Fi (Work Portion)", irs: "Utilities" },
  { ui: "Other Work Stuff", irs: "Other Expenses" },
];

export default function ExpensesTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedGig, setSelectedGig] = useState("all");
  const [reimbursedFilter, setReimbursedFilter] = useState("all");
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Fetch gigs for filtering
  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      return apiRequest("DELETE", `/api/expenses/${expenseId}`);
    },
    onSuccess: () => {
      toast({
        title: "Expense Deleted",
        description: "The expense has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = 
      expense.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || expense.categoryUi === selectedCategory;
    
    const matchesGig = selectedGig === "all" || 
      (selectedGig === "none" && !expense.linkedGigId) ||
      expense.linkedGigId?.toString() === selectedGig;
    
    const matchesReimbursed = reimbursedFilter === "all" ||
      (reimbursedFilter === "reimbursed" && expense.isReimbursed) ||
      (reimbursedFilter === "unreimbursed" && !expense.isReimbursed);

    return matchesSearch && matchesCategory && matchesGig && matchesReimbursed;
  });

  // Calculate totals
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  const reimbursedExpenses = filteredExpenses
    .filter(expense => expense.isReimbursed)
    .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  const unreimbursedExpenses = totalExpenses - reimbursedExpenses;

  // Get gig name by ID
  const getGigName = (gigId: number | null) => {
    if (!gigId) return "General Business";
    const gig = gigs.find(g => g.id === gigId);
    return gig ? `${gig.eventName} - ${gig.clientName}` : "Unknown Gig";
  };

  const handleDeleteExpense = (expenseId: number) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteExpenseMutation.mutate(expenseId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Business Expenses</h2>
          <p className="text-gray-600 dark:text-gray-400">Track and manage your business expenses</p>
        </div>
        <Button onClick={() => setShowAddExpenseForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totalExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Reimbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${reimbursedExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Tax Deductible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${unreimbursedExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search vendor or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category.ui} value={category.ui}>
                    {category.ui}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Gig Filter */}
            <Select value={selectedGig} onValueChange={setSelectedGig}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by gig" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Gigs</SelectItem>
                <SelectItem value="none">General Business</SelectItem>
                {gigs.map((gig) => (
                  <SelectItem key={gig.id} value={gig.id.toString()}>
                    {gig.eventName} - {gig.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reimbursed Filter */}
            <Select value={reimbursedFilter} onValueChange={setReimbursedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by reimbursement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expenses</SelectItem>
                <SelectItem value="reimbursed">Reimbursed Only</SelectItem>
                <SelectItem value="unreimbursed">Tax Deductible Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className="pt-6">
          {expensesLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading expenses...</div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                {expenses.length === 0 ? "No expenses recorded yet" : "No expenses match your filters"}
              </div>
              <Button onClick={() => setShowAddExpenseForm(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Gig</TableHead>
                    <TableHead>Reimbursed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {new Date(expense.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${parseFloat(expense.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.categoryUi}</Badge>
                      </TableCell>
                      <TableCell>{expense.vendor}</TableCell>
                      <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {getGigName(expense.linkedGigId)}
                      </TableCell>
                      <TableCell>
                        {expense.isReimbursed ? (
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDeleteExpense(expense.id)}
                            disabled={deleteExpenseMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Form Modal */}
      <AddExpenseForm
        isOpen={showAddExpenseForm}
        onClose={() => setShowAddExpenseForm(false)}
      />
    </div>
  );
}