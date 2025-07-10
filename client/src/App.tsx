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
        // IMMEDIATE check for reset token - highest priority
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset_token');

        if (resetToken) {
          console.log('🚫 CRITICAL SECURITY: Reset token detected - PREVENTING AUTO-LOGIN:', resetToken);
          console.log('🚫 Current URL:', window.location.href);

          // IMMEDIATELY block any authentication attempts
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }

          // Aggressively clear ALL authentication data
          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/"); 
          });
          
          // Clear with specific cookie names and domains
          const cookieNames = ['sessionId', 'connect.sid', 'session', 'giggy.session'];
          cookieNames.forEach(name => {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.bookd.tools;`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=bookd.tools;`;
          });
          
          localStorage.clear();
          sessionStorage.clear();

          // Force server-side session destruction
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            });
          } catch (logoutError) {
            console.log('Logout request failed (expected during reset):', logoutError);
          }

          return; // CRITICAL: Exit immediately to prevent any login
        }

        // Only check authentication if NO reset token
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