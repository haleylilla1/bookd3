import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Trash2, Filter, Calendar, DollarSign, Clock, ChevronLeft, ChevronRight, Car, Calculator } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Gig } from "@shared/schema";
import { formatMonth, addMonths } from "@/lib/dateUtils";


import { AddressAutocomplete } from "./address-autocomplete";
import GotPaidDialog, { type GotPaidData } from "./got-paid-dialog";

// Utility function to parse dates consistently across timezones (same as dashboard)
const parseGigDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00.000Z');
};

// Color mapping for gig status
const getGigStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "pending_payment":
    case "pending payment":
    case "pending":
    case "applied":
      return "bg-orange-500";
    case "upcoming":
    case "confirmed":
      return "bg-blue-500";
    default:
      return "bg-orange-500"; // Default to pending payment
  }
};

export default function CalendarView() {
  const [editingGig, setEditingGig] = useState<(Gig & { isMultiDay?: boolean; startDate?: string; endDate?: string; gigIds?: number[] }) | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayGigs, setShowDayGigs] = useState(false);
  const [gotPaidGig, setGotPaidGig] = useState<Gig | null>(null);
  const [showGotPaidDialog, setShowGotPaidDialog] = useState(false);
  const hasUpdatedStatusesRef = useRef(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gigsResponse, isLoading } = useQuery<{ gigs: Gig[], total: number }>({
    queryKey: ["/api/gigs"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  const gigs = gigsResponse?.gigs || [];

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 1,
  });

  // Mutation to automatically update gig statuses
  const updateGigStatusesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/gigs/update-statuses");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.updatedCount > 0) {
        console.log(`${data.updatedCount} gigs updated to pending payment`);
        // Refetch gigs to show updated statuses
        queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      }
    },
    onError: (error) => {
      console.error("Failed to update gig statuses:", error);
    },
  });

  // Automatically update gig statuses when calendar loads (once per session)
  useEffect(() => {
    if (Array.isArray(gigs) && gigs.length > 0 && !hasUpdatedStatusesRef.current) {
      hasUpdatedStatusesRef.current = true;
      updateGigStatusesMutation.mutate();
    }
  }, [gigs?.length]); // Only run when gigs are initially loaded

  // Simple utility to refresh cache after mutations
  const refreshCache = () => {
    queryClient.removeQueries({ queryKey: ["/api/gigs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  const updateGigMutation = useMutation({
    mutationFn: async (gigData: { id: number; data: Partial<Gig> }) => {
      const response = await apiRequest("PUT", `/api/gigs/${gigData.id}`, gigData.data);
      return response.json();
    },
    onSuccess: () => {
      refreshCache();
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
      refreshCache();
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

  // Get gigs for a specific date - includes multi-day gigs that span this date
  const getGigsForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Get gigs that start on this date
    const directGigs = gigsByDate.get(dateString) || [];
    
    // Also find multi-day gigs that span over this date
    const spanningGigs = gigs.filter(gig => {
      if (!gig.isMultiDay || !gig.startDate || !gig.endDate) return false;
      
      const gigStart = new Date(gig.startDate + 'T00:00:00');
      const gigEnd = new Date(gig.endDate + 'T00:00:00');
      const checkDate = new Date(dateString + 'T00:00:00');
      
      // Check if this date falls within the multi-day range
      return checkDate >= gigStart && checkDate <= gigEnd && gig.date !== dateString;
    });
    
    return [...directGigs, ...spanningGigs];
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
      // Handle both "pending payment" and "pending_payment" status formats
      if (filterStatus !== "all") {
        const normalizedGigStatus = gig.status.replace('_', ' ');
        const normalizedFilterStatus = filterStatus.replace('_', ' ');
        if (normalizedGigStatus !== normalizedFilterStatus) return false;
      }
      if (searchQuery && 
          !gig.eventName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !gig.clientName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    // Apply grouping to filtered gigs
    const sortedGigs = [...filtered].sort((a, b) => parseGigDate(a.date).getTime() - parseGigDate(b.date).getTime());
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
        const lastGigDate = parseGigDate(similarGigs[similarGigs.length - 1].date);
        const nextDate = parseGigDate(nextGig.date);
        
        // Calculate days difference - must be positive (forward in time) and <= 7 days
        const dayDiff = (nextDate.getTime() - lastGigDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Smart grouping logic:
        // 1. If both have same multi_day_group_id - definitely group
        // 2. If same name/client/type and consecutive days (≤2 days apart) - likely multi-day gig
        // 3. But if they're >7 days apart - definitely separate gigs
        const bothHaveGroupId = currentGig.multiDayGroupId && nextGig.multiDayGroupId && 
                               currentGig.multiDayGroupId === nextGig.multiDayGroupId;
        const consecutiveDays = dayDiff > 0 && dayDiff <= 2; // Truly consecutive (next day or day after)
        const tooFarApart = dayDiff > 7; // Definitely separate gigs
        
        if (nextGig.eventName === currentGig.eventName &&
            nextGig.clientName === currentGig.clientName &&
            nextGig.gigType === currentGig.gigType &&
            (bothHaveGroupId || (consecutiveDays && !tooFarApart))) {
          similarGigs.push(nextGig);
          processed.add(nextGig.id);
        } else if (tooFarApart) {
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
        grouped.push({
          ...currentGig,
          isMultiDay: currentGig.isMultiDay || false,
          startDate: currentGig.startDate || currentGig.date,
          endDate: currentGig.endDate || currentGig.date,
          gigIds: undefined
        });
      }
    }
    
    return grouped.sort((a, b) => parseGigDate(b.date).getTime() - parseGigDate(a.date).getTime());
  }, [gigs, filterStatus, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending_payment":
      case "pending payment":
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
      case "pending payment":
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

  // Handle "Got Paid" workflow
  const handleGotPaid = (gig: Gig) => {
    setGotPaidGig(gig);
    setShowGotPaidDialog(true);
  };

  // Mutation for "Got Paid" workflow
  const gotPaidMutation = useMutation({
    mutationFn: async ({ gigId, data }: { gigId: number; data: GotPaidData }) => {
      const response = await apiRequest("POST", `/api/gigs/${gigId}/got-paid`, data);
      if (!response.ok) {
        throw new Error("Failed to process payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      toast({
        title: "Payment processed",
        description: "Tax-smart calculations have been saved.",
      });
      setShowGotPaidDialog(false);
      setGotPaidGig(null);
    },
    onError: (error) => {
      console.error("Got paid error:", error);
      toast({
        title: "Error processing payment",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  // Helper function to generate date range (reused from gig-form)
  const generateDateRange = (startDate: string, endDate?: string): string[] => {
    if (!endDate || endDate === startDate) return [startDate];
    
    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [startDate];
      
      const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) return [startDate];
      
      const dates: string[] = [];
      for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      return dates;
    } catch {
      return [startDate];
    }
  };

  // Helper function to recreate multi-day gigs with new dates
  const recreateMultiDayGigs = async (gigIds: number[], startDate: string, endDate: string, updatePayload: any) => {
    try {
      // Delete existing gigs
      for (const gigId of gigIds) {
        const response = await apiRequest("DELETE", `/api/gigs/${gigId}`);
        if (!response.ok) throw new Error(`Failed to delete gig ${gigId}`);
      }
      
      // Create new gigs
      const newDates = generateDateRange(startDate, endDate);
      for (const date of newDates) {
        const gigData = {
          userId: (user as any)?.id,
          date,
          ...updatePayload,
          paymentMethod: editingGig!.paymentMethod || "Cash",
          notes: editingGig!.notes || null
        };
        
        const response = await apiRequest("POST", "/api/gigs", gigData);
        if (!response.ok) throw new Error(`Failed to create gig for ${date}`);
      }
      
      refreshCache();
      toast({
        title: "Multi-day gig recreated",
        description: `Created ${newDates.length} days from ${startDate} to ${endDate}`,
      });
      
      setEditingGig(null);
    } catch (error) {
      console.error("Error recreating multi-day gigs:", error);
      toast({
        title: "Update failed",
        description: "Failed to update date range. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper function to update existing multi-day gigs
  const updateMultiDayGigs = async (gigIds: number[], updatePayload: any) => {
    try {
      const updatePromises = gigIds.map(async (gigId) => {
        try {
          const response = await apiRequest("PUT", `/api/gigs/${gigId}`, updatePayload);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update gig ${gigId}: ${errorText}`);
          }
          return await response.json();
        } catch (error) {
          console.error(`Error updating gig ${gigId}:`, error);
          throw error;
        }
      });
      
      await Promise.all(updatePromises);
      
      refreshCache();
      toast({
        title: "Multi-day gig updated",
        description: `Updated ${gigIds.length} days of ${editingGig!.eventName}`,
      });
      
      setEditingGig(null);
    } catch (error) {
      console.error("Error updating multi-day gigs:", error);
      toast({
        title: "Update failed",
        description: `Failed to update gig: ${(error as Error).message}. Please try again.`,
        variant: "destructive",
      });
    }
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
    
    // Safe numeric conversions - preserve exact string values
    const safeParseFloat = (value: string | number | undefined): string | null => {
      if (value === "" || value === null || value === undefined) return null;
      const stringValue = String(value);
      const parsed = parseFloat(stringValue);
      return isNaN(parsed) ? null : stringValue;
    };
    
    updatePayload.expectedPay = safeParseFloat(updatedData.expectedPay);
    updatePayload.actualPay = safeParseFloat(updatedData.actualPay);
    updatePayload.tips = safeParseFloat(updatedData.tips);
    updatePayload.parkingExpense = safeParseFloat(updatedData.parkingExpense);

    
    // Handle mileage calculation
    if (updatedData.calculatedMileage) {
      updatePayload.mileage = Math.max(0, parseInt(updatedData.calculatedMileage) || 0);
    } else {
      updatePayload.mileage = Math.max(0, parseInt(String(updatedData.mileage)) || 0);
    }
    
    // Handle receipts and reimbursement tracking
    if (updatedData.parkingDescription !== undefined) {
      updatePayload.parkingDescription = updatedData.parkingDescription;
    }

    
    // Add reimbursement tracking fields
    if (updatedData.parkingReimbursed !== undefined) {
      updatePayload.parkingReimbursed = Boolean(updatedData.parkingReimbursed);
    }


    console.log("Saving gig edit:", updatePayload); // Debug log
    
    // Handle multi-day gigs with efficient date change detection
    if (editingGig.isMultiDay && editingGig.gigIds?.length) {
      const datesChanged = (updatedData.startDate !== editingGig.startDate) || 
                          (updatedData.endDate !== editingGig.endDate);
      
      if (datesChanged) {
        // Recreate gig series with new dates
        recreateMultiDayGigs(editingGig.gigIds, updatedData.startDate || editingGig.startDate!, 
                           updatedData.endDate || editingGig.endDate!, updatePayload);
      } else {
        // Update existing gigs in series
        updateMultiDayGigs(editingGig.gigIds, updatePayload);
      }
    } else {
      // Single day gig
      updateGigMutation.mutate({ id: editingGig.id, data: updatePayload });
    }
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
          <div className="grid grid-cols-7 gap-1">
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
                            className={`w-8 h-8 rounded-full ${getGigStatusColor(dayGigs[0].status)} opacity-30 flex-shrink-0`}
                          />
                        ) : dayGigs.length === 2 ? (
                          <div className="flex gap-1">
                            <div 
                              className={`w-6 h-6 rounded-full ${getGigStatusColor(dayGigs[0].status)} opacity-30 flex-shrink-0`}
                            />
                            <div 
                              className={`w-6 h-6 rounded-full ${getGigStatusColor(dayGigs[1].status)} opacity-30 flex-shrink-0`}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-0.5 justify-center items-center">
                            {dayGigs.slice(0, 3).map((gig: Gig, gigIndex: number) => (
                              <div 
                                key={gigIndex}
                                className={`w-4 h-4 rounded-full ${getGigStatusColor(gig.status)} opacity-30 flex-shrink-0`}
                              />
                            ))}
                            {dayGigs.length > 3 && (
                              <div className="w-4 h-4 rounded-full bg-gray-500 opacity-30 flex items-center justify-center flex-shrink-0">
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
              <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500 flex-shrink-0"></div>
              <span className="text-gray-600">Pending Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="text-gray-600">Upcoming</span>
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
            <SelectItem value="pending payment">Pending Payment</SelectItem>
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
                        {/* Always show expected pay in calendar view */}
                        {gig.expectedPay 
                          ? formatCurrency(parseFloat(gig.expectedPay))
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

                  {/* Action Buttons - Mobile Optimized Layout */}
                  <div className="flex flex-col gap-2 pt-2">
                    {gig.status !== 'completed' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleGotPaid(gig)}
                        className="bg-green-600 hover:bg-green-700 text-white w-full px-3 py-1.5"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Got Paid
                      </Button>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGig(gig)}
                        className="flex items-center justify-center"
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
                        className="flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
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
            <DialogDescription>
              View and manage all gigs scheduled for this date.
            </DialogDescription>
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
                      <div className="flex flex-col gap-2">
                        <Badge 
                          variant={
                            gig.status === 'completed' ? 'default' : 
                            gig.status === 'upcoming' ? 'secondary' : 
                            'outline'
                          }
                          className="w-fit"
                        >
                          {gig.status}
                        </Badge>
                        
                        {/* Action Buttons - Mobile Optimized Layout */}
                        <div className="flex flex-col gap-2">
                          {gig.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                handleGotPaid(gig);
                                setShowDayGigs(false);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white w-full px-3 py-1.5"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Got Paid
                            </Button>
                          )}
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Find the grouped gig in filteredGigs to get multi-day properties
                                const groupedGig = filteredGigs.find(g => 
                                  g.id === gig.id || (g.gigIds && g.gigIds.includes(gig.id))
                                );
                                
                                if (groupedGig) {
                                  setEditingGig(groupedGig);
                                } else {
                                  setEditingGig({ ...gig, isMultiDay: false, startDate: gig.date, endDate: gig.date });
                                }
                                setShowDayGigs(false);
                              }}
                              className="flex items-center justify-center"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Find the grouped gig to handle multi-day gigs properly
                                const groupedGig = filteredGigs.find(g => 
                                  g.id === gig.id || (g.gigIds && g.gigIds.includes(gig.id))
                                );
                                
                                if (groupedGig?.isMultiDay && groupedGig.gigIds) {
                                  // Delete all gigs in the multi-day series
                                  groupedGig.gigIds.forEach(id => deleteGigMutation.mutate(id));
                                } else {
                                  deleteGigMutation.mutate(gig.id);
                                }
                                setShowDayGigs(false);
                              }}
                              disabled={deleteGigMutation.isPending}
                              className="flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
            <DialogDescription>
              Update gig information, payments, and expense tracking.
            </DialogDescription>
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

      {/* Got Paid Dialog */}
      {gotPaidGig && (
        <GotPaidDialog
          gig={gotPaidGig}
          isOpen={showGotPaidDialog}
          onClose={() => {
            setShowGotPaidDialog(false);
            setGotPaidGig(null);
          }}
          onSave={async (data) => {
            return gotPaidMutation.mutateAsync({ 
              gigId: gotPaidGig.id, 
              data 
            });
          }}
        />
      )}
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
    taxPercentage: (gig.taxPercentage !== null && gig.taxPercentage !== undefined) ? gig.taxPercentage : ((user as any)?.defaultTaxPercentage || 23),
    mileage: gig.mileage || 0,
    startingAddress: (user as any)?.homeAddress || "",
    endingAddress: "",
    stops: [] as string[],
    includeRoundtrip: true,
    calculatedMileage: "",
    parkingExpense: gig.parkingExpense || "",
    parkingDescription: gig.parkingDescription || "",
    parkingReimbursed: (gig as any).parkingReimbursed || false,

  });

  const [isCalculatingMileage, setIsCalculatingMileage] = useState(false);

  const handleCalculateMileage = async () => {
    // Enhanced mobile validation
    if (!formData.startingAddress?.trim() || !formData.endingAddress?.trim()) {
      toast({
        title: "Missing Addresses",
        description: "Both starting and ending addresses are required for mileage calculation.",
        variant: "destructive",
      });
      return;
    }

    // Check network connectivity for mobile
    if (!navigator.onLine) {
      toast({
        title: "No Internet Connection",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingMileage(true);
    
    try {
      // Enhanced mobile network handling with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      
      const { calculateDistance } = await import('../lib/distance');
      
      const result = await calculateDistance(
        formData.startingAddress.trim(),
        formData.endingAddress.trim(),
        formData.stops.filter(stop => stop?.trim()),
        formData.includeRoundtrip
      );

      clearTimeout(timeoutId);

      if (result.status === 'error') {
        throw new Error(result.error || 'Failed to calculate distance');
      }
      
      // Handle partial success with warnings
      if (result.status === 'partial_success') {
        const warningMessage = result.errors?.join(', ') || 'Some route segments could not be calculated';
        console.warn('Distance calculation partial success:', warningMessage);
      }
      
      const roundedDistance = Math.ceil(result.distanceMiles);
      setFormData(prev => ({ 
        ...prev, 
        calculatedMileage: roundedDistance.toString(),
        mileage: roundedDistance 
      }));
      
      if (result.status === 'success') {
        toast({
          title: "Mileage Calculated",
          description: `${roundedDistance} miles total${formData.includeRoundtrip ? ' including round trip' : ''}${result.fromCache ? ' (from cache)' : ''}.`,
        });
      } else {
        toast({
          title: "Distance Calculated (with warnings)",
          description: `${roundedDistance} miles calculated. Some segments may be estimated.`,
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error("Mileage calculation error:", error);
      
      // Enhanced mobile error messages
      let errorMessage = "Failed to calculate mileage. Please check your addresses and try again.";
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "Calculation timeout. Please check your internet connection and try again.";
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMessage = "Calculation timeout. Please check your internet connection and try again.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your internet connection.";
        } else if (error.message.includes('Invalid response')) {
          errorMessage = "Invalid address. Please check your addresses and try again.";
        }
      }
      
      toast({
        title: "Calculation Failed",
        description: errorMessage,
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
        <Select 
          value={formData.gigType} 
          onValueChange={(value) => setFormData({ ...formData, gigType: value })}
        >
          <SelectTrigger 
            className="min-h-[48px] text-base bg-white border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            style={{
              fontSize: '16px',
              minHeight: '48px',
              touchAction: 'manipulation',
              WebkitAppearance: 'none'
            }}
          >
            <SelectValue placeholder="Select gig type..." />
          </SelectTrigger>
          <SelectContent 
            className="max-h-[300px] overflow-y-auto z-50"
            position="popper"
            sideOffset={4}
          >
            {(user as any)?.customGigTypes && (user as any).customGigTypes.length > 0 ? (
              <>
                {(user as any).customGigTypes.map((gigType: string) => (
                  <SelectItem 
                    key={gigType} 
                    value={gigType}
                    className="min-h-[44px] text-base cursor-pointer hover:bg-gray-100 focus:bg-gray-100"
                    style={{ fontSize: '16px', minHeight: '44px' }}
                  >
                    {gigType}
                  </SelectItem>
                ))}
                <SelectItem 
                  value="other"
                  className="min-h-[44px] text-base cursor-pointer hover:bg-gray-100 focus:bg-gray-100"
                  style={{ fontSize: '16px', minHeight: '44px' }}
                >
                  Other
                </SelectItem>
              </>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">No gig types added yet.</p>
                <p className="text-xs mt-1">Go to Profile → Add Type to create your custom gig types.</p>
              </div>
            )}
          </SelectContent>
        </Select>
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
          <AddressAutocomplete
            label="Starting Address"
            placeholder="Your home or starting location..."
            value={formData.startingAddress}
            onChange={(value) => setFormData({ ...formData, startingAddress: value })}
          />
          <AddressAutocomplete
            label="Ending Address" 
            placeholder="Event venue or destination..."
            value={formData.endingAddress}
            onChange={(value) => setFormData({ ...formData, endingAddress: value })}
          />
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
            <SelectItem value="pending payment">Pending Payment</SelectItem>
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
      <div className="border-t pt-3 space-y-4">
        <h4 className="font-medium text-sm">Expenses & Receipts</h4>
        
        {/* Parking Section */}
        <div className="space-y-3 p-3 bg-blue-50 rounded-lg border">
          <h5 className="font-medium text-blue-900 text-xs">Parking</h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Amount ($)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.parkingExpense}
                onChange={(e) => setFormData({ ...formData, parkingExpense: e.target.value })}
              />
            </div>
            <div className="flex items-center pt-4">
              <Checkbox
                id="parkingReimbursed"
                checked={formData.parkingReimbursed}
                onCheckedChange={(checked) => setFormData({ ...formData, parkingReimbursed: checked })}
              />
              <label htmlFor="parkingReimbursed" className="text-xs ml-2">
                Reimbursed
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Parking Details (optional)</label>
            <Input
              placeholder="e.g., meter parking, garage level 2"
              value={formData.parkingDescription}
              onChange={(e) => setFormData({ ...formData, parkingDescription: e.target.value })}
            />
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