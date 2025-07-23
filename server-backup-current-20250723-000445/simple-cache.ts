import { createClient } from 'redis';

// Memory-limited cache interface for enhanced entry tracking
interface CacheEntry {
  data: any;
  expires: number;
  lastAccessed: number;
  size: number; // Approximate size in bytes
}

interface CacheStats {
  size: number;
  memoryUsageMB: number;
  hitRate: number;
  evictions: number;
  warnings: string[];
}

// Simple Redis cache for 1000 concurrent users with strict memory limits
class SimpleCache {
  private client: any = null;
  private fallbackCache = new Map<string, CacheEntry>();
  private readonly maxEntries = 1000;
  private readonly maxMemoryMB = 50;
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes, configurable
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private lastCleanup = Date.now();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private expiredEntriesRemoved = 0;
  private cleanupDurationTotal = 0;
  private cleanupCount = 0;
  
  async init() {
    try {
      // Use Redis if available, fallback to memory cache
      if (process.env.REDIS_URL) {
        this.client = createClient({ url: process.env.REDIS_URL });
        await this.client.connect();
        console.log('Redis cache connected');
      } else {
        console.log('No Redis URL - using memory cache fallback');
        // Clear any existing memory cache on restart
        this.fallbackCache.clear();
        // Start automatic TTL cleanup for memory cache
        this.startAutomaticCleanup();
      }
    } catch (error) {
      console.log('Redis connection failed - using memory cache fallback');
      this.client = null;
      this.fallbackCache.clear();
      // Start automatic TTL cleanup for memory cache
      this.startAutomaticCleanup();
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      if (this.client) {
        const data = await this.client.get(key);
        this.client ? this.hits++ : this.misses++;
        return data ? JSON.parse(data) : null;
      } else {
        // Memory fallback with tracking
        const entry = this.fallbackCache.get(key);
        if (entry && entry.expires > Date.now()) {
          entry.lastAccessed = Date.now(); // Update for LRU
          this.hits++;
          return entry.data;
        }
        this.fallbackCache.delete(key);
        this.misses++;
        return null;
      }
    } catch (error) {
      this.misses++;
      return null;
    }
  }

  async set(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    try {
      // PREVENTION RULE: Never cache empty objects or invalid data
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        console.warn(`Cache prevention: Blocked caching empty data for key: ${key}`);
        return;
      }
      
      if (this.client) {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
      } else {
        // Memory fallback with strict limits and TTL enforcement
        const size = this.estimateSize(data);
        
        // Immediate cleanup of expired entries before adding new ones
        this.immediateExpiredCleanup();
        
        // Check limits after cleanup
        await this.enforceMemoryLimits();
        
        this.fallbackCache.set(key, {
          data,
          expires: Date.now() + (ttlSeconds * 1000),
          lastAccessed: Date.now(),
          size
        });
        
        // Force cleanup if we exceed limits after adding
        if (this.fallbackCache.size > this.maxEntries || this.getMemoryUsageMB() > this.maxMemoryMB) {
          await this.forceEviction();
        }
      }
    } catch (error) {
      // Fail silently - cache is not critical
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      if (this.client) {
        const keys = await this.client.keys(`*${pattern}*`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } else {
        // Memory fallback
        for (const key of Array.from(this.fallbackCache.keys())) {
          if (key.includes(pattern)) {
            this.fallbackCache.delete(key);
          }
        }
      }
    } catch (error) {
      // Fail silently
    }
  }

  async clearAll(): Promise<void> {
    try {
      if (this.client) {
        await this.client.flushAll();
      } else {
        this.fallbackCache.clear();
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.expiredEntriesRemoved = 0;
        this.cleanupDurationTotal = 0;
        this.cleanupCount = 0;
      }
    } catch (error) {
      // Fail silently
    }
  }

  // Start automatic cleanup interval for memory cache TTL enforcement
  private startAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Run TTL cleanup at configured interval
    this.cleanupInterval = setInterval(() => {
      this.scheduledExpiredCleanup();
    }, this.cleanupIntervalMs);
    
