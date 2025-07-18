import { createClient } from 'redis';

// Simple Redis cache for 1000 concurrent users
class SimpleCache {
  private client: any = null;
  private fallbackCache = new Map<string, { data: any; expires: number }>();
  
  async init() {
    try {
      // Use Redis if available, fallback to memory cache
      if (process.env.REDIS_URL) {
        this.client = createClient({ url: process.env.REDIS_URL });
        await this.client.connect();
        console.log('Redis cache connected');
      } else {
        console.log('No Redis URL - using memory cache fallback');
      }
    } catch (error) {
      console.log('Redis connection failed - using memory cache fallback');
      this.client = null;
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      if (this.client) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        // Memory fallback
        const entry = this.fallbackCache.get(key);
        if (entry && entry.expires > Date.now()) {
          return entry.data;
        }
        this.fallbackCache.delete(key);
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  async set(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    try {
      if (this.client) {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
      } else {
        // Memory fallback
        this.fallbackCache.set(key, {
          data,
          expires: Date.now() + (ttlSeconds * 1000)
        });
        
        // Cleanup old entries periodically
        if (this.fallbackCache.size > 1000) {
          this.cleanup();
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

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.fallbackCache.entries()) {
      if (entry.expires < now) {
        this.fallbackCache.delete(key);
      }
    }
  }

  getStats() {
    return {
      type: this.client ? 'redis' : 'memory',
      connected: !!this.client,
      cacheSize: this.client ? 'unknown' : this.fallbackCache.size,
      timestamp: new Date().toISOString()
    };
  }
}

export const cache = new SimpleCache();