// Mobile optimization utilities for network requests

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: number;
}

/**
 * Fetch with retry mechanism optimized for mobile networks
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 1.5
  } = retryOptions;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Return response if successful or if it's a client error (4xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      
      // Server error (5xx) - retry
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort or client-side errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      
      // Retry on network errors
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  throw lastError || new Error(`Failed to fetch after ${maxRetries + 1} attempts`);
}

/**
 * Optimized fetch for mobile with reduced payload and caching
 */
export async function mobileOptimizedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithRetry(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'max-age=300', // 5 minute cache
      ...options.headers
    }
  });
}