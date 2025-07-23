# Supabase Data Migration Guide

## Step 1: Get Your Supabase API Keys

1. **Go to Project Settings > API**
2. **Copy these values**:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon public key**: `eyJ...` (starts with eyJ, safe for frontend)
   - **Service role key**: `eyJ...` (secret, server-side only)

## Step 2: Migration Process

### Current Data to Migrate:
- **9 users** with complete profiles
- **40 gigs** across all users  
- **3 monthly goals**

### Migration Steps:
1. Install Supabase client
2. Set up environment variables
3. Create migration script
4. Test authentication flows
5. Update application code

## Data Mapping:

### Users → Supabase Auth + user_profiles
- **Current**: `users` table with password hashes
- **New**: Supabase `auth.users` + `user_profiles` table
- **Migration**: Create auth users, link to profiles

### Gigs → gigs table
- **Current**: `user_id` (integer)
- **New**: `auth_user_id` (UUID)
- **Migration**: Map user IDs to new UUIDs

### Goals → monthly_goals/yearly_goals
- **Current**: `user_id` (integer) 
- **New**: `auth_user_id` (UUID)
- **Migration**: Map user IDs to new UUIDs

## Security Benefits:
- Row Level Security prevents cross-user data access
- JWT tokens eliminate database session queries
- Built-in rate limiting and DDoS protection
- Automatic security updates from Supabase

Ready to proceed with the migration?