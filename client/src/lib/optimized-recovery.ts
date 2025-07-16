import { useEffect, useRef, useCallback, useState } from 'react';

// Storage priorities for reliability
const STORAGE_PRIORITIES = ['localStorage', 'sessionStorage', 'indexedDB', 'memory'] as const;
type StorageType = typeof STORAGE_PRIORITIES[number];

interface OptimizedRecoveryConfig {
  formKey: string;
  formType: string;
  autoSave?: boolean;
  saveInterval?: number;
  maxRetries?: number;
  compressionEnabled?: boolean;
  onRecoveryFound?: (data: any) => void;
  onSaveSuccess?: (data: any) => void;
  onSaveError?: (error: Error) => void;
}

interface RecoveryData {
  data: any;
  timestamp: number;
  formType: string;
  storageSource: StorageType;
  checksum: string;
  version: number;
}

// In-memory fallback for extreme cases
const memoryStorage = new Map<string, string>();

// Optimized recovery system with intelligent storage management
export class OptimizedRecoverySystem {
  private static instance: OptimizedRecoverySystem;
  private recoveryCache = new Map<string, RecoveryData>();
  private saveQueue = new Map<string, NodeJS.Timeout>();
  private compressionWorker: Worker | null = null;
  private readonly VERSION = 1;

  private constructor() {
    this.initializeCompressionWorker();
  }

  static getInstance(): OptimizedRecoverySystem {
    if (!OptimizedRecoverySystem.instance) {
      OptimizedRecoverySystem.instance = new OptimizedRecoverySystem();
    }
    return OptimizedRecoverySystem.instance;
  }

