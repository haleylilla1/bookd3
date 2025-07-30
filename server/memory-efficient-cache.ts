/**
 * Memory-Efficient Cache with Supabase Integration
 * Reduces local memory usage by leveraging Supabase Storage for large objects
 */

import { supabaseOptimizer } from './supabase-optimizer';

interface CacheEntry {
  data: any;
  expires: number;
  lastAccessed: number;
  size: number;
  storedInSupabase?: boolean;
}

interface CacheStats {
  localEntries: number;
  supabaseEntries: number;
  memoryUsageMB: number;
  hitRate: number;
  storageOptimization: string;
}

class MemoryEfficientCache {
  private localCache = new Map<string, CacheEntry>();
  private readonly maxLocalEntries = 100; // Reduced from 1000
  private readonly maxMemoryMB = 10; // Reduced from 50
  private readonly largeObjectThresholdKB = 50; // Objects >50KB go to Supabase
  private hits = 0;
  private misses = 0;
  private supabaseHits = 0;

  async init() {
    console.log('🚀 Memory-efficient cache initialized with Supabase optimization');
    this.localCache.clear();
    
    // Start periodic cleanup
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000); // 5 minutes
    setInterval(() => supabaseOptimizer.cleanupExpiredCache(), 60 * 60 * 1000); // 1 hour
  }

  async get(key: string): Promise<any | null> {
    try {
      // First check local cache
      const localEntry = this.localCache.get(key);
      if (localEntry && localEntry.expires > Date.now()) {
        localEntry.lastAccessed = Date.now();
        this.hits++;
        console.log(`💨 Cache hit (local): ${key}`);
        return localEntry.data;
      }

      // If not in local cache, check Supabase Storage
      const supabaseData = await supabaseOptimizer.getCachedFromStorage(key);
      if (supabaseData) {
        this.supabaseHits++;
        console.log(`☁️ Cache hit (Supabase): ${key}`);
        return supabaseData;
      }

      this.misses++;
      return null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      this.misses++;
      return null;
    }
  }

  async set(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    try {
      // Prevent caching empty or invalid data
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        console.warn(`⚠️ Blocked caching empty data for key: ${key}`);
        return;
      }

      const size = this.estimateSize(data);
      const sizeKB = size / 1024;

      // Large objects go to Supabase Storage
      if (sizeKB > this.largeObjectThresholdKB) {
        const success = await supabaseOptimizer.cacheToStorage(key, data, ttlSeconds / 3600);
        if (success) {
          console.log(`☁️ Large object (${sizeKB.toFixed(1)}KB) cached to Supabase: ${key}`);
          return;
        }
        // If Supabase fails, fall back to local cache but with shorter TTL
        ttlSeconds = Math.min(ttlSeconds, 60); // Max 1 minute for large objects
      }

      // Clean up local cache before adding
      await this.enforceLocalLimits();

      // Store in local cache
      this.localCache.set(key, {
        data,
        expires: Date.now() + (ttlSeconds * 1000),
        lastAccessed: Date.now(),
        size,
        storedInSupabase: false
      });

      console.log(`💾 Cached locally (${sizeKB.toFixed(1)}KB): ${key}`);
    } catch (error) {
      console.error('❌ Cache set error:', error);
    }
  }

  private async enforceLocalLimits(): Promise<void> {
    // Remove expired entries first
    this.cleanupExpired();

    // If still over limits, remove oldest entries
    while (this.localCache.size >= this.maxLocalEntries || this.getLocalMemoryUsageMB() > this.maxMemoryMB) {
      let oldestKey = '';
      let oldestTime = Date.now();

      for (const [key, entry] of this.localCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.localCache.delete(oldestKey);
        console.log(`🗑️ Evicted old cache entry: ${oldestKey}`);
      } else {
        break;
      }
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.localCache) {
      if (entry.expires <= now) {
        this.localCache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Removed ${removedCount} expired local cache entries`);
    }
  }

  private estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // UTF-16 estimate
    } catch {
      return 1024; // Default 1KB
    }
  }

  private getLocalMemoryUsageMB(): number {
    let totalSize = 0;
    for (const entry of this.localCache.values()) {
      totalSize += entry.size || 1024;
    }
    return totalSize / (1024 * 1024);
  }

  async getStats(): Promise<CacheStats> {
    const supabaseStats = supabaseOptimizer.getMemoryStats();
    
    return {
      localEntries: this.localCache.size,
      supabaseEntries: -1, // Would need separate tracking
      memoryUsageMB: this.getLocalMemoryUsageMB(),
      hitRate: this.hits + this.misses > 0 ? (this.hits + this.supabaseHits) / (this.hits + this.misses + this.supabaseHits) : 0,
      storageOptimization: supabaseStats.optimization
    };
  }

  async invalidate(key: string): Promise<void> {
    this.localCache.delete(key);
    // Note: Supabase Storage entries will expire naturally
    console.log(`🗑️ Invalidated cache: ${key}`);
  }

  async clear(): Promise<void> {
    this.localCache.clear();
    console.log('🧹 Local cache cleared');
  }
}

export const memoryEfficientCache = new MemoryEfficientCache();