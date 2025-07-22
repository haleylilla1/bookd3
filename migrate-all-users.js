// Comprehensive user migration script for all real users (excluding test accounts)
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Client } = pkg;

const supabaseUrl = process.env.SUPABASE_URL || 'https://gwywiuigckemgngpmbxf.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database client
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL
});

async function getAllRealUsers() {
  await dbClient.connect();
  
  // Get all active users, excluding test accounts
  const result = await dbClient.query(`
    SELECT id, name, email, password_hash, created_at, last_login_at
    FROM users 
    WHERE is_active = true 
    AND is_deleted = false
    AND email NOT ILIKE '%test%'
    AND email NOT ILIKE '%demo%'
    AND email NOT ILIKE '%example%'
    AND name NOT ILIKE '%test%'
    ORDER BY created_at ASC
  `);
  
  return result.rows;
}

async function migrateUserToSupabase(user) {
  try {
    console.log(`📝 Migrating user: ${user.email} (ID: ${user.id})`);

    // Check if user already exists in Supabase
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === user.email);

    if (existingUser) {
      console.log(`✅ User ${user.email} already exists in Supabase (ID: ${existingUser.id})`);
      return { success: true, existing: true, supabaseId: existingUser.id };
    }

    // Create user in Supabase with temporary password
    // They'll use password reset on first login for security
    const tempPassword = `temp${user.id}${Date.now()}`;
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: tempPassword,
      user_metadata: { 
        name: user.name,
        migrated_from_bookd: true,
        original_user_id: user.id,
        migration_date: new Date().toISOString(),
        needs_password_reset: true
      },
      email_confirm: true // Auto-confirm for migration
    });

    if (error) {
      console.error(`❌ Failed to create ${user.email}:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ Successfully migrated ${user.email} to Supabase (ID: ${data.user.id})`);
    return { 
      success: true, 
      existing: false, 
      supabaseId: data.user.id, 
      tempPassword: tempPassword 
    };

  } catch (error) {
    console.error(`💥 Error migrating ${user.email}:`, error);
    return { success: false, error: error.message };
  }
}

async function migrateAllUsers() {
  try {
    console.log('🚀 Starting comprehensive user migration to Supabase...');
    console.log('📋 Excluding test accounts (test@*, demo@*, example@*, names with "test")');

    const users = await getAllRealUsers();
    console.log(`📊 Found ${users.length} real users to process`);

    let successCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    const results = [];

    for (const user of users) {
      const result = await migrateUserToSupabase(user);
      results.push({ user: user.email, ...result });

      if (result.success) {
        if (result.existing) {
          existingCount++;
        } else {
          successCount++;
        }
      } else {
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`🔄 Already existed: ${existingCount}`);
    console.log(`❌ Failed migrations: ${errorCount}`);
    console.log(`📝 Total users processed: ${users.length}`);

    if (successCount > 0) {
      console.log('\n🔔 IMPORTANT NOTICE:');
      console.log('New users have been migrated with temporary passwords.');
      console.log('They should use the password reset feature on first login.');
    }

    // Print results for major users
    console.log('\n👥 USER MIGRATION DETAILS:');
    results.forEach(result => {
      if (result.success) {
        const status = result.existing ? 'EXISTING' : 'MIGRATED';
        console.log(`${status}: ${result.user} → ${result.supabaseId}`);
      } else {
        console.log(`FAILED: ${result.user} → ${result.error}`);
      }
    });

    await dbClient.end();
    return { successCount, existingCount, errorCount, total: users.length };

  } catch (error) {
    console.error('💥 Migration failed:', error);
    await dbClient.end();
    process.exit(1);
  }
}

// Run the migration
migrateAllUsers().then(summary => {
  console.log('\n🎉 Migration process completed!');
  console.log(`Final results: ${summary.successCount + summary.existingCount}/${summary.total} users ready in Supabase`);
  
  if (summary.successCount + summary.existingCount === summary.total) {
    console.log('✅ ALL USERS SUCCESSFULLY MIGRATED OR EXISTED');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});