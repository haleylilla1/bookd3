import { useState } from "react";
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
    defaultValues: { token: '', newPassword: '' }
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
      return apiRequest('POST', '/api/auth/reset-password-request', data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Reset link sent",
        description: "Check your email for the reset link"
      });
      if (data.token) {
        setResetToken(data.token);
        setMode('reset-password');
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

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      return apiRequest('POST', '/api/auth/reset-password', data);
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "You can now login with your new password"
      });
      setMode('login');
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
                    <FormItem>
                      <FormLabel>Reset Token</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Enter reset token"
                          {...field}
                          value={resetToken || field.value}
                        />
                      </FormControl>
                      <FormMessage />
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
                          placeholder="Enter new password (min 6 characters)"
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