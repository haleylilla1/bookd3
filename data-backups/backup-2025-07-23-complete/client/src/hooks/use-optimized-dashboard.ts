/**
 * OPTIMIZED DASHBOARD HOOK: Single query replaces multiple API calls
 * Reduces 5-10 queries to 1 query with aggressive caching
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface DashboardData {
  user: {
    id: number;
    email: string;
    username: string;
    name: string;
    homeAddress: string | null;
    defaultTaxPercentage: number;
    customGigTypes: string[];
  };
  monthlyStats: {
    actualEarnings: number;
    projectedEarnings: number;
    totalGigs: number;
    completedGigs: number;
    upcomingGigs: number;
    pendingPaymentGigs: number;
    totalExpenses: number;
    estimatedTaxes: number;
    goal: number | null;
  };
  annualStats: {
    actualEarnings: number;
    projectedEarnings: number;
    totalGigs: number;
    completedGigs: number;
    upcomingGigs: number;
    pendingPaymentGigs: number;
    totalExpenses: number;
    estimatedTaxes: number;
    goal: number | null;
  };
  recentGigs: Array<{
    id: number;
    eventName: string;
    clientName: string;
    gigType: string;
    date: string;
    status: string;
    expectedPay: string;
    actualPay: string;
  }>;
}

export function useOptimizedDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['/api/dashboard/optimized'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/dashboard/optimized');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // Keep cached for 5 minutes
    refetchOnWindowFocus: false, // Reduce unnecessary API calls
    retry: 2, // Retry failed requests
  });
}

// Legacy compatibility for existing dashboard components
export function useDashboardStats(period: 'monthly' | 'annual') {
  const { data, isLoading, error } = useOptimizedDashboard();
  
  if (!data) {
    return { data: null, isLoading, error };
  }
  
  const stats = period === 'monthly' ? data.monthlyStats : data.annualStats;
  
  return {
    data: stats,
    isLoading,
    error,
    user: data.user,
    recentGigs: data.recentGigs
  };
}

// User data hook with optimization
export function useOptimizedUser() {
  const { data, isLoading, error } = useOptimizedDashboard();
  
  return {
    data: data?.user || null,
    isLoading,
    error
  };
}

// Recent gigs hook with optimization  
export function useOptimizedRecentGigs() {
  const { data, isLoading, error } = useOptimizedDashboard();
  
  return {
    data: data?.recentGigs || [],
    isLoading,
    error
  };
}