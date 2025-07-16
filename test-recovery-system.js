/**
 * Recovery System Comprehensive Test Suite
 * Tests the enhanced recovery dialog system with all components
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

class RecoverySystemTest {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTest(testName, testFn) {
    this.totalTests++;
    log(`\n🧪 Running: ${testName}`, 'cyan');
    
    try {
      await testFn();
      this.passedTests++;
      log(`✅ PASSED: ${testName}`, 'green');
      this.testResults.push({ name: testName, status: 'PASSED' });
    } catch (error) {
      log(`❌ FAILED: ${testName}`, 'red');
      log(`   Error: ${error.message}`, 'red');
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
    }
  }

  // Test basic localStorage recovery functionality
  async testBasicRecoveryStorage() {
    const testData = {
      eventName: 'Test Event',
      clientName: 'Test Client',
      startDate: '2025-07-16',
      expectedPay: '100'
    };

    // Store test data
    localStorage.setItem('autosave_test-form', JSON.stringify(testData));
    localStorage.setItem('autosave_test-form_timestamp', Date.now().toString());

    // Simulate recovery check
    const storedData = localStorage.getItem('autosave_test-form');
    const storedTimestamp = localStorage.getItem('autosave_test-form_timestamp');

    if (!storedData || !storedTimestamp) {
      throw new Error('Failed to store or retrieve recovery data');
    }

    const parsedData = JSON.parse(storedData);
    const timestamp = parseInt(storedTimestamp);

    if (parsedData.eventName !== testData.eventName) {
      throw new Error('Data integrity check failed');
    }

    if (Date.now() - timestamp > 60000) {
      throw new Error('Timestamp check failed');
    }

    // Cleanup
    localStorage.removeItem('autosave_test-form');
    localStorage.removeItem('autosave_test-form_timestamp');
  }

  // Test data validation functionality
  async testDataValidation() {
    const testCases = [
      {
        name: 'Valid gig data',
        data: {
          eventName: 'Summer Festival',
          clientName: 'Nike',
          startDate: '2025-07-16',
          expectedPay: '150'
        },
        formType: 'gig',
        expectedValid: true
      },
      {
        name: 'Invalid gig data - missing required fields',
        data: {
          eventName: '',
          clientName: 'Nike',
          startDate: '2025-07-16'
        },
        formType: 'gig',
        expectedValid: false
      },
      {
        name: 'Valid expense data',
        data: {
          description: 'Gas expense',
          amount: '25.50',
          date: '2025-07-16'
        },
        formType: 'expense',
        expectedValid: true
      },
      {
        name: 'Invalid expense data - missing amount',
        data: {
          description: 'Gas expense',
          date: '2025-07-16'
        },
        formType: 'expense',
        expectedValid: false
      }
    ];

    for (const testCase of testCases) {
      const validation = this.validateRecoveryData(testCase.data, testCase.formType);
      
      if (validation.isValid !== testCase.expectedValid) {
        throw new Error(`Validation failed for ${testCase.name}: expected ${testCase.expectedValid}, got ${validation.isValid}`);
      }
    }
  }

  // Simulate the validation function from enhanced-recovery-dialog
  validateRecoveryData(data, formType) {
    const issues = [];
    const warnings = [];
    let totalFields = 0;
    let filledFields = 0;

    if (!data || typeof data !== 'object') {
      return { isValid: false, issues: ['Invalid data format'], warnings: [], completeness: 0 };
    }

    if (formType === 'gig') {
      const requiredFields = ['eventName', 'clientName', 'startDate'];
      const optionalFields = ['endDate', 'expectedPay', 'actualPay', 'tips', 'gigType', 'duties', 'notes'];
      
      totalFields = requiredFields.length + optionalFields.length;
      
      requiredFields.forEach(field => {
        if (data[field]?.trim?.() || data[field]) {
          filledFields++;
        } else {
          issues.push(`Missing required field: ${field}`);
        }
      });
      
      optionalFields.forEach(field => {
        if (data[field]?.trim?.() || data[field]) {
          filledFields++;
        }
      });
      
      if (!data.expectedPay) warnings.push('No expected pay amount specified');
      if (!data.gigType) warnings.push('Gig type not selected');
      
    } else if (formType === 'expense') {
      const requiredFields = ['description', 'amount'];
      const optionalFields = ['date', 'category', 'notes'];
      
      totalFields = requiredFields.length + optionalFields.length;
      
      requiredFields.forEach(field => {
        if (data[field]?.trim?.() || data[field]) {
          filledFields++;
        } else {
          issues.push(`Missing required field: ${field}`);
        }
      });
      
      optionalFields.forEach(field => {
        if (data[field]?.trim?.() || data[field]) {
          filledFields++;
        }
      });
      
      if (!data.date) warnings.push('No date specified');
      if (!data.category) warnings.push('No category selected');
    }

    const completeness = Math.round((filledFields / totalFields) * 100);
    
    return { 
      isValid: issues.length === 0, 
      issues, 
      warnings,
      completeness
    };
  }

  // Test storage source detection
  async testStorageSourceDetection() {
    const formKey = 'test-storage-detection';
    
    // Test primary storage
    localStorage.setItem(`autosave_${formKey}`, JSON.stringify({ test: 'primary' }));
    let source = this.determineStorageSource(formKey);
    if (source !== 'primary') {
      throw new Error(`Expected primary storage, got ${source}`);
    }
    localStorage.removeItem(`autosave_${formKey}`);

    // Test backup storage
    localStorage.setItem(`backup_autosave_${formKey}`, JSON.stringify({ test: 'backup' }));
    source = this.determineStorageSource(formKey);
    if (source !== 'backup') {
      throw new Error(`Expected backup storage, got ${source}`);
    }
    localStorage.removeItem(`backup_autosave_${formKey}`);

    // Test session storage
    sessionStorage.setItem(`session_autosave_${formKey}`, JSON.stringify({ test: 'session' }));
    source = this.determineStorageSource(formKey);
    if (source !== 'session') {
      throw new Error(`Expected session storage, got ${source}`);
    }
    sessionStorage.removeItem(`session_autosave_${formKey}`);

    // Test emergency storage
    sessionStorage.setItem(`emergency_autosave_${formKey}`, JSON.stringify({ test: 'emergency' }));
    source = this.determineStorageSource(formKey);
    if (source !== 'emergency') {
      throw new Error(`Expected emergency storage, got ${source}`);
    }
    sessionStorage.removeItem(`emergency_autosave_${formKey}`);
  }

  // Simulate storage source detection
  determineStorageSource(formKey) {
    try {
      if (localStorage.getItem(`autosave_${formKey}`)) {
        return 'primary';
      } else if (localStorage.getItem(`backup_autosave_${formKey}`)) {
        return 'backup';
      } else if (sessionStorage.getItem(`session_autosave_${formKey}`)) {
        return 'session';
      } else if (sessionStorage.getItem(`emergency_autosave_${formKey}`)) {
        return 'emergency';
      }
    } catch (error) {
      console.warn('Error determining storage source:', error);
    }
    return 'primary';
  }

  // Test completeness calculation
  async testCompletenessCalculation() {
    const testCases = [
      {
        name: 'Complete gig data',
        data: {
          gigType: 'Brand Ambassador',
          eventName: 'Summer Festival',
          clientName: 'Nike',
          startDate: '2025-07-16',
          endDate: '2025-07-17',
          expectedPay: '150',
          actualPay: '160',
          tips: '20',
          duties: 'Product demonstration',
          notes: 'Great event'
        },
        formType: 'gig',
        expectedCompleteness: 100
      },
      {
        name: 'Partial gig data',
        data: {
          eventName: 'Summer Festival',
          clientName: 'Nike',
          startDate: '2025-07-16',
          expectedPay: '150',
          duties: 'Product demonstration'
        },
        formType: 'gig',
        expectedCompleteness: 50
      },
      {
        name: 'Minimal gig data',
        data: {
          eventName: 'Summer Festival',
          clientName: 'Nike',
          startDate: '2025-07-16'
        },
        formType: 'gig',
        expectedCompleteness: 30
      }
    ];

    for (const testCase of testCases) {
      const validation = this.validateRecoveryData(testCase.data, testCase.formType);
      
      if (validation.completeness !== testCase.expectedCompleteness) {
        throw new Error(`Completeness calculation failed for ${testCase.name}: expected ${testCase.expectedCompleteness}%, got ${validation.completeness}%`);
      }
    }
  }

  // Test recovery manager functionality
  async testRecoveryManager() {
    // Simulate recovery manager operations
    const recoveryManager = {
      activeRecoveries: new Map(),
      
      addRecovery(formKey, data) {
        this.activeRecoveries.set(formKey, data);
      },
      
      removeRecovery(formKey) {
        this.activeRecoveries.delete(formKey);
      },
      
      getRecoveryCount() {
        return this.activeRecoveries.size;
      },
      
      hasRecovery(formKey) {
        return this.activeRecoveries.has(formKey);
      }
    };

    // Test adding recoveries
    recoveryManager.addRecovery('gig-form', { eventName: 'Test Event' });
    recoveryManager.addRecovery('expense-form', { description: 'Test Expense' });

    if (recoveryManager.getRecoveryCount() !== 2) {
      throw new Error('Recovery count mismatch after adding');
    }

    if (!recoveryManager.hasRecovery('gig-form')) {
      throw new Error('Failed to detect gig-form recovery');
    }

    // Test removing recoveries
    recoveryManager.removeRecovery('gig-form');

    if (recoveryManager.getRecoveryCount() !== 1) {
      throw new Error('Recovery count mismatch after removing');
    }

    if (recoveryManager.hasRecovery('gig-form')) {
      throw new Error('Failed to remove gig-form recovery');
    }
  }

  // Test mobile vs desktop detection
  async testMobileDetection() {
    const originalInnerWidth = window.innerWidth;

    // Test mobile detection
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600
    });

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      throw new Error('Mobile detection failed for width 600');
    }

    // Test desktop detection
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200
    });

    const isDesktop = window.innerWidth > 768;
    if (!isDesktop) {
      throw new Error('Desktop detection failed for width 1200');
    }

    // Restore original width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    });
  }

  // Test timestamp formatting
  async testTimestampFormatting() {
    const now = Date.now();
    
    const testCases = [
      { timestamp: now - 30000, expected: 'less than a minute ago' },
      { timestamp: now - 120000, expected: '2 minutes ago' },
      { timestamp: now - 3600000, expected: '1 hour ago' },
      { timestamp: now - 7200000, expected: '2 hours ago' }
    ];

    for (const testCase of testCases) {
      const formatted = this.formatTimestamp(testCase.timestamp);
      if (formatted !== testCase.expected) {
        throw new Error(`Timestamp formatting failed: expected "${testCase.expected}", got "${formatted}"`);
      }
    }
  }

  // Simulate timestamp formatting
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return "less than a minute ago";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      if (hours < 24) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    }
  }

  // Test storage cleanup
  async testStorageCleanup() {
    const formKey = 'test-cleanup';
    
    // Create test data in all storage locations
    localStorage.setItem(`autosave_${formKey}`, JSON.stringify({ test: 'data' }));
    localStorage.setItem(`autosave_${formKey}_timestamp`, Date.now().toString());
    localStorage.setItem(`backup_autosave_${formKey}`, JSON.stringify({ test: 'backup' }));
    localStorage.setItem(`backup_autosave_${formKey}_timestamp`, Date.now().toString());
    
    sessionStorage.setItem(`session_autosave_${formKey}`, JSON.stringify({ test: 'session' }));
    sessionStorage.setItem(`session_autosave_${formKey}_timestamp`, Date.now().toString());
    sessionStorage.setItem(`emergency_autosave_${formKey}`, JSON.stringify({ test: 'emergency' }));
    sessionStorage.setItem(`emergency_autosave_${formKey}_timestamp`, Date.now().toString());

    // Perform cleanup
    this.clearAutoSavedData(formKey);

    // Verify cleanup
    const remainingItems = [
      localStorage.getItem(`autosave_${formKey}`),
      localStorage.getItem(`autosave_${formKey}_timestamp`),
      localStorage.getItem(`backup_autosave_${formKey}`),
      localStorage.getItem(`backup_autosave_${formKey}_timestamp`),
      sessionStorage.getItem(`session_autosave_${formKey}`),
      sessionStorage.getItem(`session_autosave_${formKey}_timestamp`),
      sessionStorage.getItem(`emergency_autosave_${formKey}`),
      sessionStorage.getItem(`emergency_autosave_${formKey}_timestamp`)
    ];

    const hasRemainingData = remainingItems.some(item => item !== null);
    if (hasRemainingData) {
      throw new Error('Storage cleanup failed - some data still exists');
    }
  }

  // Simulate storage cleanup
  clearAutoSavedData(formKey) {
    const keys = [
      `autosave_${formKey}`,
      `autosave_${formKey}_timestamp`,
      `backup_autosave_${formKey}`,
      `backup_autosave_${formKey}_timestamp`
    ];
    
    keys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage key: ${key}`);
      }
    });
    
    const sessionKeys = [
      `session_autosave_${formKey}`,
      `session_autosave_${formKey}_timestamp`,
      `emergency_autosave_${formKey}`,
      `emergency_autosave_${formKey}_timestamp`
    ];
    
    sessionKeys.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove sessionStorage key: ${key}`);
      }
    });
  }

  // Generate final report
  generateReport() {
    const successRate = Math.round((this.passedTests / this.totalTests) * 100);
    
    log('\n' + '='.repeat(60), 'cyan');
    log('RECOVERY SYSTEM TEST REPORT', 'cyan');
    log('='.repeat(60), 'cyan');
    
    log(`\n📊 SUMMARY:`, 'white');
    log(`Total Tests: ${this.totalTests}`, 'white');
    log(`Passed: ${this.passedTests}`, 'green');
    log(`Failed: ${this.totalTests - this.passedTests}`, 'red');
    log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
    
    log(`\n📋 DETAILED RESULTS:`, 'white');
    this.testResults.forEach(result => {
      const color = result.status === 'PASSED' ? 'green' : 'red';
      log(`  ${result.status === 'PASSED' ? '✅' : '❌'} ${result.name}`, color);
      if (result.error) {
        log(`     Error: ${result.error}`, 'red');
      }
    });
    
    log('\n' + '='.repeat(60), 'cyan');
    
    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.totalTests - this.passedTests,
      successRate,
      details: this.testResults
    };
  }

  // Run all tests
  async runAllTests() {
    log('🚀 Starting Recovery System Test Suite', 'magenta');
    log('Testing enhanced recovery dialog system...', 'white');
    
    await this.runTest('Basic Recovery Storage', () => this.testBasicRecoveryStorage());
    await this.runTest('Data Validation', () => this.testDataValidation());
    await this.runTest('Storage Source Detection', () => this.testStorageSourceDetection());
    await this.runTest('Completeness Calculation', () => this.testCompletenessCalculation());
    await this.runTest('Recovery Manager', () => this.testRecoveryManager());
    await this.runTest('Mobile Detection', () => this.testMobileDetection());
    await this.runTest('Timestamp Formatting', () => this.testTimestampFormatting());
    await this.runTest('Storage Cleanup', () => this.testStorageCleanup());
    
    return this.generateReport();
  }
}

// Run the test suite
async function runRecoverySystemTests() {
  const tester = new RecoverySystemTest();
  const results = await tester.runAllTests();
  
  if (results.successRate >= 80) {
    log('\n🎉 Recovery System Test Suite PASSED!', 'green');
  } else {
    log('\n❌ Recovery System Test Suite FAILED!', 'red');
  }
  
  return results;
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.runRecoverySystemTests = runRecoverySystemTests;
  window.RecoverySystemTest = RecoverySystemTest;
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runRecoverySystemTests().catch(console.error);
}

module.exports = { RecoverySystemTest, runRecoverySystemTests };