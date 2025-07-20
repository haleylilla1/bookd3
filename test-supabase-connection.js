/**
 * Test Supabase Connection
 * Run with: node test-supabase-connection.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gwywiuigckemgngpmbxf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eXdpdWlnY2tlbWduZ3BtYnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzA5NDEsImV4cCI6MjA2ODYwNjk0MX0.eVas5kb4MF9zpzPHZHTfSY2YlFiOejZ3MVzFD1sEMKk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testConnection() {
  console.log('🔗 Testing Supabase connection...')
  
  try {
    // Test basic connection by checking if tables exist
    const { data, error } = await supabase
      .from('gigs')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      console.log('❌ Connection test failed:', error.message)
      return false
    }
    
    console.log('✅ Successfully connected to Supabase!')
    console.log('✅ Database tables are accessible')
    console.log(`✅ Gigs table exists (currently ${data || 0} records)`)
    
    // Test other tables
    const tables = ['user_profiles', 'monthly_goals', 'yearly_goals']
    for (const table of tables) {
      const { error: tableError } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true })
      
      if (tableError) {
        console.log(`❌ Table ${table} not accessible:`, tableError.message)
      } else {
        console.log(`✅ Table ${table} exists and accessible`)
      }
    }
    
    return true
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message)
    return false
  }
}

// Run the test
testConnection()