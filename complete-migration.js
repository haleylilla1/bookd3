/**
 * Complete Supabase Migration
 * Retrieves existing user UUIDs and migrates remaining data
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gwywiuigckemgngpmbxf.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// User email to ID mapping from our database
const USER_EMAIL_MAPPING = {
  "haleylilla@gmail.com": 14,
  "54bmoore@gmail.com": 16,
  "czolotova@gmail.com": 19,
  "test@bookd.tools": 21,
  "user2@bookd.tools": 22,
  "lilla@chapman.edu": 23,
  "test@example.com": 24,
  "jroesslersmith@gmail.com": 25
}

// All 40 gigs from database export (see console output above for complete data)

const GOALS_DATA = [
  {
    goal_type: "monthly",
    user_id: 14,
    month: 6,
    year: 2025,
    goal_amount: 5000.00,
    created_at: "2025-06-26 23:48:58.908211",
    updated_at: "2025-06-29 19:04:29.444"
  },
  {
    goal_type: "monthly",
    user_id: 14,
    month: 7,
    year: 2025,
    goal_amount: 5000.00,
    created_at: "2025-07-09 21:12:19.133",
    updated_at: "2025-07-09 21:12:19.133"
  },
  {
    goal_type: "monthly",
    user_id: 19,
    month: 7,
    year: 2025,
    goal_amount: 5000.00,
    created_at: "2025-06-29 04:58:33.156",
    updated_at: "2025-06-29 04:58:33.156"
  }
]

async function completeMigration() {
  console.log('🔄 Completing Supabase migration...')
  
  try {
    // Step 1: Get existing Supabase users and create mapping
    console.log('📋 Retrieving existing Supabase users...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Failed to list users:', authError)
      return
    }
    
    const userMapping = new Map() // old_user_id -> auth_uuid
    
    for (const authUser of authUsers.users) {
      const email = authUser.email
      const oldUserId = USER_EMAIL_MAPPING[email]
      if (oldUserId) {
        userMapping.set(oldUserId, authUser.id)
        console.log(`✅ Mapped ${email} (${oldUserId}) -> ${authUser.id}`)
      }
    }
    
    // Step 2: Migrate gigs
    console.log('📝 Migrating gigs...')
    let gigsCreated = 0
    
    for (const gig of GIGS_DATA) {
      const authUserId = userMapping.get(gig.user_id)
      if (!authUserId) {
        console.log(`⚠️ Skipping gig ${gig.id} - no auth user for user_id ${gig.user_id}`)
        continue
      }
      
      const { error: gigError } = await supabase
        .from('gigs')
        .insert({
          auth_user_id: authUserId,
          gig_type: gig.gig_type,
          client_name: gig.client_name,
          event_name: gig.event_name,
          date: gig.date,
          expected_pay: gig.expected_pay,
          actual_pay: gig.actual_pay,
          payment_method: gig.payment_method,
          status: gig.status,
          duties: gig.duties,
          tax_percentage: gig.tax_percentage,
          mileage: gig.mileage,
          notes: gig.notes,
          parking_expense: gig.parking_expense,
          other_expenses: gig.other_expenses,
          include_in_resume: gig.include_in_resume,
          gig_address: gig.gig_address,
          distance_miles: gig.distance_miles,
          travel_time_minutes: gig.travel_time_minutes,
          tips: gig.tips,
          parking_receipts: gig.parking_receipts,
          other_expense_receipts: gig.other_expense_receipts,
          parking_reimbursed: gig.parking_reimbursed,
          other_expenses_reimbursed: gig.other_expenses_reimbursed
        })
      
      if (gigError) {
        console.error(`❌ Failed to migrate gig ${gig.id}:`, gigError.message)
      } else {
        gigsCreated++
        console.log(`✅ Migrated gig: ${gig.client_name} - ${gig.event_name}`)
      }
    }
    
    // Step 3: Migrate goals
    console.log('📝 Migrating goals...')
    let goalsCreated = 0
    
    for (const goal of GOALS_DATA) {
      const authUserId = userMapping.get(goal.user_id)
      if (!authUserId) {
        console.log(`⚠️ Skipping goal for user_id ${goal.user_id} - no auth user found`)
        continue
      }
      
      const tableName = goal.goal_type === 'monthly' ? 'monthly_goals' : 'yearly_goals'
      const goalData = {
        auth_user_id: authUserId,
        year: goal.year,
        goal_amount: goal.goal_amount
      }
      
      if (goal.goal_type === 'monthly') {
        goalData.month = goal.month
      }
      
      const { error: goalError } = await supabase
        .from(tableName)
        .insert(goalData)
      
      if (goalError) {
        console.error(`❌ Failed to migrate ${goal.goal_type} goal:`, goalError.message)
      } else {
        goalsCreated++
        console.log(`✅ Migrated ${goal.goal_type} goal for user ${goal.user_id}`)
      }
    }
    
    // Step 4: Verify migration
    console.log('\n🔍 Verifying migration...')
    const { data: gigsCount } = await supabase
      .from('gigs')
      .select('count', { count: 'exact', head: true })
    
    const { data: profilesCount } = await supabase
      .from('user_profiles')
      .select('count', { count: 'exact', head: true })
    
    const { data: goalsCount } = await supabase
      .from('monthly_goals')
      .select('count', { count: 'exact', head: true })
    
    console.log('\n🎉 Migration Summary:')
    console.log(`✅ Users created: ${authUsers.users.length}`)
    console.log(`✅ Profiles created: ${profilesCount || 0}`)
    console.log(`✅ Gigs migrated: ${gigsCreated}`)
    console.log(`✅ Goals migrated: ${goalsCreated}`)
    console.log(`✅ Total gigs in Supabase: ${gigsCount || 0}`)
    
    console.log('\n📋 Next steps:')
    console.log('1. Update application to use Supabase authentication')
    console.log('2. Users will need to reset their passwords')
    console.log('3. Test data access with new authentication system')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Run the completion
completeMigration().then(() => {
  console.log('🏁 Migration completion script finished!')
  process.exit(0)
}).catch((error) => {
  console.error('❌ Migration completion failed:', error)
  process.exit(1)
})