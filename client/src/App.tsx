import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/replit-auth';
import HomePage from '@/pages/home';
import NotFound from '@/pages/not-found';
import { RecoverySystemProvider } from '@/components/recovery-system-provider';
import { GlobalRecoveryIndicator } from '@/components/global-recovery-indicator';

function AppRouter() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route component={NotFound} />
      </Switch>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RecoverySystemProvider>
        <AppRouter />
        <GlobalRecoveryIndicator />
        <Toaster />
      </RecoverySystemProvider>
    </QueryClientProvider>
  );
}

export default App;