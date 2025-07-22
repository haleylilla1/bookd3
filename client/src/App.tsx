import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/useSupabaseAuth';
import HomePage from '@/pages/home';
import SupabaseAuthPage from '@/pages/supabase-auth';
import NotFound from '@/pages/not-found';
import { RecoverySystemProvider } from '@/components/recovery-system-provider';
import { GlobalRecoveryIndicator } from '@/components/global-recovery-indicator';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {user ? (
        <Route path="/" component={HomePage} />
      ) : (
        <Route path="/" component={SupabaseAuthPage} />
      )}
      <Route path="/auth" component={SupabaseAuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RecoverySystemProvider>
          <AppRouter />
          <GlobalRecoveryIndicator />
          <Toaster />
        </RecoverySystemProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;