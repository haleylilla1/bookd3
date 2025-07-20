import { createClient } from 'redis';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface CacheEntry {
  data: any;
  expires: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  priority: number; // 0-10, higher = more important
  compressed: boolean; // Track if data is compressed
  originalSize: number; // Original size before compression
}

interface CacheStats {
  connected: boolean;
  cacheSize: number;
  maxEntries: number;
  memoryUsageMB: number;
  maxMemoryMB: number;
  hitRate: number;
  hits: number;
  misses: number;
  evictions: number;
  expiredEntriesRemoved: number;
  automaticCleanupActive: boolean;
  cleanupIntervalMinutes: number;
  averageCleanupDuration: number;
  totalCleanups: number;
  warmingHits: number;
  dynamicAdjustments: number;
  batchOperations: number;
  emergencyCleanups: number;
  lastEmergencyCleanup: number;
  warnings: string[];
  timestamp: string;
  // Compression and size optimization stats
  compressionRatio: number;
  compressedEntries: number;
  rejectedLargeEntries: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
}

// Priority queue node for efficient TTL management
class ExpirationNode {
  constructor(
    public key: string,
    public expiration: number,
    public priority: number = 0
  ) {}
}

// Min-heap priority queue for O(log n) TTL cleanup
class ExpirationQueue {
  private heap: ExpirationNode[] = [];

  push(node: ExpirationNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): ExpirationNode | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  peek(): ExpirationNode | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  // Remove specific key from queue (for cache invalidation)
  remove(key: string): boolean {
    const index = this.heap.findIndex(node => node.key === key);
    if (index === -1) return false;

    const lastNode = this.heap.pop()!;
    if (index === this.heap.length) return true; // Was last element

    this.heap[index] = lastNode;
    this.bubbleUp(index);
    this.bubbleDown(index);
    return true;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].expiration <= this.heap[index].expiration) break;

      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < this.heap.length && 
          this.heap[leftChild].expiration < this.heap[minIndex].expiration) {
        minIndex = leftChild;
      }

      if (rightChild < this.heap.length && 
          this.heap[rightChild].expiration < this.heap[minIndex].expiration) {
        minIndex = rightChild;
      }

      if (minIndex === index) break;

      [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex], this.heap[index]];
      index = minIndex;
    }
  }
}

// Advanced cache with O(log n) TTL cleanup and intelligent features
class AdvancedCache {
  private client: any = null;
  private fallbackCache = new Map<string, CacheEntry>();
  private expirationQueue = new ExpirationQueue();
  private readonly maxEntries = 1000;
  private readonly maxMemoryMB = 50;
  private readonly maxEntrySizeKB = 100; // 100KB limit per entry
  private readonly compressionThresholdKB = 10; // Compress entries larger than 10KB
  private baseCleanupIntervalMs = 5 * 60 * 1000; // 5 minutes base
  private currentCleanupIntervalMs = this.baseCleanupIntervalMs;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private lastCleanup = Date.now();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private expiredEntriesRemoved = 0;
  private cleanupDurationTotal = 0;
  private cleanupCount = 0;
  private warmingHits = 0;
  private dynamicAdjustments = 0;
  private batchOperations = 0;
  
  // Compression and size optimization tracking
  private compressedEntries = 0;
  private rejectedLargeEntries = 0;
  private totalOriginalSize = 0;
  private totalCompressedSize = 0;
  
  // Emergency cleanup stats
  private emergencyCleanups = 0;
  private lastEmergencyCleanup = 0;
  private emergencyCleanupCooldown = 5 * 60 * 1000; // 5 minutes cooldown
  
  // Cache activity tracking for dynamic intervals
  private recentActivity: number[] = [];
  private lastActivityCheck = Date.now();
  
  // Cache warming patterns
  private accessPatterns = new Map<string, { count: number; lastAccess: number; avgInterval: number }>();
  private warmingQueue: string[] = [];

  async init() {
    try {
      if (process.env.REDIS_URL) {
        this.client = createClient({ url: process.env.REDIS_URL });
        await this.client.connect();
        console.log('🚀 Advanced Redis cache connected');
      } else {
        console.log('🚀 Advanced memory cache with priority queue and intelligent features');
        this.startAdvancedFeatures();
      }
    } catch (error) {
      console.log('🚀 Advanced memory cache fallback with all optimization features');
      this.client = null;
      this.startAdvancedFeatures();
    }
  }

