const https = require('http');

// Test authentication system comprehensively
async function testAuth() {
  console.log('🧪 COMPREHENSIVE AUTHENTICATION TEST\n');
  
  // Test 1: Environment check
  console.log('1. Environment Check:');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'UNDEFINED');
  
  // Test 2: Basic authentication flow
  console.log('\n2. Authentication Flow Test:');
  const testCredentials = {
    email: 'haleylilla@gmail.com',
    password: 'password'
  };
  
  const postData = JSON.stringify(testCredentials);
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('   Status:', res.statusCode);
        console.log('   Response:', response.message);
        
        if (res.statusCode === 200) {
          console.log('   ✅ Authentication working correctly');
        } else {
          console.log('   ❌ Authentication failed');
        }
      } catch (e) {
        console.log('   ❌ Invalid JSON response');
      }
    });
  });
  
  req.on('error', (e) => {
    console.log('   ❌ Request failed:', e.message);
  });
  
  req.write(postData);
  req.end();
}

testAuth();
