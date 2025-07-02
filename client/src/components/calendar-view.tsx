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

// Utility function to parse dates consistently across timezones
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

  const { data: gigs = [], isLoading: gigsLoading } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
    retry: 1,
  });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => addMonths(prev, direction === "next" ? 1 : -1));
  };

  const handleDayClick = (date: Date) => {
    const dayGigs = getGigsForDate(date);
    if (dayGigs.length > 0) {
      setSelectedDate(date);
      setShowDayGigs(true);
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const getGigsForDate = (date: Date): Gig[] => {
    const dateStr = date.toISOString().split('T')[0];
    return gigs.filter(gig => {
      const gigDate = parseGigDate(gig.date);
      return gigDate.toISOString().split('T')[0] === dateStr;
    });
  };

  if (gigsLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
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
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-3 border-b border-gray-100">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 lg:gap-2">
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
                    aspect-square p-2 text-sm relative transition-all duration-200 rounded-lg min-h-[48px] lg:min-h-[60px]
                    ${isCurrentMonth 
                      ? hasGigs 
                        ? 'hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-200 hover:shadow-sm' 
                        : isToday
                          ? 'text-blue-600 font-semibold hover:bg-blue-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      : 'text-gray-300'
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
    </div>
  );
}