import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || "https://e3a605a82a58b7bcda7ada1c8f676fbd@o4509788026765312.ingest.us.sentry.io/4509788821389312";
  
  if (!dsn) {
    console.warn("Sentry DSN not found - error monitoring disabled");
    return;
  }
  
  console.log("Initializing Sentry with DSN:", dsn.substring(0, 30) + "...");

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    environment: import.meta.env.MODE, // 'development' or 'production'
    
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    
    // Enable PII data collection (IP addresses, user agent, etc.)
    sendDefaultPii: true,
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',
    
    // Error filtering
    beforeSend(event) {
      // Send all events in development for testing
      if (import.meta.env.MODE === 'development') {
        console.log('Sentry: Sending error event', event);
        return event;
      }
      return event;
    },
    
    // Additional options for your gig worker app
    initialScope: {
      tags: {
        component: 'bookd-frontend',
        platform: 'web'
      },
    },
  });
}

// Helper to set user context when they log in
export function setSentryUser(user: { id: number; email: string; name?: string }) {
  Sentry.setUser({
    id: user.id.toString(),
    email: user.email,
    username: user.name || user.email,
  });
}

// Helper to clear user context on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Helper to add breadcrumbs for important actions
export function addSentryBreadcrumb(message: string, category: string, data?: any) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}