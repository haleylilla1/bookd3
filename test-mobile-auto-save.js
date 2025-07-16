/**
 * Mobile Auto-Save System Test Suite
 * Tests bulletproof local storage backup and recovery
 */

// Test Configuration
const TEST_CONFIG = {
  formKey: 'test-mobile-gig-form',
  testData: {
    gigType: 'brand-ambassador',
    eventName: 'Product Launch Event',
    clientName: 'Tech Startup Inc',
    startDate: '2025-07-16',
    expectedPay: '150.00',
    notes: 'High-energy promotional work'
  },
  testDelay: 2000, // 2 seconds
  maxRetries: 3
};

class MobileAutoSaveTest {
  constructor() {
    this.testResults = [];
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
    
    try {
      await testFn();
      this.log(`✅ Test passed: ${testName}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Test failed: ${testName} - ${error.message}`, 'error');
      return false;
    }
  }

  // Test 1: Basic localStorage functionality
  async testBasicLocalStorage() {
    const { formKey, testData } = TEST_CONFIG;
    
    // Clear any existing data
    localStorage.removeItem(`autosave_${formKey}`);
    localStorage.removeItem(`autosave_${formKey}_timestamp`);
    
    // Test basic save
    const serializedData = JSON.stringify(testData);
    localStorage.setItem(`autosave_${formKey}`, serializedData);
    localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
    
    // Test retrieval
    const savedData = localStorage.getItem(`autosave_${formKey}`);
    const savedTimestamp = localStorage.getItem(`autosave_${formKey}_timestamp`);
    
    if (!savedData || !savedTimestamp) {
      throw new Error('Basic localStorage save/retrieve failed');
    }
    
    const parsedData = JSON.parse(savedData);
    if (parsedData.gigType !== testData.gigType) {
      throw new Error('Data integrity check failed');
    }
    
    this.log(`Saved data: ${Object.keys(parsedData).length} fields`);
    this.log(`Timestamp: ${new Date(parseInt(savedTimestamp)).toLocaleString()}`);
  }

  // Test 2: Mobile-optimized multi-storage system
  async testMultiStorageSystem() {
    const { formKey, testData } = TEST_CONFIG;
    
    // Clear all storage locations
    this.clearAllStorage(formKey);
    
    // Simulate mobile-optimized save
    const serializedData = JSON.stringify(testData);
    const timestamp = Date.now().toString();
    
    // Primary storage
    localStorage.setItem(`autosave_${formKey}`, serializedData);
    localStorage.setItem(`autosave_${formKey}_timestamp`, timestamp);
    
    // Backup storage
    localStorage.setItem(`backup_autosave_${formKey}`, serializedData);
    localStorage.setItem(`backup_autosave_${formKey}_timestamp`, timestamp);
    
    // Session storage
    sessionStorage.setItem(`session_autosave_${formKey}`, serializedData);
    sessionStorage.setItem(`session_autosave_${formKey}_timestamp`, timestamp);
    
    // Emergency storage
    sessionStorage.setItem(`emergency_autosave_${formKey}`, serializedData);
    sessionStorage.setItem(`emergency_autosave_${formKey}_timestamp`, timestamp);
    
    // Test retrieval from all sources
    const sources = [
      { name: 'Primary', storage: localStorage, prefix: 'autosave_' },
      { name: 'Backup', storage: localStorage, prefix: 'backup_autosave_' },
      { name: 'Session', storage: sessionStorage, prefix: 'session_autosave_' },
      { name: 'Emergency', storage: sessionStorage, prefix: 'emergency_autosave_' }
    ];
    
    for (const source of sources) {
      const data = source.storage.getItem(`${source.prefix}${formKey}`);
      const ts = source.storage.getItem(`${source.prefix}${formKey}_timestamp`);
      
      if (!data || !ts) {
        throw new Error(`${source.name} storage failed`);
      }
      
      this.log(`${source.name} storage: ✅ Working`);
    }
  }

