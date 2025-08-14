import { QueryClient, QueryFunction } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    
    // Track API errors in Sentry
    if (res.status >= 500) {
      // Server errors
      Sentry.withScope((scope) => {
        scope.setTag('api_error', true);
        scope.setTag('http_status', res.status);
        scope.setContext('api_request', {
          url: res.url,
          status: res.status,
          statusText: res.statusText,
        });
        scope.setLevel('error');
        Sentry.captureException(error);
      });
    } else if (res.status >= 400 && res.status < 500) {
      // Client errors (4xx) - track but as info level
      Sentry.addBreadcrumb({
        message: `API client error: ${res.status}`,
        category: 'api',
        data: {
          url: res.url,
          status: res.status,
          response: text,
        },
        level: 'info',
      });
    }
    
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - reduced refresh frequency for Safari performance
      retry: (failureCount, error: any) => {
        // Don't retry on client errors
        if (error?.message?.includes('400') || error?.message?.includes('401') || 
            error?.message?.includes('403') || error?.message?.includes('404')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry on client errors or authentication issues
        if (error?.message?.includes('400') || error?.message?.includes('401') || 
            error?.message?.includes('403') || error?.message?.includes('404')) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
