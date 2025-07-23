import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface RecoverySystemContextType {
  activeRecoveries: Map<string, any>;
  registerRecovery: (formKey: string, data: any) => void;
  clearRecovery: (formKey: string) => void;
  getRecovery: (formKey: string) => any;
  hasRecovery: (formKey: string) => boolean;
  globalRecoveryCount: number;
}

const RecoverySystemContext = createContext<RecoverySystemContextType | null>(null);

/**
 * Global recovery system provider for managing recovery state across the app
 */
export function RecoverySystemProvider({ children }: { children: ReactNode }) {
  const [activeRecoveries, setActiveRecoveries] = useState<Map<string, any>>(new Map());

  const registerRecovery = useCallback((formKey: string, data: any) => {
    setActiveRecoveries(prev => {
      const newMap = new Map(prev);
      newMap.set(formKey, data);
      return newMap;
    });
  }, []);

  const clearRecovery = useCallback((formKey: string) => {
    setActiveRecoveries(prev => {
      const newMap = new Map(prev);
      newMap.delete(formKey);
      return newMap;
    });
  }, []);

  const getRecovery = useCallback((formKey: string) => {
    return activeRecoveries.get(formKey);
  }, [activeRecoveries]);

  const hasRecovery = useCallback((formKey: string) => {
    return activeRecoveries.has(formKey);
  }, [activeRecoveries]);

  const globalRecoveryCount = activeRecoveries.size;

  return (
    <RecoverySystemContext.Provider
      value={{
        activeRecoveries,
        registerRecovery,
        clearRecovery,
        getRecovery,
        hasRecovery,
        globalRecoveryCount
      }}
    >
      {children}
    </RecoverySystemContext.Provider>
  );
}

export function useRecoverySystemContext() {
  const context = useContext(RecoverySystemContext);
  if (!context) {
    throw new Error('useRecoverySystemContext must be used within a RecoverySystemProvider');
  }
  return context;
}