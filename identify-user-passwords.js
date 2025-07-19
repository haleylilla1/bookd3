// Script to identify each user's actual password by testing common patterns
import bcrypt from 'bcryptjs';
import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Common password patterns users might have chosen
const passwordPatterns = [
  // Based on user names and emails
  (email, name) => name?.toLowerCase(),
  (email, name) => name?.toLowerCase() + '123',
  (email, name) => email.split('@')[0],
  (email, name) => email.split('@')[0] + '123',
  
  // Common passwords users might choose
  'password123',
  'bookd123',
  'bookdapp',
  'giggy123',
  'test123',
  'demo123',
  '123456',
  'password',
  
  // Date-based patterns (creation dates)
  '062025', '072025', '2025',
  
  // App-specific
  'bookd2025',
  'gigworker',
  'mypassword'
];

async function identifyUserPasswords() {
  console.log('🔍 IDENTIFYING EACH USER\'S ACTUAL PASSWORD...\n');
  
  try {
    const activeUsers = await db
      .select()
      .from(users)
      .where(eq(users.isActive, true));

    const results = [];
    
    for (const user of activeUsers) {
      console.log(`Testing user: ${user.email} (${user.name})`);
      
      if (!user.passwordHash) {
        console.log('  ❌ No password hash');
        results.push({ email: user.email, password: null, status: 'NO_HASH' });
        continue;
      }
      
      let foundPassword = null;
      
      // Generate user-specific patterns
      const userPatterns = passwordPatterns.flatMap(pattern => {
        if (typeof pattern === 'function') {
          return pattern(user.email, user.name);
        }
        return pattern;
      }).filter(Boolean);
      
      // Test each pattern
      for (const testPassword of userPatterns) {
        try {
          const isValid = await bcrypt.compare(testPassword, user.passwordHash);
          if (isValid) {
            foundPassword = testPassword;
            console.log(`  ✅ Found: "${testPassword}"`);
            break;
          }
        } catch (error) {
          // Invalid hash or comparison error, continue
        }
      }
      
      if (!foundPassword) {
        console.log('  ❓ Password not found in common patterns');
        results.push({ email: user.email, password: null, status: 'UNKNOWN' });
      } else {
        results.push({ email: user.email, password: foundPassword, status: 'FOUND' });
      }
    }
    
    console.log('\n📋 RESULTS SUMMARY:');
    console.log('==================');
    
    results.forEach(result => {
      if (result.status === 'FOUND') {
        console.log(`✅ ${result.email} -> "${result.password}"`);
      } else {
        console.log(`❌ ${result.email} -> ${result.status}`);
      }
    });
    
    const foundCount = results.filter(r => r.status === 'FOUND').length;
    console.log(`\n🎯 Found passwords for ${foundCount}/${results.length} users`);
    
    return results;
    
  } catch (error) {
    console.error('Error identifying passwords:', error);
  }
}

// Run if called directly
identifyUserPasswords().then(() => process.exit(0));