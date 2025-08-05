import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN || "https://e3a605a82a58b7bcda7ada1c8f676fbd@o4509788026765312.ingest.us.sentry.io/4509788821389312";
  
  if (!dsn) {
    console.warn("Sentry DSN not found - error monitoring disabled");
    return;
  }
  
  console.log("Initializing Sentry server with DSN:", dsn.substring(0, 30) + "...");

  Sentry.init({
    dsn,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    environment: process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.APP_VERSION || 'unknown',
    
    // Additional context for your backend
    initialScope: {
      tags: {
        component: 'bookd-backend',
        platform: 'node'
      },
    },
  });
}

// Helper to set user context for server-side events
export function setSentryUser(user: { id: number; email: string; name?: string }) {
  Sentry.setUser({
    id: user.id.toString(),
    email: user.email,
    username: user.name || user.email,
  });
}

// Helper to capture API errors with context
export function captureAPIError(error: Error, context: {
  endpoint: string;
  method: string;
  userId?: number;
  body?: any;
}) {
  Sentry.withScope((scope) => {
    scope.setTag('api_endpoint', context.endpoint);
    scope.setTag('http_method', context.method);
    if (context.userId) {
      scope.setUser({ id: context.userId.toString() });
    }
    if (context.body) {
      scope.setContext('request_body', context.body);
    }
    Sentry.captureException(error);
  });
}