# Sentry Setup Guide for Bookd

## Overview
Sentry is now configured for comprehensive error monitoring and performance tracking in your Bookd app. This setup includes both frontend (React) and backend (Node.js) monitoring.

## Quick Setup Steps

### 1. Create Sentry Project
1. Go to [sentry.io](https://sentry.io) and create a free account
2. Create a new project
3. **Select "React" as the platform** (important!)
4. Copy the DSN from the project settings

### 2. Add DSN to Environment
Once you have your DSN, add it as a secret in your Replit environment:
- The secret key should be named: `SENTRY_DSN`
- The value should be your complete DSN URL from Sentry

## What's Already Configured

### ✅ Frontend Monitoring
- **Error Boundary Integration**: All React errors are automatically captured
- **User Context**: User information is tracked with errors (email, ID, name)
- **API Error Tracking**: Failed API requests are monitored and categorized
- **Performance Monitoring**: Page loads and user interactions are tracked
- **Authentication Events**: Login/logout events are recorded as breadcrumbs

### ✅ Backend Monitoring  
- **Server Error Tracking**: All server-side errors are captured
- **API Error Context**: Failed API calls include request details
- **User Context**: Server errors are linked to specific users when possible
- **Performance Monitoring**: Server response times and database queries

### ✅ Smart Error Filtering
- **Development Mode**: Errors only sent when `VITE_SENTRY_DEBUG` is enabled in dev
- **Production Mode**: 10% sampling rate for performance monitoring
- **Client vs Server Errors**: Proper categorization and different handling

## Features You Get

1. **Real-time Error Alerts**: Get notified when users encounter errors
2. **Error Context**: See exactly what the user was doing when errors occurred
3. **Performance Insights**: Monitor slow API calls and page loads
4. **User Journey Tracking**: Follow user actions leading up to errors
5. **Release Tracking**: Monitor error rates across different app versions

## Testing the Setup

Once you add the DSN:
1. The console warning "Sentry DSN not found" will disappear
2. You can test by triggering an error in the app
3. Check your Sentry dashboard to see the error appear

## Customization Options

The configuration includes several environment variables you can set:
- `VITE_SENTRY_DEBUG`: Enable Sentry in development mode
- `VITE_APP_VERSION`: Track which version of your app caused errors
- `APP_VERSION`: Server-side version tracking

## Production Benefits

When you deploy to production:
- Automatic error monitoring for all users
- Performance bottleneck identification
- User impact analysis for bugs
- Proactive issue detection before users report problems

## Next Steps

1. Add your Sentry DSN as a secret
2. Test the integration in development
3. Monitor the Sentry dashboard for any issues
4. Set up alerts for critical errors

Your app is now ready for professional-grade error monitoring and performance tracking!