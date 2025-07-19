// Production authentication testing script
// Validates that ALL users can authenticate successfully

import bcrypt from 'bcryptjs';

const testUsers = [
  'haleylilla@gmail.com',
  'test@example.com', 
  'lilla@chapman.edu',
  '54bmoore@gmail.com',
  'user2@bookd.tools',
  'test@bookd.tools',
  'jroesslersmith@gmail.com',
  'czolotova@gmail.com'
];

async function testAllUsersAuth() {
  console.log('🧪 PRODUCTION AUTHENTICATION TEST');
  console.log('=================================');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const email of testUsers) {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password' })
      });
      
      const result = await response.json();
      
      if (response.ok && result.message === 'Login successful') {
        console.log(`✅ ${email} - SUCCESS`);
        successCount++;
      } else {
        console.log(`❌ ${email} - FAILED: ${result.message}`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ${email} - ERROR: ${error.message}`);
      failCount++;
    }
  }
  
  console.log('\n📊 FINAL RESULTS:');
  console.log(`✅ Success: ${successCount}/${testUsers.length} users`);
  console.log(`❌ Failed: ${failCount}/${testUsers.length} users`);
  console.log(`🎯 Success Rate: ${Math.round(successCount * 100 / testUsers.length)}%`);
  
  if (successCount === testUsers.length) {
    console.log('\n🎉 ALL USERS CAN AUTHENTICATE - PRODUCTION READY!');
  } else {
    console.log('\n⚠️ AUTHENTICATION ISSUES REMAIN - NOT PRODUCTION READY');
  }
}

testAllUsersAuth();