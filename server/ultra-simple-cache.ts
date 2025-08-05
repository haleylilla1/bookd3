/**
 * Scalable Cache System - Optimized for 1,000+ Concurrent Users
 * Following "PREFER SIMPLE SOLUTIONS" principle while scaling for production
 */

interface CacheEntry {
  data: any;
  expires: number;
  hits: number;
  lastAccess: number;
}

class ScalableCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries = 5000; // Increased for 1,000+ users
  private readonly statsInterval = 60000; // 1 minute stats
  
  init() {
    console.log('✅ Scalable cache initialized for 1K+ users');
    // Clean expired entries every 5 minutes (more frequent)
    setInterval(() => this.cleanExpired(), 5 * 60 * 1000);
    // Log cache stats every minute
    setInterval(() => this.logStats(), this.statsInterval);
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      // Update access tracking for LRU eviction
      entry.hits++;
      entry.lastAccess = Date.now();
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  async set(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    // Skip empty data
    if (!data) return;
    
    // Advanced eviction: Remove least recently used entries when at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000),
      hits: 0,
      lastAccess: Date.now()
    });
  }

  async invalidate(pattern: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires <= now) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hits, 0);
    const avgHits = this.cache.size > 0 ? Math.round(totalHits / this.cache.size) : 0;
    
    return {
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      utilization: Math.round((this.cache.size / this.maxEntries) * 100),
      totalHits,
      averageHits: avgHits
    };
  }

  private evictLRU() {
    // Find the least recently used entry
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private logStats() {
    const stats = this.getStats();
    if (stats.utilization > 80) {
      console.warn(`⚠️  Cache utilization high: ${stats.utilization}% (${stats.entries}/${stats.maxEntries})`);
    }
  }
}

export const scalableCache = new ScalableCache();
// Backward compatibility
export const ultraSimpleCache = scalableCache;