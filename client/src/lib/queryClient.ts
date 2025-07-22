import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from './supabase';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get current session token from Supabase
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
    // Get current session token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      headers,
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
      staleTime: 2 * 60 * 1000, // 2 minutes for better data freshness
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
