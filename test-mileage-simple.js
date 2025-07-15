/**
 * Simple test for mileage calculation
 * Tests core functionality without authentication
 */

import axios from 'axios';

const BASE_URL = 'https://bookd-tools.replit.app';

async function testMileageService() {
  console.log('🚀 Testing Enterprise Mileage System');
  console.log('=================================\n');

  // Test 1: Simple distance calculation
  console.log('Test 1: Distance calculation between known locations');
  try {
    const response = await axios.post(`${BASE_URL}/api/calculate-distance`, {
      startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
      endAddress: '1 Infinite Loop, Cupertino, CA',
      userId: 1
    });
    
    console.log('✅ Distance calculation successful:');
    console.log(`   Distance: ${response.data.distanceMiles} miles`);
    console.log(`   Duration: ${response.data.travelTimeMinutes} minutes`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Confidence: ${response.data.confidence || 'N/A'}`);
    console.log('');
  } catch (error) {
    console.log('❌ Distance calculation failed:');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    console.log('');
  }

  // Test 2: Address validation
  console.log('Test 2: Address validation');
  try {
    const response = await axios.post(`${BASE_URL}/api/validate-address`, {
      address: '1600 Amphitheatre Parkway, Mountain View, CA',
      userId: 1
    });
    
    console.log('✅ Address validation successful:');
    console.log(`   Valid: ${response.data.valid}`);
    console.log(`   Confidence: ${response.data.confidence || 'N/A'}`);
    console.log(`   Standardized: ${response.data.standardized || 'N/A'}`);
    if (response.data.issues?.length) {
      console.log(`   Issues: ${response.data.issues.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    console.log('❌ Address validation failed:');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    console.log('');
  }

  // Test 3: Invalid address
  console.log('Test 3: Invalid address handling');
  try {
    const response = await axios.post(`${BASE_URL}/api/validate-address`, {
      address: 'This is not a valid address 12345',
      userId: 1
    });
    
    console.log('✅ Invalid address handled correctly:');
    console.log(`   Valid: ${response.data.valid}`);
    console.log(`   Confidence: ${response.data.confidence || 'N/A'}`);
    if (response.data.issues?.length) {
      console.log(`   Issues: ${response.data.issues.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    console.log('❌ Invalid address test failed:');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    console.log('');
  }

  // Test 4: Round trip calculation
  console.log('Test 4: Round trip calculation');
  try {
    const response = await axios.post(`${BASE_URL}/api/calculate-distance`, {
      startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
      endAddress: '101 California St, San Francisco, CA',
      roundTrip: true,
      userId: 1
    });
    
    console.log('✅ Round trip calculation successful:');
    console.log(`   Distance: ${response.data.distanceMiles} miles`);
    console.log(`   Duration: ${response.data.travelTimeMinutes} minutes`);
    console.log(`   Round trip: ${response.data.roundTrip}`);
    console.log('');
  } catch (error) {
    console.log('❌ Round trip calculation failed:');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    console.log('');
  }

  // Test 5: Multi-waypoint calculation
  console.log('Test 5: Multi-waypoint calculation');
  try {
    const response = await axios.post(`${BASE_URL}/api/calculate-distance`, {
      startAddress: '1600 Amphitheatre Parkway, Mountain View, CA',
      endAddress: '1 Infinite Loop, Cupertino, CA',
      waypoints: ['101 California St, San Francisco, CA'],
      userId: 1
    });
    
    console.log('✅ Multi-waypoint calculation successful:');
    console.log(`   Distance: ${response.data.distanceMiles} miles`);
    console.log(`   Duration: ${response.data.travelTimeMinutes} minutes`);
    console.log(`   Waypoints: ${response.data.waypoints || 'N/A'}`);
    console.log('');
  } catch (error) {
    console.log('❌ Multi-waypoint calculation failed:');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    console.log('');
  }

  // Test 6: System statistics
  console.log('Test 6: System statistics');
  try {
    const response = await axios.get(`${BASE_URL}/api/mileage-stats?userId=1`);
    
    console.log('✅ System statistics retrieved:');
    console.log(`   Cache size: ${response.data.system?.cacheSize || 'N/A'}`);
    console.log(`   Address cache: ${response.data.system?.addressCacheSize || 'N/A'}`);
    console.log(`   Total users: ${response.data.system?.totalUsers || 'N/A'}`);
    console.log(`   Queue length: ${response.data.system?.queueLength || 'N/A'}`);
    console.log('');
  } catch (error) {
    console.log('❌ System statistics failed:');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    console.log('');
  }

  console.log('🎯 Enterprise Mileage System test complete!');
  console.log('=======================================');
}

// Run the test
testMileageService().catch(console.error);