    console.log('🕐 Automatic cache TTL cleanup started (every 5 minutes)');
  }

  // Stop automatic cleanup (for cleanup on shutdown)
  private stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Shared cleanup logic with performance monitoring and error handling
  private performExpiredCleanup(isScheduled = false): number {
    if (this.client) return 0; // Only for memory cache
    
    const startTime = Date.now();
    const beforeSize = this.fallbackCache.size;
    let removedCount = 0;
    
    try {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      // Collect expired keys first to avoid iteration during deletion
      for (const [key, entry] of Array.from(this.fallbackCache.entries())) {
        try {
          if (now > entry.expires) {
            expiredKeys.push(key);
          }
        } catch (error) {
          // Handle corrupted cache entry
          expiredKeys.push(key);
          console.warn(`⚠️ Corrupted cache entry removed: ${key}`);
        }
      }
      
      // Remove expired entries
      for (const key of expiredKeys) {
        this.fallbackCache.delete(key);
        removedCount++;
      }
      
      // Update statistics
      if (removedCount > 0) {
        this.expiredEntriesRemoved += removedCount;
        const duration = Date.now() - startTime;
        this.cleanupDurationTotal += duration;
        this.cleanupCount++;
        
        const cleanupType = isScheduled ? '🕐 Scheduled' : '⏰ Immediate';
        console.log(`${cleanupType} TTL cleanup: removed ${removedCount} expired entries in ${duration}ms (${beforeSize} → ${this.fallbackCache.size})`);
      }
      
    } catch (error) {
      console.error('❌ TTL cleanup failed:', error);
    }
    
    return removedCount;
  }

  // Immediate cleanup of expired entries (runs when adding new entries)
  private immediateExpiredCleanup(): void {
    this.performExpiredCleanup(false);
  }

  // Scheduled cleanup of expired entries (runs at configured interval)
  private scheduledExpiredCleanup(): void {
    this.performExpiredCleanup(true);
  }

  // Estimate object size in bytes
  private estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Default 1KB for non-serializable objects
    }
  }

  // Get memory usage in MB
  private getMemoryUsageMB(): number {
    let totalSize = 0;
    for (const entry of Array.from(this.fallbackCache.values())) {
      totalSize += entry.size || 1024; // Default size if missing
    }
    return totalSize / (1024 * 1024);
  }

  // Memory limit enforcement (separate from TTL cleanup)
  private async enforceMemoryLimits(): Promise<void> {
    if (this.client) return; // Only for memory cache
    
    const now = Date.now();
    
    // Only run memory limit checks every 30 seconds (TTL cleanup is separate)
    if (now - this.lastCleanup < 30000) return;
    
    this.lastCleanup = now;
    
    // Check if we're approaching memory limits
    const memoryUsage = this.getMemoryUsageMB();
    const entryCount = this.fallbackCache.size;
    
    if (entryCount > this.maxEntries * 0.9 || memoryUsage > this.maxMemoryMB * 0.9) {
      console.log(`⚠️ Cache approaching limits: ${entryCount}/${this.maxEntries} entries, ${memoryUsage.toFixed(1)}/${this.maxMemoryMB}MB`);
    }
  }

  // Force eviction when limits exceeded - uses LRU eviction
  private async forceEviction(): Promise<void> {
    const targetSize = Math.floor(this.maxEntries * 0.8); // Clean to 80% capacity
    
    if (this.fallbackCache.size <= targetSize) return;
    
    // Sort by last accessed time (LRU)
    const entries = Array.from(this.fallbackCache.entries())
      .sort(([,a], [,b]) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
    
    const toRemove = this.fallbackCache.size - targetSize;
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.fallbackCache.delete(entries[i][0]);
      this.evictions++;
    }
    
    console.log(`⚠️ Cache eviction: removed ${toRemove} LRU entries (limit: ${this.maxEntries})`);
  }

  private cleanup(): void {
    // Legacy cleanup method - now does immediate TTL cleanup
    this.immediateExpiredCleanup();
  }

  getStats() {
    if (this.client) {
      return {
        type: 'redis',
        connected: true,
        cacheSize: 'unknown',
        timestamp: new Date().toISOString()
      };
    }

    // Memory cache detailed stats
    const memoryUsage = this.getMemoryUsageMB();
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    
    const warnings: string[] = [];
    if (this.fallbackCache.size > this.maxEntries * 0.9) {
      warnings.push(`High cache usage: ${this.fallbackCache.size}/${this.maxEntries} entries`);
    }
    if (memoryUsage > this.maxMemoryMB * 0.9) {
      warnings.push(`High memory usage: ${memoryUsage.toFixed(1)}/${this.maxMemoryMB}MB`);
    }
    if (this.evictions > 100) {
      warnings.push(`High eviction rate: ${this.evictions} evictions`);
    }
    
    return {
      type: 'memory',
      connected: false,
      cacheSize: this.fallbackCache.size,
      maxEntries: this.maxEntries,
      memoryUsageMB: parseFloat(memoryUsage.toFixed(2)),
      maxMemoryMB: this.maxMemoryMB,
      hitRate: parseFloat(hitRate.toFixed(1)),
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expiredEntriesRemoved: this.expiredEntriesRemoved,
      automaticCleanupActive: !!this.cleanupInterval,
      cleanupIntervalMinutes: this.cleanupIntervalMs / (60 * 1000),
      averageCleanupDuration: this.cleanupCount > 0 ? Math.round(this.cleanupDurationTotal / this.cleanupCount) : 0,
      totalCleanups: this.cleanupCount,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  // Get cache health status for monitoring
  getCacheHealth(): 'healthy' | 'warning' | 'critical' {
    if (this.client) return 'healthy'; // Redis handles its own limits
    
    const memoryUsage = this.getMemoryUsageMB();
    const usagePercent = this.fallbackCache.size / this.maxEntries;
    const memoryPercent = memoryUsage / this.maxMemoryMB;
    
    if (usagePercent > 0.95 || memoryPercent > 0.95 || this.evictions > 500) {
      return 'critical';
    }
    if (usagePercent > 0.8 || memoryPercent > 0.8 || this.evictions > 100) {
      return 'warning';
    }
    return 'healthy';
  }

  // Cleanup method for graceful shutdown
  destroy(): void {
    this.stopAutomaticCleanup();
    if (this.client) {
      this.client.disconnect();
    }
    this.fallbackCache.clear();
  }
}

export const cache = new SimpleCache();