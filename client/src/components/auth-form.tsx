import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required")
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

const resetRequestSchema = z.object({
  email: z.string().email("Please enter a valid email")
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters")
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;
type ResetRequestData = z.infer<typeof resetRequestSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

interface AuthFormProps {
  onSuccess: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset-request' | 'reset-password'>('login');
  const [resetToken, setResetToken] = useState('');
  const { toast } = useToast();

  // Check for reset token in URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('reset_token');

    if (token) {
      console.log('🔑 SECURITY: Reset token detected - entering secure reset mode:', token);

      // NUCLEAR OPTION: Destroy ALL possible authentication data
      // Clear all cookies with every possible combination
      const cookieNames = ['sessionId', 'connect.sid', 'session', 'giggy.session', 'auth', 'token', 'user'];
      const domains = ['', '.bookd.tools', 'bookd.tools', '.localhost', 'localhost'];
      const paths = ['/', '/auth', '/api'];
      
      // Multiple clearing attempts with different strategies
      cookieNames.forEach(name => {
        domains.forEach(domain => {
          paths.forEach(path => {
            const domainPart = domain ? `; domain=${domain}` : '';
            const pathPart = `; path=${path}`;
            // Clear with different expiration formats
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC${pathPart}${domainPart}`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${pathPart}${domainPart}`;
            document.cookie = `${name}=; max-age=0${pathPart}${domainPart}`;
          });
        });
      });
      
      // Additional cookie clearing with split method
      document.cookie.split(";").forEach(function(c) { 
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.bookd.tools";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=bookd.tools";
      });
      
      localStorage.clear();
      sessionStorage.clear();

      // Force multiple logout attempts for security
      Promise.all([
        fetch("/api/auth/logout", { method: "POST", credentials: "include" }),
        fetch("/api/auth/logout", { method: "POST", credentials: "omit" }),
        fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      ]).catch(() => {
        console.log('Logout requests completed (expected to fail during reset)');
      });

      // CRITICAL: Validate token and get user info before showing form
      fetch("/api/auth/validate-reset-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      })
      .then(response => response.json())
      .then(data => {
        if (data.valid) {
          console.log('✅ Token validated for user:', data.user.email);
          
          // Set the form to password reset mode
          setMode('reset-password');
          
          // Populate the token field securely
          resetPasswordForm.setValue('token', token);
          
          // Show user info in toast for confirmation
          toast({
            title: "Password Reset",
            description: `Resetting password for ${data.user.email}`,
          });
        } else {
          console.log('❌ Invalid token');
          toast({
            title: "Invalid Reset Link",
            description: "This reset link is invalid or has expired.",
            variant: "destructive",
          });
          setMode('login');
        }
      })
      .catch(error => {
        console.error('Token validation failed:', error);
        toast({
          title: "Reset Link Error",
          description: "Could not validate reset link. Please try again.",
          variant: "destructive",
        });
        setMode('login');
      });

      // Clean the URL to prevent token exposure
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reset_token');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' }
  });

  const resetRequestForm = useForm<ResetRequestData>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' }
  });

  const resetPasswordForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      newPassword: ""
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. Please log in with your new password.",
      });
      setMode('login');
      resetPasswordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Password Reset Failed",
        description: error.message || "Failed to reset password. The link may be expired.",
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      return apiRequest('POST', '/api/auth/login', data);
    },
    onSuccess: () => {
      toast({
        title: "Login successful",
        description: "Welcome back!"
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials",
        variant: "destructive"
      });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      return apiRequest('POST', '/api/auth/register', data);
    },
    onSuccess: () => {
      toast({
        title: "Registration successful",
        description: "Welcome to Bookd!"
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  const resetRequestMutation = useMutation({
    mutationFn: async (data: ResetRequestData) => {
      const response = await apiRequest('POST', '/api/auth/reset-password-request', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Reset link sent",
        description: data.developmentResetUrl ? "Development reset link available in console" : "Check your email for the reset link"
      });

      // In development, show the reset URL in console for manual testing
      if (data.developmentResetUrl) {
        console.log('🔗 Development Reset Link:', data.developmentResetUrl);

        // Note: Auto-navigation removed - user should click email link or console link
        // This allows testing of the actual email flow
      }
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  const onLogin = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  const onResetRequest = (data: ResetRequestData) => {
    resetRequestMutation.mutate(data);
  };

  const onResetPassword = (data: ResetPasswordData) => {
    resetPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {mode === 'login' && 'bookd'}
            {mode === 'register' && 'Create Account'}
            {mode === 'reset-request' && 'Reset Password'}
            {mode === 'reset-password' && 'Set New Password'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'register' && 'Get started with your gig tracking'}
            {mode === 'reset-request' && 'Enter your email to reset your password'}
            {mode === 'reset-password' && 'Enter your new password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="Enter your email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Don't have an account? Sign up
                  </button>
                  <br />
                  <button
                    type="button"
                    onClick={() => setMode('reset-request')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot your password?
                  </button>
                </div>
              </form>
            </Form>
          )}

          {mode === 'register' && (
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Enter your name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="Enter your email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Create a password (min 6 characters)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            </Form>
          )}

          {mode === 'reset-request' && (
            <Form {...resetRequestForm}>
              <form onSubmit={resetRequestForm.handleSubmit(onResetRequest)} className="space-y-4">
                <FormField
                  control={resetRequestForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="Enter your email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={resetRequestMutation.isPending}
                >
                  {resetRequestMutation.isPending ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            </Form>
          )}

          {mode === 'reset-password' && (
            <Form {...resetPasswordForm}>
              <form onSubmit={resetPasswordForm.handleSubmit(onResetPassword)} className="space-y-4">
                <FormField
                  control={resetPasswordForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input type="hidden" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetPasswordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your new password (min 6 characters)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}