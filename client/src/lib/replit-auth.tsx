import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import React, { useState } from 'react';

// User type for Replit Auth
export interface ReplitUser {
  id: number;
  replitId: string;
  username: string;
  email?: string;
  displayName?: string;
  profileImageUrl?: string;
}

// Auth status response
export interface AuthStatus {
  authenticated: boolean;
  user?: ReplitUser;
}

// Custom hook for authentication status
export function useAuth() {
  const queryClient = useQueryClient();

  const { data: authStatus, isLoading, error } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: user, isLoading: userLoading } = useQuery<ReplitUser>({
    queryKey: ['/api/user'],
    enabled: authStatus?.authenticated || false,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      // Redirect to login endpoint
      window.location.href = '/auth/login';
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Redirect to logout endpoint
      window.location.href = '/auth/logout';
    },
    onSuccess: () => {
      // Clear all queries after logout
      queryClient.clear();
    },
  });

  return {
    user,
    isAuthenticated: authStatus?.authenticated || false,
    isLoading: isLoading || userLoading,
    error,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}

// Bookd Authentication Form Component
function BookdAuthForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Instead of making API calls, directly redirect to Replit Auth
      // This provides seamless authentication experience
      window.location.href = '/auth/login';
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">bookd</h2>
          <p className="mt-2 text-sm text-gray-600">for those who don't 9 to 5</p>
        </div>
        
        <div className="mt-8 space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            {errorMessage && (
              <div className="text-red-600 text-sm text-center">
                {errorMessage}
              </div>
            )}
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Redirecting...' : 'Continue with Bookd'}
            </button>
          </form>
          
          <div className="text-center">
            <p className="mt-2 text-xs text-gray-500">
              Secure authentication powered by Replit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
    return <BookdAuthForm />;
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