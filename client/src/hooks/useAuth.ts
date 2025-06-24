import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user", {
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.status === 401) {
          return null; // Not authenticated
        }
        
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.log("Auth check failed:", error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    throwOnError: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      // Invalidate the user query specifically
      queryClient.setQueryData(["/api/user"], null);
      // Force reload to clear any remaining state
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Logout Failed",
        description: "There was an error logging out",
        variant: "destructive",
      });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/auth/export-data");
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `giggy-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Data Export Complete",
        description: "Your data has been downloaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data",
        variant: "destructive",
      });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    logout: () => logoutMutation.mutate(),
    exportData: () => exportDataMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
    isExporting: exportDataMutation.isPending,
  };
}