# Giggy Platform Custom Domain Setup

## Prerequisites
- Domain name purchased from registrar (Namecheap, GoDaddy, etc.)
- Replit account with deployment access

## Deployment Steps

### 1. Deploy to Replit Hosting
1. Click "Deploy" button in Replit interface
2. Select "Autoscale Deployment" 
3. Configure deployment settings:
   - Build: `npm run build`
   - Run: `npm start`
   - Port: 5000

### 2. Add Custom Domain
1. Access deployment dashboard
2. Navigate to "Domains" section
3. Click "Add Custom Domain"
4. Enter your domain (e.g., giggy.app)

### 3. Configure DNS Records
At your domain registrar, add these DNS records:

**Root Domain (giggy.app):**
- Type: A Record
- Name: @
- Value: [IP provided by Replit]

**WWW Subdomain (www.giggy.app):**
- Type: CNAME
- Name: www
- Value: [Replit deployment URL]

### 4. Enable HTTPS
Replit automatically provides SSL certificates for custom domains.
Wait 10-15 minutes for DNS propagation.

### 5. Test Your Domain
- Visit your custom domain
- Verify all features work:
  - User authentication
  - Admin dashboard at /admin
  - API endpoints
  - Database connections

## Domain Suggestions
- giggy.app
- usegiggy.com
- giggyplatform.com
- mygiggy.io

## Benefits of Custom Domain
- Professional appearance
- Better SEO
- Custom email addresses
- Brand recognition
- SSL certificate included