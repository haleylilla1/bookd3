// Memory optimization utilities for handling large datasets
import { cache } from './simple-cache';

export class MemoryOptimizer {
  
  /**
   * Check if data is safe to cache based on size
   */
  static isSafeToCacheData(data: any, maxSizeKB: number = 100): boolean {
    const dataSize = JSON.stringify(data).length;
    const dataSizeKB = dataSize / 1024;
    
    if (dataSizeKB > maxSizeKB) {
      console.log(`🚫 Data too large to cache: ${Math.round(dataSizeKB)}KB (max: ${maxSizeKB}KB)`);
      return false;
    }
    
    return true;
  }

  /**
   * Create lightweight version of gig data for better performance
   */
  static createLightweightGigData(gigs: any[]): any[] {
    return gigs.map(gig => ({
      id: gig.id,
      eventName: gig.eventName,
      clientName: gig.clientName,
      date: gig.date,
      startDate: gig.startDate,
      endDate: gig.endDate,
      expectedPay: gig.expectedPay,
      actualPay: gig.actualPay,
      status: gig.status,
      gigType: gig.gigType,
      taxRate: gig.taxRate,
      location: gig.location,
      startingAddress: gig.startingAddress,
      endingAddress: gig.endingAddress,
      distance: gig.distance,
      parkingCost: gig.parkingCost,
      otherExpenses: gig.otherExpenses,
      reimbursed: gig.reimbursed,
      // Exclude heavy fields
      receiptCount: {
        parking: gig.parking_receipts?.length || 0,
        other: gig.other_expense_receipts?.length || 0
      },
      // Truncate long text fields
      notes: gig.notes?.length > 200 ? gig.notes.substring(0, 200) + '...' : gig.notes,
      duties: gig.duties?.length > 200 ? gig.duties.substring(0, 200) + '...' : gig.duties,
    }));
  }

  /**
   * Paginate large datasets for memory efficiency
   */
  static paginateData<T>(data: T[], page: number = 1, limit: number = 50): {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  } {
    const offset = (page - 1) * limit;
    const items = data.slice(offset, offset + limit);
    const totalPages = Math.ceil(data.length / limit);
    
    return {
      items,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Safe cache operation that checks size before storing
   */
  static async safeCache(key: string, data: any, ttlSeconds: number = 120): Promise<boolean> {
    if (!this.isSafeToCacheData(data)) {
      console.log(`⚠️ Skipping cache for oversized data: ${key}`);
      return false;
    }
    
    try {
      await cache.set(key, data, ttlSeconds);
      console.log(`✅ Cached data: ${key} (${Math.round(JSON.stringify(data).length/1024)}KB)`);
      return true;
    } catch (error) {
      console.error(`❌ Cache operation failed for ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear cache entries that are too large
   */
  static async cleanupOversizedCache(): Promise<number> {
    // This would need to be implemented based on your cache implementation
    // For now, log the action
    console.log('🧹 Cleaning up oversized cache entries...');
    return 0;
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  static monitorMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    percentage: number;
    needsCleanup: boolean;
  } {
    const usage = process.memoryUsage();
    const percentage = (usage.heapUsed / usage.heapTotal) * 100;
    
    const stats = {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 10) / 10, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 10) / 10, // MB
      rss: Math.round(usage.rss / 1024 / 1024 * 10) / 10, // MB
      external: Math.round(usage.external / 1024 / 1024 * 10) / 10, // MB
      percentage: Math.round(percentage * 10) / 10,
      needsCleanup: percentage > 85 // Trigger cleanup at 85%
    };

    if (stats.needsCleanup) {
      console.log(`🚨 Memory usage high: ${stats.percentage}% (${stats.heapUsed}MB/${stats.heapTotal}MB)`);
    }

    return stats;
  }

  /**
   * Force garbage collection if available
   */
  static forceGarbageCollection(): boolean {
    if (global.gc) {
      const beforeMem = process.memoryUsage().heapUsed;
      global.gc();
      const afterMem = process.memoryUsage().heapUsed;
      const freed = (beforeMem - afterMem) / 1024 / 1024;
      
      if (freed > 0.1) { // Only log if significant memory was freed
        console.log(`🗑️ Garbage collection freed ${Math.round(freed * 10) / 10}MB`);
      }
      
      return true;
    }
    
    return false;
  }
}

// Export memory monitoring utility
export function startMemoryMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
  return setInterval(() => {
    const stats = MemoryOptimizer.monitorMemoryUsage();
    
    if (stats.needsCleanup) {
      console.log('🧹 Triggering memory cleanup due to high usage');
      MemoryOptimizer.forceGarbageCollection();
      MemoryOptimizer.cleanupOversizedCache();
    }
  }, intervalMs);
}