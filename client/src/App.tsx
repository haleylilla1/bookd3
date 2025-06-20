import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/error-boundary";
import { useState, useEffect } from "react";
import Home from "@/pages/home";
import LandingPage from "@/components/landing-page";
import NotFound from "@/pages/not-found";

function Router() {
  // DEVELOPMENT MODE: Skip authentication for now
  const SKIP_AUTH = true;
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(!SKIP_AUTH);

  useEffect(() => {
    if (SKIP_AUTH) {
      // Skip authentication during development
      setUser({ id: 1, name: "Dev User", email: "dev@giggy.app" });
      setIsLoading(false);
      return;
    }

    let mounted = true;
    
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
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
          <p className="text-gray-600">Loading Giggy...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {user ? (
        <Route path="/" component={Home} />
      ) : (
        <Route path="/" component={LandingPage} />
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
          <div className="mobile-app">
            <Router />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
