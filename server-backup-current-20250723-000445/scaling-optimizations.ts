import rateLimit from "express-rate-limit";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Enhanced rate limiting for 1000 concurrent users
export const createScaledRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    // Store rate limit data in memory for better performance
    store: new rateLimit.MemoryStore(),
    // Skip rate limiting for authenticated health checks
    skip: (req) => req.path === '/health' || req.path === '/api/system-status'
  });
};

// Optimized rate limiters for high concurrent load
export const scaledRateLimiters = {
  // Authentication - more lenient for 1000 users
  auth: createScaledRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Increased from 5 to 10 for better UX
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true
  }),

  // Password reset - slightly more lenient
  passwordReset: createScaledRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Increased from 3 to 5
    message: 'Too many password reset attempts, please try again later.'
  }),

  // API endpoints - optimized for high traffic
  api: createScaledRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: 'Rate limit exceeded. Please slow down your requests.',
    skipSuccessfulRequests: true
  }),

  // Mileage calculation - specialized for heavy computation
  mileage: createScaledRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 mileage calculations per minute
    message: 'Mileage calculation rate limit exceeded. Please wait before calculating more distances.'
  }),

  // File uploads - prevent abuse
  upload: createScaledRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per 15 minutes
    message: 'Upload rate limit exceeded. Please wait before uploading more files.'
  })
};

// Database connection optimization
export class DatabaseOptimizer {
  private static queryCache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Cache frequently accessed data
  static async getCachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data;
    }

    const result = await queryFn();
    this.queryCache.set(cacheKey, { data: result, timestamp: now });

    // Clean up old cache entries
    if (this.queryCache.size > 1000) {
      const cutoff = now - ttl;
      for (const [key, value] of this.queryCache.entries()) {
        if (value.timestamp < cutoff) {
          this.queryCache.delete(key);
        }
      }
    }

    return result;
  }

  // Batch operations for better performance
  static async batchQuery<T>(
    queries: Array<() => Promise<T>>
  ): Promise<T[]> {
    // Execute queries in batches of 10 to avoid overwhelming the database
    const batchSize = 10;
    const results: T[] = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(query => query()));
      results.push(...batchResults);
    }

    return results;
  }

  // Clear cache when needed
  static clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }
}

// Memory optimization for 1000 concurrent users
export class MemoryOptimizer {
  private static instances = new Map<string, any>();
  private static readonly MAX_INSTANCES = 1000;

  // Singleton pattern with cleanup
  static getInstance<T>(key: string, factory: () => T): T {
    if (!this.instances.has(key)) {
      // Clean up old instances if we hit the limit
      if (this.instances.size >= this.MAX_INSTANCES) {
        const keysToDelete = Array.from(this.instances.keys()).slice(0, 100);
        keysToDelete.forEach(k => this.instances.delete(k));
      }
      
      this.instances.set(key, factory());
    }
    
    return this.instances.get(key);
  }

  // Clear instances for a specific user
  static clearUserInstances(userId: number): void {
    const userPrefix = `user_${userId}_`;
    for (const key of this.instances.keys()) {
      if (key.startsWith(userPrefix)) {
        this.instances.delete(key);
      }
    }
  }

  // Get current memory usage
  static getMemoryUsage(): {
    instanceCount: number;
    estimatedMemoryMB: number;
  } {
    const instanceCount = this.instances.size;
    const estimatedMemoryMB = Math.round(instanceCount * 0.1); // Rough estimate
    
    return { instanceCount, estimatedMemoryMB };
  }
}

// Request queue for handling high concurrent load
export class RequestQueue {
  private queue: Array<{
    id: string;
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: number;
    timestamp: number;
  }> = [];
  
  private processing = false;
  private readonly maxConcurrent = 50; // Process 50 requests concurrently
  private readonly maxQueueSize = 1000; // Maximum queue size

  async addRequest<T>(
    request: () => Promise<T>,
    priority: number = 0,
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Request queue is full. Please try again later.'));
        return;
      }

