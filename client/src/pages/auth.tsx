import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const { toast } = useToast();

  // Prevent zoom on mobile input focus
  const inputProps = {
    style: { fontSize: '16px' }, // Prevents iOS zoom
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return false;
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter your full name.",
          variant: "destructive",
        });
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    console.log(`${isLogin ? 'Login' : 'Registration'} attempt:`, formData.email);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin 
        ? { email: formData.email.trim(), password: formData.password }
        : { 
            name: formData.name.trim(), 
            email: formData.email.trim(), 
            password: formData.password 
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Cache-Control": "no-cache",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      console.log(`🔍 ${isLogin ? 'Login' : 'Registration'} response:`, response.status);
      console.log('🔍 Response headers:', response.headers.get('content-type'));
      
      // Debug: log first few characters of response to identify HTML vs JSON
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      console.log('🔍 Response preview:', responseText.substring(0, 200));

      if (response.ok) {
        let result;
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          try {
            result = await response.json();
            console.log("Success:", result);
          } catch (jsonError) {
            console.error("JSON parsing error:", jsonError);
            // If JSON parsing fails but response is ok, assume success
            result = { message: "Authentication successful" };
          }
        } else {
          // Non-JSON response but successful
          result = { message: "Authentication successful" };
        }
        
        toast({
          title: isLogin ? "Welcome back!" : "Welcome to Bookd!",
          description: isLogin 
            ? "You've been successfully logged in." 
            : "Your account has been created successfully.",
        });
        
        // Redirect after small delay
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      } else {
        let error;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            error = await response.json();
            console.error(`${isLogin ? 'Login' : 'Registration'} error:`, error);
          } else {
            // Non-JSON error - might be HTML error page
            const errorText = await response.text();
            console.error(`Non-JSON error response:`, errorText.substring(0, 200));
            error = { message: `Server error: ${response.status} ${response.statusText}` };
          }
        } catch (jsonError) {
          console.error("Error JSON parsing failed:", jsonError);
          error = { message: `Authentication failed: ${response.status} ${response.statusText}` };
        }
        
        const errorMessage = error.error || error.message || "An unexpected error occurred";
        console.error("Displaying error to user:", errorMessage);
        
        toast({
          title: isLogin ? "Login Failed" : "Registration Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Network error:", error);
      
      // Network error - could be CORS, network connectivity, or server down
      toast({
        title: isLogin ? "Connection Error" : "Registration Error",
        description: "Unable to connect to server. Please check your internet connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    });
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  const inputStyle = {
    width: '100%',
    height: '48px',
    fontSize: '16px',
    padding: '12px 16px',
    border: '2px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#000000',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Bookd</h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Work different.</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin 
                ? "Sign in to your Bookd account" 
                : "Start tracking your gigs with Bookd"
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={loading}
                    style={inputStyle}
                    {...inputProps}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={loading}
                  style={inputStyle}
                  {...inputProps}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    disabled={loading}
                    style={{
                      ...inputStyle,
                      paddingRight: '50px'
                    }}
                    {...inputProps}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {!isLogin && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Password must be at least 6 characters long
                  </p>
                )}
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    disabled={loading}
                    style={inputStyle}
                    {...inputProps}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ name: "", email: "", password: "", confirmPassword: "" });
                }}
                disabled={loading}
              >
                {isLogin 
                  ? "Need an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full text-base"
              onClick={() => {
                try {
                  window.location.href = "/api/auth/google";
                } catch (error) {
                  console.error("Google auth redirect failed:", error);
                  toast({
                    title: "Error",
                    description: "Unable to redirect to Google. Please try the email login.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}