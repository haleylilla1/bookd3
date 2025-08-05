# Sentry Source Maps Setup Guide

## Why Source Maps Matter
Source maps allow Sentry to show you the **actual source code** where errors occur instead of minified/compiled code. This is crucial for debugging production issues.

## Quick Setup Steps

### 1. Create Sentry Auth Token
1. Go to [Sentry Settings > Auth Tokens](https://sentry.io/settings/auth-tokens/)
2. Click "Create New Token"
3. Name: "Bookd Source Maps"
4. Scopes: Select "project:releases" and "org:read"
5. Copy the token

### 2. Add Auth Token to Environment
Add your auth token as a secret in Replit:
- Secret name: `SENTRY_AUTH_TOKEN`
- Value: Your token from step 1

### 3. Enable Source Maps in Production Build
When building for production, run:
```bash
# Regular build
npm run build

# Then upload source maps
node scripts/upload-sourcemaps.js
```

Or combine both:
```bash
npm run build && node scripts/upload-sourcemaps.js
```

## What the Setup Includes

### ✅ Files Created
- `sentry.properties` - Sentry CLI configuration
- `scripts/upload-sourcemaps.js` - Automated upload script
- Sentry CLI installed via npm

### ✅ Automatic Process
When you run the upload script, it will:
1. Create a new release in Sentry
2. Upload source maps from your build directory
3. Associate the maps with your release
4. Finalize the release

## Testing the Setup

1. Build your project: `npm run build`
2. Upload source maps: `node scripts/upload-sourcemaps.js`
3. Check your Sentry dashboard → Releases
4. You should see a new release with uploaded artifacts

## Production Workflow

For deployment:
1. Set `VITE_APP_VERSION` environment variable (optional)
2. Run build with source map upload
3. Deploy your built files
4. Sentry will now show readable stack traces for any errors

## Configuration Details

The setup uses:
- **Organization**: bookd-yd
- **Project**: bookd
- **Build Directory**: dist/public
- **URL Prefix**: ~/ (maps to your domain root)

## Troubleshooting

**"Authentication required"**: Make sure `SENTRY_AUTH_TOKEN` is set
**"Project not found"**: Verify your org/project names in `sentry.properties`
**"No source maps found"**: Ensure your build creates .map files in dist/public

Your error monitoring will be much more effective with source maps - you'll see exact line numbers and readable code in Sentry!