#!/usr/bin/env node

// Memory leak detection and optimization script
const fs = require('fs');
const path = require('path');

console.log('🔍 MEMORY LEAK ANALYSIS AND FIXES');
console.log('==================================');

// 1. Analyze current memory patterns
function analyzeMemoryPatterns() {
  console.log('\n1. Memory Pattern Analysis:');
  
  const memUsage = process.memoryUsage();
  console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   External: ${(memUsage.external / 1024 / 1024).toFixed(1)}MB`);
  
  if (global.gc) {
    console.log('   Running garbage collection...');
    global.gc();
    const memUsageAfterGC = process.memoryUsage();
    console.log(`   Heap After GC: ${(memUsageAfterGC.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   GC Freed: ${((memUsage.heapUsed - memUsageAfterGC.heapUsed) / 1024 / 1024).toFixed(1)}MB`);
  }
}

// 2. Identify problematic cache entries
function identifyProblematicCacheEntries() {
  console.log('\n2. Cache Memory Issues:');
  console.log('   - User 14 gig data: 5781KB (rejected > 100KB limit)');
  console.log('   - Likely causes: Receipt images stored inline, data duplication');
  console.log('   - Solution: Implement data pagination, separate receipt storage');
}

// 3. Implement memory-efficient gig data loading
function createMemoryEfficientGigLoader() {
  console.log('\n3. Creating Memory-Efficient Data Patterns:');
  
  const gigDataOptimization = `
// Memory-efficient gig data loading with pagination
class MemoryEfficientGigLoader {
  static async getGigsPaginated(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    // Load minimal gig data without heavy fields
    const gigs = await db.select({
      id: gigs.id,
      eventName: gigs.eventName,
      clientName: gigs.clientName,
      date: gigs.date,
      expectedPay: gigs.expectedPay,
      actualPay: gigs.actualPay,
      status: gigs.status,
      // Exclude heavy fields like duties, notes, receipt arrays
    }).from(gigs)
      .where(eq(gigs.userId, userId))
      .orderBy(desc(gigs.date))
      .limit(limit)
      .offset(offset);
      
    return gigs;
  }
  
  static async getGigDetails(gigId) {
    // Load full gig data only when specifically requested
    return await db.select().from(gigs).where(eq(gigs.id, gigId));
  }
  
  static async getReceiptCount(userId) {
    // Count receipts without loading them
    const result = await db.select({
      totalReceipts: sql\`array_length(parking_receipts, 1) + array_length(other_expense_receipts, 1)\`
    }).from(gigs).where(eq(gigs.userId, userId));
    
    return result.reduce((sum, row) => sum + (row.totalReceipts || 0), 0);
  }
}
`;

  fs.writeFileSync('memory-efficient-gig-loader.js', gigDataOptimization);
  console.log('   ✓ Created memory-efficient gig loader pattern');
}

// 4. Cache size optimization
function createCacheOptimizations() {
  console.log('\n4. Cache Size Optimizations:');
  
  const cacheOptimizations = `
// Optimize cache storage for large datasets
class OptimizedCacheManager {
  static async setGigCache(userId, gigs) {
    // Calculate cache entry size
    const dataSize = JSON.stringify(gigs).length;
    
    if (dataSize > 50000) { // 50KB threshold
      console.log(\`🚫 Large gig dataset (\${Math.round(dataSize/1024)}KB) - using pagination\`);
      
      // Store only recent gigs in cache
      const recentGigs = gigs.slice(0, 20); // Last 20 gigs only
      await cache.set(\`gigs:\${userId}\`, recentGigs, 60); // Shorter TTL
      
      // Store metadata separately
      await cache.set(\`gigs-meta:\${userId}\`, {
        totalCount: gigs.length,
        lastUpdate: Date.now(),
        recentOnly: true
      }, 300);
      
      return { cached: 'partial', reason: 'size_optimized' };
    } else {
      await cache.set(\`gigs:\${userId}\`, gigs, 120);
      return { cached: 'full' };
    }
  }
  
  static async getGigCache(userId) {
    const cachedGigs = await cache.get(\`gigs:\${userId}\`);
    const metadata = await cache.get(\`gigs-meta:\${userId}\`);
    
    return {
      gigs: cachedGigs,
      isPartial: metadata?.recentOnly || false,
      totalCount: metadata?.totalCount || cachedGigs?.length || 0
    };
  }
}
`;

  fs.writeFileSync('optimized-cache-manager.js', cacheOptimizations);
  console.log('   ✓ Created cache size optimization patterns');
}

// 5. Memory monitoring improvements
function createMemoryMonitoring() {
  console.log('\n5. Enhanced Memory Monitoring:');
  
  const monitoring = `
// Enhanced memory monitoring with leak detection
class MemoryLeakDetector {
  static memoryHistory = [];
  static MAX_HISTORY = 60; // 60 data points
  
  static recordMemoryUsage() {
    const usage = process.memoryUsage();
    const timestamp = Date.now();
    
    this.memoryHistory.push({
      timestamp,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external
    });
    
    // Keep only recent history
    if (this.memoryHistory.length > this.MAX_HISTORY) {
      this.memoryHistory.shift();
    }
    
    // Detect memory leaks (consistent growth over time)
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10);
      const trend = this.calculateMemoryTrend(recent);
      
      if (trend.isLeaking) {
        console.log(\`🚨 MEMORY LEAK DETECTED: \${trend.growthRate}MB/min\`);
        this.triggerMemoryCleanup();
      }
    }
  }
  
  static calculateMemoryTrend(data) {
    const firstPoint = data[0];
    const lastPoint = data[data.length - 1];
    
    const timeDiff = (lastPoint.timestamp - firstPoint.timestamp) / 60000; // minutes
    const memoryDiff = (lastPoint.heapUsed - firstPoint.heapUsed) / 1024 / 1024; // MB
    
    const growthRate = memoryDiff / timeDiff;
    
    return {
      isLeaking: growthRate > 5, // 5MB/min growth threshold
      growthRate: growthRate.toFixed(2)
    };
  }
  
  static triggerMemoryCleanup() {
    console.log('🧹 Triggering emergency memory cleanup');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear large cache entries
    import('./advanced-cache.js').then(({ advancedCache }) => {
      advancedCache.emergencyCleanup(0.7); // Clear 70% of cache
    });
    
    // Log cleanup results
    setTimeout(() => {
      const usage = process.memoryUsage();
      console.log(\`🧠 Post-cleanup memory: \${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB\`);
    }, 1000);
  }
}

// Start monitoring
setInterval(() => MemoryLeakDetector.recordMemoryUsage(), 30000); // Every 30 seconds
`;

  fs.writeFileSync('memory-leak-detector.js', monitoring);
  console.log('   ✓ Created enhanced memory leak detection');
}

// Run all optimizations
async function main() {
  analyzeMemoryPatterns();
  identifyProblematicCacheEntries();
  createMemoryEfficientGigLoader();
  createCacheOptimizations();
  createMemoryMonitoring();
  
  console.log('\n✅ MEMORY OPTIMIZATION COMPLETE');
  console.log('==========================================');
  console.log('Next steps:');
  console.log('1. Implement pagination for large gig datasets');
  console.log('2. Separate receipt storage from gig data');
  console.log('3. Add cache size limits and optimization');
  console.log('4. Deploy memory leak detection system');
}

main().catch(console.error);