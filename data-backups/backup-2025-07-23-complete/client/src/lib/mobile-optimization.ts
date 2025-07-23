// Simple Mobile Optimization
// Fixes iOS zoom, touch targets, and network timeouts with minimal code

// iOS zoom prevention: Just set 16px font size in CSS - no JavaScript needed
// Touch targets: Just set min-height/width in CSS - no JavaScript needed
// Network timeouts: Simple retry wrapper

// Network timeout with retry - simple and reliable
export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 1s, 2s, 3s delay
    }
  }
  throw new Error('Max retries exceeded');
}

// Helper for API requests with retry
export async function apiRequest(method: string, url: string, data?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetchWithRetry(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// Simple init - no complex logic needed
export function initializeMobileOptimization() {
  // iOS zoom prevention and touch targets are handled by CSS
  // Network timeouts are handled by fetchWithRetry
  // That's it - no complex initialization needed
}