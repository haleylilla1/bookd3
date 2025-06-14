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
import { formatMonth, addMonths } from "@/lib/dateUtils";

export default function CalendarView() {
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayGigs, setShowDayGigs] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
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

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start on Sunday
    
    const days = [];
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41); // 6 weeks worth of days
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days;
  };

  // Get gigs for a specific date
  const getGigsForDate = (date: Date) => {
    if (!gigs) return [];
    const dateString = date.toISOString().split('T')[0];
    return gigs.filter(gig => gig.date === dateString);
  };

  // Handle day click
  const handleDayClick = (date: Date) => {
    const dayGigs = getGigsForDate(date);
    if (dayGigs.length > 0) {
      setSelectedDate(date);
      setShowDayGigs(true);
    }
  };

  // Navigation functions
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      return direction === "prev" ? addMonths(prev, -1) : addMonths(prev, 1);
    });
  };

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

  // Filter and search gigs for the gig log
  const filteredGigs = gigs
    .filter(gig => {
      if (filterStatus !== "all" && gig.status !== filterStatus) return false;
      if (searchQuery && 
          !gig.eventName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !gig.clientName.toLowerCase().includes(searchQuery.toLowerCase()) && 
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

  return (
    <div className="p-4">
      {/* View Mode Toggle */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
        <Button 
          variant={viewMode === "calendar" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => setViewMode("calendar")}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Calendar
        </Button>
        <Button 
          variant={viewMode === "list" ? "default" : "ghost"} 
          size="sm" 
          className="flex-1"
          onClick={() => setViewMode("list")}
        >
          <Filter className="w-4 h-4 mr-2" />
          List View
        </Button>
      </div>

      {viewMode === "calendar" ? (
        <>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-3 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatMonth(currentDate)}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="text-xs text-blue-600 p-0 h-auto"
              >
                Back to current month
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <Card className="mb-6">
            <CardContent className="p-4">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-3">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((date, index) => {
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dayGigs = getGigsForDate(date);
                  const hasGigs = dayGigs.length > 0;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleDayClick(date)}
                      className={`
                        aspect-square p-2 text-sm rounded-lg relative transition-colors min-h-[60px]
                        ${isCurrentMonth 
                          ? hasGigs 
                            ? 'bg-primary text-white hover:bg-primary/80 cursor-pointer' 
                            : 'text-gray-900 hover:bg-gray-100'
                          : 'text-gray-300 hover:bg-gray-50'
                        }
                        ${isToday && !hasGigs ? 'ring-2 ring-primary ring-offset-1' : ''}
                        ${!hasGigs ? 'cursor-default' : ''}
                      `}
                      disabled={!hasGigs}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span className={`${isToday && hasGigs ? 'font-bold' : ''} mb-1`}>
                          {date.getDate()}
                        </span>
                        {hasGigs && (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {dayGigs.slice(0, 3).map((gig, gigIndex) => (
                              <div 
                                key={gigIndex}
                                className={`w-2 h-2 rounded-full ${
                                  gig.status === 'completed' ? 'bg-green-300' :
                                  gig.status === 'upcoming' ? 'bg-blue-300' :
                                  'bg-orange-300'
                                }`}
                              />
                            ))}
                            {dayGigs.length > 3 && (
                              <div className="text-xs text-white/80">+{dayGigs.length - 3}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-4 text-center text-xs text-gray-500">
                Click on highlighted dates to see gig details
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* List View - Quick Stats Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="bg-success/10 border-success/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-success text-sm font-medium">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency((stats as any)?.monthlyEarnings || 0)}
                    </p>
                  </div>
                  <DollarSign className="w-5 h-5 text-success" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Upcoming</p>
                    <p className="text-2xl font-bold text-gray-900">{(stats as any)?.upcomingGigs || 0}</p>
                  </div>
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search gigs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending_payment">Pending Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gig List */}
          <div className="space-y-3">
            {filteredGigs.length > 0 ? (
              filteredGigs.map((gig) => (
                <Card key={gig.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {gig.eventName || "Unnamed Event"}
                          </h3>
                          <Badge className={getStatusColor(gig.status)}>
                            {getStatusLabel(gig.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{gig.clientName}</span>
                          <span>•</span>
                          <span>{gig.gigType}</span>
                          <span>•</span>
                          <span>{formatDate(gig.date)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditGig(gig)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGigMutation.mutate(gig.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Expected Pay</span>
                        <div className="font-medium text-green-600">
                          {formatCurrency(parseFloat(gig.expectedPay || "0"))}
                        </div>
                      </div>
                      {gig.actualPay && (
                        <div>
                          <span className="text-gray-500">Actual Pay</span>
                          <div className="font-medium text-green-600">
                            {formatCurrency(parseFloat(gig.actualPay))}
                          </div>
                        </div>
                      )}
                      {gig.tips && parseFloat(gig.tips) > 0 && (
                        <div>
                          <span className="text-gray-500">Tips</span>
                          <div className="font-medium text-green-600">
                            {formatCurrency(parseFloat(gig.tips))}
                          </div>
                        </div>
                      )}
                      {gig.paymentMethod && (
                        <div>
                          <span className="text-gray-500">Payment</span>
                          <div className="font-medium">{gig.paymentMethod}</div>
                        </div>
                      )}
                    </div>

                    {gig.duties && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="text-gray-500 text-sm">Duties:</span>
                        <div className="text-sm text-gray-900 mt-1">{gig.duties}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No gigs found</h3>
                  <p className="text-gray-500">
                    {searchQuery || filterStatus !== "all"
                      ? "No gigs match your current filters"
                      : "You haven't logged any gigs yet"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Day Gigs Modal */}
      <Dialog open={showDayGigs} onOpenChange={setShowDayGigs}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Gigs for {selectedDate?.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {selectedDate && getGigsForDate(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getGigsForDate(selectedDate).map((gig, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-lg text-gray-900">
                          {gig.eventName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {gig.clientName} • {gig.gigType}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={
                            gig.status === 'completed' ? 'default' : 
                            gig.status === 'upcoming' ? 'secondary' : 
                            'outline'
                          }
                          className="mb-2"
                        >
                          {gig.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Expected Pay:</span>
                        <div className="font-medium text-green-600">
                          {formatCurrency(parseFloat(gig.expectedPay || "0"))}
                        </div>
                      </div>
                      
                      {gig.status === 'completed' && gig.actualPay && (
                        <div>
                          <span className="text-gray-600">Actual Pay:</span>
                          <div className="font-medium text-green-600">
                            {formatCurrency(parseFloat(gig.actualPay))}
                          </div>
                        </div>
                      )}
                      
                      {gig.tips && parseFloat(gig.tips) > 0 && (
                        <div>
                          <span className="text-gray-600">Tips:</span>
                          <div className="font-medium text-green-600">
                            {formatCurrency(parseFloat(gig.tips))}
                          </div>
                        </div>
                      )}
                      
                      {gig.gigAddress && (
                        <div>
                          <span className="text-gray-600">Location:</span>
                          <div className="font-medium text-gray-900 text-xs">
                            {gig.gigAddress}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {gig.duties && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="text-gray-600 text-sm">Duties:</span>
                        <div className="text-sm text-gray-900 mt-1">
                          {gig.duties}
                        </div>
                      </div>
                    )}
                    
                    {gig.notes && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Notes:</span>
                        <div className="text-sm text-gray-900 mt-1">
                          {gig.notes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No gigs found for this date</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    eventName: gig.eventName || "",
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
        <label className="block text-sm font-medium mb-1">Event Name</label>
        <Input
          value={formData.eventName}
          onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
          placeholder="e.g. Summer Festival, Product Launch..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Expected Pay</label>
        <Input
          type="number"
          step="0.01"
          value={formData.expectedPay}
          onChange={(e) => setFormData({ ...formData, expectedPay: e.target.value })}
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Actual Pay</label>
        <Input
          type="number"
          step="0.01"
          value={formData.actualPay}
          onChange={(e) => setFormData({ ...formData, actualPay: e.target.value })}
          placeholder="0.00"
        />
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
        <label className="block text-sm font-medium mb-1">Payment Method</label>
        <Input
          value={formData.paymentMethod}
          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          placeholder="e.g. Cash, Check, Venmo..."
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}