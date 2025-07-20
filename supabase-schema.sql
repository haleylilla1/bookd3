-- Supabase Database Schema Migration
-- Copy and paste this into Supabase SQL Editor

-- Enable UUID extension for better primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core user-related tables (gigs, goals, etc.)
-- Note: Supabase auth.users will handle authentication
-- We'll link to auth.users via auth_user_id

-- Main gigs table
CREATE TABLE gigs (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gig_type TEXT NOT NULL,
  client_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  date DATE NOT NULL,
  expected_pay NUMERIC,
  actual_pay NUMERIC,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  duties TEXT,
  tax_percentage INTEGER DEFAULT 23,
  mileage INTEGER,
  notes TEXT,
  parking_expense NUMERIC DEFAULT 0,
  other_expenses NUMERIC DEFAULT 0,
  include_in_resume BOOLEAN DEFAULT false,
  gig_address TEXT,
  distance_miles NUMERIC,
  travel_time_minutes INTEGER,
  tips NUMERIC DEFAULT 0,
  parking_receipts TEXT[] DEFAULT '{}',
  other_expense_receipts TEXT[] DEFAULT '{}',
  parking_reimbursed BOOLEAN DEFAULT false,
  other_expenses_reimbursed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly goals
CREATE TABLE monthly_goals (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  goal_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(auth_user_id, month, year)
);

-- Yearly goals
CREATE TABLE yearly_goals (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  goal_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(auth_user_id, year)
);

-- User profile extension (additional fields beyond Supabase auth)
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  phone TEXT,
  title TEXT DEFAULT 'Gig Worker',
  default_tax_percentage INTEGER DEFAULT 23,
  custom_gig_types TEXT[] DEFAULT '{}',
  home_address TEXT,
  business_name TEXT,
  business_address TEXT,
  business_phone TEXT,
  business_email TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "reminders": true}',
  work_preferences JSONB DEFAULT '{"primaryGigTypes": []}',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_gigs_auth_user_id ON gigs(auth_user_id);
CREATE INDEX idx_gigs_date ON gigs(date);
CREATE INDEX idx_gigs_status ON gigs(status);
CREATE INDEX idx_monthly_goals_user_year_month ON monthly_goals(auth_user_id, year, month);
CREATE INDEX idx_yearly_goals_user_year ON yearly_goals(auth_user_id, year);
CREATE INDEX idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

-- Row Level Security (RLS) policies
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE yearly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Gigs policies
CREATE POLICY "Users can view their own gigs" ON gigs
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own gigs" ON gigs
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own gigs" ON gigs
  FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can delete their own gigs" ON gigs
  FOR DELETE USING (auth.uid() = auth_user_id);

-- Monthly goals policies
CREATE POLICY "Users can view their own monthly goals" ON monthly_goals
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own monthly goals" ON monthly_goals
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own monthly goals" ON monthly_goals
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Yearly goals policies
CREATE POLICY "Users can view their own yearly goals" ON yearly_goals
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own yearly goals" ON yearly_goals
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own yearly goals" ON yearly_goals
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (auth_user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_monthly_goals_updated_at BEFORE UPDATE ON monthly_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_yearly_goals_updated_at BEFORE UPDATE ON yearly_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();