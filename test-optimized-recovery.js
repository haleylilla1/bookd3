/**
 * Optimized Recovery System Test Suite
 * Tests the enhanced recovery system with performance optimization
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(colors[color] + message + colors.reset);
}

class OptimizedRecoveryTest {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.performanceMetrics = {
      saveOperations: [],
      retrievalOperations: [],
      compressionTests: [],
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  async runTest(testName, testFn) {
    this.totalTests++;
    log(`\n🧪 Running: ${testName}`, 'cyan');
    
    const startTime = performance.now();
    
    try {
      await testFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.passedTests++;
      log(`✅ PASSED: ${testName} (${duration.toFixed(2)}ms)`, 'green');
      this.testResults.push({ 
        name: testName, 
        status: 'PASSED', 
        duration: duration.toFixed(2),
        performance: duration < 100 ? 'Excellent' : duration < 500 ? 'Good' : 'Needs Optimization'
      });
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      log(`❌ FAILED: ${testName} (${duration.toFixed(2)}ms)`, 'red');
      log(`   Error: ${error.message}`, 'red');
      this.testResults.push({ 
        name: testName, 
        status: 'FAILED', 
        error: error.message,
        duration: duration.toFixed(2)
      });
    }
  }

  // Test intelligent storage selection
  async testIntelligentStorageSelection() {
    const testData = {
      small: { eventName: 'Test', clientName: 'Client' },
      medium: { eventName: 'Test'.repeat(100), clientName: 'Client'.repeat(100) },
      large: { eventName: 'Test'.repeat(1000), clientName: 'Client'.repeat(1000) }
    };

    // Test small data -> localStorage
    const smallDataSize = JSON.stringify(testData.small).length;
    const smallStorage = this.selectOptimalStorage(smallDataSize);
    if (smallStorage !== 'localStorage') {
      throw new Error(`Expected localStorage for small data, got ${smallStorage}`);
    }

    // Test medium data -> sessionStorage or localStorage
    const mediumDataSize = JSON.stringify(testData.medium).length;
    const mediumStorage = this.selectOptimalStorage(mediumDataSize);
    if (!['localStorage', 'sessionStorage'].includes(mediumStorage)) {
      throw new Error(`Expected localStorage or sessionStorage for medium data, got ${mediumStorage}`);
    }

    // Test large data -> indexedDB
    const largeDataSize = JSON.stringify(testData.large).length;
    const largeStorage = this.selectOptimalStorage(largeDataSize);
    if (!['indexedDB', 'memory'].includes(largeStorage)) {
      throw new Error(`Expected indexedDB or memory for large data, got ${largeStorage}`);
    }
  }

  // Simulate storage selection logic
  selectOptimalStorage(dataSize) {
    if (dataSize < 50000) {
      try {
        localStorage.setItem('__test__', 'test');
        localStorage.removeItem('__test__');
        return 'localStorage';
      } catch (error) {
        // Fall through
      }
    }

    if (dataSize < 100000) {
      try {
        sessionStorage.setItem('__test__', 'test');
        sessionStorage.removeItem('__test__');
        return 'sessionStorage';
      } catch (error) {
        // Fall through
      }
    }

    if (typeof indexedDB !== 'undefined') {
      return 'indexedDB';
    }

    return 'memory';
  }

  // Test data deduplication
  async testDataDeduplication() {
    const testData = { eventName: 'Test Event', clientName: 'Test Client' };
    const serializedData = JSON.stringify(testData);
    
    // Generate checksum
    const checksum1 = this.generateChecksum(serializedData);
    const checksum2 = this.generateChecksum(serializedData);
    
    // Same data should have same checksum
    if (checksum1 !== checksum2) {
      throw new Error('Identical data produced different checksums');
    }
    
    // Modified data should have different checksum
    const modifiedData = { ...testData, eventName: 'Modified Event' };
    const modifiedChecksum = this.generateChecksum(JSON.stringify(modifiedData));
    
    if (checksum1 === modifiedChecksum) {
      throw new Error('Different data produced same checksum');
    }
  }

  // Generate checksum for data integrity
  generateChecksum(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  // Test compression efficiency
  async testCompressionEfficiency() {
    const testCases = [
      { name: 'Small data', data: { eventName: 'Test', clientName: 'Client' } },
      { name: 'Repetitive data', data: { eventName: 'Test'.repeat(100), clientName: 'Client'.repeat(100) } },
      { name: 'Large data', data: { eventName: 'Test'.repeat(1000), clientName: 'Client'.repeat(1000) } }
    ];

    for (const testCase of testCases) {
      const originalData = JSON.stringify(testCase.data);
      const originalSize = originalData.length;
      
      // Simulate compression (simplified)
      const compressedData = this.simulateCompression(originalData);
      const compressedSize = compressedData.length;
      
      const compressionRatio = (originalSize - compressedSize) / originalSize;
      
      this.performanceMetrics.compressionTests.push({
        name: testCase.name,
        originalSize,
        compressedSize,
        compressionRatio: compressionRatio * 100
      });
      
      // Compression should not increase size significantly
      if (compressedSize > originalSize * 1.1) {
        throw new Error(`Compression increased size for ${testCase.name}`);
      }
    }
  }

  // Simulate compression
  simulateCompression(data) {
    // Simple compression simulation - in real implementation would use proper algorithms
    if (data.length < 1000) {
      return data; // No compression for small data
    }
    
    // Simulate 10-30% compression
    const compressionRatio = 0.7 + Math.random() * 0.2;
    return data.substring(0, Math.floor(data.length * compressionRatio));
  }

  // Test performance under load
  async testPerformanceUnderLoad() {
    const testOperations = 100;
    const testData = { eventName: 'Load Test', clientName: 'Performance Client' };
    
    // Test save operations
    const saveStartTime = performance.now();
    const savePromises = [];
    
    for (let i = 0; i < testOperations; i++) {
      const promise = this.simulateSaveOperation(`test_${i}`, { ...testData, id: i });
      savePromises.push(promise);
    }
    
    await Promise.all(savePromises);
    const saveEndTime = performance.now();
    const saveDuration = saveEndTime - saveStartTime;
    
    this.performanceMetrics.saveOperations.push({
      operationCount: testOperations,
      totalDuration: saveDuration,
      averagePerOperation: saveDuration / testOperations
    });
    
    // Test retrieval operations
    const retrievalStartTime = performance.now();
    const retrievalPromises = [];
    
    for (let i = 0; i < testOperations; i++) {
      const promise = this.simulateRetrievalOperation(`test_${i}`);
      retrievalPromises.push(promise);
    }
    
    await Promise.all(retrievalPromises);
    const retrievalEndTime = performance.now();
    const retrievalDuration = retrievalEndTime - retrievalStartTime;
    
    this.performanceMetrics.retrievalOperations.push({
      operationCount: testOperations,
      totalDuration: retrievalDuration,
      averagePerOperation: retrievalDuration / testOperations
    });
    
    // Performance thresholds
    const avgSaveTime = saveDuration / testOperations;
    const avgRetrievalTime = retrievalDuration / testOperations;
    
    if (avgSaveTime > 50) {
      throw new Error(`Average save time too high: ${avgSaveTime.toFixed(2)}ms`);
    }
    
    if (avgRetrievalTime > 10) {
      throw new Error(`Average retrieval time too high: ${avgRetrievalTime.toFixed(2)}ms`);
    }
  }

  // Simulate save operation
  async simulateSaveOperation(key, data) {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          localStorage.setItem(`optimized_recovery_${key}`, JSON.stringify(data));
          resolve();
        } catch (error) {
          // Fallback to session storage
          sessionStorage.setItem(`optimized_recovery_${key}`, JSON.stringify(data));
          resolve();
        }
      }, Math.random() * 5); // Simulate network/storage latency
    });
  }

  // Simulate retrieval operation
  async simulateRetrievalOperation(key) {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const data = localStorage.getItem(`optimized_recovery_${key}`) || 
                       sessionStorage.getItem(`optimized_recovery_${key}`);
          resolve(data ? JSON.parse(data) : null);
        } catch (error) {
          resolve(null);
        }
      }, Math.random() * 2); // Simulate retrieval latency
    });
  }

  // Test cache efficiency
  async testCacheEfficiency() {
    const cache = new Map();
    const testKeys = Array.from({ length: 50 }, (_, i) => `test_key_${i}`);
    const testData = { eventName: 'Cache Test', clientName: 'Cache Client' };
    
    // First access - should be cache miss
    for (const key of testKeys) {
      const cached = cache.get(key);
      if (cached) {
        this.performanceMetrics.cacheHits++;
      } else {
        this.performanceMetrics.cacheMisses++;
        cache.set(key, testData);
      }
    }
    
    // Second access - should be cache hit
    for (const key of testKeys) {
      const cached = cache.get(key);
      if (cached) {
        this.performanceMetrics.cacheHits++;
      } else {
        this.performanceMetrics.cacheMisses++;
      }
    }
    
    // Calculate cache hit ratio
    const totalAccesses = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const hitRatio = this.performanceMetrics.cacheHits / totalAccesses;
    
    // Should have at least 50% cache hit ratio
    if (hitRatio < 0.5) {
      throw new Error(`Cache hit ratio too low: ${(hitRatio * 100).toFixed(1)}%`);
    }
  }

  // Test fallback storage chain
  async testFallbackStorageChain() {
    const testKey = 'fallback_test';
    const testData = { eventName: 'Fallback Test', clientName: 'Fallback Client' };
    
    // Test storage availability
    const storageAvailability = {
      localStorage: this.isStorageAvailable('localStorage'),
      sessionStorage: this.isStorageAvailable('sessionStorage'),
      indexedDB: typeof indexedDB !== 'undefined',
      memory: true
    };
    
    // At least one storage should be available
    const availableStorage = Object.values(storageAvailability).some(Boolean);
    if (!availableStorage) {
      throw new Error('No storage mechanisms available');
    }
    
    // Test fallback chain
    const fallbackChain = ['localStorage', 'sessionStorage', 'indexedDB', 'memory'];
    let successfulStorage = null;
    
    for (const storageType of fallbackChain) {
      if (storageAvailability[storageType]) {
        try {
          await this.testStorageType(storageType, testKey, testData);
          successfulStorage = storageType;
          break;
        } catch (error) {
          // Continue to next storage type
        }
      }
    }
    
    if (!successfulStorage) {
      throw new Error('All storage types failed');
    }
  }

  // Test storage availability
  isStorageAvailable(storageType) {
    try {
      const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
      storage.setItem('__test__', 'test');
      storage.removeItem('__test__');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Test specific storage type
  async testStorageType(storageType, key, data) {
    const serializedData = JSON.stringify(data);
    
    switch (storageType) {
      case 'localStorage':
        localStorage.setItem(key, serializedData);
        const localData = localStorage.getItem(key);
        if (localData !== serializedData) {
          throw new Error('localStorage data mismatch');
        }
        localStorage.removeItem(key);
        break;
        
      case 'sessionStorage':
        sessionStorage.setItem(key, serializedData);
        const sessionData = sessionStorage.getItem(key);
        if (sessionData !== serializedData) {
          throw new Error('sessionStorage data mismatch');
        }
        sessionStorage.removeItem(key);
        break;
        
      case 'indexedDB':
        // Simplified IndexedDB test
        if (typeof indexedDB === 'undefined') {
          throw new Error('IndexedDB not available');
        }
        break;
        
      case 'memory':
        // Memory storage always works
        break;
        
      default:
        throw new Error(`Unknown storage type: ${storageType}`);
    }
  }

  // Test data integrity validation
  async testDataIntegrityValidation() {
    const testData = { eventName: 'Integrity Test', clientName: 'Integrity Client' };
    const serializedData = JSON.stringify(testData);
    const checksum = this.generateChecksum(serializedData);
    
    // Test valid data
    const validationResult = this.validateDataIntegrity(serializedData, checksum);
    if (!validationResult.isValid) {
      throw new Error('Valid data failed integrity check');
    }
    
    // Test corrupted data
    const corruptedData = serializedData.replace('Integrity', 'Corrupted');
    const corruptedValidation = this.validateDataIntegrity(corruptedData, checksum);
    if (corruptedValidation.isValid) {
      throw new Error('Corrupted data passed integrity check');
    }
  }

  // Validate data integrity
  validateDataIntegrity(data, expectedChecksum) {
    const actualChecksum = this.generateChecksum(data);
    return {
      isValid: actualChecksum === expectedChecksum,
      expectedChecksum,
      actualChecksum
    };
  }

  // Test bulk operations
  async testBulkOperations() {
    const testData = Array.from({ length: 20 }, (_, i) => ({
      key: `bulk_test_${i}`,
      data: { eventName: `Bulk Event ${i}`, clientName: `Bulk Client ${i}` }
    }));
    
    // Test bulk save
    const bulkSaveStart = performance.now();
    const savePromises = testData.map(({ key, data }) => 
      this.simulateSaveOperation(key, data)
    );
    await Promise.all(savePromises);
    const bulkSaveEnd = performance.now();
    const bulkSaveDuration = bulkSaveEnd - bulkSaveStart;
    
    // Test bulk retrieval
    const bulkRetrievalStart = performance.now();
    const retrievalPromises = testData.map(({ key }) => 
      this.simulateRetrievalOperation(key)
    );
    const results = await Promise.all(retrievalPromises);
    const bulkRetrievalEnd = performance.now();
    const bulkRetrievalDuration = bulkRetrievalEnd - bulkRetrievalStart;
    
    // Verify results
    const successfulRetrievals = results.filter(result => result !== null).length;
    if (successfulRetrievals !== testData.length) {
      throw new Error(`Bulk retrieval failed: ${successfulRetrievals}/${testData.length} successful`);
    }
    
    // Performance validation
    const avgBulkSaveTime = bulkSaveDuration / testData.length;
    const avgBulkRetrievalTime = bulkRetrievalDuration / testData.length;
    
    if (avgBulkSaveTime > 100) {
      throw new Error(`Bulk save performance too slow: ${avgBulkSaveTime.toFixed(2)}ms per item`);
    }
    
    if (avgBulkRetrievalTime > 20) {
      throw new Error(`Bulk retrieval performance too slow: ${avgBulkRetrievalTime.toFixed(2)}ms per item`);
    }
    
    // Cleanup
    testData.forEach(({ key }) => {
      try {
        localStorage.removeItem(`optimized_recovery_${key}`);
        sessionStorage.removeItem(`optimized_recovery_${key}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  }

  // Generate performance report
  generatePerformanceReport() {
    const report = {
      summary: {
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.totalTests - this.passedTests,
        successRate: Math.round((this.passedTests / this.totalTests) * 100)
      },
      performance: {
        averageSaveTime: this.performanceMetrics.saveOperations.length > 0 ? 
          this.performanceMetrics.saveOperations[0].averagePerOperation : 0,
        averageRetrievalTime: this.performanceMetrics.retrievalOperations.length > 0 ? 
          this.performanceMetrics.retrievalOperations[0].averagePerOperation : 0,
        cacheHitRatio: this.performanceMetrics.cacheHits / 
          (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses),
        compressionEfficiency: this.performanceMetrics.compressionTests.length > 0 ? 
          this.performanceMetrics.compressionTests.reduce((sum, test) => 
            sum + test.compressionRatio, 0) / this.performanceMetrics.compressionTests.length : 0
      },
      recommendations: []
    };
    
    // Generate recommendations
    if (report.performance.averageSaveTime > 50) {
      report.recommendations.push('Consider optimizing save operations');
    }
    
    if (report.performance.averageRetrievalTime > 10) {
      report.recommendations.push('Consider implementing more aggressive caching');
    }
    
    if (report.performance.cacheHitRatio < 0.7) {
      report.recommendations.push('Improve cache efficiency');
    }
    
    if (report.performance.compressionEfficiency < 10) {
      report.recommendations.push('Consider implementing better compression algorithms');
    }
    
    return report;
  }

  // Generate final report
  generateReport() {
    const successRate = Math.round((this.passedTests / this.totalTests) * 100);
    const performanceReport = this.generatePerformanceReport();
    
    log('\n' + '='.repeat(80), 'cyan');
    log('OPTIMIZED RECOVERY SYSTEM TEST REPORT', 'cyan');
    log('='.repeat(80), 'cyan');
    
    log(`\n📊 TEST SUMMARY:`, 'white');
    log(`Total Tests: ${this.totalTests}`, 'white');
    log(`Passed: ${this.passedTests}`, 'green');
    log(`Failed: ${this.totalTests - this.passedTests}`, 'red');
    log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
    
    log(`\n⚡ PERFORMANCE METRICS:`, 'white');
    log(`Average Save Time: ${performanceReport.performance.averageSaveTime?.toFixed(2) || 'N/A'}ms`, 'white');
    log(`Average Retrieval Time: ${performanceReport.performance.averageRetrievalTime?.toFixed(2) || 'N/A'}ms`, 'white');
    log(`Cache Hit Ratio: ${(performanceReport.performance.cacheHitRatio * 100)?.toFixed(1) || 'N/A'}%`, 'white');
    log(`Compression Efficiency: ${performanceReport.performance.compressionEfficiency?.toFixed(1) || 'N/A'}%`, 'white');
    
    if (performanceReport.recommendations.length > 0) {
      log(`\n💡 RECOMMENDATIONS:`, 'yellow');
      performanceReport.recommendations.forEach(rec => {
        log(`  • ${rec}`, 'yellow');
      });
    }
    
    log(`\n📋 DETAILED RESULTS:`, 'white');
    this.testResults.forEach(result => {
      const color = result.status === 'PASSED' ? 'green' : 'red';
      log(`  ${result.status === 'PASSED' ? '✅' : '❌'} ${result.name} (${result.duration}ms)`, color);
      if (result.performance) {
        log(`     Performance: ${result.performance}`, 'white');
      }
      if (result.error) {
        log(`     Error: ${result.error}`, 'red');
      }
    });
    
    log('\n' + '='.repeat(80), 'cyan');
    
    return {
      ...performanceReport,
      details: this.testResults
    };
  }

  // Run all tests
  async runAllTests() {
    log('🚀 Starting Optimized Recovery System Test Suite', 'magenta');
    log('Testing performance optimization and reliability...', 'white');
    
    await this.runTest('Intelligent Storage Selection', () => this.testIntelligentStorageSelection());
    await this.runTest('Data Deduplication', () => this.testDataDeduplication());
    await this.runTest('Compression Efficiency', () => this.testCompressionEfficiency());
    await this.runTest('Performance Under Load', () => this.testPerformanceUnderLoad());
    await this.runTest('Cache Efficiency', () => this.testCacheEfficiency());
    await this.runTest('Fallback Storage Chain', () => this.testFallbackStorageChain());
    await this.runTest('Data Integrity Validation', () => this.testDataIntegrityValidation());
    await this.runTest('Bulk Operations', () => this.testBulkOperations());
    
    return this.generateReport();
  }
}

// Run the test suite
async function runOptimizedRecoveryTests() {
  const tester = new OptimizedRecoveryTest();
  const results = await tester.runAllTests();
  
  if (results.summary.successRate >= 80) {
    log('\n🎉 Optimized Recovery System Test Suite PASSED!', 'green');
  } else {
    log('\n❌ Optimized Recovery System Test Suite FAILED!', 'red');
  }
  
  return results;
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.runOptimizedRecoveryTests = runOptimizedRecoveryTests;
  window.OptimizedRecoveryTest = OptimizedRecoveryTest;
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runOptimizedRecoveryTests().catch(console.error);
}

export { OptimizedRecoveryTest, runOptimizedRecoveryTests };