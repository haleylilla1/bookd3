import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Network error getting session:', error);
        // Don't show error toast for initial load
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: name ? { name } : undefined
        }
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        toast({
          title: 'Check Your Email',
          description: 'Please check your email to confirm your account.',
        });
      }

      return { error: null };
    } catch (networkError: any) {
      console.error('Network error during sign up:', networkError);
      return { 
        error: {
          message: 'Connection failed. Please check your internet connection and try again.',
          name: 'NetworkError'
        }
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      return { error: error || null };
    } catch (networkError: any) {
      console.error('Network error during sign in:', networkError);
      return { 
        error: {
          message: 'Connection failed. Please check your internet connection and try again.',
          name: 'NetworkError'
        }
      };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
    } catch (networkError) {
      console.error('Network error during sign out:', networkError);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error || null };
    } catch (networkError: any) {
      console.error('Network error during password reset:', networkError);
      return { 
        error: {
          message: 'Connection failed. Please check your internet connection and try again.',
          name: 'NetworkError'
        }
      };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword
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