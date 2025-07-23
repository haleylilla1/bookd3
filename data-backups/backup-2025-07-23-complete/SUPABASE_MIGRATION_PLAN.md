# Supabase Migration Plan

## Overview
Migrating from current Neon PostgreSQL + custom auth to Supabase for bulletproof 1000-user scalability.

## Benefits
- **Cost Reduction**: $25/month vs $69/month Neon Scale plan
- **Performance**: JWT tokens eliminate database queries per auth check
- **Scalability**: Built-in support for 100,000+ users
- **Security**: Enterprise-grade auth with rate limiting
- **Maintenance**: Managed service vs custom auth code

## Migration Steps

### Phase 1: Database Setup (Today)
1. ✅ Create Supabase project
2. 🔄 Export current database schema
3. 🔄 Create matching tables in Supabase
4. 🔄 Migrate user data
5. 🔄 Test data integrity

### Phase 2: Authentication Integration
1. Install Supabase client
2. Replace custom auth with Supabase Auth
3. Update API middleware
4. Update frontend components
5. Test authentication flows

### Phase 3: Production Cutover
1. Update environment variables
2. Deploy to production
3. Monitor performance
4. Decommission old auth system

## Database Schema Migration

### Current Tables to Migrate:
- `users` (9 users with gig data)
- `gigs` (40 gigs)
- `monthly_goals` / `yearly_goals` (3 goals)
- `user_sessions` (will be replaced by Supabase auth)
- `password_reset_tokens` (will be replaced by Supabase auth)

### Supabase Auth Integration:
- User management handled by Supabase
- Session management via JWT tokens
- Password reset via Supabase API
- Rate limiting built-in

## Rollback Plan
- Keep current system running during migration
- Database backup available for instant revert
- Environment variable switch for quick rollback

## Timeline
- **Day 1**: Database migration and schema setup
- **Day 2**: Auth integration and testing
- **Day 3**: Production deployment and monitoring