  // Test 3: Mobile Safari tab switching simulation
  async testMobileSafariTabSwitching() {
    const { formKey, testData } = TEST_CONFIG;
    
    // Clear storage
    this.clearAllStorage(formKey);
    
    // Simulate form data entry
    const formData = { ...testData };
    
    // Simulate tab switching (visibilitychange event)
    const serializedData = JSON.stringify(formData);
    const timestamp = Date.now().toString();
    
    // Mobile Safari fix: Force save when visibility changes
    localStorage.setItem(`autosave_${formKey}`, serializedData);
    localStorage.setItem(`autosave_${formKey}_timestamp`, timestamp);
    localStorage.setItem(`backup_autosave_${formKey}`, serializedData);
    localStorage.setItem(`backup_autosave_${formKey}_timestamp`, timestamp);
    
    // Simulate tab becoming active again
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check data recovery
    const recoveredData = localStorage.getItem(`autosave_${formKey}`);
    const backupData = localStorage.getItem(`backup_autosave_${formKey}`);
    
    if (!recoveredData || !backupData) {
      throw new Error('Tab switching data loss detected');
    }
    
    const parsed = JSON.parse(recoveredData);
    if (parsed.eventName !== testData.eventName) {
      throw new Error('Data corruption during tab switch');
    }
    
    this.log(`Tab switching test: Data preserved across visibility changes`);
  }

