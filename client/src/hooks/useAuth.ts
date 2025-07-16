// Legacy useAuth hook - forwards to Replit Auth
import { useAuth as useReplitAuth } from '@/lib/replit-auth';

export function useAuth() {
  const auth = useReplitAuth();
  
  // Add placeholder functions for legacy compatibility
  return {
    ...auth,
    exportData: () => {
      console.log('Export data not implemented with Replit Auth');
    },
    isExporting: false
  };
}

export default useAuth;