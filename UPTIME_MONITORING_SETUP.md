# UptimeRobot Monitoring Setup for Bookd

## Health Check Endpoints Created

Your Bookd app now has these monitoring endpoints:

### 1. **Basic Health Check**
- **URL**: `https://app.bookd.tools/health` (production) or `https://your-replit-url/health` (dev)
- **Purpose**: Simple server status check
- **Response**: `{"status":"healthy","timestamp":"2025-08-05T01:51:28.753Z"}`
- **Status Code**: 200 = healthy, 5xx = down

### 2. **Database Health Check**
- **URL**: `https://app.bookd.tools/api/health/database`
- **Purpose**: Verify database connectivity
- **Response**: `{"status":"ok","database":"connected","timestamp":"..."}`
- **Status Code**: 200 = database OK, 503 = database issues

### 3. **Authentication Health Check**
- **URL**: `https://app.bookd.tools/api/health/auth`
- **Purpose**: Verify auth system is responsive
- **Response**: `{"status":"ok","auth":"available","endpoints":["login","register","reset-password"]}`

### 4. **Core Functionality Check**
- **URL**: `https://app.bookd.tools/api/health/core`
- **Purpose**: Verify core gig/expense functionality
- **Response**: `{"status":"ok","core_features":{"gigs":"accessible","database_tables":"ready"}}`

## Recommended UptimeRobot Monitors

**Free Plan Setup (5-minute intervals):**

### Monitor #1: Main Application  
- **Type**: HTTP(s)
- **URL**: `https://app.bookd.tools`
- **Name**: "Bookd App"
- **Keyword to Monitor**: "Bookd" (ensures page loads properly)
- **Alert When**: Down for 2+ minutes

### Monitor #2: Basic Health
- **Type**: HTTP(s) 
- **URL**: `https://app.bookd.tools/health`
- **Name**: "Bookd Server Health"
- **Keyword to Monitor**: "healthy"
- **Alert When**: Down for 1+ minute

### Monitor #3: Database Health (Most Important)
- **Type**: HTTP(s)
- **URL**: `https://app.bookd.tools/api/health/database` 
- **Name**: "Bookd Database"
- **Keyword to Monitor**: "connected"
- **Alert When**: Down for 1+ minute
- **Why Critical**: Database issues affect all user functionality

## Development vs Production URLs

**Development** (Current):
- Main site: Your current Replit development URL
- Health: `your-replit-url/health` ✅ Working

**Production** (After Deploy):
- Main site: `https://bookd.tools`
- Health endpoints: `https://bookd.tools/health`, etc.

## Upgrade Recommendation

Once you deploy to production and have paying users:

**Solo Plan Benefits** ($7/month):
- 60-second monitoring intervals (vs 5-minute on free)
- SSL certificate expiration monitoring
- Slow response time alerts
- Better integrations (Slack notifications)

This gives you professional-grade monitoring that complements your Sentry error tracking perfectly.