      const id = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => {
        this.removeRequest(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.queue.push({
        id,
        request,
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        priority,
        timestamp: Date.now()
      });

      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  private removeRequest(id: string): void {
    const index = this.queue.findIndex(req => req.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Process requests in batches
      const batch = this.queue.splice(0, this.maxConcurrent);
      
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const result = await item.request();
            item.resolve(result);
          } catch (error) {
            item.reject(error);
          }
        })
      );

      // Continue processing if there are more requests
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 10); // Small delay to prevent CPU overload
      }
    } finally {
      this.processing = false;
    }
  }

  getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    oldestRequestAge: number;
  } {
    const now = Date.now();
    const oldestRequestAge = this.queue.length > 0 
      ? now - Math.min(...this.queue.map(r => r.timestamp))
      : 0;

    return {
      queueLength: this.queue.length,
      processing: this.processing,
      oldestRequestAge
    };
  }
}

// Global request queue instance
export const globalRequestQueue = new RequestQueue();

// Session optimization for 1000 concurrent users
export class SessionOptimizer {
  private static sessionCache = new Map<string, any>();
  private static readonly MAX_SESSIONS = 1000;
  private static readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  static cacheSession(sessionId: string, sessionData: any): void {
    // Clean up old sessions if we hit the limit
    if (this.sessionCache.size >= this.MAX_SESSIONS) {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, value] of Array.from(this.sessionCache.entries())) {
        if (now - value.timestamp > this.SESSION_TTL) {
          this.sessionCache.delete(key);
          cleanedCount++;
          if (cleanedCount >= 100) break; // Clean up in batches
        }
      }
    }

    this.sessionCache.set(sessionId, {
      ...sessionData,
      timestamp: Date.now()
    });
  }

  static getCachedSession(sessionId: string): any {
    const cached = this.sessionCache.get(sessionId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.SESSION_TTL) {
      this.sessionCache.delete(sessionId);
      return null;
    }

    return cached;
  }

  static clearSession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  static getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    memoryUsageMB: number;
  } {
    const now = Date.now();
    let activeSessions = 0;

    for (const [key, value] of this.sessionCache.entries()) {
      if (now - value.timestamp <= this.SESSION_TTL) {
        activeSessions++;
      }
    }

    return {
      totalSessions: this.sessionCache.size,
      activeSessions,
      memoryUsageMB: Math.round(this.sessionCache.size * 0.05) // Rough estimate
    };
  }
}

// Health monitoring for scaled system
export class ScalingHealthMonitor {
  static async getScalingMetrics(): Promise<{
    requestQueue: any;
    memoryUsage: any;
    sessionStats: any;
    databaseHealth: any;
  }> {
    const [requestQueue, memoryUsage, sessionStats] = await Promise.all([
      Promise.resolve(globalRequestQueue.getQueueStatus()),
      Promise.resolve(MemoryOptimizer.getMemoryUsage()),
      Promise.resolve(SessionOptimizer.getSessionStats())
    ]);

    // Simple database health check
    const databaseHealth = await this.checkDatabaseHealth();

    return {
      requestQueue,
      memoryUsage,
      sessionStats,
      databaseHealth
    };
  }

  private static async checkDatabaseHealth(): Promise<{
    responsive: boolean;
    responseTime: number;
    connectionCount: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Simple query to check database responsiveness
      await db.execute(sql`SELECT 1`);
      const responseTime = Date.now() - startTime;
      
      return {
        responsive: responseTime < 5000, // Consider healthy if under 5 seconds
        responseTime,
        connectionCount: 1 // Neon uses HTTP connections
      };
    } catch (error) {
      return {
        responsive: false,
        responseTime: Date.now() - startTime,
        connectionCount: 0
      };
    }
  }
}

export default {
  scaledRateLimiters,
  DatabaseOptimizer,
  MemoryOptimizer,
  RequestQueue,
  globalRequestQueue,
  SessionOptimizer,
  ScalingHealthMonitor
};