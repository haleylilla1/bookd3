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
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private lastCleanup = Date.now();
  
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
      }
    } catch (error) {
      console.log('Redis connection failed - using memory cache fallback');
      this.client = null;
      this.fallbackCache.clear();
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
        // Memory fallback with strict limits
        const size = this.estimateSize(data);
        
        // Check limits before adding
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
        for (const key of this.fallbackCache.keys()) {
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
      }
    } catch (error) {
      // Fail silently
    }
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
    for (const entry of this.fallbackCache.values()) {
      totalSize += entry.size || 1024; // Default size if missing
    }
    return totalSize / (1024 * 1024);
  }

  // Regular cleanup of expired entries
  private async enforceMemoryLimits(): Promise<void> {
    const now = Date.now();
    
    // Only run cleanup every 30 seconds
    if (now - this.lastCleanup < 30000) return;
    
    const beforeSize = this.fallbackCache.size;
    for (const [key, entry] of this.fallbackCache.entries()) {
      if (now > entry.expires) {
        this.fallbackCache.delete(key);
      }
    }
    
    this.lastCleanup = now;
    const cleaned = beforeSize - this.fallbackCache.size;
    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
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
    // Legacy cleanup method - now calls enforceMemoryLimits
    this.enforceMemoryLimits();
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
}

export const cache = new SimpleCache();