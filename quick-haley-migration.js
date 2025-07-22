// Quick migration script for haleylilla@gmail.com to test Supabase auth
import { createClient } from '@supabase/supabase-js';

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

async function migrateHaley() {
  try {
    console.log('🎯 Migrating haleylilla@gmail.com to Supabase...');
    console.log(`🔗 Supabase URL: ${supabaseUrl}`);

    // Create user in Supabase Auth with known credentials
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'haleylilla@gmail.com',
      password: 'bookd123',
      user_metadata: { 
        name: 'Haley Lilla',
        migrated_from_bookd: true,
        original_user_id: 14
      },
      email_confirm: true // Auto-confirm email
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ User haleylilla@gmail.com already exists in Supabase');
        
        // Try to get existing user
        const { data: existingUser, error: getUserError } = 
          await supabaseAdmin.auth.admin.listUsers();
        
        if (!getUserError && existingUser?.users) {
          const haleyUser = existingUser.users.find(u => u.email === 'haleylilla@gmail.com');
          if (haleyUser) {
            console.log(`✅ Found existing user: ${haleyUser.id}`);
            return true;
          }
        }
        return true;
      }
      
      console.error('❌ Failed to create user:', error.message);
      return false;
    }

    console.log('✅ Successfully created haleylilla@gmail.com in Supabase');
    console.log(`📧 Email: haleylilla@gmail.com`);
    console.log(`🔐 Password: bookd123`);
    console.log(`🆔 Supabase User ID: ${data.user?.id}`);
    
    return true;

  } catch (error) {
    console.error('💥 Migration error:', error.message);
    return false;
  }
}

// Run the migration
migrateHaley().then(success => {
  if (success) {
    console.log('\n🎉 Migration completed! You can now sign in with:');
    console.log('📧 Email: haleylilla@gmail.com');
    console.log('🔐 Password: bookd123');
  } else {
    console.log('\n❌ Migration failed. Check the error messages above.');
  }
  process.exit(success ? 0 : 1);
});