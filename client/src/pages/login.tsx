import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address").max(100, "Email must be less than 100 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    console.log("Starting login process for:", data.email);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      console.log("Login response status:", response.status);
      console.log("Login response headers:", Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const result = await response.json();
        console.log("Login successful, result:", result);
        
        toast({
          title: "Welcome back!",
          description: "You've been successfully logged in.",
        });
        
        // Small delay to ensure session is established
        setTimeout(() => {
          console.log("Redirecting to home page");
          window.location.href = "/";
        }, 500);
      } else {
        const error = await response.json();
        console.log("Login failed, error:", error);
        
        toast({
          title: "Login Failed",
          description: error.message || "Invalid email or password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login request failed:", error);
      
      toast({
        title: "Login Error",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    
    // Enhanced validation for mobile
    if (!data.name.trim() || !data.email.trim() || !data.password.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to create your account.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      console.log("Attempting registration with:", { name: data.name, email: data.email });
      
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
        }),
      });

      console.log("Registration response status:", response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log("Registration successful:", result);
        
        toast({
          title: "Welcome to Giggy!",
          description: "Your account has been created successfully. You can now start tracking your gigs!",
        });
        
        // Force refresh auth state and redirect
        window.location.href = "/";
      } else {
        const error = await response.json();
        console.error("Registration failed:", error);
        
        toast({
          title: "Registration Failed",
          description: error.message || "Unable to create account. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please check your internet connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 touch-manipulation">
      <div className="w-full max-w-md space-y-6">
        {/* Giggy Branding */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Giggy</h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Work different.</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isRegisterMode ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-center">
              {isRegisterMode 
                ? "Start tracking your gigs with Giggy" 
                : "Sign in to your Giggy account"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Registration Success Notice */}
            {isRegisterMode && (
              <div className="text-center text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 p-3 rounded-md">
                Create your free Giggy account to start tracking gigs and earnings!
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Native Mobile Registration Form */}
            {isRegisterMode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={registerForm.watch('name') || ''}
                    onChange={(e) => registerForm.setValue('name', e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      height: '48px',
                      fontSize: '16px',
                      padding: '12px 16px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={registerForm.watch('email') || ''}
                    onChange={(e) => registerForm.setValue('email', e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      height: '48px',
                      fontSize: '16px',
                      padding: '12px 16px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={registerForm.watch('password') || ''}
                      onChange={(e) => registerForm.setValue('password', e.target.value)}
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        height: '48px',
                        fontSize: '16px',
                        padding: '12px 50px 12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={registerForm.watch('confirmPassword') || ''}
                      onChange={(e) => registerForm.setValue('confirmPassword', e.target.value)}
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        height: '48px',
                        fontSize: '16px',
                        padding: '12px 50px 12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button 
                  onClick={registerForm.handleSubmit(handleRegister)} 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </div>
            ) : (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
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
                            disabled={isLoading}
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
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password" 
                              {...field} 
                              disabled={isLoading}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={isLoading}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </Form>
            )}

            {/* Toggle between login and register */}
            <div className="text-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {isRegisterMode ? "Already have an account? " : "Don't have an account? "}
              </span>
              <Button
                variant="link"
                className="p-0 h-auto font-semibold"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  loginForm.reset();
                  registerForm.reset();
                }}
                disabled={isLoading}
              >
                {isRegisterMode ? "Sign in" : "Create account"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">© 2025 Giggy. Built for gig workers by gig workers.</div>
      </div>
    </div>
  );
}