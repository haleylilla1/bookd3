import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import HomePage from '@/pages/home';
import AuthForm from '@/components/auth-form';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        // Check for reset token - if present, show auth form directly
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset_token');

        if (resetToken) {
          console.log('🔑 Reset token detected - showing auth form');
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        // Normal authentication check
        const response = await fetch('/api/auth/user', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('✅ User authenticated:', userData.email);
          if (mounted) {
            setUser(userData);
          }
        } else {
          console.log('❌ User not authenticated');
          if (mounted) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show auth form
  if (!user) {
    return <AuthForm />;
  }

  // User is authenticated, show main app
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;