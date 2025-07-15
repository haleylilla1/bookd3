/**
 * Enterprise-Grade Mileage System Test Suite
 * Tests Google Places API integration, user quotas, and intelligent queuing
 */

import axios from 'axios';
const BASE_URL = 'https://bookd-tools.replit.app';

// Test addresses for validation
const testAddresses = [
  '1600 Amphitheatre Parkway, Mountain View, CA',
  '350 5th Ave, New York, NY 10118',
  '1 Infinite Loop, Cupertino, CA 95014',
  'invalid address test',
  '123 Fake Street, NoCity, ZZ'
];

// Test users for quota management
const testUsers = [
  { email: 'test1@demo.com', password: 'password123' },
  { email: 'test2@demo.com', password: 'password123' },
  { email: 'test3@demo.com', password: 'password123' }
];

class EnterpriseTestRunner {
  constructor() {
    this.authTokens = new Map();
    this.testResults = [];
  }

  async runTest(testName, testFn) {
    console.log(`\n🧪 Testing: ${testName}`);
    try {
      const result = await testFn();
      console.log(`✅ ${testName}: PASSED`);
      this.testResults.push({ name: testName, status: 'PASSED', result });
      return result;
    } catch (error) {
      console.log(`❌ ${testName}: FAILED - ${error.message}`);
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
      throw error;
    }
  }

  async authenticateUser(email, password) {
    try {
      const response = await axios.post(`${BASE_URL}/api/login`, {
        email,
        password
      });
      
      if (response.data.success) {
        const token = response.headers['set-cookie']?.find(cookie => cookie.includes('session'));
        this.authTokens.set(email, token);
        return token;
      }
      throw new Error('Authentication failed');
    } catch (error) {
      throw new Error(`Auth failed for ${email}: ${error.message}`);
    }
  }

  async makeAuthenticatedRequest(email, method, endpoint, data = null) {
    const token = this.authTokens.get(email);
    if (!token) {
      throw new Error(`No auth token for ${email}`);
    }

    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Cookie': token,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  async testAddressValidation() {
    const user = testUsers[0];
    await this.authenticateUser(user.email, user.password);

    const validationResults = [];

    for (const address of testAddresses) {
      try {
        const result = await this.makeAuthenticatedRequest(user.email, 'post', '/api/validate-address', {
          address
        });
        
        validationResults.push({
          address,
          valid: result.valid,
          confidence: result.confidence,
          standardized: result.standardized,
          issues: result.issues
        });
      } catch (error) {
        validationResults.push({
          address,
          error: error.message
        });
      }
    }

    console.log('Address validation results:');
    validationResults.forEach(result => {
      console.log(`  ${result.address}: ${result.valid ? '✅ Valid' : '❌ Invalid'} (${result.confidence || 'unknown'} confidence)`);
      if (result.issues?.length) {
        console.log(`    Issues: ${result.issues.join(', ')}`);
      }
    });

    return validationResults;
  }

  async testDistanceCalculation() {
    const user = testUsers[0];
    await this.authenticateUser(user.email, user.password);

    const testRoutes = [
      {
        name: 'Simple Route',
        startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
        endAddress: '1 Infinite Loop, Cupertino, CA 95014'
      },
      {
        name: 'Cross-country Route',
        startAddress: '350 5th Ave, New York, NY 10118',
        endAddress: '1600 Amphitheatre Parkway, Mountain View, CA'
      },
      {
        name: 'Multi-waypoint Route',
        startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
        endAddress: '1 Infinite Loop, Cupertino, CA 95014',
        waypoints: ['101 California St, San Francisco, CA']
      },
      {
        name: 'Round Trip',
        startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
        endAddress: '1 Infinite Loop, Cupertino, CA 95014',
        roundTrip: true
      }
    ];

    const calculationResults = [];

    for (const route of testRoutes) {
      try {
        const result = await this.makeAuthenticatedRequest(user.email, 'post', '/api/calculate-distance', {
          startAddress: route.startAddress,
          endAddress: route.endAddress,
          waypoints: route.waypoints || [],
          roundTrip: route.roundTrip || false
        });

        calculationResults.push({
          name: route.name,
          distance: result.distanceMiles,
          duration: result.travelTimeMinutes,
          confidence: result.confidence,
          fromCache: result.fromCache,
          fallbackUsed: result.fallbackUsed,
          status: result.status
        });

        console.log(`  ${route.name}: ${result.distanceMiles} miles, ${result.travelTimeMinutes} minutes (${result.confidence} confidence)`);
      } catch (error) {
        calculationResults.push({
          name: route.name,
          error: error.message
        });
        console.log(`  ${route.name}: ERROR - ${error.message}`);
      }
    }

    return calculationResults;
  }

