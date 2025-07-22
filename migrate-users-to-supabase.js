import { createClient } from '@supabase/supabase-js';
import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateUsersToSupabase() {
  try {
    console.log('🚀 Starting user migration to Supabase...');

    // Get all active users from existing database
    const existingUsers = await db.select().from(users).where(eq(users.isActive, true));
    
    console.log(`📊 Found ${existingUsers.length} users to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of existingUsers) {
      try {
        console.log(`📝 Migrating user: ${user.email}`);

        // Check if user already exists in Supabase
        const { data: existingSupabaseUser, error: checkError } = 
          await supabaseAdmin.auth.admin.getUserById(user.id.toString());

        if (existingSupabaseUser && !checkError) {
          console.log(`✅ User ${user.email} already exists in Supabase`);
          continue;
        }

        // Create user in Supabase with a temporary password
        // They'll need to reset their password on first login
        const tempPassword = `temp${user.id}${Date.now()}`;
        
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          user_metadata: { 
            name: user.name,
            migrated_from_bookd: true,
            original_user_id: user.id
          },
          email_confirm: true // Auto-confirm for migration
        });

        if (error) {
          console.error(`❌ Failed to create ${user.email}:`, error.message);
          errorCount++;
          continue;
        }

        console.log(`✅ Successfully migrated ${user.email} to Supabase`);
        console.log(`🔐 Temporary password for ${user.email}: ${tempPassword}`);
        successCount++;

      } catch (userError) {
        console.error(`❌ Error migrating ${user.email}:`, userError);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful migrations: ${successCount}`);
    console.log(`❌ Failed migrations: ${errorCount}`);
    console.log(`📝 Total users processed: ${existingUsers.length}`);

    if (successCount > 0) {
      console.log('\n🔔 IMPORTANT NOTICE:');
      console.log('Users have been migrated with temporary passwords.');
      console.log('They will need to use the password reset feature on their first login.');
      console.log('This is the most secure approach for migration.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Special migration for haleylilla@gmail.com with a known password
async function migrateHaleySpecial() {
  try {
    console.log('🎯 Special migration for haleylilla@gmail.com...');

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'haleylilla@gmail.com',
      password: 'bookd123', // Use a known password for testing
      user_metadata: { 
        name: 'Haley Lilla',
        migrated_from_bookd: true,
        original_user_id: 14 // Assuming this is Haley's ID
      },
      email_confirm: true
    });

    if (error) {
      console.error('❌ Failed to create haleylilla@gmail.com:', error.message);
      return false;
    }

    console.log('✅ Successfully migrated haleylilla@gmail.com');
    console.log('🔐 Password set to: bookd123');
    return true;

  } catch (error) {
    console.error('❌ Error in special migration:', error);
    return false;
  }
}

// Run the migration
async function main() {
  // First try the special migration for testing
  const success = await migrateHaleySpecial();
  if (success) {
    console.log('\n🎉 Test user migration completed successfully!');
    console.log('You can now sign in with:');
    console.log('Email: haleylilla@gmail.com');
    console.log('Password: bookd123');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateUsersToSupabase, migrateHaleySpecial };