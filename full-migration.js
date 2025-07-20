/**
 * Full Supabase Migration - Complete all 40 gigs
 * Export current database data and migrate everything
 */

import { createClient } from '@supabase/supabase-js'
import pkg from 'pg'
const { Pool } = pkg

const SUPABASE_URL = 'https://gwywiuigckemgngpmbxf.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Connect to current Neon database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

async function fullMigration() {
  console.log('🚀 Starting full migration to Supabase...')
  
  try {
    // Step 1: Get existing Supabase users
    console.log('📋 Getting Supabase user mappings...')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Failed to list users:', authError)
      return
    }
    
    // Create user mapping: email -> auth_uuid
    const userMapping = new Map()
    
    // Get current users from Neon
    const neonUsersResult = await pool.query('SELECT id, email FROM users ORDER BY id')
    
    for (const neonUser of neonUsersResult.rows) {
      const authUser = authUsers.users.find(u => u.email === neonUser.email)
      if (authUser) {
        userMapping.set(neonUser.id, authUser.id)
        console.log(`✅ Mapped ${neonUser.email} (${neonUser.id}) -> ${authUser.id}`)
      }
    }
    
    // Step 2: Export and migrate all gigs
    console.log('📝 Exporting gigs from Neon...')
    const gigsResult = await pool.query(`
      SELECT 
        id, user_id, gig_type, client_name, event_name, date,
        expected_pay, actual_pay, payment_method, status, duties,
        tax_percentage, mileage, notes, parking_expense, other_expenses,
        include_in_resume, gig_address, distance_miles, travel_time_minutes,
        tips, parking_receipts, other_expense_receipts, parking_reimbursed,
        other_expenses_reimbursed, created_at
      FROM gigs 
      ORDER BY user_id, date
    `)
    
    console.log(`📊 Found ${gigsResult.rows.length} gigs to migrate`)
    
    let gigsCreated = 0
    let gigsFailed = 0
    
    for (const gig of gigsResult.rows) {
      const authUserId = userMapping.get(gig.user_id)
      if (!authUserId) {
        console.log(`⚠️ Skipping gig ${gig.id} - no auth user for user_id ${gig.user_id}`)
        gigsFailed++
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
          expected_pay: parseFloat(gig.expected_pay || 0),
          actual_pay: gig.actual_pay ? parseFloat(gig.actual_pay) : null,
          payment_method: gig.payment_method,
          status: gig.status,
          duties: gig.duties,
          tax_percentage: parseInt(gig.tax_percentage || 0),
          mileage: gig.mileage ? parseInt(gig.mileage) : null,
          notes: gig.notes,
          parking_expense: gig.parking_expense ? parseFloat(gig.parking_expense) : null,
          other_expenses: gig.other_expenses ? parseFloat(gig.other_expenses) : null,
          include_in_resume: gig.include_in_resume !== false,
          gig_address: gig.gig_address,
          distance_miles: gig.distance_miles ? parseFloat(gig.distance_miles) : null,
          travel_time_minutes: gig.travel_time_minutes ? parseInt(gig.travel_time_minutes) : null,
          tips: gig.tips ? parseFloat(gig.tips) : null,
          parking_receipts: Array.isArray(gig.parking_receipts) ? gig.parking_receipts : [],
          other_expense_receipts: Array.isArray(gig.other_expense_receipts) ? gig.other_expense_receipts : [],
          parking_reimbursed: gig.parking_reimbursed === true,
          other_expenses_reimbursed: gig.other_expenses_reimbursed === true
        })
      
      if (gigError) {
        console.error(`❌ Failed to migrate gig ${gig.id}:`, gigError.message)
        gigsFailed++
      } else {
        gigsCreated++
        console.log(`✅ Migrated gig ${gigsCreated}: ${gig.client_name} - ${gig.event_name} (${gig.date})`)
      }
    }
    
    // Step 3: Export and migrate goals
    console.log('📝 Exporting goals from Neon...')
    const monthlyGoalsResult = await pool.query(`
      SELECT user_id, month, year, goal_amount, created_at, updated_at
      FROM monthly_goals 
      ORDER BY user_id, year, month
    `)
    
    const yearlyGoalsResult = await pool.query(`
      SELECT user_id, year, goal_amount, created_at, updated_at
      FROM yearly_goals 
      ORDER BY user_id, year
    `)
    
    console.log(`📊 Found ${monthlyGoalsResult.rows.length} monthly goals and ${yearlyGoalsResult.rows.length} yearly goals`)
    
    let goalsCreated = 0
    let goalsFailed = 0
    
    // Migrate monthly goals
    for (const goal of monthlyGoalsResult.rows) {
      const authUserId = userMapping.get(goal.user_id)
      if (!authUserId) {
        console.log(`⚠️ Skipping monthly goal for user_id ${goal.user_id} - no auth user found`)
        goalsFailed++
        continue
      }
      
      const { error: goalError } = await supabase
        .from('monthly_goals')
        .insert({
          auth_user_id: authUserId,
          month: goal.month,
          year: goal.year,
          goal_amount: parseFloat(goal.goal_amount)
        })
      
      if (goalError) {
        console.error(`❌ Failed to migrate monthly goal:`, goalError.message)
        goalsFailed++
      } else {
        goalsCreated++
        console.log(`✅ Migrated monthly goal: ${goal.year}-${goal.month} for user ${goal.user_id}`)
      }
    }
    
    // Migrate yearly goals
    for (const goal of yearlyGoalsResult.rows) {
      const authUserId = userMapping.get(goal.user_id)
      if (!authUserId) {
        console.log(`⚠️ Skipping yearly goal for user_id ${goal.user_id} - no auth user found`)
        goalsFailed++
        continue
      }
      
      const { error: goalError } = await supabase
        .from('yearly_goals')
        .insert({
          auth_user_id: authUserId,
          year: goal.year,
          goal_amount: parseFloat(goal.goal_amount)
        })
      
      if (goalError) {
        console.error(`❌ Failed to migrate yearly goal:`, goalError.message)
        goalsFailed++
      } else {
        goalsCreated++
        console.log(`✅ Migrated yearly goal: ${goal.year} for user ${goal.user_id}`)
      }
    }
    
    // Step 4: Create user profiles
    console.log('📝 Creating user profiles...')
    const usersResult = await pool.query(`
      SELECT 
        id, name, email, phone, title, default_tax_percentage,
        custom_gig_types, home_address, business_name, business_address,
        business_phone, business_email, notification_preferences,
        work_preferences, onboarding_completed, created_at
      FROM users 
      ORDER BY id
    `)
    
    let profilesCreated = 0
    let profilesFailed = 0
    
    for (const user of usersResult.rows) {
      const authUserId = userMapping.get(user.id)
      if (!authUserId) {
        console.log(`⚠️ Skipping profile for user_id ${user.id} - no auth user found`)
        profilesFailed++
        continue
      }
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: authUserId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          title: user.title || 'Gig Worker',
          default_tax_percentage: user.default_tax_percentage || 23,
          custom_gig_types: Array.isArray(user.custom_gig_types) ? user.custom_gig_types : [],
          home_address: user.home_address,
          business_name: user.business_name,
          business_address: user.business_address,
          business_phone: user.business_phone,
          business_email: user.business_email,
          notification_preferences: user.notification_preferences || {
            push: true,
            email: true,
            reminders: true
          },
          work_preferences: user.work_preferences || {
            workingHours: { start: "09:00", end: "17:00" },
            primaryGigTypes: [],
            preferredClients: []
          },
          onboarding_completed: user.onboarding_completed === true
        })
      
      if (profileError) {
        console.error(`❌ Failed to create profile for ${user.email}:`, profileError.message)
        profilesFailed++
      } else {
        profilesCreated++
        console.log(`✅ Created profile for ${user.email}`)
      }
    }
    
    // Step 5: Final verification
    console.log('\n🔍 Verifying migration...')
    const { data: finalGigsCount } = await supabase
      .from('gigs')
      .select('count', { count: 'exact', head: true })
    
    const { data: finalProfilesCount } = await supabase
      .from('user_profiles')
      .select('count', { count: 'exact', head: true })
    
    const { data: finalGoalsCount } = await supabase
      .from('monthly_goals')
      .select('count', { count: 'exact', head: true })
    
    console.log('\n🎉 FINAL MIGRATION SUMMARY:')
    console.log('=' .repeat(50))
    console.log(`✅ Auth users: ${authUsers.users.length}`)
    console.log(`✅ User profiles: ${profilesCreated} created, ${profilesFailed} failed`)
    console.log(`✅ Gigs: ${gigsCreated} created, ${gigsFailed} failed`)
    console.log(`✅ Goals: ${goalsCreated} created, ${goalsFailed} failed`)
    console.log(`✅ Final count - Gigs: ${finalGigsCount || 0}`)
    console.log(`✅ Final count - Profiles: ${finalProfilesCount || 0}`)
    console.log(`✅ Final count - Goals: ${finalGoalsCount || 0}`)
    
    if (gigsCreated === gigsResult.rows.length && profilesCreated === usersResult.rows.length) {
      console.log('\n🚀 MIGRATION COMPLETED SUCCESSFULLY!')
      console.log('All data has been successfully migrated to Supabase.')
    } else {
      console.log('\n⚠️  MIGRATION COMPLETED WITH ISSUES')
      console.log('Some data may not have been migrated. Check errors above.')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    await pool.end()
  }
}

// Run the full migration
fullMigration().then(() => {
  console.log('🏁 Full migration script finished!')
  process.exit(0)
}).catch((error) => {
  console.error('❌ Full migration failed:', error)
  process.exit(1)
})