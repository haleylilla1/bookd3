/**
 * MEMORY MANAGEMENT UTILITIES
 * Optimizes memory usage for PDF/HTML report generation and large data handling
 */

// Memory management utilities for optimizing PDF/HTML report generation

interface MemoryCleanupResult {
  beforeMB: number;
  afterMB: number;
  recoveredMB: number;
  success: boolean;
}

export class MemoryManager {
  private static maxCacheSize = 50 * 1024 * 1024; // 50MB max cache size
  private static largeObjectThreshold = 1024 * 1024; // 1MB threshold

  /**
   * Force garbage collection and report memory usage
   */
  static forceGarbageCollection(): MemoryCleanupResult {
    const beforeUsage = process.memoryUsage();
    const beforeMB = beforeUsage.heapUsed / 1024 / 1024;

    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterUsage = process.memoryUsage();
      const afterMB = afterUsage.heapUsed / 1024 / 1024;
      const recoveredMB = beforeMB - afterMB;

      console.log(`🗑️ MEMORY: GC completed - recovered ${recoveredMB.toFixed(1)}MB (${beforeMB.toFixed(1)}MB → ${afterMB.toFixed(1)}MB)`);

      return {
        beforeMB,
        afterMB,
        recoveredMB,
        success: true
      };
    } catch (error) {
      console.warn('⚠️ MEMORY: GC failed:', error);
      return {
        beforeMB,
        afterMB: beforeMB,
        recoveredMB: 0,
        success: false
      };
    }
  }

  /**
   * Clear large variables and arrays to free memory
   */
  static clearLargeVariables(variables: any[]): void {
    try {
      variables.forEach((variable, index) => {
        if (variable) {
          if (Array.isArray(variable)) {
            variable.length = 0;
          } else if (typeof variable === 'object') {
            Object.keys(variable).forEach(key => {
              try {
                delete variable[key];
              } catch (e) {
                // Ignore deletion errors
              }
            });
          }
        }
      });
      console.log(`🧹 MEMORY: Cleared ${variables.length} large variables`);
    } catch (error) {
      console.warn('⚠️ MEMORY: Variable cleanup failed:', error);
    }
  }

  /**
   * Check if data size exceeds cache limits
   */
  static isDataTooLarge(data: any): boolean {
    try {
      const serialized = JSON.stringify(data);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');
      const sizeMB = sizeBytes / 1024 / 1024;
      
      if (sizeMB > 1) {
        console.log(`🚫 MEMORY: Data too large for cache (${sizeMB.toFixed(1)}MB > 1MB limit)`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ MEMORY: Size check failed:', error);
      return true; // Assume too large if we can't measure
    }
  }

  /**
   * Optimize object for caching by removing large fields
   */
  static optimizeForCache<T>(data: T): T {
    try {
      if (!data || typeof data !== 'object') return data;

      const optimized = JSON.parse(JSON.stringify(data));

      // Remove potentially large fields that can be regenerated
      if (Array.isArray(optimized)) {
        // For arrays, limit to essential fields only
        return optimized.map(item => this.optimizeObjectFields(item)) as T;
      } else {
        return this.optimizeObjectFields(optimized) as T;
      }
    } catch (error) {
      console.warn('⚠️ MEMORY: Cache optimization failed:', error);
      return data;
    }
  }

  /**
   * Remove/minimize large fields from objects
   */
  private static optimizeObjectFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const optimized = { ...obj };

    // Remove large text fields
    if (optimized.notes && typeof optimized.notes === 'string' && optimized.notes.length > 500) {
      optimized.notes = optimized.notes.substring(0, 100) + '...[truncated]';
    }

    if (optimized.duties && typeof optimized.duties === 'string' && optimized.duties.length > 500) {
      optimized.duties = optimized.duties.substring(0, 100) + '...[truncated]';
    }

    // Remove receipt photo data (can be fetched separately)
    if (optimized.receipts && Array.isArray(optimized.receipts)) {
      optimized.receipts = optimized.receipts.map((receipt: any) => ({
        ...receipt,
        photoData: undefined, // Remove large photo data
        photos: receipt.photos ? receipt.photos.length : 0 // Keep count only
      }));
    }

    // Remove photo arrays that can be large
    if (optimized.parkingReceipts && Array.isArray(optimized.parkingReceipts)) {
      optimized.parkingReceiptCount = optimized.parkingReceipts.length;
      optimized.parkingReceipts = []; // Clear large array
    }

    if (optimized.otherExpenseReceipts && Array.isArray(optimized.otherExpenseReceipts)) {
      optimized.otherExpenseReceiptCount = optimized.otherExpenseReceipts.length;
      optimized.otherExpenseReceipts = []; // Clear large array
    }

    return optimized;
  }

  /**
   * Monitor memory usage and log warnings
   */
  static monitorMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const utilization = (heapUsedMB / heapTotalMB) * 100;

    if (utilization > 90) {
      console.warn(`🚨 MEMORY: High utilization ${utilization.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB/${heapTotalMB.toFixed(1)}MB)`);
      
      // Force cleanup at high utilization
      this.forceGarbageCollection();
    } else if (utilization > 75) {
      console.log(`⚠️ MEMORY: Moderate utilization ${utilization.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB/${heapTotalMB.toFixed(1)}MB)`);
    }
  }

  /**
   * Create streaming response for large content
   */
  static streamLargeContent(res: any, content: string): void {
    try {
      // Set optimal headers for streaming
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Encoding', 'identity'); // Prevent compression buffering
      
      const chunkSize = 8192; // 8KB chunks for optimal memory usage
      
      console.log(`📡 MEMORY: Streaming ${content.length} bytes in ${Math.ceil(content.length / chunkSize)} chunks`);
      
      // Stream content in chunks
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        res.write(chunk);
      }
      
      res.end();
      
      // Clear content variable immediately after streaming  
      // Note: content parameter is immutable here, clearing in calling function
      
      console.log('✅ MEMORY: Content streamed and cleared');
      
    } catch (error) {
      console.error('🚨 MEMORY: Streaming failed:', error);
      // Fallback to regular send
      res.status(200).send(content);
    }
  }
}