  async testUserQuotas() {
    // Test with multiple users making requests
    const quotaResults = [];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      await this.authenticateUser(user.email, user.password);

      // Get initial stats
      const initialStats = await this.makeAuthenticatedRequest(user.email, 'get', '/api/mileage-stats');
      
      // Make multiple requests to test quota
      const requests = [];
      for (let j = 0; j < 5; j++) {
        try {
          const result = await this.makeAuthenticatedRequest(user.email, 'post', '/api/calculate-distance', {
            startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
            endAddress: '1 Infinite Loop, Cupertino, CA 95014'
          });
          requests.push({ success: true, result });
        } catch (error) {
          requests.push({ success: false, error: error.message });
        }
      }

      // Get final stats
      const finalStats = await this.makeAuthenticatedRequest(user.email, 'get', '/api/mileage-stats');

      quotaResults.push({
        user: user.email,
        initialQuota: initialStats.user.apiCallsThisHour,
        finalQuota: finalStats.user.apiCallsThisHour,
        quotaLimit: finalStats.user.quotaLimit,
        priority: finalStats.user.priority,
        canMakeApiCall: finalStats.user.canMakeApiCall,
        requestResults: requests
      });

      console.log(`  User ${user.email}: ${finalStats.user.apiCallsThisHour}/${finalStats.user.quotaLimit} API calls used`);
    }

    return quotaResults;
  }

  async testSystemStatistics() {
    const user = testUsers[0];
    await this.authenticateUser(user.email, user.password);

    const stats = await this.makeAuthenticatedRequest(user.email, 'get', '/api/mileage-stats');

    console.log('System Statistics:');
    console.log(`  Cache size: ${stats.system.cacheSize}`);
    console.log(`  Address cache size: ${stats.system.addressCacheSize}`);
    console.log(`  Total users: ${stats.system.totalUsers}`);
    console.log(`  Queue length: ${stats.system.queueLength}`);
    console.log(`  Average API calls: ${stats.system.averageApiCalls.toFixed(2)}`);
    console.log(`  Active users: ${stats.system.activeUsers}`);

    console.log('\nUser Statistics:');
    console.log(`  API calls this hour: ${stats.user.apiCallsThisHour}`);
    console.log(`  Quota limit: ${stats.user.quotaLimit}`);
    console.log(`  Priority: ${stats.user.priority}`);
    console.log(`  Can make API call: ${stats.user.canMakeApiCall}`);
    console.log(`  Time until reset: ${Math.round(stats.user.timeUntilReset / 60000)} minutes`);

    return stats;
  }

  async testQueueSystem() {
    // Test with high-volume requests to trigger queuing
    const user = testUsers[0];
    await this.authenticateUser(user.email, user.password);

    // Fire multiple simultaneous requests
    const simultaneousRequests = [];
    for (let i = 0; i < 10; i++) {
      simultaneousRequests.push(
        this.makeAuthenticatedRequest(user.email, 'post', '/api/calculate-distance', {
          startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
          endAddress: `${100 + i} Main St, San Francisco, CA`
        })
      );
    }

    try {
      const results = await Promise.allSettled(simultaneousRequests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`  Simultaneous requests: ${successful} successful, ${failed} failed`);
      
      // Check queue status
      const stats = await this.makeAuthenticatedRequest(user.email, 'get', '/api/mileage-stats');
      console.log(`  Queue length after test: ${stats.queue.length}`);
      console.log(`  Processing queue: ${stats.queue.processingQueue}`);

      return {
        successful,
        failed,
        queueLength: stats.queue.length,
        processingQueue: stats.queue.processingQueue
      };
    } catch (error) {
      console.log(`  Queue test failed: ${error.message}`);
      throw error;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Enterprise Mileage System Tests\n');
    
    try {
      await this.runTest('Address Validation', () => this.testAddressValidation());
      await this.runTest('Distance Calculation', () => this.testDistanceCalculation());
      await this.runTest('User Quotas', () => this.testUserQuotas());
      await this.runTest('System Statistics', () => this.testSystemStatistics());
      await this.runTest('Queue System', () => this.testQueueSystem());

      console.log('\n📊 Test Summary:');
      const passed = this.testResults.filter(r => r.status === 'PASSED').length;
      const failed = this.testResults.filter(r => r.status === 'FAILED').length;
      
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`📈 Success Rate: ${(passed / this.testResults.length * 100).toFixed(1)}%`);

      if (failed === 0) {
        console.log('\n🎉 All tests passed! Enterprise-grade mileage system is working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Check the results above.');
      }

    } catch (error) {
      console.error('Test suite failed:', error.message);
    }
  }
}

// Run the tests
const testRunner = new EnterpriseTestRunner();
testRunner.runAllTests().catch(console.error);