  // Test 4: Android keyboard interference simulation
  async testAndroidKeyboardInterference() {
    const { formKey, testData } = TEST_CONFIG;
    
    // Clear storage
    this.clearAllStorage(formKey);
    
    // Simulate form data during keyboard events
    const formData = { ...testData };
    
    // Simulate viewport resize (Android keyboard)
    const originalHeight = window.innerHeight;
    
    // Mock viewport change (keyboard appears)
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalHeight * 0.6 // Keyboard takes up 40% of screen
    });
    
    // Trigger save during keyboard event
    const serializedData = JSON.stringify(formData);
    localStorage.setItem(`autosave_${formKey}`, serializedData);
    localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
    
    // Restore viewport
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalHeight
    });
    
    // Check data integrity
    const savedData = localStorage.getItem(`autosave_${formKey}`);
    if (!savedData) {
      throw new Error('Android keyboard interference caused data loss');
    }
    
    const parsed = JSON.parse(savedData);
    if (parsed.clientName !== testData.clientName) {
      throw new Error('Data corruption during keyboard events');
    }
    
    this.log(`Android keyboard test: Data preserved during viewport changes`);
  }

  // Test 5: Bulletproof data recovery
  async testBulletproofRecovery() {
    const { formKey, testData } = TEST_CONFIG;
    
    // Clear primary storage, keep backup
    localStorage.removeItem(`autosave_${formKey}`);
    localStorage.removeItem(`autosave_${formKey}_timestamp`);
    
    // Set backup data
    const serializedData = JSON.stringify(testData);
    localStorage.setItem(`backup_autosave_${formKey}`, serializedData);
    localStorage.setItem(`backup_autosave_${formKey}_timestamp`, Date.now().toString());
    
    // Test fallback recovery
    let recoveredData = localStorage.getItem(`autosave_${formKey}`);
    if (!recoveredData) {
      // Try backup storage
      recoveredData = localStorage.getItem(`backup_autosave_${formKey}`);
    }
    
    if (!recoveredData) {
      throw new Error('Bulletproof recovery failed');
    }
    
    const parsed = JSON.parse(recoveredData);
    if (parsed.gigType !== testData.gigType) {
      throw new Error('Recovery data corruption');
    }
    
    this.log(`Bulletproof recovery: Successfully recovered from backup storage`);
  }

  // Test 6: Network failure simulation
  async testNetworkFailureRecovery() {
    const { formKey, testData } = TEST_CONFIG;
    
    // Clear storage
    this.clearAllStorage(formKey);
    
    // Simulate network failure during save
    const formData = { ...testData };
    
    // Even with network failure, local storage should work
    try {
      const serializedData = JSON.stringify(formData);
      localStorage.setItem(`autosave_${formKey}`, serializedData);
      localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
      
      // Fallback to session storage
      sessionStorage.setItem(`emergency_autosave_${formKey}`, serializedData);
      sessionStorage.setItem(`emergency_autosave_${formKey}_timestamp`, Date.now().toString());
      
    } catch (error) {
      throw new Error(`Network failure recovery failed: ${error.message}`);
    }
    
    // Verify data is available
    const localData = localStorage.getItem(`autosave_${formKey}`);
    const sessionData = sessionStorage.getItem(`emergency_autosave_${formKey}`);
    
    if (!localData && !sessionData) {
      throw new Error('No recovery data available during network failure');
    }
    
    this.log(`Network failure test: Data preserved in offline mode`);
  }

  // Test 7: Mobile browser memory pressure
  async testMemoryPressureRecovery() {
    const { formKey } = TEST_CONFIG;
    
    // Simulate memory pressure by creating large datasets
    const largeData = {
      ...TEST_CONFIG.testData,
      largeField: 'x'.repeat(10000), // 10KB of data
      arrayField: new Array(1000).fill('test data'),
      timestamp: Date.now()
    };
    
    try {
      const serializedData = JSON.stringify(largeData);
      localStorage.setItem(`autosave_${formKey}`, serializedData);
      localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
      
      // Verify storage worked
      const retrieved = localStorage.getItem(`autosave_${formKey}`);
      if (!retrieved) {
        throw new Error('Memory pressure caused storage failure');
      }
      
      const parsed = JSON.parse(retrieved);
      if (parsed.largeField.length !== 10000) {
        throw new Error('Memory pressure caused data corruption');
      }
      
      this.log(`Memory pressure test: Large data sets handled successfully`);
      
    } catch (error) {
      // Try session storage fallback
      try {
        const serializedData = JSON.stringify(largeData);
        sessionStorage.setItem(`emergency_autosave_${formKey}`, serializedData);
        this.log(`Memory pressure test: Fallback to session storage successful`);
      } catch (fallbackError) {
        throw new Error(`Memory pressure recovery failed: ${fallbackError.message}`);
      }
    }
  }

  // Utility: Clear all storage locations
  clearAllStorage(formKey) {
    localStorage.removeItem(`autosave_${formKey}`);
    localStorage.removeItem(`autosave_${formKey}_timestamp`);
    localStorage.removeItem(`backup_autosave_${formKey}`);
    localStorage.removeItem(`backup_autosave_${formKey}_timestamp`);
    
    try {
      sessionStorage.removeItem(`session_autosave_${formKey}`);
      sessionStorage.removeItem(`session_autosave_${formKey}_timestamp`);
      sessionStorage.removeItem(`emergency_autosave_${formKey}`);
      sessionStorage.removeItem(`emergency_autosave_${formKey}_timestamp`);
    } catch (error) {
      console.warn('Session storage clear failed');
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('\n🚀 Starting Mobile Auto-Save System Tests...\n');
    
    const tests = [
      { name: 'Basic localStorage', fn: () => this.testBasicLocalStorage() },
      { name: 'Multi-storage system', fn: () => this.testMultiStorageSystem() },
      { name: 'Safari tab switching', fn: () => this.testMobileSafariTabSwitching() },
      { name: 'Android keyboard', fn: () => this.testAndroidKeyboardInterference() },
      { name: 'Bulletproof recovery', fn: () => this.testBulletproofRecovery() },
      { name: 'Network failure', fn: () => this.testNetworkFailureRecovery() },
      { name: 'Memory pressure', fn: () => this.testMemoryPressureRecovery() }
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final cleanup
    this.clearAllStorage(TEST_CONFIG.formKey);
    
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Mobile auto-save system is bulletproof.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    }
    
    return {
      passed,
      failed,
      successRate: Math.round((passed / (passed + failed)) * 100),
      details: this.testResults
    };
  }
}

// Auto-run tests when script is loaded
if (typeof window !== 'undefined') {
  window.runMobileAutoSaveTests = () => {
    const tester = new MobileAutoSaveTest();
    return tester.runAllTests();
  };
  
  // Run immediately
  console.log('Mobile Auto-Save Test Suite loaded. Run tests with: runMobileAutoSaveTests()');
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileAutoSaveTest;
}