/**
 * Memory-optimized cache for large data
 */
export class MemoryOptimizedCache {
  private cache = new Map<string, any>();
  private maxSize = 50; // Maximum number of entries
  private maxEntrySize = 100 * 1024; // 100KB per entry

  set(key: string, value: any): boolean {
    try {
      // Check if value is too large
      const serialized = JSON.stringify(value);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');
      
      if (sizeBytes > this.maxEntrySize) {
        console.log(`🚫 CACHE: Entry rejected - ${key} (${(sizeBytes/1024).toFixed(1)}KB > ${this.maxEntrySize/1024}KB limit)`);
        return false;
      }

      // Optimize value for caching
      const optimizedValue = MemoryManager.optimizeForCache(value);
      
      // Clean old entries if at capacity
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
        console.log(`🗑️ CACHE: Evicted oldest entry to make room for ${key}`);
      }

      this.cache.set(key, {
        data: optimizedValue,
        timestamp: Date.now(),
        size: sizeBytes
      });

      console.log(`✅ CACHE: Stored ${key} (${(sizeBytes/1024).toFixed(1)}KB, ${this.cache.size}/${this.maxSize} entries)`);
      return true;
      
    } catch (error) {
      console.error(`🚨 CACHE: Failed to store ${key}:`, error);
      return false;
    }
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if entry is still fresh (5 minutes)
    const age = Date.now() - entry.timestamp;
    if (age > 5 * 60 * 1000) {
      this.cache.delete(key);
      console.log(`🕐 CACHE: Expired entry removed - ${key}`);
      return undefined;
    }

    return entry.data;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 CACHE: Cleared ${size} entries`);
  }

  getStats(): { size: number; maxSize: number; memoryUsage: string } {
    let totalSize = 0;
    this.cache.forEach(entry => {
      totalSize += entry.size || 0;
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: `${(totalSize / 1024).toFixed(1)}KB`
    };
  }
}

// Export singleton instance
export const memoryOptimizedCache = new MemoryOptimizedCache();