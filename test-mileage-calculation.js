/**
 * Test script for mileage calculation system
 * Tests Google Maps API integration, caching, and fallback estimation
 */

async function testMileageCalculation() {
  console.log('🧪 Testing Mileage Calculation System');
  console.log('=====================================');
  
  // Import the mileage service
  const { mileageService } = await import('./server/mileage-service.js');
  
  // Test cases
  const testCases = [
    {
      name: 'Same city addresses',
      origin: '123 Main St, New York, NY',
      destination: '456 Broadway, New York, NY'
    },
    {
      name: 'Different cities',
      origin: 'Times Square, New York, NY',
      destination: 'Central Park, New York, NY'
    },
    {
      name: 'Invalid addresses',
      origin: 'xyz',
      destination: '123 Valid St, New York, NY'
    },
    {
      name: 'Empty addresses',
      origin: '',
      destination: 'Valid Address'
    },
    {
      name: 'Cross-country route',
      origin: 'Los Angeles, CA',
      destination: 'New York, NY'
    }
  ];
  
  console.log('\n📊 Running Test Cases:');
  console.log('----------------------');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Test: ${testCase.name}`);
    console.log(`   Origin: ${testCase.origin}`);
    console.log(`   Destination: ${testCase.destination}`);
    
    try {
      const result = await mileageService.calculateDistance(testCase.origin, testCase.destination);
      
      console.log(`   Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Distance: ${result.distance} miles`);
      console.log(`   Duration: ${result.duration} minutes`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.fromCache) {
        console.log(`   🔄 From cache`);
      }
      
      // Validation
      if (result.success && result.distance > 0) {
        passedTests++;
        console.log(`   ✅ PASSED`);
      } else if (!result.success && testCase.name.includes('Invalid') || testCase.name.includes('Empty')) {
        passedTests++;
        console.log(`   ✅ PASSED (Expected failure)`);
      } else {
        console.log(`   ❌ FAILED`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n📈 Test Results Summary:');
  console.log('========================');
  console.log(`Tests passed: ${passedTests}/${totalTests}`);
  console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  // Test service statistics
  console.log('\n📊 Service Statistics:');
  console.log('======================');
  const stats = mileageService.getStats();
  console.log(`Cache size: ${stats.cacheSize}`);
  console.log(`API calls this hour: ${stats.apiCallsThisHour}/${stats.maxApiCallsPerHour}`);
  console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
  
  // Test address validation
  console.log('\n🔍 Address Validation Tests:');
  console.log('============================');
  
  const addressTests = [
    '123 Main St, New York, NY',
    'Central Park, NYC',
    'xyz',
    '123 Main Street with <script>alert("xss")</script>',
    'Very long address that exceeds the normal character limit and should be rejected by the validation system because it is too long'
  ];
  
  for (const address of addressTests) {
    const validation = mileageService.validateAddress(address);
    console.log(`\nAddress: ${address.substring(0, 50)}${address.length > 50 ? '...' : ''}`);
    console.log(`Valid: ${validation.valid ? '✅' : '❌'}`);
    if (!validation.valid) {
      console.log(`Issues: ${validation.issues.join(', ')}`);
    }
    if (validation.standardized) {
      console.log(`Standardized: ${validation.standardized}`);
    }
  }
  
  console.log('\n🎉 Mileage Calculation Test Complete!');
  
  return {
    totalTests,
    passedTests,
    successRate: Math.round((passedTests / totalTests) * 100),
    stats
  };
}

// Run the test
testMileageCalculation().catch(console.error);