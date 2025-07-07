# Bookd.tools Domain Setup Guide

## Problem: URL Forwarding vs. Proper DNS

Currently, your Squarespace domain `bookd.tools` is doing **URL forwarding** (redirect) instead of proper DNS configuration. This is why users see the full Replit URL instead of staying on `bookd.tools`.

## Solution: Proper DNS Configuration

You need to provide Squarespace with these DNS records to point directly to your Replit deployment:

### DNS Records for Squarespace

**For Root Domain (bookd.tools):**
```
Type: CNAME
Name: @
Value: [YOUR-REPLIT-DEPLOYMENT-URL].replit.app
```

**For WWW Subdomain (www.bookd.tools):**
```
Type: CNAME
Name: www
Value: [YOUR-REPLIT-DEPLOYMENT-URL].replit.app
```

### Finding Your Replit Deployment URL

1. Go to your Replit workspace
2. Click the "Deploy" tab
3. Look for your deployment URL - it will be something like:
   - `workspace-haleylilla.replit.app` (current development)
   - Or your actual deployment URL when you deploy

### Step-by-Step Instructions for Squarespace

1. **Log into Squarespace**
2. **Go to Settings > Domains**
3. **Click on bookd.tools**
4. **Find "DNS Settings" or "Advanced DNS"**
5. **Add these two CNAME records:**
   - **Record 1:**
     - Type: CNAME
     - Host/Name: @ (or leave blank for root domain)
     - Value: [your-replit-deployment-url].replit.app
   - **Record 2:**
     - Type: CNAME
     - Host/Name: www
     - Value: [your-replit-deployment-url].replit.app

### Configuration Completed in Your App

✅ **Domain Settings Updated:**
- `replit.toml` configured for `bookd.tools` and `www.bookd.tools`
- Cookie domains updated to `.bookd.tools` for proper session handling
- Authentication system ready for the new domain

### Expected Result

After DNS propagation (15 minutes to 2 hours):
- Users type `bookd.tools` → see `bookd.tools` in their browser
- Users type `www.bookd.tools` → see `www.bookd.tools` in their browser
- No more redirects showing Replit URLs
- SSL certificate automatically provided by Replit

### Next Steps

1. **Deploy your app** from Replit (if not already done)
2. **Get your deployment URL** from the Replit deploy tab
3. **Add the DNS records** to Squarespace using the deployment URL
4. **Wait for DNS propagation** (15 minutes to 2 hours)
5. **Test** by visiting `bookd.tools` in a private/incognito window

### Troubleshooting

**If it's still not working after 2 hours:**
- Double-check the CNAME values match your exact deployment URL
- Try clearing your browser cache or use incognito mode
- Contact Squarespace support to confirm the DNS records are correct

**DNS Propagation Check:**
- Use tools like `https://dnschecker.org` to verify your CNAME records are live

---

**Status:** Ready for DNS configuration
**Next Action:** Add CNAME records to Squarespace DNS settings