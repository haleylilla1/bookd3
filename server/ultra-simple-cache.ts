/**
 * Ultra-Simple Cache - No Over-Engineering
 * Following "NEVER BUILD OVER-ENGINEERED GARBAGE" principle
 */

interface CacheEntry {
  data: any;
  expires: number;
}

class UltraSimpleCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries = 200; // Simple hard limit
  
  init() {
    console.log('✅ Ultra-simple cache initialized');
    // Clean expired entries every 10 minutes
    setInterval(() => this.cleanExpired(), 10 * 60 * 1000);
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  async set(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    // Skip empty data
    if (!data) return;
    
    // Simple eviction when too many entries
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
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
    return {
      entries: this.cache.size,
      maxEntries: this.maxEntries
    };
  }
}

export const ultraSimpleCache = new UltraSimpleCache();