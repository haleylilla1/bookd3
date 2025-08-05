/**
 * Empty State Components
 * Graceful handling of empty data scenarios
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, DollarSign, BarChart3, Plus } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
          {icon || <FileText className="h-6 w-6 text-muted-foreground" />}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      {actionLabel && onAction && (
        <CardContent className="text-center">
          <Button onClick={onAction} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// Specific empty states for different sections
export function EmptyGigs({ onAddGig }: { onAddGig?: () => void }) {
  return (
    <EmptyState
      icon={<Calendar className="h-6 w-6 text-muted-foreground" />}
      title="No gigs yet"
      description="Start by adding your first gig to track your work and earnings."
      actionLabel="Add First Gig"
      onAction={onAddGig}
    />
  );
}

export function EmptyExpenses({ onAddExpense }: { onAddExpense?: () => void }) {
  return (
    <EmptyState
      icon={<DollarSign className="h-6 w-6 text-muted-foreground" />}
      title="No expenses recorded"
      description="Track your business expenses to maximize tax deductions."
      actionLabel="Add First Expense"
      onAction={onAddExpense}
    />
  );
}

export function EmptyReports() {
  return (
    <EmptyState
      icon={<BarChart3 className="h-6 w-6 text-muted-foreground" />}
      title="No data for reports"
      description="Add some gigs and expenses to generate comprehensive reports for tax season."
    />
  );
}

export function EmptyDashboard({ onAddGig }: { onAddGig?: () => void }) {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={<Calendar className="h-6 w-6 text-muted-foreground" />}
        title="Welcome to Bookd!"
        description="Track your gigs, expenses, and earnings in one place. Start by adding your first gig."
        actionLabel="Add Your First Gig"
        onAction={onAddGig}
      />
    </div>
  );
}

// Error state component
export function ErrorState({ 
  title = "Something went wrong", 
  description = "We encountered an error while loading your data.", 
  onRetry 
}: { 
  title?: string; 
  description?: string; 
  onRetry?: () => void; 
}) {
  return (
    <Card className="border-destructive/50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
          <FileText className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-xl text-destructive">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      {onRetry && (
        <CardContent className="text-center">
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// Loading state component
export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}