  // Initialize compression worker for large data
  private initializeCompressionWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        // Create inline compression worker
        const workerCode = `
          function compress(data) {
            // Simple compression using basic RLE for repetitive data
            const str = typeof data === 'string' ? data : JSON.stringify(data);
            return str.length > 1000 ? str : str; // Simplified - real compression would use LZ77 etc.
          }
          
          function decompress(data) {
            return data; // Simplified - real decompression would reverse the compression
          }
          
          self.onmessage = function(e) {
            const { action, data, id } = e.data;
            try {
              const result = action === 'compress' ? compress(data) : decompress(data);
              self.postMessage({ id, result, success: true });
            } catch (error) {
              self.postMessage({ id, error: error.message, success: false });
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.compressionWorker = new Worker(URL.createObjectURL(blob));
      } catch (error) {
        console.warn('Compression worker initialization failed:', error);
      }
    }
  }

  // Generate checksum for data integrity
  private generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  // Intelligent storage selection based on data size and availability
  private selectOptimalStorage(dataSize: number): StorageType {
    // For small data, prefer localStorage
    if (dataSize < 50000) {
      try {
        localStorage.setItem('__test__', 'test');
        localStorage.removeItem('__test__');
        return 'localStorage';
      } catch (error) {
        // Fall through to next option
      }
    }

    // For medium data, try sessionStorage
    if (dataSize < 100000) {
      try {
        sessionStorage.setItem('__test__', 'test');
        sessionStorage.removeItem('__test__');
        return 'sessionStorage';
      } catch (error) {
        // Fall through to next option
      }
    }

    // For large data, use IndexedDB if available
    if (typeof indexedDB !== 'undefined') {
      return 'indexedDB';
    }

    // Final fallback to memory
    return 'memory';
  }

  // Efficient storage operations with automatic retry
  private async saveToStorage(key: string, data: string, storageType: StorageType, retries = 3): Promise<void> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        switch (storageType) {
          case 'localStorage':
            localStorage.setItem(key, data);
            // Immediate verification
            const verification = localStorage.getItem(key);
            if (verification !== data) {
              throw new Error('Data integrity check failed');
            }
            return;
            
          case 'sessionStorage':
            sessionStorage.setItem(key, data);
            return;
            
          case 'indexedDB':
            await this.saveToIndexedDB(key, data);
            return;
            
          case 'memory':
            memoryStorage.set(key, data);
            return;
        }
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  // IndexedDB operations for large data
  private async saveToIndexedDB(key: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RecoveryDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['recoveryStore'], 'readwrite');
        const store = transaction.objectStore('recoveryStore');
        
        const putRequest = store.put({ key, data, timestamp: Date.now() });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('recoveryStore')) {
          db.createObjectStore('recoveryStore', { keyPath: 'key' });
        }
      };
    });
  }

  // Retrieve data from storage with fallback chain
  private async retrieveFromStorage(key: string): Promise<{ data: string; source: StorageType } | null> {
    // Try storage types in order of preference
    for (const storageType of STORAGE_PRIORITIES) {
      try {
        let data: string | null = null;
        
        switch (storageType) {
          case 'localStorage':
            data = localStorage.getItem(key);
            break;
          case 'sessionStorage':
            data = sessionStorage.getItem(key);
            break;
          case 'indexedDB':
            data = await this.retrieveFromIndexedDB(key);
            break;
          case 'memory':
            data = memoryStorage.get(key) || null;
            break;
        }
        
        if (data) {
          return { data, source: storageType };
        }
      } catch (error) {
        console.warn(`Failed to retrieve from ${storageType}:`, error);
      }
    }
    
    return null;
  }

  // IndexedDB retrieval
  private async retrieveFromIndexedDB(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('RecoveryDB', 1);
      
      request.onerror = () => resolve(null);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['recoveryStore'], 'readonly');
        const store = transaction.objectStore('recoveryStore');
        
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.data : null);
        };
        getRequest.onerror = () => resolve(null);
      };
    });
  }

  // Smart save with deduplication and throttling
  async saveRecoveryData(config: OptimizedRecoveryConfig, formData: any): Promise<void> {
    const { formKey, formType, saveInterval = 2000 } = config;
    
    // Clear existing save timer
    if (this.saveQueue.has(formKey)) {
      clearTimeout(this.saveQueue.get(formKey)!);
    }
    
    // Throttle saves
    const saveTimer = setTimeout(async () => {
      try {
        const serializedData = JSON.stringify(formData);
        const checksum = this.generateChecksum(serializedData);
        
        // Check if data has actually changed
        const cached = this.recoveryCache.get(formKey);
        if (cached && cached.checksum === checksum) {
          return; // No changes, skip save
        }
        
        const recoveryData: RecoveryData = {
          data: formData,
          timestamp: Date.now(),
          formType,
          storageSource: this.selectOptimalStorage(serializedData.length),
          checksum,
          version: this.VERSION
        };
        
        // Save to optimal storage
        const storageKey = `optimized_recovery_${formKey}`;
        await this.saveToStorage(storageKey, JSON.stringify(recoveryData), recoveryData.storageSource);
        
        // Update cache
        this.recoveryCache.set(formKey, recoveryData);
        
        // Cleanup old storage formats
        this.cleanupLegacyStorage(formKey);
        
        if (config.onSaveSuccess) {
          config.onSaveSuccess(formData);
        }
        
      } catch (error) {
        console.error('Recovery save failed:', error);
        if (config.onSaveError) {
          config.onSaveError(error as Error);
        }
      } finally {
        this.saveQueue.delete(formKey);
      }
    }, saveInterval);
    
    this.saveQueue.set(formKey, saveTimer);
  }

  // Efficient recovery data retrieval
  async getRecoveryData(formKey: string): Promise<RecoveryData | null> {
    // Check cache first
    const cached = this.recoveryCache.get(formKey);
    if (cached) {
      return cached;
    }
    
    // Retrieve from storage
    const storageKey = `optimized_recovery_${formKey}`;
    const result = await this.retrieveFromStorage(storageKey);
    
    if (result) {
      try {
        const recoveryData: RecoveryData = JSON.parse(result.data);
        
        // Verify data integrity
        const dataChecksum = this.generateChecksum(JSON.stringify(recoveryData.data));
        if (dataChecksum !== recoveryData.checksum) {
          console.warn('Recovery data integrity check failed');
          return null;
        }
        
        // Update cache
        this.recoveryCache.set(formKey, recoveryData);
        
        return recoveryData;
      } catch (error) {
        console.error('Failed to parse recovery data:', error);
      }
    }
    
    return null;
  }

  // Check if recovery data exists
  async hasRecoveryData(formKey: string): Promise<boolean> {
    const data = await this.getRecoveryData(formKey);
    return data !== null;
  }

  // Clear recovery data
  async clearRecoveryData(formKey: string): Promise<void> {
    // Remove from cache
    this.recoveryCache.delete(formKey);
    
    // Clear from all storage types
    const storageKey = `optimized_recovery_${formKey}`;
    
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
    
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear sessionStorage:', error);
    }
    
    try {
      memoryStorage.delete(storageKey);
    } catch (error) {
      console.warn('Failed to clear memory storage:', error);
    }
    
    // Clear from IndexedDB
    try {
      await this.clearFromIndexedDB(storageKey);
    } catch (error) {
      console.warn('Failed to clear IndexedDB:', error);
    }
    
    // Clear legacy storage
    this.cleanupLegacyStorage(formKey);
  }

  // Clear from IndexedDB
  private async clearFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('RecoveryDB', 1);
      
      request.onerror = () => resolve();
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['recoveryStore'], 'readwrite');
        const store = transaction.objectStore('recoveryStore');
        
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
      };
    });
  }

  // Clean up legacy storage formats
  private cleanupLegacyStorage(formKey: string): void {
    const legacyKeys = [
      `autosave_${formKey}`,
      `autosave_${formKey}_timestamp`,
      `backup_autosave_${formKey}`,
      `backup_autosave_${formKey}_timestamp`,
      `session_autosave_${formKey}`,
      `session_autosave_${formKey}_timestamp`,
      `emergency_autosave_${formKey}`,
      `emergency_autosave_${formKey}_timestamp`
    ];
    
    legacyKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  }

  // Get system statistics
  getSystemStats(): {
    cacheSize: number;
    queueSize: number;
    supportedStorage: StorageType[];
    memoryUsage: number;
  } {
    return {
      cacheSize: this.recoveryCache.size,
      queueSize: this.saveQueue.size,
      supportedStorage: STORAGE_PRIORITIES.filter(type => {
        switch (type) {
          case 'localStorage':
            try {
              localStorage.setItem('__test__', 'test');
              localStorage.removeItem('__test__');
              return true;
            } catch {
              return false;
            }
          case 'sessionStorage':
            try {
              sessionStorage.setItem('__test__', 'test');
              sessionStorage.removeItem('__test__');
              return true;
            } catch {
              return false;
            }
          case 'indexedDB':
            return typeof indexedDB !== 'undefined';
          case 'memory':
            return true;
          default:
            return false;
        }
      }),
      memoryUsage: memoryStorage.size
    };
  }

  // Bulk operations for efficiency
  async bulkSaveRecoveryData(configs: { config: OptimizedRecoveryConfig; formData: any }[]): Promise<void> {
    const promises = configs.map(({ config, formData }) => 
      this.saveRecoveryData(config, formData)
    );
    
    await Promise.allSettled(promises);
  }

  async bulkGetRecoveryData(formKeys: string[]): Promise<Map<string, RecoveryData | null>> {
    const results = new Map<string, RecoveryData | null>();
    
    const promises = formKeys.map(async (formKey) => {
      const data = await this.getRecoveryData(formKey);
      results.set(formKey, data);
    });
    
    await Promise.allSettled(promises);
    return results;
  }
}

// Hook for using the optimized recovery system
export function useOptimizedRecovery(config: OptimizedRecoveryConfig) {
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const systemRef = useRef(OptimizedRecoverySystem.getInstance());

  // Check for existing recovery data on mount
  useEffect(() => {
    const checkRecovery = async () => {
      try {
        setIsLoading(true);
        const data = await systemRef.current.getRecoveryData(config.formKey);
        setRecoveryData(data);
        
        if (data && config.onRecoveryFound) {
          config.onRecoveryFound(data.data);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkRecovery();
  }, [config.formKey]);

  // Save recovery data
  const saveRecovery = useCallback(async (formData: any) => {
    try {
      setError(null);
      await systemRef.current.saveRecoveryData(config, formData);
    } catch (err) {
      setError(err as Error);
      if (config.onSaveError) {
        config.onSaveError(err as Error);
      }
    }
  }, [config]);

  // Clear recovery data
  const clearRecovery = useCallback(async () => {
    try {
      setError(null);
      await systemRef.current.clearRecoveryData(config.formKey);
      setRecoveryData(null);
    } catch (err) {
      setError(err as Error);
    }
  }, [config.formKey]);

  // Check if recovery data exists
  const hasRecovery = useCallback(async (): Promise<boolean> => {
    try {
      return await systemRef.current.hasRecoveryData(config.formKey);
    } catch (err) {
      setError(err as Error);
      return false;
    }
  }, [config.formKey]);

  return {
    recoveryData,
    isLoading,
    error,
    saveRecovery,
    clearRecovery,
    hasRecovery,
    systemStats: systemRef.current.getSystemStats()
  };
}

// Export the singleton instance
export const optimizedRecoverySystem = OptimizedRecoverySystem.getInstance();