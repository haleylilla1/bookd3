import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import { setSentryUser, clearSentryUser, addSentryBreadcrumb } from './sentry';
import React, { useState } from 'react';

// User type for traditional auth
export interface User {
  id: number;
  email: string;
  name: string;
  subscriptionTier?: string;
  profileImageUrl?: string;
}

// Auth status response
export interface AuthStatus {
  authenticated: boolean;
  user?: User;
}

// Custom hook for authentication status
export function useAuth() {
  const queryClient = useQueryClient();
  
  // Authentication state tracking for Sentry
  const debugAuth = (action: string, data?: any) => {
    // Production: Only use Sentry, no console logs
  };

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ['/api/user'],
    retry: false,
    staleTime: 0, // No stale time - always fresh auth check
    gcTime: 0, // No garbage collection time - always fresh auth check
  });

  // Debug authentication state changes and update Sentry
  React.useEffect(() => {
    if (user) {
      debugAuth('User authenticated', { 
        id: user.id, 
        email: user.email, 
        name: user.name 
      });
      // Set Sentry user context
      setSentryUser({
        id: user.id,
        email: user.email,
        name: user.name
      });
      addSentryBreadcrumb('User authenticated', 'auth', { userId: user.id });
    } else if (error) {
      debugAuth('Authentication failed', { error: error.message });
      addSentryBreadcrumb('Authentication failed', 'auth.error', { error: error.message });
    } else if (!isLoading && !user) {
      debugAuth('No authenticated user', {});
      clearSentryUser();
    }
  }, [user, error, isLoading]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return response.json();
    },
    onSuccess: (data) => {
      // Add Sentry breadcrumb for successful login
      addSentryBreadcrumb('User logged in', 'auth', { email: data.email });
      // Refresh user data after login
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/logout');
      return response.json();
    },
    onSuccess: () => {
      // Add Sentry breadcrumb and clear user context
      addSentryBreadcrumb('User logged out', 'auth');
      clearSentryUser();
      // Clear all queries after logout
      queryClient.clear();
      // Force full page reload to ensure complete logout
      window.location.href = '/';
    },
    onError: () => {
      // Force logout even if API call fails
      queryClient.clear();
      window.location.href = '/';
    },
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}



// Auth guard component
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Import and use the advanced auth form with proper React Hook Form
    const AuthForm = React.lazy(() => import('../components/auth-form'));
    return (
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>}>
        <AuthForm />
      </React.Suspense>
    );
  }

  return <>{children}</>;
}

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  );
}

export default {
  useAuth,
  AuthGuard,
  AuthProvider
};