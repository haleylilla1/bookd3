// Frontend Klaviyo integration for user tracking
declare global {
  interface Window {
    klaviyo?: {
      push: (args: any[]) => void;
      identify: (properties: Record<string, any>) => void;
      track: (eventName: string, properties?: Record<string, any>) => void;
    };
  }
}

class KlaviyoClient {
  private isInitialized = false;

  // Initialize Klaviyo tracking script
  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    
    // For now, we'll track events through backend API calls
    // Frontend tracking can be enabled later with proper public key setup
    console.log('Klaviyo backend tracking initialized');
    this.isInitialized = true;
  }

  // Identify user after login (backend tracking)
  identify(userProperties: {
    email: string;
    name?: string;
    subscriptionTier?: string;
    signupDate?: string;
  }) {
    if (!this.isInitialized) return;
    
    // Track login event through backend API
    console.log('User identified in Klaviyo:', userProperties.email);
    // Backend already handles user identification during login
  }

  // Track frontend events (backend API)
  track(eventName: string, properties: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    // For now, just log - backend handles most tracking automatically
    console.log('Klaviyo event:', eventName, properties);
  }

  // Specialized tracking methods
  trackPageView(pageName: string) {
    this.track('Page Viewed', {
      'page_name': pageName,
      'url': window.location.href
    });
  }

  trackGigFormStarted() {
    this.track('Gig Form Started', {
      'form_type': 'create_gig'
    });
  }

  trackExpenseFormStarted() {
    this.track('Expense Form Started', {
      'form_type': 'create_expense'
    });
  }

  trackDashboardViewed(metrics: {
    totalEarnings?: number;
    totalExpenses?: number;
    gigCount?: number;
  }) {
    this.track('Dashboard Viewed', {
      'total_earnings': metrics.totalEarnings,
      'total_expenses': metrics.totalExpenses,
      'gig_count': metrics.gigCount
    });
  }

  trackFeatureUsed(featureName: string, context?: Record<string, any>) {
    this.track('Feature Used', {
      'feature_name': featureName,
      ...context
    });
  }

  // Reset user on logout
  reset() {
    if (!this.isInitialized) return;
    console.log('Klaviyo user logged out');
  }
}

export const klaviyo = new KlaviyoClient();

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  klaviyo.init();
}