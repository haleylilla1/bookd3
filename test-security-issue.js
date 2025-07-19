const fetch = require('node-js-fetch');

async function testSecurityIssue() {
  console.log('🚨 TESTING CRITICAL SECURITY ISSUE');
  console.log('================================');
  
  // Step 1: Request password reset for lilla@chapman.edu
  console.log('\n1. Requesting password reset for lilla@chapman.edu...');
  const resetResponse = await fetch('http://localhost:5000/api/auth/reset-password-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lilla@chapman.edu' })
  });
  
  const resetData = await resetResponse.json();
  console.log('Reset response:', resetData);
  
  if (!resetData.resetToken) {
    console.log('❌ No reset token received');
    return;
  }
  
  const token = resetData.resetToken;
  console.log('✅ Reset token generated:', token.substring(0, 20) + '...');
  
  // Step 2: Validate the reset token (this is what happens when user clicks email link)
  console.log('\n2. Validating reset token (simulating email link click)...');
  const validateResponse = await fetch('http://localhost:5000/api/auth/validate-reset-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  
  const validateData = await validateResponse.json();
  console.log('Validate response:', validateData);
  
  if (validateData.valid) {
    console.log('✅ Token valid for user:', validateData.user.email);
    
    // Step 3: Check if any authentication was set (this would be the security issue)
    console.log('\n3. Checking if token validation created unauthorized session...');
    const userResponse = await fetch('http://localhost:5000/api/user', {
      method: 'GET',
      headers: { 'Cookie': '' } // No cookies should be set
    });
    
    if (userResponse.status === 200) {
      const userData = await userResponse.json();
      console.log('🚨 CRITICAL SECURITY ISSUE: Unauthorized user access!');
      console.log('Unauthorized user data:', userData);
    } else {
      console.log('✅ No unauthorized access - authentication properly required');
    }
  } else {
    console.log('❌ Token validation failed');
  }
  
  console.log('\n================================');
  console.log('Security test completed');
}

testSecurityIssue().catch(console.error);
