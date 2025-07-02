import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Gig } from "@shared/schema";
import { formatMonth, addMonths } from "@/lib/dateUtils";

// Utility function to parse dates consistently across timezones
const parseGigDate = (dateString: string): Date => {
  return new Date(dateString + 'T00:00:00');
};

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: gigs = [], isLoading: gigsLoading } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
    retry: 1,
  });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => addMonths(prev, direction === "next" ? 1 : -1));
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
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date: Date, index: number) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              const dayGigs = getGigsForDate(date);
              const hasGigs = dayGigs.length > 0;
              
              return (
                <div
                  key={index}
                  className={`
                    h-16 lg:h-20 p-2 text-sm relative rounded-md border border-gray-100 flex items-center justify-center
                    ${isCurrentMonth 
                      ? hasGigs 
                        ? 'bg-blue-50 border-blue-200' 
                        : isToday
                          ? 'text-blue-600 font-semibold bg-blue-50'
                          : 'text-gray-700 bg-white'
                      : 'text-gray-300 bg-gray-50'
                    }
                  `}
                >
                  <span className={`${isToday ? 'font-semibold' : ''}`}>
                    {date.getDate()}
                  </span>
                  
                  {/* Gig indicators */}
                  {hasGigs && (
                    <div className="absolute top-1 right-1">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 text-center text-xs text-gray-500">
            Calendar view - gigs marked with blue dots
          </div>
        </CardContent>
      </Card>
    </div>
  );
}