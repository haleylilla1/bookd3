import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/error-boundary";
import { useState, useEffect } from "react";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import { AuthForm } from "@/components/auth-form";
import NotFound from "@/pages/not-found";

function Router() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function checkAuth() {
      try {
        // Check if there's a reset token in the URL - if so, don't auto-authenticate
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset_token');
        
        if (resetToken) {
          // For reset tokens, clear any existing session and show auth form
          console.log('🔄 Reset token detected, clearing cookies and skipping auth check:', resetToken);
          
          // Clear session cookie on client side
          document.cookie = 'sessionId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.bookd.tools;';
          document.cookie = 'sessionId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }
        
        const response = await fetch("/api/auth/user", {
          credentials: "include",
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (mounted) {
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            setUser(null);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.log("Auth check failed (normal for logged out users):", error);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    checkAuth();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Bookd...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {user ? (
        <>
          <Route path="/" component={Home} />
          <Route path="/profile" component={Profile} />
        </>
      ) : (
        <>
          <Route path="/login">
            <AuthForm onSuccess={() => window.location.reload()} />
          </Route>
          <Route path="/">
            <AuthForm onSuccess={() => window.location.reload()} />
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
