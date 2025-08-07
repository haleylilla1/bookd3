import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Building, UserPlus, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import EmergencyPostForm from '@/components/emergency-post-form';

// Agency registration schema
const agencySignupSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  companyName: z.string().min(2, 'Company name is required'),
  contactName: z.string().min(2, 'Contact name is required'),
  phoneNumber: z.string().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Agency login schema
const agencyLoginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type AgencySignupForm = z.infer<typeof agencySignupSchema>;
type AgencyLoginForm = z.infer<typeof agencyLoginSchema>;

export default function AgencyPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agencyInfo, setAgencyInfo] = useState(null);
  const { toast } = useToast();

  const signupForm = useForm<AgencySignupForm>({
    resolver: zodResolver(agencySignupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      contactName: '',
      phoneNumber: '',
      website: '',
      description: '',
    },
  });

  const loginForm = useForm<AgencyLoginForm>({
    resolver: zodResolver(agencyLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSignup = async (data: AgencySignupForm) => {
    try {
      const response = await apiRequest('POST', '/api/agencies/register', {
        email: data.email,
        password: data.password,
        companyName: data.companyName,
        contactName: data.contactName,
        phoneNumber: data.phoneNumber,
        website: data.website,
        description: data.description,
      });
      
      if (response.ok) {
        const result = await response.json();
        setAgencyInfo(result.agency);
        setIsAuthenticated(true);
        
        toast({
          title: "Registration Successful!",
          description: "Welcome to the agency portal. You can now post emergency gigs.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Agency signup error:', error);
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "There was an error creating your agency account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async (data: AgencyLoginForm) => {
    try {
      const response = await apiRequest('POST', '/api/agencies/login', {
        email: data.email,
        password: data.password,
      });
      
      if (response.ok) {
        const result = await response.json();
        setAgencyInfo(result.agency);
        setIsAuthenticated(true);
        
        toast({
          title: "Login Successful!",
          description: `Welcome back, ${result.agency.companyName}!`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
    } catch (error) {
      console.error('Agency login error:', error);
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Agency Portal</h1>
            <p className="text-gray-600">Post emergency brand ambassador opportunities</p>
          </div>
          
          <EmergencyPostForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agency Portal</h1>
          <p className="text-gray-600">Post emergency brand ambassador opportunities</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Access Agency Portal</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="agency@company.com" {...field} />
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
                            <Input type="password" placeholder="Enter your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      <LogIn className="w-4 h-4 mr-2" />
                      Login to Agency Portal
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="signup">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Marketing Agency" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contact@yourcompany.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Minimum 8 characters" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create Agency Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Agency accounts are for companies posting brand ambassador opportunities.</p>
          <p>Individual workers should use the main Bookd app.</p>
        </div>
      </div>
    </div>
  );
}