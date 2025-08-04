import React, { useEffect } from "react";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { initializeIOSOptimizations } from "@/lib/ios-mobile-optimization";
import Dashboard from "@/components/dashboard";
import Auth from "@/pages/auth";
import Home from "@/pages/home";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  // Initialize iOS optimizations on app startup
  useEffect(() => {
    initializeIOSOptimizations();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Switch>
          <Route path="/auth" component={Auth} />
          <Route path="/profile" component={Profile} />
          <Route path="/home" component={Home} />
          <Route path="/" component={Dashboard} />
          <Route>
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
              </div>
            </div>
          </Route>
        </Switch>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;