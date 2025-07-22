import { useState } from 'react';
import { useAuth } from '@/hooks/useSupabaseProxyAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SupabaseProxyAuthPage() {
  const { signInMutation, signUpMutation, resetPasswordMutation } = useAuth();
  
  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({ name: '', email: '', password: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    signInMutation.mutate(signInData);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    signUpMutation.mutate(signUpData);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    resetPasswordMutation.mutate({ email: resetEmail });
  };

  if (showResetForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
            <CardDescription>
              Enter your email to receive password reset instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetForm(false)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="flex-1"
                >
                  {resetPasswordMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Column - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Welcome to Bookd
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your financial companion for gig work
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card>
                <CardHeader>
                  <CardTitle>Sign In to Your Account</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your gig finances
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signInEmail">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signInEmail"
                          type="email"
                          placeholder="your@email.com"
                          value={signInData.email}
                          onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signInPassword">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signInPassword"
                          type="password"
                          placeholder="Your password"
                          value={signInData.password}
                          onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={signInMutation.isPending}
                      className="w-full"
                    >
                      {signInMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowResetForm(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card>
                <CardHeader>
                  <CardTitle>Create Your Account</CardTitle>
                  <CardDescription>
                    Join thousands of gig workers managing their finances with Bookd
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signUpName">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signUpName"
                          type="text"
                          placeholder="Your full name"
                          value={signUpData.name}
                          onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signUpEmail">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signUpEmail"
                          type="email"
                          placeholder="your@email.com"
                          value={signUpData.email}
                          onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signUpPassword">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="signUpPassword"
                          type="password"
                          placeholder="Create a password (min 6 characters)"
                          value={signUpData.password}
                          onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    {signUpData.password && signUpData.password.length < 6 && (
                      <Alert>
                        <AlertDescription>
                          Password must be at least 6 characters long
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      disabled={signUpMutation.isPending || signUpData.password.length < 6}
                      className="w-full"
                    >
                      {signUpMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Column - Hero */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-purple-700 text-white p-12 items-center justify-center">
        <div className="max-w-md text-center">
          <h2 className="text-4xl font-bold mb-6">Work Different</h2>
          <p className="text-xl text-blue-100 mb-8">
            Track your gigs, manage expenses, and optimize your earnings with intelligent insights.
          </p>
          
          <div className="space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-300 mt-2"></div>
              <div>
                <h3 className="font-semibold">Smart Financial Tracking</h3>
                <p className="text-blue-100">Comprehensive income and expense management</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-purple-300 mt-2"></div>
              <div>
                <h3 className="font-semibold">Professional Reports</h3>
                <p className="text-blue-100">Generate detailed tax and earnings reports</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-indigo-300 mt-2"></div>
              <div>
                <h3 className="font-semibold">Multi-Platform Sync</h3>
                <p className="text-blue-100">Access your data anywhere, anytime</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}