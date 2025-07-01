# Bookd Domain Deployment Guide

## Custom Domain: bookdtools.com

### Domain Configuration Completed ✅

The app has been configured for deployment to your custom domain `bookdtools.com` with the following settings:

#### 1. Replit Domain Configuration
- Added `bookdtools.com` to `replit.toml` for automatic domain binding
- Configured for autoscale deployment target

#### 2. Cookie Domain Settings
- Production cookies set to `.bookdtools.com` for subdomain compatibility
- Secure cookie settings for HTTPS deployment
- 30-day session persistence maintained

#### 3. Authentication Ready
- Domain-aware cookie handling for production environment
- Secure session management across potential subdomains
- Logout properly clears domain-specific cookies

### Deployment Steps

#### Step 1: Deploy from Replit
1. Click the **Deploy** button in your Replit workspace
2. Select **Autoscale** deployment (already configured)
3. Confirm domain settings show `bookdtools.com`

#### Step 2: DNS Configuration
Configure these DNS records with your domain registrar:

**For main domain (bookdtools.com):**
```
Type: CNAME
Name: @
Value: your-replit-deployment-url.replit.app
```

**For www subdomain:**
```
Type: CNAME  
Name: www
Value: your-replit-deployment-url.replit.app
```

#### Step 3: SSL Certificate
- Replit automatically provides SSL certificates for custom domains
- HTTPS will be available within 24 hours of deployment
- All HTTP traffic automatically redirects to HTTPS

### Future Landing Page Setup

When you're ready to create a separate landing page:

#### Option A: Subdomain for App
- Move app to `app.bookdtools.com`
- Create landing page at `bookdtools.com`
- Update cookie domain to `.bookdtools.com` (already configured)

#### Option B: Path-based Routing
- Landing page at `bookdtools.com/`
- App accessible at `bookdtools.com/app`
- Single deployment with route handling

### Production Environment Variables

Ensure these are set in your Replit deployment:
- `NODE_ENV=production` (automatically set)
- `DATABASE_URL` (your PostgreSQL connection)
- `SESSION_SECRET` (secure random string)
- Any API keys for Google Maps, etc.

### Post-Deployment Verification

After deployment, verify:
1. **Domain Access**: Navigate to `https://bookdtools.com`
2. **Authentication**: Test login/logout functionality
3. **Session Persistence**: Verify 30-day sessions work
4. **Mobile Compatibility**: Test on various devices
5. **SSL Certificate**: Confirm HTTPS with valid certificate

### Monitoring & Maintenance

- Admin dashboard available at `https://bookdtools.com/admin`
- System health monitoring built-in
- User analytics and activity tracking ready
- Database backup recommendations in place

### Support Notes

- All authentication cookies properly scoped to domain
- Mobile-first design optimized for production
- Professional PDF reports ready for user download
- Complete financial tracking system operational

---

**Status**: Ready for deployment to `bookdtools.com`
**Next Step**: Click Deploy button in Replit workspace