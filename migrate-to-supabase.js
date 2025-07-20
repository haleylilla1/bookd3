/**
 * Supabase Migration Script
 * 
 * This script migrates data from current Neon PostgreSQL to Supabase
 * Run with: node migrate-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js')

// You'll need to replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_SERVICE_KEY = 'your-service-role-key' // Secret key for admin operations

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Current data exported from your database
const USERS_DATA = [
  {
    id: 14,
    name: "Haley",
    email: "haleylilla@gmail.com",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: ["Brand Ambassador", "Market Research", "Photo Assistant"],
    home_address: "313 16th Street, Huntington Beach CA 92648",
    business_name: null,
    business_address: null,
    business_phone: null,
    business_email: null,
    notification_preferences: {
      "push": true,
      "email": true,
      "reminders": true
    },
    work_preferences: {
      "workingHours": {
        "end": "17:00",
        "start": "09:00"
      },
      "primaryGigTypes": [],
      "preferredClients": []
    },
    onboarding_completed: false,
    created_at: "2025-06-23 21:11:16.352955"
  }
  // Add other users here...
]

// Sample gig data structure
const GIGS_DATA = [
  {
    id: 59,
    user_id: 14,
    gig_type: "Brand Ambassador",
    client_name: "Epiros",
    event_name: "IDDBA",
    date: "2025-06-01",
    expected_pay: 1000.00,
    actual_pay: 1000.00,
    payment_method: "cash",
    status: "completed",
    duties: null,
    tax_percentage: 0,
    mileage: 0,
    notes: null,
    parking_expense: null,
    other_expenses: null,
    include_in_resume: true,
    gig_address: null,
    distance_miles: null,
    travel_time_minutes: null,
    tips: null,
    parking_receipts: [],
    other_expense_receipts: [],
    parking_reimbursed: false,
    other_expenses_reimbursed: false,
    created_at: "2025-06-24 17:48:03.158529"
  }
  // Add other gigs here...
]

const GOALS_DATA = [
  {
    goal_type: "monthly",
    user_id: 14,
    month: 6,
    year: 2025,
    goal_amount: 5000.00,
    created_at: "2025-06-26 23:48:58.908211",
    updated_at: "2025-06-29 19:04:29.444"
  }
  // Add other goals here...
]

async function migrateData() {
  console.log('🚀 Starting Supabase migration...')
  
  try {
    // Step 1: Create Supabase auth users and get UUIDs
    console.log('📝 Creating Supabase auth users...')
    const userMapping = new Map() // old_user_id -> new_auth_uuid
    
    for (const user of USERS_DATA) {
      // Create Supabase auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'TemporaryPassword123!', // Users will reset this
        email_confirm: true,
        user_metadata: {
          name: user.name
        }
      })
      
      if (authError) {
        console.error(`❌ Failed to create auth user for ${user.email}:`, authError)
        continue
      }
      
      console.log(`✅ Created auth user: ${user.email} -> ${authUser.user.id}`)
      userMapping.set(user.id, authUser.user.id)
      
      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: authUser.user.id,
          phone: user.phone,
          title: user.title,
          default_tax_percentage: user.default_tax_percentage,
          custom_gig_types: user.custom_gig_types,
          home_address: user.home_address,
          business_name: user.business_name,
          business_address: user.business_address,
          business_phone: user.business_phone,
          business_email: user.business_email,
          notification_preferences: user.notification_preferences,
          work_preferences: user.work_preferences,
          onboarding_completed: user.onboarding_completed
        })
      
      if (profileError) {
        console.error(`❌ Failed to create profile for ${user.email}:`, profileError)
      } else {
        console.log(`✅ Created profile for: ${user.email}`)
      }
    }
    
    // Step 2: Migrate gigs
    console.log('📝 Migrating gigs...')
    for (const gig of GIGS_DATA) {
      const authUserId = userMapping.get(gig.user_id)
      if (!authUserId) {
        console.error(`❌ No auth user found for user_id ${gig.user_id}`)
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
        console.error(`❌ Failed to migrate gig ${gig.id}:`, gigError)
      } else {
        console.log(`✅ Migrated gig: ${gig.client_name} - ${gig.event_name}`)
      }
    }
    
    // Step 3: Migrate goals
    console.log('📝 Migrating goals...')
    for (const goal of GOALS_DATA) {
      const authUserId = userMapping.get(goal.user_id)
      if (!authUserId) {
        console.error(`❌ No auth user found for user_id ${goal.user_id}`)
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
        console.error(`❌ Failed to migrate ${goal.goal_type} goal:`, goalError)
      } else {
        console.log(`✅ Migrated ${goal.goal_type} goal for user ${goal.user_id}`)
      }
    }
    
    console.log('🎉 Migration completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Update your .env file with Supabase credentials')
    console.log('2. Update application code to use Supabase client')
    console.log('3. Test authentication flows')
    console.log('4. Users will need to reset their passwords')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Uncomment to run migration
// migrateData()

module.exports = { migrateData }