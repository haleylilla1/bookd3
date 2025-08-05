# Production Deployment Guide for Bookd

## Environment Configuration

### Required Secrets (Set via Replit Secrets)
These should be configured in your Replit deployment secrets:

**Database:**
- `DATABASE_URL` - Your Neon PostgreSQL production connection string

**External Services:**
- `SENDGRID_API_KEY` - For password reset emails
- `GOOGLE_MAPS_API_KEY` - For address autocomplete and mileage calculation

**Sentry Monitoring:**
- `SENTRY_DSN` - For backend error tracking
- `VITE_SENTRY_DSN` - For frontend error tracking  
- `SENTRY_AUTH_TOKEN` - For source maps upload (optional but recommended)

**Security:**
- `SESSION_SECRET` - Strong random string for session encryption

### Environment Variables for Production
These can be set as regular environment variables:

```bash
NODE_ENV=production
PORT=5000
PRODUCTION_DOMAIN=app.bookd.tools
CORS_ORIGIN=https://app.bookd.tools
BCRYPT_ROUNDS=12
MAX_REQUEST_SIZE=10mb
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
```

## Build Process

### 1. Frontend Build
```bash
npm run build
```
This creates optimized production files in `dist/client/`

### 2. Backend Build  
```bash
npm run build
```
This bundles the server code for production

### 3. Source Maps Upload (Optional)
```bash
export SENTRY_AUTH_TOKEN="your-token" && node scripts/upload-sourcemaps.js
```

### 4. Start Production Server
```bash
npm start
```

## Database Migration

Before deploying to production:
```bash
npm run db:push
```
This ensures your production database schema matches your development schema.

## Quick Deployment Commands

### For Production Deploy:
```bash
# 1. Build the application
npm run build

# 2. Push database schema (if needed)
npm run db:push

# 3. Upload source maps (if SENTRY_AUTH_TOKEN is set)
export SENTRY_AUTH_TOKEN="your-token" && node scripts/upload-sourcemaps.js

# 4. Start production server
NODE_ENV=production node dist/index.js
```

### Automated Option:
```bash
# Uses the production startup script with validation
node scripts/production-start.js
```

## Pre-Deployment Checklist

- [x] Build process tested ✅
- [x] Production server starts successfully ✅
- [x] Health endpoints responding ✅
- [x] Security headers configured ✅
- [x] CORS configured for app.bookd.tools + bookd.tools ✅
- [x] Rate limiting optimized ✅
- [ ] All required secrets configured in Replit
- [ ] Database connection tested in production
- [ ] External services (SendGrid, Google Maps) working
- [ ] Sentry error monitoring configured
- [ ] UptimeRobot monitoring set up
- [ ] HTTPS/SSL certificate configured

## Post-Deployment Verification

1. Check health endpoints:
   - `https://app.bookd.tools/health`
   - `https://app.bookd.tools/api/health/database`

2. Test core functionality:
   - User registration/login
   - Gig creation
   - Expense tracking
   - Report generation

3. Monitor for 24 hours:
   - Check Sentry for errors
   - Verify UptimeRobot alerts
   - Monitor performance metrics