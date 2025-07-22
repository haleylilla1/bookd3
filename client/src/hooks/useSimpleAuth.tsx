import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  // Check for existing session
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        if (response.status === 401) {
          return null;
        }
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        return await response.json();
      } catch (error) {
        console.log('No existing session found');
        return null;
      }
    },
    retry: false
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  const signUpMutation = useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name?: string }) => {
      const response = await apiRequest('POST', '/api/register', {
        email,
        password,
        username: name || email.split('@')[0]
      });
      return await response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      toast({
        title: 'Account Created',
        description: 'Welcome to Bookd! You can now start tracking your gigs.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Unable to create account. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await apiRequest('POST', '/api/login', {
        username: email,
        password
      });
      return await response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      toast({
        title: 'Welcome Back',
        description: 'Successfully logged in to Bookd.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password.',
        variant: 'destructive',
      });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
      queryClient.clear();
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await apiRequest('POST', '/api/reset-password', { email });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Reset Email Sent',
        description: 'Check your email for password reset instructions.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Unable to send reset email.',
        variant: 'destructive',
      });
    },
  });

  return (
    <AuthContext.Provider value={{
      user: user || null,
      loading,
      signUp: async (email: string, password: string, name?: string) => {
        try {
          await signUpMutation.mutateAsync({ email, password, name });
          return {};
        } catch (error) {
          return { error };
        }
      },
      signIn: async (email: string, password: string) => {
        try {
          await signInMutation.mutateAsync({ email, password });
          return {};
        } catch (error) {
          return { error };
        }
      },
      signOut: async () => {
        await signOutMutation.mutateAsync();
      },
      resetPassword: async (email: string) => {
        try {
          await resetPasswordMutation.mutateAsync({ email });
          return {};
        } catch (error) {
          return { error };
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}