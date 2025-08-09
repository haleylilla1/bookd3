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
import PrivacyPolicy from '@/pages/privacy-policy';
import TermsOfService from '@/pages/terms-of-service';

import AgencyPortal from '@/pages/agency';
import NotFound from '@/pages/not-found';
import { useEffect } from 'react';

function AppRouter() {
  // Auto-redirect agency subdomain to agency portal
  useEffect(() => {
    if (window.location.hostname === 'agency.bookd.tools' && window.location.pathname === '/') {
      window.location.pathname = '/agency';
    }
  }, []);

  return (
    <Switch>
      {/* Public routes - no auth required */}
      <Route path="/agency" component={AgencyPortal} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      
      {/* All other routes require regular user authentication */}
      <Route path="/*">
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
      </Route>
    </Switch>
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