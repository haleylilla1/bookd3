import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, DollarSign, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Gig } from "@shared/schema";

export default function CalendarView() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
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

      {/* Recent Gigs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Gigs</h3>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {stats?.recentGigs?.slice(0, 3).map((gig: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    gig.status === 'completed' ? 'bg-success' : 
                    gig.status === 'pending_payment' ? 'bg-warning' : 'bg-secondary'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{gig.clientName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(gig.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(parseFloat(gig.actualPay || gig.expectedPay || '0'))}
                </span>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No gigs recorded yet</p>
                <p className="text-sm">Tap the + button to add your first gig</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
