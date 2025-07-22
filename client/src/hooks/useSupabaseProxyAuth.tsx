import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { useMutation, useQuery, UseMutationResult } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type User = {
  id: string;
  email: string;
  name?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  signInMutation: UseMutationResult<User, Error, { email: string; password: string }>;
  signUpMutation: UseMutationResult<User, Error, { email: string; password: string; name?: string }>;
  signOutMutation: UseMutationResult<void, Error, void>;
  resetPasswordMutation: UseMutationResult<void, Error, { email: string }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check current user on mount
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null; // Not authenticated
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    retry: false,
  });

  useEffect(() => {
    setUser(userData || null);
    setIsLoading(userLoading);
  }, [userData, userLoading]);

  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log('🔐 Signing in with server proxy...');
      
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Sign in failed');
      }

      return data.user;
    },
    onSuccess: (userData: User) => {
      console.log('✅ Sign in successful:', userData.email);
      setUser(userData);
      queryClient.setQueryData(['/api/auth/user'], userData);
      toast({
        title: "Signed in successfully",
        description: `Welcome back, ${userData.email}!`,
      });
    },
    onError: (error: Error) => {
      console.error('❌ Sign in failed:', error.message);
      setError(error);
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name?: string }) => {
      console.log('📝 Signing up with server proxy...');
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Sign up failed');
      }

      return data.user;
    },
    onSuccess: (userData: User) => {
      console.log('✅ Sign up successful:', userData.email);
      setUser(userData);
      queryClient.setQueryData(['/api/auth/user'], userData);
      toast({
        title: "Account created successfully",
        description: `Welcome to Bookd, ${userData.email}!`,
      });
    },
    onError: (error: Error) => {
      console.error('❌ Sign up failed:', error.message);
      setError(error);
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      console.log('👋 Signing out...');
      
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Sign out failed');
      }
    },
    onSuccess: () => {
      console.log('✅ Sign out successful');
      setUser(null);
      queryClient.setQueryData(['/api/auth/user'], null);
      queryClient.clear(); // Clear all cached data
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Sign out failed:', error.message);
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      console.log('🔑 Requesting password reset...');
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Password reset failed');
      }

      return data;
    },
    onSuccess: () => {
      console.log('✅ Password reset email sent');
      toast({
        title: "Password reset sent",
        description: "Check your email for password reset instructions.",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Password reset failed:', error.message);
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        signInMutation,
        signUpMutation,
        signOutMutation,
        resetPasswordMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}