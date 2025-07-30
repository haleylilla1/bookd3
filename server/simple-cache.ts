// Simple memory cache - no Redis dependency for minimal bloat
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

// Simple memory cache for small scale deployment
class SimpleCache {
  private cache = new Map<string, CacheEntry>();
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
    console.log('Simple memory cache initialized');
    this.cache.clear();
    this.startAutomaticCleanup();
  }

  async get(key: string): Promise<any | null> {
    try {
      const entry = this.cache.get(key);
      if (entry && entry.expires > Date.now()) {
        entry.lastAccessed = Date.now();
        this.hits++;
        return entry.data;
      }
      this.cache.delete(key);
      this.misses++;
      return null;
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
      
      const size = this.estimateSize(data);
      this.immediateExpiredCleanup();
      await this.enforceMemoryLimits();
      
      this.cache.set(key, {
        data,
        expires: Date.now() + (ttlSeconds * 1000),
        lastAccessed: Date.now(),
        size
      });
      
      if (this.cache.size > this.maxEntries || this.getMemoryUsageMB() > this.maxMemoryMB) {
        await this.forceEviction();
      }
    } catch (error) {
      // Fail silently - cache is not critical
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      // Fail silently
    }
  }

  async clearAll(): Promise<void> {
    try {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
      this.evictions = 0;
      this.expiredEntriesRemoved = 0;
      this.cleanupDurationTotal = 0;
      this.cleanupCount = 0;
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

  // Cleanup expired entries with performance monitoring
  private performExpiredCleanup(isScheduled = false): number {
    const startTime = Date.now();
    const beforeSize = this.cache.size;
    let removedCount = 0;
    
    try {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const [key, entry] of this.cache.entries()) {
        try {
          if (now > entry.expires) {
            expiredKeys.push(key);
          }
        } catch (error) {
          expiredKeys.push(key);
          console.warn(`⚠️ Corrupted cache entry removed: ${key}`);
        }
      }
      
      for (const key of expiredKeys) {
        this.cache.delete(key);
        removedCount++;
      }
      
      if (removedCount > 0) {
        this.expiredEntriesRemoved += removedCount;
        const duration = Date.now() - startTime;
        this.cleanupDurationTotal += duration;
        this.cleanupCount++;
        
        const cleanupType = isScheduled ? 'Scheduled' : 'Immediate';
        console.log(`${cleanupType} cleanup: removed ${removedCount} expired entries in ${duration}ms (${beforeSize} → ${this.cache.size})`);
      }
      
    } catch (error) {
      console.error('Cache cleanup failed:', error);
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
    for (const entry of this.cache.values()) {
      totalSize += entry.size || 1024;
    }
    return totalSize / (1024 * 1024);
  }

  // Memory limit enforcement
  private async enforceMemoryLimits(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanup < 30000) return;
    
    this.lastCleanup = now;
    const memoryUsage = this.getMemoryUsageMB();
    const entryCount = this.cache.size;
    
    if (entryCount > this.maxEntries * 0.9 || memoryUsage > this.maxMemoryMB * 0.9) {
      console.log(`Cache approaching limits: ${entryCount}/${this.maxEntries} entries, ${memoryUsage.toFixed(1)}/${this.maxMemoryMB}MB`);
    }
  }

  // Force eviction when limits exceeded - uses LRU eviction
  private async forceEviction(): Promise<void> {
    const targetSize = Math.floor(this.maxEntries * 0.8);
    if (this.cache.size <= targetSize) return;
    
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
    
    const toRemove = this.cache.size - targetSize;
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
      this.evictions++;
    }
    
    console.log(`Cache eviction: removed ${toRemove} LRU entries (limit: ${this.maxEntries})`);
  }

  private cleanup(): void {
    // Legacy cleanup method - now does immediate TTL cleanup
    this.immediateExpiredCleanup();
  }

  getStats() {
    const memoryUsage = this.getMemoryUsageMB();
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    
    const warnings: string[] = [];
    if (this.cache.size > this.maxEntries * 0.9) {
      warnings.push(`High cache usage: ${this.cache.size}/${this.maxEntries} entries`);
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
      cacheSize: this.cache.size,
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
    const memoryUsage = this.getMemoryUsageMB();
    const usagePercent = this.cache.size / this.maxEntries;
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
    this.cache.clear();
  }
}

export const cache = new SimpleCache();