  private startAdvancedFeatures(): void {
    this.startDynamicCleanup();
    this.startCacheWarming();
    this.startActivityMonitoring();
    this.startEmergencyMemoryMonitoring();
  }

  // Dynamic interval adjustment based on cache activity
  private startDynamicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.performAdvancedCleanup();
      this.adjustCleanupInterval();
    }, this.currentCleanupIntervalMs);
    
    console.log(`📊 Dynamic TTL cleanup started (${this.currentCleanupIntervalMs / 60000} min interval)`);
  }

  // Adjust cleanup frequency based on cache activity
  private adjustCleanupInterval(): void {
    const activityLevel = this.calculateActivityLevel();
    let newInterval = this.baseCleanupIntervalMs;

    if (activityLevel > 0.8) {
      // High activity - cleanup more frequently
      newInterval = this.baseCleanupIntervalMs * 0.5; // 2.5 minutes
    } else if (activityLevel > 0.5) {
      // Medium activity - slightly more frequent
      newInterval = this.baseCleanupIntervalMs * 0.75; // 3.75 minutes
    } else if (activityLevel < 0.2) {
      // Low activity - cleanup less frequently
      newInterval = this.baseCleanupIntervalMs * 2; // 10 minutes
    }

    if (newInterval !== this.currentCleanupIntervalMs) {
      this.currentCleanupIntervalMs = newInterval;
      this.dynamicAdjustments++;
      this.startDynamicCleanup(); // Restart with new interval
      console.log(`⚡ Dynamic interval adjusted to ${newInterval / 60000} minutes (activity: ${(activityLevel * 100).toFixed(1)}%)`);
    }
  }

  private calculateActivityLevel(): number {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // Remove old activity data
    this.recentActivity = this.recentActivity.filter(time => time > fiveMinutesAgo);
    
    // Calculate activity level (0-1)
    const maxExpectedOps = 100; // Max operations per 5 minutes
    return Math.min(this.recentActivity.length / maxExpectedOps, 1);
  }

  private recordActivity(): void {
    this.recentActivity.push(Date.now());
  }

  // Cache warming based on access patterns
  private startCacheWarming(): void {
    setInterval(() => {
      this.performCacheWarming();
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  private performCacheWarming(): void {
    if (this.client || this.warmingQueue.length === 0) return;

    const now = Date.now();
    const keysToWarm: string[] = [];

    // Find keys that should be warmed based on patterns
    for (const [key, pattern] of Array.from(this.accessPatterns.entries())) {
      const timeSinceLastAccess = now - pattern.lastAccess;
      
      // If pattern suggests key will be accessed soon, warm it
      if (timeSinceLastAccess >= pattern.avgInterval * 0.8 && 
          !this.fallbackCache.has(key) && 
          keysToWarm.length < 10) {
        keysToWarm.push(key);
      }
    }

    if (keysToWarm.length > 0) {
      console.log(`🔥 Cache warming: preloading ${keysToWarm.length} predicted keys`);
      // Note: In real implementation, you'd fetch these keys from database
      // For now, we just simulate the warming process
    }
  }

  private startActivityMonitoring(): void {
    setInterval(() => {
      this.cleanupAccessPatterns();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  // Emergency memory monitoring and cleanup
  private startEmergencyMemoryMonitoring(): void {
    setInterval(() => {
      this.checkMemoryPressure();
    }, 30 * 1000); // Check every 30 seconds
  }

  private checkMemoryPressure(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const utilizationPercent = (heapUsedMB / heapTotalMB) * 100;
    
    // Emergency cleanup threshold: >90% memory utilization
    if (utilizationPercent > 90) {
      console.log(`🚨 EMERGENCY: Memory utilization at ${utilizationPercent.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB/${heapTotalMB.toFixed(1)}MB)`);
      this.performEmergencyCleanup(heapUsedMB, heapTotalMB, utilizationPercent);
    }
    // Warning threshold: >80% memory utilization  
    else if (utilizationPercent > 80) {
      console.log(`⚠️  WARNING: Memory utilization at ${utilizationPercent.toFixed(1)}% (${heapUsedMB.toFixed(1)}MB/${heapTotalMB.toFixed(1)}MB)`);
      this.performPreventiveCleanup(heapUsedMB, heapTotalMB, utilizationPercent);
    }
  }

  private performEmergencyCleanup(heapUsedMB: number, heapTotalMB: number, utilizationPercent: number): void {
    const startTime = Date.now();
    const initialEntries = this.fallbackCache.size;
    const targetReduction = 0.5; // Clear 50% of cache
    
    console.log(`🧹 EMERGENCY CLEANUP: Clearing ${(targetReduction * 100)}% of cache entries`);
    console.log(`📊 Before cleanup: ${initialEntries} entries, ${heapUsedMB.toFixed(1)}MB heap`);
    
    if (this.client) {
      // Redis cleanup - clear 50% of keys
      this.performEmergencyRedisCleanup(targetReduction);
    } else {
      // Memory cache cleanup with priority-based eviction
      this.performEmergencyMemoryCleanup(targetReduction);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('🗑️  Forcing garbage collection');
      global.gc();
    }
    
    const endTime = Date.now();
    const finalEntries = this.fallbackCache.size;
    const entriesRemoved = initialEntries - finalEntries;
    const memoryAfter = process.memoryUsage();
    const heapAfterMB = memoryAfter.heapUsed / 1024 / 1024;
    
    console.log(`✅ EMERGENCY CLEANUP COMPLETE:`);
    console.log(`   Entries removed: ${entriesRemoved}/${initialEntries} (${((entriesRemoved/initialEntries)*100).toFixed(1)}%)`);
    console.log(`   Memory recovered: ${(heapUsedMB - heapAfterMB).toFixed(1)}MB`);
    console.log(`   New utilization: ${((heapAfterMB / heapTotalMB) * 100).toFixed(1)}%`);
    console.log(`   Cleanup duration: ${endTime - startTime}ms`);
    
    // Record emergency cleanup stats
    this.emergencyCleanups = (this.emergencyCleanups || 0) + 1;
    this.lastEmergencyCleanup = Date.now();
  }

  private performPreventiveCleanup(heapUsedMB: number, heapTotalMB: number, utilizationPercent: number): void {
    // Lighter cleanup to prevent reaching emergency threshold
    const targetReduction = 0.2; // Clear 20% of cache
    const initialEntries = this.fallbackCache.size;
    
    console.log(`🧽 PREVENTIVE CLEANUP: Clearing ${(targetReduction * 100)}% of cache entries`);
    
    if (this.client) {
      this.performPreventiveRedisCleanup(targetReduction);
    } else {
      this.performPreventiveMemoryCleanup(targetReduction);
    }
    
    const finalEntries = this.fallbackCache.size;
    const entriesRemoved = initialEntries - finalEntries;
    console.log(`   Preventive cleanup: ${entriesRemoved} entries removed`);
  }

  private performEmergencyMemoryCleanup(targetReduction: number): void {
    if (!this.fallbackCache || this.fallbackCache.size === 0) return;
    
    const totalEntries = this.fallbackCache.size;
    const targetRemoval = Math.floor(totalEntries * targetReduction);
    
    // Create priority list for eviction (oldest + least accessed first)
    const evictionCandidates: Array<{key: string, entry: CacheEntry, score: number}> = [];
    const now = Date.now();
    
    for (const [key, entry] of this.fallbackCache.entries()) {
      // Calculate eviction score (higher = more likely to evict)
      const ageScore = (now - entry.lastAccessed) / (24 * 60 * 60 * 1000); // Days since access
      const accessScore = 1 / Math.max(entry.accessCount, 1); // Inverse of access count
      const priorityScore = (10 - entry.priority) / 10; // Inverse of priority (lower priority = higher score)
      const sizeScore = entry.size / (100 * 1024); // Larger entries get higher eviction score
      
      const totalScore = (ageScore * 0.4) + (accessScore * 0.3) + (priorityScore * 0.2) + (sizeScore * 0.1);
      
      evictionCandidates.push({ key, entry, score: totalScore });
    }
    
    // Sort by eviction score (highest first = most likely to evict)
    evictionCandidates.sort((a, b) => b.score - a.score);
    
    // Remove top candidates
    const keysToRemove = evictionCandidates.slice(0, targetRemoval).map(c => c.key);
    
    console.log(`🎯 Emergency eviction targets: ${keysToRemove.length} entries`);
    console.log(`   Criteria: oldest access, lowest frequency, lowest priority, largest size`);
    
    this.performBatchDelete(keysToRemove);
    this.evictions += keysToRemove.length;
  }

  private performPreventiveMemoryCleanup(targetReduction: number): void {
    if (!this.fallbackCache || this.fallbackCache.size === 0) return;
    
    const totalEntries = this.fallbackCache.size;
    const targetRemoval = Math.floor(totalEntries * targetReduction);
    
    // Focus on expired and low-priority entries for preventive cleanup
    const candidates: Array<{key: string, entry: CacheEntry, score: number}> = [];
    const now = Date.now();
    
    for (const [key, entry] of this.fallbackCache.entries()) {
      let score = 0;
      
      // Heavily prioritize expired entries
      if (entry.expires <= now) {
        score += 1000;
      }
      
      // Age factor (older = higher score)
      const hoursSinceAccess = (now - entry.lastAccessed) / (60 * 60 * 1000);
      score += hoursSinceAccess * 10;
      
      // Low access count
      score += (1 / Math.max(entry.accessCount, 1)) * 50;
      
      // Low priority
      score += (10 - entry.priority) * 5;
      
      candidates.push({ key, entry, score });
    }
    
    candidates.sort((a, b) => b.score - a.score);
    const keysToRemove = candidates.slice(0, targetRemoval).map(c => c.key);
    
    this.performBatchDelete(keysToRemove);
    this.evictions += keysToRemove.length;
  }

  private async performEmergencyRedisCleanup(targetReduction: number): Promise<void> {
    if (!this.client) return;
    
    try {
      // Get all keys and remove based on TTL and access patterns
      const keys = await this.client.keys('*');
      const targetRemoval = Math.floor(keys.length * targetReduction);
      
      // Use Redis commands to get key info and prioritize removal
      const keysWithTtl: Array<{key: string, ttl: number}> = [];
      
      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        keysWithTtl.push({ key, ttl });
      }
      
      // Sort by TTL (shortest first) and remove
      keysWithTtl.sort((a, b) => a.ttl - b.ttl);
      const keysToRemove = keysWithTtl.slice(0, targetRemoval).map(k => k.key);
      
      if (keysToRemove.length > 0) {
        await this.client.del(keysToRemove);
        console.log(`🗑️  Redis emergency cleanup: ${keysToRemove.length} keys removed`);
      }
    } catch (error) {
      console.error('Emergency Redis cleanup failed:', error);
    }
  }

  private async performPreventiveRedisCleanup(targetReduction: number): Promise<void> {
    if (!this.client) return;
    
    try {
      const keys = await this.client.keys('*');
      const targetRemoval = Math.floor(keys.length * targetReduction);
      
      // Focus on keys with short TTL for preventive cleanup
      const expiredKeys: string[] = [];
      
      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        if (ttl <= 60) { // TTL <= 1 minute
          expiredKeys.push(key);
          if (expiredKeys.length >= targetRemoval) break;
        }
      }
      
      if (expiredKeys.length > 0) {
        await this.client.del(expiredKeys);
        console.log(`🧽 Redis preventive cleanup: ${expiredKeys.length} near-expired keys removed`);
      }
    } catch (error) {
      console.error('Preventive Redis cleanup failed:', error);
    }
  }

  private cleanupAccessPatterns(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [key, pattern] of Array.from(this.accessPatterns.entries())) {
      if (pattern.lastAccess < oneHourAgo) {
        this.accessPatterns.delete(key);
      }
    }
  }

  // O(log n) TTL cleanup using priority queue
  private performAdvancedCleanup(): number {
    if (this.client) return 0;

    const startTime = Date.now();
    let removedCount = 0;
    const expiredKeys: string[] = [];

    try {
      const now = Date.now();

      // Use priority queue for O(log n) cleanup
      while (this.expirationQueue.size() > 0) {
        const node = this.expirationQueue.peek();
        if (!node || node.expiration > now) break;

        this.expirationQueue.pop();
        if (this.fallbackCache.has(node.key)) {
          const entry = this.fallbackCache.get(node.key)!;
          if (entry.expires <= now) {
            expiredKeys.push(node.key);
          }
        }
      }

      // Batch delete expired entries
      if (expiredKeys.length > 0) {
        this.performBatchDelete(expiredKeys);
        removedCount = expiredKeys.length;
        this.batchOperations++;
      }

      // Update statistics
      if (removedCount > 0) {
        this.expiredEntriesRemoved += removedCount;
        const duration = Date.now() - startTime;
        this.cleanupDurationTotal += duration;
        this.cleanupCount++;
        
        console.log(`⚡ Advanced TTL cleanup: removed ${removedCount} expired entries in ${duration}ms (O(log n) priority queue)`);
      }

    } catch (error) {
      console.error('❌ Advanced TTL cleanup failed:', error);
    }

    return removedCount;
  }

  // Batch operations for better efficiency
  private performBatchDelete(keys: string[]): void {
    const startTime = Date.now();
    
    for (const key of keys) {
      this.fallbackCache.delete(key);
    }

    const duration = Date.now() - startTime;
    console.log(`📦 Batch delete: removed ${keys.length} entries in ${duration}ms`);
  }

  async set(key: string, data: any, ttlSeconds: number = 300, priority: number = 5): Promise<void> {
    this.recordActivity();

    try {
      if (this.client) {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
      } else {
        // Check entry size first
        const originalSize = this.estimateSize(data);
        const originalSizeKB = originalSize / 1024;
        
        // Reject entries larger than 100KB
        if (originalSizeKB > this.maxEntrySizeKB) {
          this.rejectedLargeEntries++;
          console.log(`🚫 Cache entry rejected: ${key} (${originalSizeKB.toFixed(1)}KB > ${this.maxEntrySizeKB}KB limit)`);
          return;
        }

        // Immediate cleanup before adding
        this.performAdvancedCleanup();

        let finalData = data;
        let compressed = false;
        let finalSize = originalSize;

        // Compress large entries (over 10KB)
        if (originalSizeKB > this.compressionThresholdKB) {
          try {
            const serialized = JSON.stringify(data);
            const compressedBuffer = await gzipAsync(Buffer.from(serialized, 'utf8'));
            const compressedSize = compressedBuffer.length;
            
            // Only use compression if it actually reduces size significantly
            if (compressedSize < originalSize * 0.8) {
              finalData = compressedBuffer;
              finalSize = compressedSize;
              compressed = true;
              this.compressedEntries++;
              this.totalOriginalSize += originalSize;
              this.totalCompressedSize += compressedSize;
              
              console.log(`🗜️  Compressed cache entry: ${key} (${originalSizeKB.toFixed(1)}KB → ${(compressedSize/1024).toFixed(1)}KB, ${((1 - compressedSize/originalSize) * 100).toFixed(1)}% reduction)`);
            }
          } catch (compressionError) {
            console.log(`⚠️  Compression failed for ${key}, storing uncompressed`);
          }
        }

        const expiration = Date.now() + (ttlSeconds * 1000);
        
        // Add to cache with compression metadata
        this.fallbackCache.set(key, {
          data: finalData,
          expires: expiration,
          lastAccessed: Date.now(),
          accessCount: 1,
          size: finalSize,
          originalSize,
          compressed,
          priority
        });

        // Add to priority queue for O(log n) cleanup
        this.expirationQueue.push(new ExpirationNode(key, expiration, priority));

        // Update access patterns for cache warming
        this.updateAccessPattern(key);

        // Force cleanup if limits exceeded
        if (this.fallbackCache.size > this.maxEntries || this.getMemoryUsageMB() > this.maxMemoryMB) {
          await this.forceEviction();
        }
      }
    } catch (error) {
      console.error(`❌ Cache set error for ${key}:`, error.message);
    }
  }

  async get(key: string): Promise<any> {
    this.recordActivity();

    try {
      if (this.client) {
        const result = await this.client.get(key);
        if (result) {
          this.hits++;
          return JSON.parse(result);
        } else {
          this.misses++;
          return null;
        }
      } else {
        // Advanced memory cache with warming detection and decompression
        const entry = this.fallbackCache.get(key);
        
        if (entry && Date.now() <= entry.expires) {
          entry.lastAccessed = Date.now();
          entry.accessCount++;
          this.hits++;
          this.updateAccessPattern(key);
          
          // Check if this was a warming hit
          if (this.warmingQueue.includes(key)) {
            this.warmingHits++;
          }
          
          // Decompress data if needed
          if (entry.compressed && Buffer.isBuffer(entry.data)) {
            try {
              const decompressed = await gunzipAsync(entry.data);
              const decompressedString = decompressed.toString('utf8');
              return JSON.parse(decompressedString);
            } catch (decompressionError) {
              console.error(`❌ Decompression failed for ${key}:`, decompressionError.message);
              // Remove corrupted entry
              this.fallbackCache.delete(key);
              this.expirationQueue.remove(key);
              this.misses++;
              return null;
            }
          }
          
          return entry.data;
        } else {
          this.misses++;
          if (entry) {
            // Remove expired entry
            this.fallbackCache.delete(key);
            this.expirationQueue.remove(key);
          }
          return null;
        }
      }
    } catch (error) {
      this.misses++;
      return null;
    }
  }

  private updateAccessPattern(key: string): void {
    const now = Date.now();
    const existing = this.accessPatterns.get(key);

    if (existing) {
      const interval = now - existing.lastAccess;
      existing.avgInterval = (existing.avgInterval + interval) / 2;
      existing.count++;
      existing.lastAccess = now;
    } else {
      this.accessPatterns.set(key, {
        count: 1,
        lastAccess: now,
        avgInterval: 5 * 60 * 1000 // Default 5 minutes
      });
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      if (this.client) {
        await this.client.del(key);
      } else {
        this.fallbackCache.delete(key);
        this.expirationQueue.remove(key);
      }
    } catch (error) {
      // Fail silently
    }
  }

  private estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2;
    } catch {
      return 1024;
    }
  }

  private getMemoryUsageMB(): number {
    let totalSize = 0;
    for (const entry of Array.from(this.fallbackCache.values())) {
      totalSize += entry.size || 1024;
    }
    return totalSize / (1024 * 1024);
  }

  // Enhanced LRU eviction with priority consideration
  private async forceEviction(): Promise<void> {
    const targetSize = Math.floor(this.maxEntries * 0.8);
    if (this.fallbackCache.size <= targetSize) return;

    const entries = Array.from(this.fallbackCache.entries())
      .sort(([, a], [, b]) => {
        // Sort by priority (low priority first), then by last accessed time
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return (a.lastAccessed || 0) - (b.lastAccessed || 0);
      });

    const toRemove = this.fallbackCache.size - targetSize;
    const removedKeys: string[] = [];

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const key = entries[i][0];
      this.fallbackCache.delete(key);
      this.expirationQueue.remove(key);
      removedKeys.push(key);
      this.evictions++;
    }

    this.performBatchDelete(removedKeys);
    console.log(`⚡ Advanced eviction: removed ${toRemove} entries (priority-aware LRU)`);
  }

  /**
   * Emergency cleanup for memory pressure situations
   */
  async emergencyCleanup(reductionPercentage: number = 0.5): Promise<void> {
    const startTime = Date.now();
    const initialSize = this.fallbackCache.size;
    const targetReduction = Math.floor(initialSize * reductionPercentage);
    
    console.log(`🚨 Emergency cache cleanup: removing ${targetReduction} entries (${(reductionPercentage * 100).toFixed(1)}%)`);
    
    try {
      // 1. First remove all expired entries
      await this.performTTLCleanup();
      
      // 2. If we still need to reduce more, remove LRU entries
      const remainingToRemove = targetReduction - (initialSize - this.fallbackCache.size);
      
      if (remainingToRemove > 0) {
        // Sort by access time and priority for intelligent eviction
        const entries = Array.from(this.fallbackCache.entries())
          .sort((a, b) => {
            const entryA = a[1];
            const entryB = b[1];
            
            // Consider both access time and priority
            const scoreA = entryA.lastAccessed + (entryA.priority * 60000); // Priority worth 1 minute
            const scoreB = entryB.lastAccessed + (entryB.priority * 60000);
            
            return scoreA - scoreB; // Ascending - remove oldest/lowest priority first
          });
        
        // Remove the least valuable entries
        const keysToRemove = entries.slice(0, remainingToRemove).map(([key]) => key);
        
        for (const key of keysToRemove) {
          this.fallbackCache.delete(key);
          this.expirationQueue.remove(key);
        }
        
        console.log(`📦 Emergency cleanup: removed ${keysToRemove.length} LRU entries`);
      }
      
      const finalSize = this.fallbackCache.size;
      const actualReduction = initialSize - finalSize;
      const duration = Date.now() - startTime;
      
      console.log(`✅ Emergency cleanup completed: ${actualReduction} entries removed in ${duration}ms (${initialSize} → ${finalSize})`);
      
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error.message);
    }
  }

  getStats(): CacheStats {
    const memoryUsage = this.client ? 0 : this.getMemoryUsageMB();
    const hitRate = this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)) * 100 : 0;
    
    // Calculate compression ratio
    const compressionRatio = this.totalOriginalSize > 0 ? 
      parseFloat(((this.totalCompressedSize / this.totalOriginalSize) * 100).toFixed(1)) : 0;
    
    const warnings: string[] = [];
    const usagePercent = this.fallbackCache.size / this.maxEntries;
    const memoryPercent = memoryUsage / this.maxMemoryMB;
    
    if (usagePercent > 0.9) warnings.push('Cache size approaching limit');
    if (memoryPercent > 0.9) warnings.push('Memory usage approaching limit');
    if (this.evictions > 50) warnings.push('High eviction rate detected');
    if (this.rejectedLargeEntries > 10) warnings.push('Multiple large entries rejected');

    return {
      connected: !!this.client,
      cacheSize: this.client ? 0 : this.fallbackCache.size,
      maxEntries: this.maxEntries,
      memoryUsageMB: parseFloat(memoryUsage.toFixed(2)),
      maxMemoryMB: this.maxMemoryMB,
      hitRate: parseFloat(hitRate.toFixed(1)),
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expiredEntriesRemoved: this.expiredEntriesRemoved,
      automaticCleanupActive: !!this.cleanupInterval,
      cleanupIntervalMinutes: this.currentCleanupIntervalMs / (60 * 1000),
      averageCleanupDuration: this.cleanupCount > 0 ? Math.round(this.cleanupDurationTotal / this.cleanupCount) : 0,
      totalCleanups: this.cleanupCount,
      emergencyCleanups: this.emergencyCleanups,
      lastEmergencyCleanup: this.lastEmergencyCleanup,
      warmingHits: this.warmingHits,
      dynamicAdjustments: this.dynamicAdjustments,
      batchOperations: this.batchOperations,
      warnings,
      timestamp: new Date().toISOString(),
      // Compression and size optimization stats
      compressionRatio,
      compressedEntries: this.compressedEntries,
      rejectedLargeEntries: this.rejectedLargeEntries,
      totalOriginalSize: this.totalOriginalSize,
      totalCompressedSize: this.totalCompressedSize
    };
  }

  getCacheHealth(): string {
    const stats = this.getStats();
    const usagePercent = stats.cacheSize / stats.maxEntries;
    const memoryPercent = stats.memoryUsageMB / stats.maxMemoryMB;
    
    if (usagePercent > 0.95 || memoryPercent > 0.95 || stats.evictions > 200) {
      return 'critical';
    }
    if (usagePercent > 0.8 || memoryPercent > 0.8 || stats.evictions > 100) {
      return 'warning';
    }
    return 'healthy';
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.client) {
      this.client.disconnect();
    }
    this.fallbackCache.clear();
    this.expirationQueue.clear();
    this.accessPatterns.clear();
  }
}

const advancedCache = new AdvancedCache();
export { advancedCache };