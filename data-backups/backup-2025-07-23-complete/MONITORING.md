# Giggy User Monitoring Guide

## Simple & Reliable Monitoring Endpoints

### 1. Check System Health
```bash
curl http://localhost:5000/api/monitor/health
```
Returns database connectivity status and basic health check.

### 2. Get User Statistics
```bash
curl http://localhost:5000/api/monitor/stats
```
Returns:
- Total registered users
- Active users in last 24 hours
- Timestamp of check

### 3. Export Individual User Data (Emergency Recovery)
```bash
curl http://localhost:5000/api/monitor/export/[USER_ID]
```
Downloads a JSON file with the user's essential data for recovery purposes.

## Database Backup (Most Reliable Method)

### Daily Automated Backup (Recommended)
Add to your system cron job:
```bash
# Run daily at 2 AM
0 2 * * * pg_dump $DATABASE_URL > /backup/giggy-$(date +\%Y\%m\%d).sql
```

### Manual Backup
```bash
pg_dump $DATABASE_URL > giggy-backup.sql
```

### Restore from Backup
```bash
psql $DATABASE_URL < giggy-backup.sql
```

## User Data Protection

1. **Audit Logs**: All user actions are automatically logged in the `audit_logs` table
2. **No Data Loss**: User data persists even if they become inactive
3. **Recovery**: Individual user exports available via API
4. **Monitoring**: Health checks ensure system is operational

## Emergency Procedures

If users report data issues:
1. Check system health: `/api/monitor/health`
2. Export affected user's data: `/api/monitor/export/[USER_ID]`
3. Check audit logs in database for recent activity
4. Restore from daily backup if needed

This approach is:
- ✅ Simple and reliable
- ✅ Uses PostgreSQL's proven backup system
- ✅ Minimal memory usage
- ✅ Fast response times
- ✅ Battle-tested reliability