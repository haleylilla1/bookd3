import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function MobileAuthPage() {
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

  const validateForm = () => {
    if (!formData.email.trim() || !formData.password.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
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

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin 
        ? { 
            email: formData.email.trim().toLowerCase(), 
            password: formData.password 
          }
        : { 
            name: formData.name.trim(), 
            email: formData.email.trim().toLowerCase(), 
            password: formData.password 
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Authentication failed" }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: data.message || `${isLogin ? 'Login' : 'Registration'} successful!`,
      });
      
      // Give toast time to show, then redirect
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      
    } catch (error) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Authentication failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mobile-optimized input styles
  const inputStyle = {
    width: '100%',
    minHeight: '50px',
    fontSize: '16px', // Prevents iOS zoom
    padding: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#000000',
    outline: 'none',
    WebkitAppearance: 'none' as const,
    boxSizing: 'border-box' as const,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Simple Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">bookd</h1>
          <p className="text-gray-600">Work different.</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={loading}
                    style={inputStyle}
                    autoComplete="name"
                    autoCorrect="off"
                    autoCapitalize="words"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={loading}
                  style={inputStyle}
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    disabled={loading}
                    style={{
                      ...inputStyle,
                      paddingRight: '50px'
                    }}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    disabled={loading}
                    style={inputStyle}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setFormData({ name: "", email: "", password: "", confirmPassword: "" });
                }}
                disabled={loading}
                className="text-sm"
              >
                {isLogin 
                  ? "Need an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </Button>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full mt-4 h-12 text-base"
                onClick={() => {
                  try {
                    window.location.href = "/api/auth/google";
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Google login unavailable. Please use email login.",
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}