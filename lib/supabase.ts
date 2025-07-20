import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gwywiuigckemgngpmbxf.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eXdpdWlnY2tlbWduZ3BtYnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzA5NDEsImV4cCI6MjA2ODYwNjk0MX0.eVas5kb4MF9zpzPHZHTfSY2YlFiOejZ3MVzFD1sEMKk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our Supabase tables
export interface SupabaseGig {
  id: number
  auth_user_id: string
  gig_type: string
  client_name: string
  event_name: string
  date: string
  expected_pay?: number
  actual_pay?: number
  payment_method?: string
  status: string
  duties?: string
  tax_percentage?: number
  mileage?: number
  notes?: string
  parking_expense?: number
  other_expenses?: number
  include_in_resume?: boolean
  gig_address?: string
  distance_miles?: number
  travel_time_minutes?: number
  tips?: number
  parking_receipts?: string[]
  other_expense_receipts?: string[]
  parking_reimbursed?: boolean
  other_expenses_reimbursed?: boolean
  created_at?: string
}

export interface SupabaseUserProfile {
  id: number
  auth_user_id: string
  phone?: string
  title?: string
  default_tax_percentage?: number
  custom_gig_types?: string[]
  home_address?: string
  business_name?: string
  business_address?: string
  business_phone?: string
  business_email?: string
  notification_preferences?: any
  work_preferences?: any
  onboarding_completed?: boolean
  created_at?: string
  updated_at?: string
}

export interface SupabaseMonthlyGoal {
  id: number
  auth_user_id: string
  month: number
  year: number
  goal_amount: number
  created_at?: string
  updated_at?: string
}

export interface SupabaseYearlyGoal {
  id: number
  auth_user_id: string
  year: number
  goal_amount: number
  created_at?: string
  updated_at?: string
}