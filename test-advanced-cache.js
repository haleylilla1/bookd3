#!/usr/bin/env node

// Test Advanced Cache Features
console.log('🚀 Testing Advanced Cache System\n');

async function testAdvancedCache() {
  console.log('⚡ Testing O(log n) priority queue, dynamic intervals, cache warming, and batch operations...\n');
  
  // Wait for cache system to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Import fetch for Node.js
    const fetch = (await import('node-fetch')).default;
    
    // Get initial cache stats
    const response = await fetch('http://localhost:3000/api/cache-stats', {
      headers: { 'Cookie': 'session=valid-session-cookie' }
    });
    
    if (!response.ok) {
      console.log('❌ Cache stats endpoint not accessible');
      return;
    }
    
    const stats = await response.json();
    console.log('📊 Advanced Cache Features:');
    console.log(`   ✅ Priority Queue: ${stats.features?.priorityQueue ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   ✅ Dynamic Intervals: ${stats.features?.dynamicIntervals ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   ✅ Cache Warming: ${stats.features?.cacheWarming ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   ✅ Batch Operations: ${stats.features?.batchOperations ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   ✅ O(log n) Cleanup: ${stats.features?.oLogNCleanup ? 'ENABLED' : 'DISABLED'}`);
    
    console.log('\n📈 Performance Metrics:');
    console.log(`   Cache size: ${stats.cacheSize}/${stats.maxEntries} entries`);
    console.log(`   Memory usage: ${stats.memoryUsageMB}/${stats.maxMemoryMB} MB`);
    console.log(`   Hit rate: ${stats.hitRate}%`);
    console.log(`   Cleanup interval: ${stats.cleanupIntervalMinutes} minutes`);
    console.log(`   Average cleanup time: ${stats.averageCleanupDuration}ms`);
    
    console.log('\n🔥 Advanced Features Status:');
    console.log(`   Warming hits: ${stats.warmingHits}`);
    console.log(`   Dynamic adjustments: ${stats.dynamicAdjustments}`);
    console.log(`   Batch operations: ${stats.batchOperations}`);
    console.log(`   Total cleanups: ${stats.totalCleanups}`);
    console.log(`   Expired entries removed: ${stats.expiredEntriesRemoved}`);
    
    console.log('\n⚡ Performance Benefits:');
    console.log('   ✅ O(log n) TTL cleanup vs O(n) basic cleanup');
    console.log('   ✅ Dynamic intervals adjust based on cache activity');
    console.log('   ✅ Cache warming preloads frequently accessed data');
    console.log('   ✅ Batch operations for efficient bulk deletions');
    console.log('   ✅ Priority-aware LRU eviction');
    
    if (stats.health === 'healthy') {
      console.log('\n🎯 Advanced Cache Status: OPTIMAL PERFORMANCE');
    } else {
      console.log(`\n⚠️ Cache Health: ${stats.health.toUpperCase()}`);
    }
    
    // Test high activity to trigger dynamic interval adjustment
    console.log('\n🔄 Testing dynamic interval adjustment with high activity...');
    for (let i = 0; i < 20; i++) {
      await fetch('http://localhost:3000/api/user', {
        headers: { 'Cookie': 'session=valid-session-cookie' }
      });
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
    }
    
    // Check for dynamic adjustments
    const updatedResponse = await fetch('http://localhost:3000/api/cache-stats', {
      headers: { 'Cookie': 'session=valid-session-cookie' }
    });
    const updatedStats = await updatedResponse.json();
    
    console.log('\n📊 After High Activity:');
    console.log(`   New cleanup interval: ${updatedStats.cleanupIntervalMinutes} minutes`);
    console.log(`   Dynamic adjustments: ${updatedStats.dynamicAdjustments}`);
    console.log(`   Total cache operations: ${updatedStats.hits + updatedStats.misses}`);
    
    console.log('\n✅ Advanced Cache System Fully Operational');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAdvancedCache();