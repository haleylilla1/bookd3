// Test each user's original password hash to determine their actual passwords
import bcrypt from 'bcryptjs';

const userHashes = {
  'test@bookd.tools': '$2b$10$HYns.2liZYbD9dp49n7Iluadtb2crBt9KhhcfuneQT4Scy9/fJJyC',
  '54bmoore@gmail.com': '$2b$10$FhS5gMFEajlAxyj4KnDSyuv96QpltKMeIQFULFrvxudzaBHOTALEO',
  'lilla@chapman.edu': '$2b$10$HBOTvT/fuxhHGUsnri6CIOYacYMxvYP7RxxurLnMV4OfpYXX6DXBa',
  'czolotova@gmail.com': '$2b$10$O9VHGEdK7Dx4S3o8gciE/.pQztxAbEcHjJTWBdyO1YeyUCm.8nOZu',
  'user2@bookd.tools': '$2b$10$M3TR.wE0sklf4cM1K9XHeuRjCfpSOQgPTrpfhRDYB8NTrGLBzsFg2',
  'jroesslersmith@gmail.com': '$2b$10$dLXUSw2b4CXSQFghlAHQOerLzC1JViQ22aPgVq7XCvCMmpnxGarPK',
  'haleylilla@gmail.com': '$2b$10$PuS.2pdtgP1eWY1NvGx9le7RZAAN3prGptFISo7lKi8r5aYXsficK',
  'test@example.com': '$2b$10$76A0CR2dEBGeVyy74CrZbuj7kRLcW1o9D2Y6XpF5OaV0ykoNOKsHC'
};

const commonPasswords = [
  'password', 'password123', 'bookd123', 'bookdapp', 'giggy', 'giggy123',
  'test123', 'demo', 'demo123', '123456', 'haley', 'bryan', 'christina', 
  'jessica', 'lilla', 'test', 'bookd2025', 'worker', 'gig123'
];

async function testUserPasswords() {
  console.log('🔍 TESTING ORIGINAL PASSWORD HASHES');
  console.log('===================================');
  
  const results = {};
  
  for (const [email, hash] of Object.entries(userHashes)) {
    console.log(`\nTesting ${email}:`);
    let found = false;
    
    for (const password of commonPasswords) {
      try {
        const isMatch = await bcrypt.compare(password, hash);
        if (isMatch) {
          console.log(`  ✅ PASSWORD FOUND: "${password}"`);
          results[email] = password;
          found = true;
          break;
        }
      } catch (error) {
        // Continue testing other passwords
      }
    }
    
    if (!found) {
      console.log(`  ❓ Password not found in common patterns`);
      results[email] = 'UNKNOWN';
    }
  }
  
  console.log('\n📋 FINAL RESULTS:');
  console.log('================');
  
  Object.entries(results).forEach(([email, password]) => {
    if (password !== 'UNKNOWN') {
      console.log(`✅ ${email} → "${password}"`);
    } else {
      console.log(`❌ ${email} → NEEDS PASSWORD RESET`);
    }
  });
  
  const foundCount = Object.values(results).filter(p => p !== 'UNKNOWN').length;
  console.log(`\n🎯 Found passwords for ${foundCount}/${Object.keys(results).length} users`);
}

testUserPasswords();