import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gwywiuigckemgngpmbxf.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eXdpdWlnY2tlbWduZ3BtYnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMzQ4NzMsImV4cCI6MjA2NjcxMDg3M30.hOYBcF1VQkZRJU4KuNMTT_5SFUZiUX7ZF-nUmH7lw68'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  email: string
  name?: string
}