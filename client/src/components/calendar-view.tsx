import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, DollarSign, Calendar, Edit2, Trash2, Filter, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Gig } from "@shared/schema";

export default function CalendarView() {
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const updateGigMutation = useMutation({
    mutationFn: async (gigData: { id: number; data: Partial<Gig> }) => {
      const response = await apiRequest("PUT", `/api/gigs/${gigData.id}`, gigData.data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Gig updated successfully!",
      });
      setEditingGig(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteGigMutation = useMutation({
    mutationFn: async (gigId: number) => {
      await apiRequest("DELETE", `/api/gigs/${gigId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Gig deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate calendar for current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

  // Create calendar grid
  const calendarDays = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    const prevMonthDay = new Date(currentYear, currentMonth, -startingDayOfWeek + i + 1);
    calendarDays.push({
      day: prevMonthDay.getDate(),
      isCurrentMonth: false,
      date: prevMonthDay,
      gigs: []
    });
  }

  // Add days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateString = date.toISOString().split('T')[0];
    const dayGigs = gigs.filter(gig => gig.date === dateString);
    
    calendarDays.push({
      day,
      isCurrentMonth: true,
      date,
      gigs: dayGigs
    });
  }

  // Filter and search gigs for the gig log
  const filteredGigs = gigs
    .filter(gig => {
      if (filterStatus !== "all" && gig.status !== filterStatus) return false;
      if (searchQuery && !gig.clientName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !gig.gigType.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending_payment":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "upcoming":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "pending_payment":
        return "Pending Payment";
      case "upcoming":
        return "Upcoming";
      default:
        return status;
    }
  };

  const handleEditGig = (gig: Gig) => {
    setEditingGig(gig);
  };

  const handleSaveEdit = (updatedData: Partial<Gig>) => {
    if (editingGig) {
      updateGigMutation.mutate({
        id: editingGig.id,
        data: updatedData,
      });
    }
  };

  const getGigIndicators = (gigs: Gig[]) => {
    const indicators = [];
    const statusCounts = { completed: 0, pending_payment: 0, upcoming: 0 };
    
    gigs.forEach(gig => {
      if (statusCounts[gig.status as keyof typeof statusCounts] < 2) {
        statusCounts[gig.status as keyof typeof statusCounts]++;
      }
    });

    for (let i = 0; i < statusCounts.completed; i++) {
      indicators.push(<div key={`completed-${i}`} className="day-indicator completed" />);
    }
    for (let i = 0; i < statusCounts.pending_payment; i++) {
      indicators.push(<div key={`pending-${i}`} className="day-indicator pending" />);
    }
    for (let i = 0; i < statusCounts.upcoming; i++) {
      indicators.push(<div key={`upcoming-${i}`} className="day-indicator upcoming" />);
    }

    return indicators;
  };

  return (
    <div className="p-4">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-success text-sm font-medium">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats?.monthlyEarnings || 0)}
                </p>
              </div>
              <DollarSign className="w-5 h-5 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/10 border-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-secondary text-sm font-medium">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.upcomingGigs || 0} Gigs
                </p>
              </div>
              <Calendar className="w-5 h-5 text-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {monthNames[currentMonth]} {currentYear}
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="mb-6">
        <CardContent className="p-4">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((calendarDay, index) => {
              const isToday = calendarDay.isCurrentMonth && calendarDay.day === now.getDate();
              
              return (
                <div 
                  key={index}
                  className={`calendar-day ${isToday ? 'today' : ''}`}
                >
                  <span className={`text-sm ${
                    calendarDay.isCurrentMonth 
                      ? isToday ? 'font-semibold text-primary' : 'font-medium text-gray-900'
                      : 'text-gray-400'
                  }`}>
                    {calendarDay.day}
                  </span>
                  {calendarDay.gigs.length > 0 && (
                    <div className="day-indicators">
                      {getGigIndicators(calendarDay.gigs)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Status Legend */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Gig Status</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-success rounded-full"></div>
              <span className="text-sm text-gray-600">Completed & Paid</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-warning rounded-full"></div>
              <span className="text-sm text-gray-600">Pending Payment</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-secondary rounded-full"></div>
              <span className="text-sm text-gray-600">Upcoming</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gig Log */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Gigs</h3>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {filteredGigs.length} gigs
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search by client or gig type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending_payment">Pending Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gigs List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredGigs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">No Gigs Found</h4>
                <p className="text-gray-600">
                  {searchQuery || filterStatus !== "all" 
                    ? "No gigs match your current filters." 
                    : "You haven't logged any gigs yet."}
                </p>
              </div>
            ) : (
              filteredGigs.map((gig) => (
                <div key={gig.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{gig.clientName}</h4>
                        <Badge className={getStatusColor(gig.status)}>
                          {getStatusLabel(gig.status)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(gig.date)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {gig.gigType.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {gig.actualPay 
                            ? formatCurrency(parseFloat(gig.actualPay))
                            : gig.expectedPay 
                              ? `${formatCurrency(parseFloat(gig.expectedPay))} (expected)`
                              : "No pay set"
                          }
                        </div>
                      </div>

                      {gig.duties && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {gig.duties}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGig(gig)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGigMutation.mutate(gig.id)}
                        disabled={deleteGigMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Gig Dialog */}
      <Dialog open={!!editingGig} onOpenChange={() => setEditingGig(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Gig</DialogTitle>
          </DialogHeader>
          {editingGig && (
            <GigEditForm
              gig={editingGig}
              onSave={handleSaveEdit}
              onCancel={() => setEditingGig(null)}
              isLoading={updateGigMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

interface GigEditFormProps {
  gig: Gig;
  onSave: (data: Partial<Gig>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function GigEditForm({ gig, onSave, onCancel, isLoading }: GigEditFormProps) {
  const [formData, setFormData] = useState({
    clientName: gig.clientName,
    gigType: gig.gigType,
    date: gig.date,
    expectedPay: gig.expectedPay || "",
    actualPay: gig.actualPay || "",
    status: gig.status,
    duties: gig.duties || "",
    paymentMethod: gig.paymentMethod || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Client Name</label>
        <Input
          value={formData.clientName}
          onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <Input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Expected Pay</label>
          <Input
            type="number"
            value={formData.expectedPay}
            onChange={(e) => setFormData({ ...formData, expectedPay: e.target.value })}
            placeholder="250"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Actual Pay</label>
          <Input
            type="number"
            value={formData.actualPay}
            onChange={(e) => setFormData({ ...formData, actualPay: e.target.value })}
            placeholder="285"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Status</label>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Duties</label>
        <textarea
          className="w-full p-2 border rounded-md resize-none h-20"
          value={formData.duties}
          onChange={(e) => setFormData({ ...formData, duties: e.target.value })}
          placeholder="Key duties and responsibilities..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
