# Bookd.tools Domain Setup Guide

## Step-by-Step Domain Connection Process

### **Step 1: Initiate Domain Connection in Replit**

1. **Access Your Replit Workspace**
   - Go to your Replit workspace where Bookd is hosted
   - Navigate to the "Deployments" tab in the sidebar

2. **Start Custom Domain Setup**
   - Click on "Deploy" (blue button)
   - Select "Custom Domain" option
   - Enter your domain: `bookd.tools`

3. **Generate DNS Records**
   - Replit will generate your unique IP address and TXT verification record
   - You'll receive something like:
     ```
     A Record (for @): 216.24.57.X
     TXT Record: replit-domain-verification=abc123...
     ```
   - **Important**: Use the SAME IP address for both @ and www records

### **Step 2: Configure DNS Records with Squarespace**

After Replit generates your records, configure these in Squarespace:

#### **A Records (Required)**
1. **Root Domain (@)**
   - Type: A
   - Host: @
   - Value: [IP address from Replit]
   - TTL: 300 (5 minutes)

2. **WWW Subdomain** (YOU NEED TO ADD THIS MANUALLY)
   - Type: A
   - Host: www
   - Value: [SAME IP address from Replit]
   - TTL: 300 (5 minutes)

**Note**: Replit only shows you one IP address, but you need to create TWO A records using the same IP - one for @ and one for www.

#### **TXT Verification Record (Required)**
- Type: TXT
- Host: @
- Value: [TXT verification string from Replit]
- TTL: 300 (5 minutes)

### **Step 3: Complete Domain Verification**

1. **Wait for DNS Propagation**
   - DNS changes take 5-60 minutes to propagate
   - You can check propagation status using tools like whatsmydns.net

2. **Verify in Replit**
   - Return to your Replit deployment settings
   - Click "Verify Domain" button
   - Replit will confirm the DNS records are properly configured

3. **Deploy to Custom Domain**
   - Once verified, click "Deploy"
   - Your app will be accessible at `https://bookd.tools`

### **Step 4: Update Application Configuration**

The app is already configured for the bookd.tools domain with:
- Secure cookie settings for `.bookd.tools`
- HTTPS-ready authentication
- 30-day session persistence
- Mobile-optimized design

### **Step 5: Post-Deployment Testing**

After deployment, verify:
1. **Domain Access**: `https://bookd.tools` loads correctly
2. **WWW Redirect**: `https://www.bookd.tools` redirects to main domain
3. **Authentication**: Login/logout works properly
4. **Mobile Compatibility**: Test on your phone
5. **SSL Certificate**: Confirm HTTPS is active

### **Expected Timeline**

- **DNS Configuration**: 5-10 minutes
- **DNS Propagation**: 5-60 minutes  
- **SSL Certificate**: 1-24 hours
- **Full Functionality**: Within 2 hours

### **Troubleshooting Common Issues**

#### **"Domain Not Verified" Error**
- Check DNS propagation using online tools
- Ensure TXT record is exactly as provided by Replit
- Wait additional time for DNS propagation

#### **"SSL Certificate Pending"**
- Normal for first 24 hours after domain verification
- HTTP will redirect to HTTPS once certificate is issued
- No action needed - automatic process

#### **Authentication Issues**
- Clear browser cache and cookies
- Try incognito/private browsing mode
- Check that cookies are enabled

### **Current Status**

✅ **Application**: Ready for custom domain deployment  
✅ **DNS Configuration**: Prepared for bookd.tools  
✅ **SSL Support**: Automatic certificate generation  
✅ **Mobile Optimization**: Fully responsive design  
⏳ **Domain Connection**: Waiting for Replit setup initiation  

### **Next Steps**

1. **Initiate domain connection in Replit Deployments**
2. **Copy the generated IP address and TXT record**
3. **Configure DNS records in Squarespace**
4. **Verify domain in Replit**
5. **Deploy to custom domain**

### **Important Notes**

- **Current URL**: `giggy-platform-haleylilla.replit.app` (internal development URL)
- **Target URL**: `https://bookd.tools` (production URL)
- **DNS Provider**: Squarespace (your domain registrar)
- **Deployment Platform**: Replit Autoscale

Once you initiate the domain connection in Replit, you'll get the specific IP address and TXT record that Squarespace needs for the DNS configuration.