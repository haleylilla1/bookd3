# Supabase Setup Guide

## Step 1: Database Schema Setup

1. **Go to your Supabase project dashboard**
2. **Click "SQL Editor" (not Table Editor)**
3. **Copy and paste the entire contents of `supabase-schema.sql`**
4. **Click "Run" to execute the SQL**

This will create:
- ✅ Core tables: `gigs`, `monthly_goals`, `yearly_goals`, `user_profiles`
- ✅ Proper indexes for performance
- ✅ Row Level Security (RLS) policies for data isolation
- ✅ Automatic user profile creation on signup
- ✅ UUID-based user references (Supabase standard)

## Step 2: Authentication Configuration

1. **Go to Authentication > Settings**
2. **Enable Email authentication** (should be enabled by default)
3. **Set up email templates** (optional for now)
4. **Configure redirect URLs** for your domain

## Step 3: API Keys

1. **Go to Project Settings > API**
2. **Copy these values** (we'll need them):
   - Project URL: `https://your-project.supabase.co`
   - Anon public key: `eyJ...` (safe for frontend)
   - Service role key: `eyJ...` (secret, server-side only)

## Step 4: Test the Setup

After running the SQL, you should see these tables in Table Editor:
- `gigs`
- `monthly_goals` 
- `yearly_goals`
- `user_profiles`

## Data Migration (Next Step)

Once the schema is created, we'll:
1. Export your current user data
2. Create Supabase auth users
3. Migrate gig and goal data
4. Update the application code

## Security Features Included

- **Row Level Security**: Users can only access their own data
- **JWT Authentication**: No database queries for session validation
- **Automatic Profile Creation**: User profiles created on signup
- **Data Isolation**: Bulletproof multi-user security

## Cost Comparison

- **Current**: Neon Scale Plan ($69/month) + Custom Auth (maintenance cost)
- **Supabase**: $25/month for everything (database + auth + 100K users)
- **Savings**: $44/month + reduced maintenance

Ready to proceed with the schema creation?