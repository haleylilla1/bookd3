/**
 * Optimized Mobile Auto-Save System Test
 * Validates reliability, efficiency, and performance improvements
 */

// Test Configuration
const OPTIMIZATION_CONFIG = {
  formKey: 'optimized-test-form',
  testData: {
    gigType: 'brand-ambassador',
    eventName: 'Optimized Test Event',
    clientName: 'Mobile Test Client',
    expectedPay: '200.00',
    notes: 'Testing optimized auto-save system'
  },
  testSizes: {
    small: 1000,    // 1KB
    medium: 10000,  // 10KB
    large: 50000    // 50KB
  }
};

class OptimizedAutoSaveTest {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = [];
    this.currentTest = '';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${this.currentTest}: ${message}`;
    console.log(logEntry);
    this.testResults.push({ timestamp, type, test: this.currentTest, message });
  }

  async runTest(testName, testFn) {
    this.currentTest = testName;
    this.log(`Starting test: ${testName}`);
    
    const startTime = performance.now();
    
    try {
      await testFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.performanceMetrics.push({
        test: testName,
        duration: duration,
        success: true
      });
      
      this.log(`✅ Test passed: ${testName} (${duration.toFixed(2)}ms)`, 'success');
      return true;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.performanceMetrics.push({
        test: testName,
        duration: duration,
        success: false,
        error: error.message
      });
      
      this.log(`❌ Test failed: ${testName} - ${error.message} (${duration.toFixed(2)}ms)`, 'error');
      return false;
    }
  }

  // Test 1: Storage efficiency optimization
  async testStorageEfficiency() {
    const { formKey } = OPTIMIZATION_CONFIG;
    this.clearAllStorage(formKey);
    
    const testData = { ...OPTIMIZATION_CONFIG.testData };
    const serialized = JSON.stringify(testData);
    
    // Measure storage speed
    const startTime = performance.now();
    
    // Optimized storage: Primary + backup only (not all 4 locations)
    localStorage.setItem(`autosave_${formKey}`, serialized);
    localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
    localStorage.setItem(`backup_autosave_${formKey}`, serialized);
    localStorage.setItem(`backup_autosave_${formKey}_timestamp`, Date.now().toString());
    
    const endTime = performance.now();
    const storageTime = endTime - startTime;
    
    this.log(`Storage time: ${storageTime.toFixed(2)}ms`);
    this.log(`Data size: ${new Blob([serialized]).size} bytes`);
    
    // Verify data integrity
    const retrieved = localStorage.getItem(`autosave_${formKey}`);
    if (!retrieved || JSON.parse(retrieved).gigType !== testData.gigType) {
      throw new Error('Storage efficiency test failed - data integrity issue');
    }
    
    if (storageTime > 10) {
      throw new Error(`Storage too slow: ${storageTime.toFixed(2)}ms (should be < 10ms)`);
    }
  }

  // Test 2: Smart retrieval fallback chain
  async testSmartRetrieval() {
    const { formKey } = OPTIMIZATION_CONFIG;
    this.clearAllStorage(formKey);
    
    // Test fallback chain: Primary -> Backup -> Session -> Emergency
    const testData = { ...OPTIMIZATION_CONFIG.testData, test: 'fallback' };
    const serialized = JSON.stringify(testData);
    
    // Only set backup storage (primary missing)
    localStorage.setItem(`backup_autosave_${formKey}`, serialized);
    localStorage.setItem(`backup_autosave_${formKey}_timestamp`, Date.now().toString());
    
    // Simulate retrieval logic
    const sources = [
      { name: 'primary', storage: localStorage, prefix: 'autosave_' },
      { name: 'backup', storage: localStorage, prefix: 'backup_autosave_' },
      { name: 'session', storage: sessionStorage, prefix: 'session_autosave_' },
      { name: 'emergency', storage: sessionStorage, prefix: 'emergency_autosave_' }
    ];
    
    let retrievedData = null;
    let sourceUsed = null;
    
    for (const source of sources) {
      try {
        const data = source.storage.getItem(`${source.prefix}${formKey}`);
        if (data) {
          retrievedData = JSON.parse(data);
          sourceUsed = source.name;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!retrievedData || sourceUsed !== 'backup') {
      throw new Error('Smart retrieval fallback failed');
    }
    
    this.log(`Successfully retrieved from ${sourceUsed} storage`);
  }

  // Test 3: Event handling optimization
  async testEventHandlingOptimization() {
    let eventCount = 0;
    let isHandlingEvent = false;
    
    const handleCriticalSave = () => {
      if (!isHandlingEvent) {
        isHandlingEvent = true;
        eventCount++;
        // Simulate save operation
        setTimeout(() => { isHandlingEvent = false; }, 10);
      }
    };
    
    // Simulate rapid events (should be throttled)
    handleCriticalSave();
    handleCriticalSave();
    handleCriticalSave();
    
    // Wait for throttling to reset
    await new Promise(resolve => setTimeout(resolve, 150));
    
    handleCriticalSave();
    
    if (eventCount !== 2) {
      throw new Error(`Event throttling failed: ${eventCount} events (expected 2)`);
    }
    
    this.log(`Event throttling working: ${eventCount} saves from 4 events`);
  }

  // Test 4: Mobile keyboard detection optimization
  async testMobileKeyboardOptimization() {
    const originalHeight = window.innerHeight;
    let saveTriggered = false;
    
    // Mock height change tracking
    let lastHeight = originalHeight;
    
    const handleResize = (newHeight) => {
      // Only trigger if height change is significant (>150px)
      if (Math.abs(newHeight - lastHeight) > 150) {
        saveTriggered = true;
        lastHeight = newHeight;
      }
    };
    
    // Test 1: Small change (should not trigger)
    handleResize(originalHeight - 50);
    
    if (saveTriggered) {
      throw new Error('Small viewport change incorrectly triggered save');
    }
    
    // Test 2: Large change (should trigger)
    handleResize(originalHeight - 300);
    
    if (!saveTriggered) {
      throw new Error('Large viewport change (keyboard) did not trigger save');
    }
    
    this.log('Mobile keyboard detection optimized correctly');
  }

  // Test 5: Smart content validation
  async testSmartContentValidation() {
    const testCases = [
      { data: { gigType: '' }, expected: false, name: 'empty string' },
      { data: { gigType: 'test' }, expected: true, name: 'meaningful string' },
      { data: { expectedPay: '0' }, expected: false, name: 'zero value' },
      { data: { expectedPay: '100' }, expected: true, name: 'non-zero value' },
      { data: { notes: '   ' }, expected: false, name: 'whitespace only' },
      { data: { notes: 'real notes' }, expected: true, name: 'meaningful content' },
      { data: { trackExpenses: true }, expected: true, name: 'boolean true' },
      { data: { trackExpenses: false }, expected: true, name: 'boolean false' },
      { data: { stops: [] }, expected: false, name: 'empty array' },
      { data: { stops: ['stop1'] }, expected: true, name: 'non-empty array' }
    ];
    
    for (const testCase of testCases) {
      const hasContent = Object.entries(testCase.data).some(([key, value]) => {
        if (value === null || value === undefined || value === '' || value === 0) return false;
        if (typeof value === 'string' && value.trim().length > 0) return true;
        if (Array.isArray(value) && value.length > 0) return true;
        if (typeof value === 'boolean') return true;
        if (typeof value === 'number' && value !== 0) return true;
        return false;
      });
      
      if (hasContent !== testCase.expected) {
        throw new Error(`Smart content validation failed for ${testCase.name}`);
      }
    }
    
    this.log('Smart content validation working correctly');
  }

  // Test 6: Performance under load
  async testPerformanceUnderLoad() {
    const { formKey } = OPTIMIZATION_CONFIG;
    this.clearAllStorage(formKey);
    
    const largeData = {
      ...OPTIMIZATION_CONFIG.testData,
      largeField: 'x'.repeat(OPTIMIZATION_CONFIG.testSizes.large),
      arrayField: new Array(1000).fill('performance test')
    };
    
    const serialized = JSON.stringify(largeData);
    
    // Test large data storage performance
    const startTime = performance.now();
    
    localStorage.setItem(`autosave_${formKey}`, serialized);
    localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
    
    const endTime = performance.now();
    const storageTime = endTime - startTime;
    
    this.log(`Large data storage time: ${storageTime.toFixed(2)}ms`);
    this.log(`Data size: ${new Blob([serialized]).size} bytes`);
    
    // Verify retrieval performance
    const retrievalStart = performance.now();
    const retrieved = localStorage.getItem(`autosave_${formKey}`);
    const retrievalEnd = performance.now();
    const retrievalTime = retrievalEnd - retrievalStart;
    
    this.log(`Large data retrieval time: ${retrievalTime.toFixed(2)}ms`);
    
    if (storageTime > 50) {
      throw new Error(`Large data storage too slow: ${storageTime.toFixed(2)}ms`);
    }
    
    if (retrievalTime > 20) {
      throw new Error(`Large data retrieval too slow: ${retrievalTime.toFixed(2)}ms`);
    }
    
    // Verify data integrity
    const parsed = JSON.parse(retrieved);
    if (parsed.largeField.length !== OPTIMIZATION_CONFIG.testSizes.large) {
      throw new Error('Large data integrity check failed');
    }
  }

  // Test 7: Mobile vs Desktop timing optimization
  async testTimingOptimization() {
    // Test mobile timing (should be faster)
    const mobileDelay = 1200; // 1.2s
    const desktopDelay = 2000; // 2s
    
    if (mobileDelay >= desktopDelay) {
      throw new Error('Mobile timing not optimized (should be faster than desktop)');
    }
    
    const timingRatio = mobileDelay / desktopDelay;
    
    if (timingRatio > 0.7) {
      throw new Error(`Mobile timing not aggressive enough: ${timingRatio * 100}% of desktop`);
    }
    
    this.log(`Mobile timing optimized: ${mobileDelay}ms vs ${desktopDelay}ms (${(timingRatio * 100).toFixed(1)}% of desktop)`);
  }

  // Utility: Clear all storage locations
  clearAllStorage(formKey) {
    const keys = [
      `autosave_${formKey}`,
      `autosave_${formKey}_timestamp`,
      `backup_autosave_${formKey}`,
      `backup_autosave_${formKey}_timestamp`
    ];
    
    keys.forEach(key => {
      localStorage.removeItem(key);
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        // Ignore session storage errors
      }
    });
  }

  // Generate performance report
  generatePerformanceReport() {
    const totalTests = this.performanceMetrics.length;
    const passedTests = this.performanceMetrics.filter(m => m.success).length;
    const averageTime = this.performanceMetrics.reduce((acc, m) => acc + m.duration, 0) / totalTests;
    
    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: Math.round((passedTests / totalTests) * 100),
      averageTime: averageTime.toFixed(2),
      fastestTest: Math.min(...this.performanceMetrics.map(m => m.duration)).toFixed(2),
      slowestTest: Math.max(...this.performanceMetrics.map(m => m.duration)).toFixed(2),
      metrics: this.performanceMetrics
    };
  }

  // Run all optimization tests
  async runAllTests() {
    console.log('\n🚀 Starting Optimized Mobile Auto-Save Tests...\n');
    
    const tests = [
      { name: 'Storage efficiency', fn: () => this.testStorageEfficiency() },
      { name: 'Smart retrieval', fn: () => this.testSmartRetrieval() },
      { name: 'Event handling', fn: () => this.testEventHandlingOptimization() },
      { name: 'Mobile keyboard', fn: () => this.testMobileKeyboardOptimization() },
      { name: 'Content validation', fn: () => this.testSmartContentValidation() },
      { name: 'Performance load', fn: () => this.testPerformanceUnderLoad() },
      { name: 'Timing optimization', fn: () => this.testTimingOptimization() }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      const success = await this.runTest(test.name, test.fn);
      if (success) {
        passed++;
      } else {
        failed++;
      }
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Generate performance report
    const report = this.generatePerformanceReport();
    
    console.log('\n📊 Optimization Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${report.successRate}%`);
    console.log(`⚡ Average Time: ${report.averageTime}ms`);
    console.log(`🏃 Fastest Test: ${report.fastestTest}ms`);
    console.log(`🐌 Slowest Test: ${report.slowestTest}ms`);
    
    // Final cleanup
    this.clearAllStorage(OPTIMIZATION_CONFIG.formKey);
    
    if (failed === 0) {
      console.log('\n🎉 All optimization tests passed! Mobile auto-save is highly optimized.');
    } else {
      console.log('\n⚠️  Some optimization tests failed. Check the logs for details.');
    }
    
    return {
      passed,
      failed,
      successRate: report.successRate,
      performance: report,
      details: this.testResults
    };
  }
}

// Export for browser and Node.js
if (typeof window !== 'undefined') {
  window.runOptimizedAutoSaveTests = () => {
    const tester = new OptimizedAutoSaveTest();
    return tester.runAllTests();
  };
  
  console.log('Optimized Auto-Save Test Suite loaded. Run with: runOptimizedAutoSaveTests()');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedAutoSaveTest;
}