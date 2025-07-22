import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useSupabaseAuth';
import { useLocation } from 'wouter';

export default function SupabaseAuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const { toast } = useToast();
  const { signUp, signIn, resetPassword } = useAuth();
  const [, setLocation] = useLocation();

  const validateForm = () => {
    if (!formData.email.trim() || !formData.password.trim()) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return false;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Weak Password',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return false;
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        toast({
          title: 'Name Required',
          description: 'Please enter your full name.',
          variant: 'destructive',
        });
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        toast({
          title: 'Password Mismatch',
          description: 'Passwords do not match.',
          variant: 'destructive',
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
      if (isLogin) {
        const { error } = await signIn(formData.email.trim(), formData.password);
        if (error) {
          throw new Error(error.message);
        }
        toast({
          title: 'Success',
          description: 'Logged in successfully!',
        });
        setLocation('/');
      } else {
        const { error } = await signUp(formData.email.trim(), formData.password, formData.name.trim());
        if (error) {
          throw new Error(error.message);
        }
        toast({
          title: 'Success',
          description: 'Account created successfully! Please check your email to verify your account.',
        });
        setLocation('/');
      }
    } catch (error) {
      toast({
        title: isLogin ? 'Login Failed' : 'Registration Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!formData.email.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address to reset your password.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await resetPassword(formData.email.trim());
      if (error) {
        throw new Error(error.message);
      }
      toast({
        title: 'Reset Email Sent',
        description: 'Check your email for password reset instructions.',
      });
    } catch (error) {
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Failed to send reset email',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-slate-800">
            {isLogin ? 'Welcome back' : 'Create account'}
          </CardTitle>
          <CardDescription className="text-center text-slate-600">
            {isLogin ? 'Sign in to your Bookd account' : 'Get started with Bookd today'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full"
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email Address
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter your email"
                className="w-full"
                style={{ fontSize: '16px' }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  className="w-full pr-10"
                  style={{ fontSize: '16px' }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-500" />
                  )}
                </Button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Confirm Password
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  className="w-full"
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-900 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-4 space-y-2">
            {isLogin && (
              <Button
                type="button"
                variant="ghost"
                onClick={handlePasswordReset}
                className="w-full text-sm text-slate-600 hover:text-slate-800"
              >
                Forgot your password?
              </Button>
            )}
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-sm text-slate-600 hover:text-slate-800"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}