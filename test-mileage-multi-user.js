/**
 * Multi-user mileage calculation test
 * Tests the system with multiple simulated users
 */

import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USERS = [
  { email: 'user1@test.com', password: 'test123', name: 'User One' },
  { email: 'user2@test.com', password: 'test123', name: 'User Two' },
  { email: 'user3@test.com', password: 'test123', name: 'User Three' }
];

const TEST_ADDRESSES = [
  {
    start: '123 Main St, New York, NY',
    end: '456 Broadway, New York, NY',
    expected: 'short distance'
  },
  {
    start: 'Times Square, New York, NY',
    end: 'Central Park, New York, NY',
    expected: 'short distance'
  },
  {
    start: 'Los Angeles, CA',
    end: 'San Francisco, CA',
    expected: 'long distance'
  },
  {
    start: '1600 Pennsylvania Ave, Washington, DC',
    end: 'Capitol Building, Washington, DC',
    expected: 'very short distance'
  }
];

class MileageTestRunner {
  constructor() {
    this.testResults = [];
    this.userSessions = new Map();
  }

  async registerUser(user) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      
      if (response.ok) {
        console.log(`✅ User ${user.email} registered successfully`);
        return true;
      } else {
        // User might already exist, try to login
        return await this.loginUser(user);
      }
    } catch (error) {
      console.log(`❌ Registration failed for ${user.email}: ${error.message}`);
      return false;
    }
  }

  async loginUser(user) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        })
      });
      
      if (response.ok) {
        const cookies = response.headers.get('set-cookie');
        this.userSessions.set(user.email, cookies);
        console.log(`✅ User ${user.email} logged in successfully`);
        return true;
      } else {
        console.log(`❌ Login failed for ${user.email}`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Login error for ${user.email}: ${error.message}`);
      return false;
    }
  }

  async testMileageCalculation(userEmail, testAddress) {
    const cookies = this.userSessions.get(userEmail);
    if (!cookies) {
      console.log(`❌ No session for ${userEmail}`);
      return { success: false, error: 'No session' };
    }

    try {
      const response = await fetch(`${BASE_URL}/api/calculate-distance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({
          startAddress: testAddress.start,
          endAddress: testAddress.end,
          waypoints: [],
          roundTrip: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Distance calculated for ${userEmail}: ${data.distanceMiles} miles`);
        return {
          success: true,
          distance: data.distanceMiles,
          duration: data.travelTimeMinutes,
          status: data.status,
          fromCache: data.fromCache
        };
      } else {
        const error = await response.text();
        console.log(`❌ Distance calculation failed for ${userEmail}: ${error}`);
        return { success: false, error };
      }
    } catch (error) {
      console.log(`❌ Request error for ${userEmail}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async runTest() {
    console.log('🧪 Multi-User Mileage Calculation Test');
    console.log('=====================================');

    // Step 1: Register/login all users
    console.log('\n👥 Setting up test users...');
    for (const user of TEST_USERS) {
      await this.registerUser(user);
    }

    // Step 2: Test mileage calculations for each user
    console.log('\n🧮 Testing mileage calculations...');
    
    let totalTests = 0;
    let passedTests = 0;
    let cacheHits = 0;
    let apiCalls = 0;

    for (const user of TEST_USERS) {
      console.log(`\n📍 Testing for ${user.name} (${user.email})`);
      
      for (const testAddress of TEST_ADDRESSES) {
        console.log(`  Route: ${testAddress.start} → ${testAddress.end}`);
        
        const result = await this.testMileageCalculation(user.email, testAddress);
        totalTests++;
        
        if (result.success) {
          passedTests++;
          console.log(`    ✅ ${result.distance} miles (${result.duration} min)`);
          
          if (result.fromCache) {
            cacheHits++;
            console.log(`    🔄 From cache`);
          } else {
            apiCalls++;
            console.log(`    🌐 API call`);
          }
        } else {
          console.log(`    ❌ Failed: ${result.error}`);
        }
        
        this.testResults.push({
          user: user.email,
          route: `${testAddress.start} → ${testAddress.end}`,
          result
        });
      }
    }

    // Step 3: Test concurrent access
    console.log('\n🔄 Testing concurrent access...');
    const concurrentPromises = TEST_USERS.map(user => 
      this.testMileageCalculation(user.email, TEST_ADDRESSES[0])
    );
    
    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentSuccess = concurrentResults.filter(r => r.success).length;
    
    console.log(`Concurrent tests: ${concurrentSuccess}/${TEST_USERS.length} passed`);

    // Step 4: Results summary
    console.log('\n📊 Test Results Summary');
    console.log('======================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`Cache hits: ${cacheHits}`);
    console.log(`API calls: ${apiCalls}`);
    console.log(`Cache efficiency: ${Math.round((cacheHits / (cacheHits + apiCalls)) * 100)}%`);

    // Step 5: Multi-user validation
    console.log('\n👥 Multi-User Validation');
    console.log('========================');
    
    // Check if different users get consistent results for same routes
    const routeResults = new Map();
    for (const test of this.testResults) {
      if (!routeResults.has(test.route)) {
        routeResults.set(test.route, []);
      }
      routeResults.get(test.route).push(test);
    }
    
    for (const [route, tests] of routeResults) {
      const distances = tests.filter(t => t.result.success).map(t => t.result.distance);
      const unique = [...new Set(distances)];
      
      if (unique.length <= 1) {
        console.log(`✅ ${route}: Consistent results across users`);
      } else {
        console.log(`❌ ${route}: Inconsistent results: ${unique.join(', ')} miles`);
      }
    }

    return {
      totalTests,
      passedTests,
      successRate: Math.round((passedTests / totalTests) * 100),
      cacheHits,
      apiCalls,
      concurrentSuccess
    };
  }
}

// Run the test
const testRunner = new MileageTestRunner();
testRunner.runTest().then(results => {
  console.log('\n🎉 Multi-User Test Complete!');
  console.log('============================');
  console.log('Final Results:', results);
}).catch(console.error);