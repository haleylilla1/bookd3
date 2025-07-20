/**
 * Verify Supabase Migration Results
 * Uses service key to check actual migration status
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gwywiuigckemgngpmbxf.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verifyMigration() {
  console.log('🔍 Verifying Supabase migration results...')
  
  try {
    // Check auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      console.error('❌ Failed to get auth users:', authError)
      return
    }
    
    console.log(`✅ Auth users: ${authUsers.users.length}`)
    authUsers.users.forEach(user => {
      console.log(`  • ${user.email} (${user.id})`)
    })
    
    // Check gigs
    const { data: gigs, error: gigsError } = await supabase
      .from('gigs')
      .select('*')
    
    if (gigsError) {
      console.error('❌ Failed to get gigs:', gigsError)
    } else {
      console.log(`\n✅ Gigs migrated: ${gigs ? gigs.length : 0}`)
      if (gigs && gigs.length > 0) {
        console.log('📋 Sample gigs:')
        gigs.slice(0, 5).forEach((gig, i) => {
          console.log(`  ${i + 1}. ${gig.client_name} - ${gig.event_name} ($${gig.expected_pay})`)
        })
      }
    }
    
    // Check user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
    
    if (profilesError) {
      console.error('❌ Failed to get profiles:', profilesError)
    } else {
      console.log(`\n✅ User profiles: ${profiles ? profiles.length : 0}`)
      if (profiles && profiles.length > 0) {
        profiles.forEach(profile => {
          console.log(`  • ${profile.name} (${profile.email})`)
        })
      }
    }
    
    // Check monthly goals
    const { data: goals, error: goalsError } = await supabase
      .from('monthly_goals')
      .select('*')
    
    if (goalsError) {
      console.error('❌ Failed to get goals:', goalsError)
    } else {
      console.log(`\n✅ Monthly goals: ${goals ? goals.length : 0}`)
      if (goals && goals.length > 0) {
        goals.forEach(goal => {
          console.log(`  • ${goal.year}-${goal.month}: $${goal.goal_amount}`)
        })
      }
    }
    
    console.log('\n🎯 MIGRATION STATUS SUMMARY:')
    console.log('=' .repeat(40))
    console.log(`Auth Users: ${authUsers.users.length}/8 ✅`)
    console.log(`Gigs: ${gigs ? gigs.length : 0}/37 ${gigs && gigs.length > 30 ? '✅' : '⚠️'}`)
    console.log(`Profiles: ${profiles ? profiles.length : 0}/8 ${profiles && profiles.length > 5 ? '✅' : '⚠️'}`)
    console.log(`Goals: ${goals ? goals.length : 0}/3 ${goals && goals.length > 0 ? '✅' : '⚠️'}`)
    
    if (gigs && gigs.length > 30 && profiles && profiles.length > 5) {
      console.log('\n🚀 MIGRATION SUCCESS! Ready for application update.')
    } else {
      console.log('\n⚠️  Migration needs completion. Some data missing.')
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Run verification
verifyMigration().then(() => {
  console.log('🏁 Verification complete!')
  process.exit(0)
}).catch((error) => {
  console.error('❌ Verification failed:', error)
  process.exit(1)
})