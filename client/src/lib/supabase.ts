import { createClient } from '@supabase/supabase-js'

// Environment variables analysis shows project ID in VITE_SUPABASE_ANON_KEY, JWT in VITE_SUPABASE_URL
// Build the correct URL from the project ID
const projectId = import.meta.env.VITE_SUPABASE_ANON_KEY || 'gwywiuigckemgngpmbxf'
const supabaseUrl = projectId.startsWith('http') ? projectId : `https://${projectId}.supabase.co`
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_URL || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eXdpdWlnY2tlbWduZ3BtYnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzA5NDEsImV4cCI6MjA2ODYwNjk0MX0.eVas5kb4MF9zpzPHZHTfSY2YlFiOejZ3MVzFD1sEMKk'

console.log('Supabase configuration:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey
})

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    VITE_SUPABASE_URL: !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
  })
  throw new Error('Missing required Supabase environment variables. Please check your .env file.')
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch (error) {
  console.error('Invalid Supabase URL:', supabaseUrl)
  throw new Error('Invalid VITE_SUPABASE_URL format. Please provide a valid URL.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  email: string
  name?: string
}