// Mobile debugging utilities for distance calculation issues

export interface MobileDebugInfo {
  userAgent: string;
  platform: string;
  online: boolean;
  connection?: any;
  viewport: { width: number; height: number };
  supportsAbortController: boolean;
  supportsFetch: boolean;
  timestamp: string;
}

export function getMobileDebugInfo(): MobileDebugInfo {
  const nav = navigator as any;
  
  return {
    userAgent: nav.userAgent || 'Unknown',
    platform: nav.platform || 'Unknown',
    online: nav.onLine || false,
    connection: nav.connection ? {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt
    } : null,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    supportsAbortController: typeof AbortController !== 'undefined',
    supportsFetch: typeof fetch !== 'undefined',
    timestamp: new Date().toISOString()
  };
}

export function logMobileError(context: string, error: any, debugInfo?: MobileDebugInfo) {
  const info = debugInfo || getMobileDebugInfo();
  
  console.group(`🚨 Mobile Error: ${context}`);
  console.error('Error:', error);
  console.log('Debug Info:', info);
  console.log('Error Stack:', error?.stack);
  console.groupEnd();
  
  // Send to server for remote debugging if needed
  if (process.env.NODE_ENV === 'development') {
    fetch('/api/debug/mobile-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        error: {
          message: error?.message,
          name: error?.name,
          stack: error?.stack
        },
        debugInfo: info
      })
    }).catch(() => {
      // Silently fail if debug endpoint unavailable
    });
  }
}

export function validateMobileEnvironment(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!navigator.onLine) {
    issues.push('Device appears to be offline');
  }
  
  if (typeof fetch === 'undefined') {
    issues.push('Fetch API not supported');
  }
  
  if (typeof AbortController === 'undefined') {
    issues.push('AbortController not supported (timeouts may not work)');
  }
  
  const connection = (navigator as any).connection;
  if (connection && connection.effectiveType) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      issues.push('Slow network connection detected');
    }
  }
  
  if (window.innerWidth < 768) {
    // Mobile device - check for common issues
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      // Safari-specific issues
      if (userAgent.includes('version/15') || userAgent.includes('version/14')) {
        issues.push('Safari version may have fetch timeout issues');
      }
    }
    
    if (userAgent.includes('android') && userAgent.includes('webview')) {
      issues.push('Android WebView detected - may have CORS restrictions');
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}