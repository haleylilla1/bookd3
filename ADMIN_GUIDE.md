# Giggy Admin Support Guide

## Quick User Lookup Commands

### 1. Find User by Email
To help "haleylilla@gmail.com", you need her User ID first:

```bash
# Check the user database directly
curl -s http://localhost:5000/api/monitor/stats
# This shows total users, then check logs or database for specific user
```

### 2. User Account Summary (Once you have User ID)
```bash
curl -s http://localhost:5000/api/admin/user/14
```

**Returns:**
- User details (name, email, creation date)
- Account status (active/inactive)
- Data summary (total gigs, goals)
- Last activity timestamp

### 3. Export User Data (Backup/Recovery)
```bash
curl -s http://localhost:5000/api/monitor/export/14
```

**Returns:** Complete user data backup as JSON

### 4. View User's Gigs
```bash
curl -s http://localhost:5000/api/admin/user/14/gigs
```

**Returns:** All gig entries with earnings, dates, clients

## Finding User ID from Email

**Method 1: Database Query**
```sql
SELECT id, name, email FROM users WHERE email = 'haleylilla@gmail.com';
```

**Method 2: Check Server Logs**
The server logs show user IDs during login:
```
9:11:16 PM [express] POST /api/auth/register 200 :: {"user":{"id":14,"email":"haleylilla@gmail.com"}}
```

## Common Support Scenarios

### "My data disappeared"
1. `curl -s http://localhost:5000/api/admin/user/[USER_ID]` - Check data counts
2. `curl -s http://localhost:5000/api/monitor/export/[USER_ID]` - Backup current state
3. Check database audit logs for deletions

### "I can't access my account"
1. `curl -s http://localhost:5000/api/admin/user/[USER_ID]` - Verify account active
2. Check authentication logs
3. Reset if needed

### "My numbers are wrong"
1. `curl -s http://localhost:5000/api/admin/user/[USER_ID]/gigs` - Review all entries
2. Export data to compare with user's records
3. Check for calculation errors

## Emergency Recovery
If user data is corrupted, restore from PostgreSQL backup:
```bash
pg_dump $DATABASE_URL > emergency-backup.sql
psql $DATABASE_URL < previous-backup.sql
```

The system automatically logs all admin actions for audit trails.