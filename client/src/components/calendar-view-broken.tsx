import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Trash2, Filter, Calendar, DollarSign, Clock, ChevronLeft, ChevronRight, Car, Calculator } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Gig } from "@shared/schema";
import { formatMonth, addMonths } from "@/lib/dateUtils";
import ReceiptUpload from "@/components/receipt-upload";

// Utility function to parse dates consistently across timezones (same as dashboard)
const parseGigDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

// Color mapping for gig status
const getGigStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "pending_payment":
      return "bg-orange-500";
    case "upcoming":
    case "confirmed":
      return "bg-blue-500";
    case "pending":
    case "applied":
      return "bg-gray-400";
    default:
      return "bg-gray-300";
  }
};

export default function CalendarView() {
  const [editingGig, setEditingGig] = useState<(Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string; gigIds?: number[] }) | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayGigs, setShowDayGigs] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gigs = [], isLoading } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 1,
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

  // Memoize calendar days generation
  const calendarDays = useMemo(() => {
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
  }, [currentDate]);

  // Memoize gigs by date for better performance
  const gigsByDate = useMemo(() => {
    if (!gigs || !Array.isArray(gigs)) return new Map();
    const gigMap = new Map<string, Gig[]>();
    
    gigs.forEach(gig => {
      const dateString = gig.date;
      if (!gigMap.has(dateString)) {
        gigMap.set(dateString, []);
      }
      gigMap.get(dateString)!.push(gig);
    });
    
    return gigMap;
  }, [gigs]);

  // Get gigs for a specific date with consistent date formatting
  const getGigsForDate = (date: Date) => {
    // Use consistent UTC date formatting to match gig.date format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    return gigsByDate.get(dateString) || [];
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



  // Memoize filtered gigs for better performance
  const filteredGigs = useMemo(() => {
    if (!gigs || !Array.isArray(gigs)) return [];
    
    const filtered = gigs.filter(gig => {
      if (filterStatus !== "all" && gig.status !== filterStatus) return false;
      if (searchQuery && 
          !gig.eventName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !gig.clientName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    // Apply grouping to filtered gigs
    const sortedGigs = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const grouped: (Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string; gigIds?: number[] })[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < sortedGigs.length; i++) {
      if (processed.has(sortedGigs[i].id)) continue;
      
      const currentGig = sortedGigs[i];
      const similarGigs = [currentGig];
      processed.add(currentGig.id);
      
      // Look for consecutive similar gigs (within 7 days and in chronological order)
      for (let j = i + 1; j < sortedGigs.length; j++) {
        const nextGig = sortedGigs[j];
        if (processed.has(nextGig.id)) continue;
        
        // Use consistent UTC date parsing to avoid timezone issues
        const lastGigDate = new Date(similarGigs[similarGigs.length - 1].date + 'T00:00:00.000Z');
        const nextDate = new Date(nextGig.date + 'T00:00:00.000Z');
        
        // Calculate days difference - must be positive (forward in time) and <= 7 days
        const dayDiff = (nextDate.getTime() - lastGigDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Only group if: same details, within 7 days, and consecutive
        if (nextGig.eventName === currentGig.eventName &&
            nextGig.clientName === currentGig.clientName &&
            nextGig.gigType === currentGig.gigType &&
            dayDiff > 0 && dayDiff <= 7) {
          similarGigs.push(nextGig);
          processed.add(nextGig.id);
        } else if (dayDiff > 7) {
          // Stop looking if we've exceeded the 7-day window
          break;
        }
      }
      
      if (similarGigs.length > 1) {
        similarGigs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const multiDayGig = {
          ...currentGig,
          isMultiDay: true,
          startDate: similarGigs[0].date,
          endDate: similarGigs[similarGigs.length - 1].date,
          gigIds: similarGigs.map(g => g.id)
        };
        grouped.push(multiDayGig);
      } else {
        grouped.push(currentGig);
      }
    }
    
    return grouped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [gigs, filterStatus, searchQuery]);

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

  const handleEditGig = (gig: Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string; gigIds?: number[] }) => {
    setEditingGig(gig);
  };

  const handleSaveEdit = (updatedData: any) => {
    if (!editingGig) return;

    // Prepare update payload with safe numeric parsing
    const updatePayload: any = {
      eventName: updatedData.eventName?.trim() || editingGig.eventName,
      clientName: updatedData.clientName?.trim() || editingGig.clientName,
      gigType: updatedData.gigType?.trim() || editingGig.gigType,
      status: updatedData.status || editingGig.status,
      duties: updatedData.duties || null,
      taxPercentage: Math.max(0, Math.min(50, updatedData.taxPercentage || 0)),
    };
    
    // Handle date field mapping
    if (updatedData.startDate && updatedData.startDate !== editingGig.date) {
      updatePayload.date = updatedData.startDate;
    }
    
    // Safe numeric conversions
    const safeParseFloat = (value: string | number | undefined): string | null => {
      if (value === "" || value === null || value === undefined) return null;
      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? null : parsed.toString();
    };
    
    updatePayload.expectedPay = safeParseFloat(updatedData.expectedPay);
    updatePayload.actualPay = safeParseFloat(updatedData.actualPay);
    updatePayload.tips = safeParseFloat(updatedData.tips);
    updatePayload.parkingExpense = safeParseFloat(updatedData.parkingExpense);
    updatePayload.otherExpenses = safeParseFloat(updatedData.otherExpenses);
    
    // Handle mileage calculation
    if (updatedData.calculatedMileage) {
      updatePayload.mileage = Math.max(0, parseInt(updatedData.calculatedMileage) || 0);
    } else {
      updatePayload.mileage = Math.max(0, parseInt(String(updatedData.mileage)) || 0);
    }
    
    // Handle receipts and reimbursement tracking
    if (updatedData.parkingReceipts) {
      updatePayload.parkingReceipts = Array.isArray(updatedData.parkingReceipts) ? updatedData.parkingReceipts : [];
    }
    if (updatedData.otherExpenseReceipts) {
      updatePayload.otherExpenseReceipts = Array.isArray(updatedData.otherExpenseReceipts) ? updatedData.otherExpenseReceipts : [];
    }
    
    // Add reimbursement tracking fields
    if (updatedData.parkingReimbursed !== undefined) {
      updatePayload.parkingReimbursed = Boolean(updatedData.parkingReimbursed);
    }
    if (updatedData.otherExpensesReimbursed !== undefined) {
      updatePayload.otherExpensesReimbursed = Boolean(updatedData.otherExpensesReimbursed);
    }

    console.log("Saving gig edit:", updatePayload); // Debug log
    
    // Use the existing mutation
    updateGigMutation.mutate({
      id: editingGig.id,
      data: updatePayload,
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-6">
          {/* Calendar skeleton */}
          <div className="bg-gray-200 animate-pulse h-12 rounded-lg" />
          <div className="bg-gray-200 animate-pulse h-80 rounded-xl" />
          {/* Gig list skeleton */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-0 w-full space-y-6">
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
        <CardContent className="p-4 lg:p-6">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2 border-b border-gray-100">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 auto-rows-fr"
               style={{ gridTemplateRows: 'repeat(6, minmax(60px, 1fr))' }}>
            {calendarDays.map((date: Date, index: number) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              const dayGigs = getGigsForDate(date);
              const hasGigs = dayGigs.length > 0;
              
              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(date)}
                  className={`
                    h-16 w-full p-2 text-sm relative transition-all duration-200 rounded-md border border-gray-100
                    ${isCurrentMonth 
                      ? hasGigs 
                        ? 'hover:bg-blue-50 cursor-pointer hover:border-blue-200 hover:shadow-sm bg-white' 
                        : isToday
                          ? 'text-blue-600 font-semibold hover:bg-blue-50 bg-white'
                          : 'text-gray-700 hover:bg-gray-50 bg-white'
                      : 'text-gray-300 bg-gray-50'
                    }
                    ${!hasGigs && isCurrentMonth ? 'cursor-default' : ''}
                  `}
                  disabled={!hasGigs}
                  aria-label={`${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'long' })} ${date.getFullYear()}${hasGigs ? `, ${dayGigs.length} gig${dayGigs.length > 1 ? 's' : ''}` : ''}`}
                  tabIndex={hasGigs ? 0 : -1}
                >
                  <div className="flex flex-col items-center justify-center h-full relative">
                    <span className={`${isToday ? 'font-semibold' : ''} relative z-10`}>
                      {date.getDate()}
                    </span>
                    
                    {/* Colored circles for gigs */}
                    {hasGigs && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {dayGigs.length === 1 ? (
                          <div 
                            className={`w-8 h-8 rounded-full ${getGigStatusColor(dayGigs[0].status)} opacity-30`}
                          />
                        ) : dayGigs.length === 2 ? (
                          <div className="flex gap-1">
                            <div 
                              className={`w-6 h-6 rounded-full ${getGigStatusColor(dayGigs[0].status)} opacity-30`}
                            />
                            <div 
                              className={`w-6 h-6 rounded-full ${getGigStatusColor(dayGigs[1].status)} opacity-30`}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-0.5 justify-center items-center">
                            {dayGigs.slice(0, 3).map((gig: Gig, gigIndex: number) => (
                              <div 
                                key={gigIndex}
                                className={`w-4 h-4 rounded-full ${getGigStatusColor(gig.status)} opacity-30`}
                              />
                            ))}
                            {dayGigs.length > 3 && (
                              <div className="w-4 h-4 rounded-full bg-gray-500 opacity-30 flex items-center justify-center">
                                <span className="text-xs text-white font-bold">+</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {isToday && hasGigs && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full z-20"></div>
                    )}
                    {hasGigs && (
                      <div className="absolute top-1 left-1 opacity-0 hover:opacity-60 transition-opacity z-20">
                        <Edit2 className="w-3 h-3 text-gray-600" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 text-center text-xs text-gray-500">
            Click on highlighted dates to view and edit gig details
          </div>
        </CardContent>
      </Card>

      {/* Gig Status Legend */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 text-gray-700">Gig Status Colors</h3>
          <div className="flex flex-wrap gap-4 text-xs mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-gray-600">Pending Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-600">Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-gray-600">Pending</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 pt-2 border-t">
            Click dates with colored circles to view gig details
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
                {getGigsForDate(selectedDate).map((gig: Gig, index: number) => (
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
                      <div className="flex items-center gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingGig(gig);
                            setShowDayGigs(false);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
  const { toast } = useToast();
  const { data: user } = useQuery({ queryKey: ["/api/user"] });

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
    taxPercentage: (gig.taxPercentage !== null && gig.taxPercentage !== undefined) ? gig.taxPercentage : (user?.defaultTaxPercentage || 23),
    mileage: gig.mileage || 0,
    startingAddress: (user as any)?.homeAddress || "",
    endingAddress: "",
    stops: [] as string[],
    includeRoundtrip: true,
    calculatedMileage: "",
    parkingExpense: gig.parkingExpense || "",
    parkingReceipts: (gig as any).parkingReceipts || [],
    parkingReimbursed: (gig as any).parkingReimbursed || false,
    otherExpenses: gig.otherExpenses || "",
    otherExpenseReceipts: (gig as any).otherExpenseReceipts || [],
    otherExpensesReimbursed: (gig as any).otherExpensesReimbursed || false,
  });

  const [isCalculatingMileage, setIsCalculatingMileage] = useState(false);

  const handleCalculateMileage = async () => {
    // Validate inputs
    if (!formData.startingAddress?.trim() || !formData.endingAddress?.trim()) {
      toast({
        title: "Missing Addresses",
        description: "Both starting and ending addresses are required for mileage calculation.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingMileage(true);
    
    try {
      const response = await fetch("/api/calculate-distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAddress: formData.startingAddress.trim(),
          endAddress: formData.endingAddress.trim(),
          waypoints: formData.stops.filter(stop => stop?.trim()),
          roundTrip: formData.includeRoundtrip
        })
      });

      if (!response.ok) throw new Error("Failed to calculate distance");
      
      const result = await response.json();
      
      if (result.status === 'success') {
        const roundedDistance = Math.ceil(result.distanceMiles);
        setFormData(prev => ({ 
          ...prev, 
          calculatedMileage: roundedDistance.toString(),
          mileage: roundedDistance 
        }));
        
        toast({
          title: "Mileage Calculated",
          description: `${roundedDistance} miles total${formData.includeRoundtrip ? ' including round trip' : ''}.`,
        });
      } else {
        throw new Error(result.error || "Failed to calculate distance");
      }
      
    } catch (error) {
      console.error("Mileage calculation error:", error);
      toast({
        title: "Calculation Failed",
        description: "Failed to calculate mileage. Please check your addresses and try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculatingMileage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Gig Type</label>
        <Input
          value={formData.gigType}
          onChange={(e) => setFormData({ ...formData, gigType: e.target.value })}
          placeholder="Brand Ambassador"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <Input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
        <div>
          <label className="block text-sm font-medium mb-1">Tips</label>
          <Input
            type="number"
            value={formData.tips}
            onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
            placeholder="25"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Tax Percentage</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="50"
            value={formData.taxPercentage === 0 ? '' : formData.taxPercentage}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string and valid numbers
              if (value === '') {
                setFormData({ ...formData, taxPercentage: 0 });
              } else {
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  setFormData({ ...formData, taxPercentage: parsed });
                }
              }
            }}
            placeholder="25.0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mileage</label>
          <Input
            type="number"
            min="0"
            value={formData.mileage === 0 ? '' : formData.mileage}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string and valid numbers
              if (value === '') {
                setFormData({ ...formData, mileage: 0 });
              } else {
                const parsed = parseInt(value);
                if (!isNaN(parsed) && parsed >= 0) {
                  setFormData({ ...formData, mileage: parsed });
                }
              }
            }}
            placeholder="45"
          />
        </div>
      </div>

      {/* Mileage Calculation Section */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="font-medium text-sm">Mileage Calculation</h4>
        
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Starting Address</label>
            <Input
              placeholder="Your home or starting location..."
              value={formData.startingAddress}
              onChange={(e) => setFormData({ ...formData, startingAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Ending Address</label>
            <Input
              placeholder="Event venue or destination..."
              value={formData.endingAddress}
              onChange={(e) => setFormData({ ...formData, endingAddress: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.includeRoundtrip}
            onChange={(e) => setFormData({ ...formData, includeRoundtrip: e.target.checked })}
            className="rounded"
          />
          <span className="text-xs">Include round trip</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCalculateMileage}
          disabled={isCalculatingMileage}
          className="w-full"
        >
          <Calculator className="w-4 h-4 mr-2" />
          {isCalculatingMileage ? "Calculating..." : "Calculate Mileage"}
        </Button>

        {formData.calculatedMileage && (
          <div className="text-center p-2 bg-green-50 rounded text-sm">
            Calculated: {formData.calculatedMileage} miles
          </div>
        )}
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
          className="w-full p-2 border rounded-md resize-none h-16"
          value={formData.duties}
          onChange={(e) => setFormData({ ...formData, duties: e.target.value })}
          placeholder="Key duties and responsibilities..."
        />
      </div>



      {/* Expense Section */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="font-medium text-sm">Expenses & Receipts</h4>
        
        {/* Expense Fields */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Parking</label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.parkingExpense}
                onChange={(e) => setFormData({ ...formData, parkingExpense: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Other Expenses</label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.otherExpenses}
                onChange={(e) => setFormData({ ...formData, otherExpenses: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Receipt Uploads */}
        <div className="space-y-2">
          <ReceiptUpload
            label="Parking Receipts"
            receipts={formData.parkingReceipts}
            onReceiptsChange={(receipts) => setFormData({ ...formData, parkingReceipts: receipts })}
            maxFiles={3}
          />
          <ReceiptUpload
            label="Other Expense Receipts"
            receipts={formData.otherExpenseReceipts}
            onReceiptsChange={(receipts) => setFormData({ ...formData, otherExpenseReceipts: receipts })}
            maxFiles={3}
          />
        </div>

        {/* Reimbursement Tracking */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="parkingReimbursed"
              checked={formData.parkingReimbursed}
              onCheckedChange={(checked) => setFormData({ ...formData, parkingReimbursed: checked })}
            />
            <label htmlFor="parkingReimbursed" className="text-sm">
              Parking expense was reimbursed
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="otherExpensesReimbursed"
              checked={formData.otherExpensesReimbursed}
              onCheckedChange={(checked) => setFormData({ ...formData, otherExpensesReimbursed: checked })}
            />
            <label htmlFor="otherExpensesReimbursed" className="text-sm">
              Other expenses were reimbursed
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
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