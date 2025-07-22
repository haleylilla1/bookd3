// Reset password for haleylilla@gmail.com in Supabase
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

async function resetHaleyPassword() {
  try {
    console.log('🔐 Setting new password for haleylilla@gmail.com...');

    // Get user first
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Failed to list users:', listError.message);
      return false;
    }

    const haleyUser = users.users?.find(u => u.email === 'haleylilla@gmail.com');
    
    if (!haleyUser) {
      console.log('❌ User haleylilla@gmail.com not found in Supabase');
      return false;
    }

    console.log(`✅ Found user: ${haleyUser.id}`);

    // Update password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      haleyUser.id,
      {
        password: 'bookd123'
      }
    );

    if (error) {
      console.error('❌ Failed to reset password:', error.message);
      return false;
    }

    console.log('✅ Password reset successful!');
    console.log(`📧 Email: haleylilla@gmail.com`);
    console.log(`🔐 New Password: bookd123`);
    
    return true;

  } catch (error) {
    console.error('💥 Password reset error:', error.message);
    return false;
  }
}

// Run the password reset
resetHaleyPassword().then(success => {
  if (success) {
    console.log('\n🎉 Password reset completed! You can now sign in with:');
    console.log('📧 Email: haleylilla@gmail.com');
    console.log('🔐 Password: bookd123');
  } else {
    console.log('\n❌ Password reset failed. Check the error messages above.');
  }
  process.exit(success ? 0 : 1);
});