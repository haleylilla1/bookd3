import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/replit-auth';
import HomePage from '@/pages/home';
import ProfilePage from '@/pages/profile';
import BAProfilePage from '@/pages/ba-profile';
import EmergencyFeedPage from '@/pages/emergency-feed';
import EmergencyPostPage from '@/pages/emergency-post';
import NotFound from '@/pages/not-found';


function AppRouter() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/ba-profile" component={BAProfilePage} />
        <Route path="/emergency-feed" component={EmergencyFeedPage} />
        <Route path="/emergency-post" component={EmergencyPostPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;