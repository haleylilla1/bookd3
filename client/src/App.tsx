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
        // ABSOLUTE FIRST PRIORITY: Check for reset token and completely block authentication
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset_token');

        if (resetToken) {
          console.log('🚫 NUCLEAR RESET TOKEN DETECTED - COMPLETE AUTHENTICATION SHUTDOWN');
          console.log('🚫 Token:', resetToken);
          console.log('🚫 URL:', window.location.href);
          console.log('🚫 User Agent:', navigator.userAgent);

          // NUCLEAR OPTION: Immediately block everything
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }

          // GLOBAL AUTHENTICATION SHUTDOWN
          window.NUCLEAR_RESET_MODE = true;
          window.AUTHENTICATION_DISABLED = true;

          // NUCLEAR OPTION: Completely destroy all authentication state
          // Clear ALL cookies with every possible combination
          const allCookieNames = [
            'sessionId', 'connect.sid', 'session', 'giggy.session', 
            'auth', 'token', 'user', 'login', 'sess', 'sid'
          ];
          
          allCookieNames.forEach(name => {
            // Clear with every possible domain and path combination
            const domains = ['', '.bookd.tools', 'bookd.tools', '.localhost', 'localhost'];
            const paths = ['/', '/api', '/auth'];
            
            domains.forEach(domain => {
              paths.forEach(path => {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; ${domain ? `domain=${domain};` : ''}`;
              });
            });
          });

          // Clear storage
          localStorage.clear();
          sessionStorage.clear();

          // Clear any cached auth data in memory
          if (window.localStorage) {
            window.localStorage.clear();
          }
          if (window.sessionStorage) {
            window.sessionStorage.clear();
          }

          // COMPLETELY PREVENT any auth API calls
          window.RESET_MODE_ACTIVE = true;
          
          console.log('🚫 ALL AUTHENTICATION BLOCKED - RESET MODE ACTIVE');
          return; // STOP COMPLETELY - do not proceed with any auth checks
        }

        // NUCLEAR PROTECTION: No auth checks if reset mode is active
        if (window.RESET_MODE_ACTIVE || window.NUCLEAR_RESET_MODE || window.AUTHENTICATION_DISABLED) {
          console.log('🚫 NUCLEAR RESET MODE - All authentication permanently disabled');
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        // Normal authentication check (only when no reset token)
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
        console.log("Auth check failed:", error);
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