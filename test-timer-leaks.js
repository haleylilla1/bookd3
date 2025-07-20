/**
 * Timer Leak Testing
 * Tests the timer leak detection and identifies specific sources
 */

async function testTimerLeaks() {
  console.log('⏱️  TIMER LEAK TESTING');
  console.log('=====================');
  
  const BASE_URL = 'http://localhost:5000';
  
  // Test 1: Get current timer report
  console.log('\n📊 Test 1: Current Timer Report');
  
  try {
    const response = await fetch(`${BASE_URL}/api/timers/report`);
    const report = await response.json();
    
    console.log('Timer Summary:');
    console.log(`Tracked Timers: ${report.summary.trackedTimers}`);
    console.log(`Process Handles: ${report.summary.processHandles}`);
    console.log(`Unaccounted Handles: ${report.summary.unaccountedHandles}`);
    console.log(`Intervals: ${report.summary.intervalCount}`);
    console.log(`Timeouts: ${report.summary.timeoutCount}`);
    console.log(`Oldest Timer Age: ${report.oldestTimerAge.toFixed(1)} minutes`);
    
    if (Object.keys(report.sources).length > 0) {
      console.log('\nTimer Sources:');
      Object.entries(report.sources).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} timers`);
      });
    }
    
    if (report.suspiciousTimers.length > 0) {
      console.log('\n⚠️  Suspicious Timers (>5 min old):');
      report.suspiciousTimers.forEach(timer => {
        console.log(`  ${timer.source}: ${timer.type} (${timer.ageMinutes.toFixed(1)}min, ${timer.delay}ms)`);
      });
    }
    
  } catch (error) {
    console.error('Failed to fetch timer report:', error.message);
  }
  
  // Test 2: Detailed timer sources
  console.log('\n🔍 Test 2: Detailed Timer Sources');
  
  try {
    const response = await fetch(`${BASE_URL}/api/timers/sources`);
    const sources = await response.json();
    
    if (Object.keys(sources).length === 0) {
      console.log('No active timers detected');
    } else {
      Object.entries(sources).forEach(([source, details]) => {
        console.log(`\n📍 ${source}: ${details.count} timers`);
        details.timers.forEach((timer, index) => {
          console.log(`  ${index + 1}. ${timer.type} - ${timer.delay}ms - ${timer.ageMinutes.toFixed(1)}min old`);
          if (timer.ageMinutes > 5) {
            console.log(`     🚨 SUSPICIOUS: Timer older than 5 minutes`);
          }
          console.log(`     Stack: ${timer.stack.split('\n')[0]}`);
        });
      });
    }
    
  } catch (error) {
    console.error('Failed to fetch timer sources:', error.message);
  }
  
  // Test 3: Memory impact analysis
  console.log('\n🧠 Test 3: Memory Impact Analysis');
  
  try {
    const memoryResponse = await fetch(`${BASE_URL}/api/memory/stats`);
    const memoryStats = await memoryResponse.json();
    
    const timerResponse = await fetch(`${BASE_URL}/api/timers/report`);
    const timerReport = await timerResponse.json();
    
    console.log('Memory vs Timer Correlation:');
    console.log(`Heap Usage: ${memoryStats.current.heapUsed.toFixed(1)}MB`);
    console.log(`Process Handles: ${timerReport.summary.processHandles}`);
    console.log(`Timer/Handle Ratio: ${(timerReport.summary.trackedTimers / timerReport.summary.processHandles * 100).toFixed(1)}%`);
    
    if (timerReport.summary.unaccountedHandles > 50) {
      console.log(`🚨 HIGH UNACCOUNTED HANDLES: ${timerReport.summary.unaccountedHandles} (potential leak source)`);
    }
    
    if (timerReport.summary.trackedTimers > 20) {
      console.log(`⚠️  HIGH TIMER COUNT: ${timerReport.summary.trackedTimers} active timers`);
    }
    
  } catch (error) {
    console.error('Failed to analyze memory impact:', error.message);
  }
  
  // Test 4: Timer cleanup test (only if many suspicious timers)
  console.log('\n🧹 Test 4: Timer Cleanup Assessment');
  
  try {
    const reportResponse = await fetch(`${BASE_URL}/api/timers/report`);
    const report = await reportResponse.json();
    
    const suspiciousCount = report.suspiciousTimers.length;
    console.log(`Suspicious timers detected: ${suspiciousCount}`);
    
    if (suspiciousCount > 5) {
      console.log('⚠️  High number of suspicious timers detected');
      console.log('Consider running cleanup: POST /api/timers/cleanup with maxAgeMinutes parameter');
      
      // Show what would be cleaned
      const oldTimers = report.suspiciousTimers.filter(t => t.ageMinutes > 10);
      if (oldTimers.length > 0) {
        console.log(`\nWould clean ${oldTimers.length} timers older than 10 minutes:`);
        oldTimers.forEach(timer => {
          console.log(`  - ${timer.source}: ${timer.type} (${timer.ageMinutes.toFixed(1)}min old)`);
        });
      }
    } else {
      console.log('✅ Timer age levels are healthy');
    }
    
  } catch (error) {
    console.error('Failed to assess cleanup needs:', error.message);
  }
  
  // Test 5: Known timer source identification
  console.log('\n🎯 Test 5: Known Timer Source Identification');
  
  const knownSources = [
    'nodejs-memory-profiler.ts',
    'infrastructure-manager.ts',
    'monitoring-system.ts',
    'mileage-service.ts',
    'alerting-system.ts',
    'backup-system.ts',
    'advanced-cache.ts',
    'memory-leak-fixes.ts'
  ];
  
  try {
    const sourcesResponse = await fetch(`${BASE_URL}/api/timers/sources`);
    const sources = await sourcesResponse.json();
    
    console.log('Known Sources Analysis:');
    knownSources.forEach(source => {
      const matchingKeys = Object.keys(sources).filter(key => key.includes(source.replace('.ts', '')));
      if (matchingKeys.length > 0) {
        matchingKeys.forEach(key => {
          const count = sources[key].count;
          const status = count > 3 ? '🚨 HIGH' : count > 1 ? '⚠️  MODERATE' : '✅ LOW';
          console.log(`  ${source}: ${count} timers ${status}`);
        });
      } else {
        console.log(`  ${source}: No active timers`);
      }
    });
    
  } catch (error) {
    console.error('Failed to analyze known sources:', error.message);
  }
  
  console.log('\n✅ TIMER LEAK TESTING COMPLETE');
  console.log('==============================');
  
  console.log('\n🎯 Action Items:');
  console.log('1. Review timer sources with >3 active timers');
  console.log('2. Investigate unaccounted process handles');
  console.log('3. Clean up timers older than 10 minutes if needed');
  console.log('4. Monitor timer creation patterns during app usage');
}

// Run timer leak testing
testTimerLeaks().catch(console.error);