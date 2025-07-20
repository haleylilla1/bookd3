/**
 * Supabase Migration Script
 * 
 * This script migrates data from current Neon PostgreSQL to Supabase
 * Run with: node migrate-to-supabase.js
 */

import { createClient } from '@supabase/supabase-js'

// Supabase credentials - Service key will be provided via environment variable
const SUPABASE_URL = 'https://gwywiuigckemgngpmbxf.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY // Secret key for admin operations

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
  },
  {
    id: 16,
    name: "Bryan Moore",
    email: "54bmoore@gmail.com",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: [],
    home_address: null,
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
    created_at: "2025-06-26 17:06:36.188201"
  },
  {
    id: 19,
    name: "Christina Zolotova",
    email: "czolotova@gmail.com",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: ["Bartending", "Brand ambassador", "Lead event"],
    home_address: null,
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
    created_at: "2025-06-28 20:52:36.667115"
  },
  {
    id: 21,
    name: "Test User",
    email: "test@bookd.tools",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: [],
    home_address: null,
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
    created_at: "2025-07-09 20:46:37.154253"
  },
  {
    id: 22,
    name: "User Two",
    email: "user2@bookd.tools",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: [],
    home_address: null,
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
    created_at: "2025-07-09 20:46:47.097828"
  },
  {
    id: 23,
    name: "haley",
    email: "lilla@chapman.edu",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: [],
    home_address: null,
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
    created_at: "2025-07-10 16:14:52.979695"
  },
  {
    id: 24,
    name: "Test User",
    email: "test@example.com",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: [],
    home_address: null,
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
    created_at: "2025-07-16 06:44:03.846142"
  },
  {
    id: 25,
    name: "Jessica Rafaela Roessler- Smith",
    email: "jroesslersmith@gmail.com",
    phone: null,
    title: "Gig Worker",
    default_tax_percentage: 23,
    custom_gig_types: ["Brand Ambassador"],
    home_address: "4844 Riverton Ave #104 North Hollywood, CA 91601",
    business_name: "Jessica Rafaela Roessler- Smith",
    business_address: "4844 Riverton Ave #104 North Hollywood, CA 91601",
    business_phone: "7862349137",
    business_email: "jroesslersmith@gmail.com",
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
    created_at: "2025-07-19 03:06:31.193595"
  }
]

// All gig data exported from database
const GIGS_DATA = [
  {
    id: 27,
    user_id: 5,
    gig_type: "bartender",
    client_name: "Coors",
    event_name: "Life is Beautiful",
    date: "2025-06-20",
    expected_pay: 400.00,
    actual_pay: null,
    payment_method: null,
    status: "upcoming",
    duties: null,
    tax_percentage: 17,
    mileage: null,
    notes: null,
    parking_expense: 15.00,
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
    created_at: "2025-06-20 03:23:31.264326"
  },
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
  },
  {
    id: 60,
    user_id: 14,
    gig_type: "Brand Ambassador",
    client_name: "TCG",
    event_name: "Cali Vibes",
    date: "2025-06-07",
    expected_pay: 540.00,
    actual_pay: 540.00,
    payment_method: "bank-transfer",
    status: "completed",
    duties: null,
    tax_percentage: 23,
    mileage: 62,
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
    created_at: "2025-06-24 17:48:58.710669"
  },
  {
    id: 98,
    user_id: 14,
    gig_type: "Brand Ambassador",
    client_name: "Brand Besties",
    event_name: "Furbies",
    date: "2025-06-24",
    expected_pay: 406.00,
    actual_pay: 415.00,
    payment_method: "bank-transfer",
    status: "completed",
    duties: null,
    tax_percentage: 20,
    mileage: 0,
    notes: null,
    parking_expense: 30.00,
    other_expenses: null,
    include_in_resume: true,
    gig_address: null,
    distance_miles: null,
    travel_time_minutes: null,
    tips: null,
    parking_receipts: ["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD..."],
    other_expense_receipts: [],
    parking_reimbursed: false,
    other_expenses_reimbursed: false,
    created_at: "2025-06-27 10:39:48.149"
  }
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

// Run migration immediately
migrateData().then(() => {
  console.log('🎉 Migration script completed!')
  process.exit(0)
}).catch((error) => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})