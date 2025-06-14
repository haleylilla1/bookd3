import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Trash2, Filter, Calendar, DollarSign, Clock, ChevronLeft, ChevronRight } from "lucide-react";
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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gigs = [], isLoading } = useQuery<Gig[]>({
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

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
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

  // Group consecutive gigs with same details into multi-day entries
  const groupMultiDayGigs = (gigs: Gig[]) => {
    if (gigs.length === 0) return [];
    
    const sortedGigs = [...gigs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const grouped: (Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string; gigIds?: number[] })[] = [];
    
    for (let i = 0; i < sortedGigs.length; i++) {
      const currentGig = sortedGigs[i];
      
      // Check if this gig can be grouped with subsequent gigs
      const similarGigs = [currentGig];
      let j = i + 1;
      
      while (j < sortedGigs.length) {
        const nextGig = sortedGigs[j];
        const currentDate = new Date(currentGig.date);
        const nextDate = new Date(nextGig.date);
        const dayDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Group if same event, client, type and consecutive days
        if (nextGig.eventName === currentGig.eventName &&
            nextGig.clientName === currentGig.clientName &&
            nextGig.gigType === currentGig.gigType &&
            dayDiff <= similarGigs.length) {
          similarGigs.push(nextGig);
          j++;
        } else {
          break;
        }
      }
      
      if (similarGigs.length > 1) {
        // Create multi-day gig entry
        const multiDayGig = {
          ...currentGig,
          isMultiDay: true,
          startDate: similarGigs[0].date,
          endDate: similarGigs[similarGigs.length - 1].date,
          gigIds: similarGigs.map(g => g.id)
        };
        grouped.push(multiDayGig);
        i = j - 1; // Skip the grouped gigs
      } else {
        grouped.push(currentGig);
      }
    }
    
    return grouped;
  };

  // Filter and search gigs
  const filteredIndividualGigs = gigs
    .filter(gig => {
      if (filterStatus !== "all" && gig.status !== filterStatus) return false;
      if (searchQuery && !gig.eventName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !gig.clientName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

  const filteredGigs = groupMultiDayGigs(filteredIndividualGigs)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending_payment":
        return "bg-orange-100 text-orange-800";
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
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

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
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
                        : isToday
                          ? 'text-primary hover:bg-blue-50 bg-blue-50/50'
                          : 'text-gray-900 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-50'
                    }
                    ${!hasGigs ? 'cursor-default' : ''}
                  `}
                  disabled={!hasGigs}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`${isToday ? 'font-bold' : ''} mb-1`}>
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
                    {isToday && hasGigs && (
                      <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
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

      {/* Gig Status Legend */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 text-gray-700">Gig Status Legend</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-300"></div>
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-300"></div>
              <span className="text-gray-600">Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-300"></div>
              <span className="text-gray-600">Pending Payment</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gig List Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">All Gigs</h2>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {filteredGigs.length} gigs
        </Badge>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search gigs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
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
      <div className="space-y-4">
        {filteredGigs.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-2">No gigs found</p>
            <p className="text-sm text-gray-400">
              {searchQuery || filterStatus !== "all" 
                ? "Try adjusting your search or filter criteria"
                : "Add your first gig to get started"
              }
            </p>
          </div>
        ) : (
          filteredGigs.map((gig) => (
            <Card key={gig.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {gig.eventName}
                      </h3>
                      <Badge className={getStatusColor(gig.status)}>
                        {getStatusLabel(gig.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {gig.isMultiDay 
                          ? `${formatDate(gig.startDate!)} - ${formatDate(gig.endDate!)}`
                          : formatDate(gig.date)
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {gig.clientName} • {gig.gigType}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        {gig.actualPay 
                          ? formatCurrency(parseFloat(gig.actualPay))
                          : gig.expectedPay 
                            ? `${formatCurrency(parseFloat(gig.expectedPay))} (expected)`
                            : "No pay set"
                        }
                      </div>
                    </div>

                    {gig.duties && (
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-3">
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
                      onClick={() => {
                        if (gig.isMultiDay && gig.gigIds) {
                          // Delete all gigs in the multi-day series
                          gig.gigIds.forEach(id => deleteGigMutation.mutate(id));
                        } else {
                          deleteGigMutation.mutate(gig.id);
                        }
                      }}
                      disabled={deleteGigMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
  gig: Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string; gigIds?: number[] };
  onSave: (data: Partial<Gig>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function GigEditForm({ gig, onSave, onCancel, isLoading }: GigEditFormProps) {
  const [formData, setFormData] = useState({
    eventName: gig.eventName,
    clientName: gig.clientName,
    gigType: gig.gigType,
    startDate: gig.isMultiDay ? gig.startDate! : gig.date,
    endDate: gig.isMultiDay ? gig.endDate! : "",
    expectedPay: gig.expectedPay || "",
    actualPay: gig.actualPay || "",
    tips: gig.tips || "",
    status: gig.status,
    duties: gig.duties || "",
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
          placeholder="Corporate Event"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Client Name</label>
        <Input
          value={formData.clientName}
          onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
          placeholder="ABC Company"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Gig Type</label>
        <Input
          value={formData.gigType}
          onChange={(e) => setFormData({ ...formData, gigType: e.target.value })}
          placeholder="Brand Ambassador"
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
          <Input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            placeholder="Leave empty for single day"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Expected Pay</label>
          <Input
            type="number"
            value={formData.expectedPay}
            onChange={(e) => setFormData({ ...formData, expectedPay: e.target.value })}
            placeholder="300"
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
        <label className="block text-sm font-medium mb-1">Tips Earned</label>
        <Input
          type="number"
          value={formData.tips}
          onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
          placeholder="25"
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