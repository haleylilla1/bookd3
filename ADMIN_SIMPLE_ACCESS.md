# Simple Admin Dashboard Access

## Quick URL Access (No Extensions Needed!)

### Step 1: Access Dashboard with Key
Simply navigate to the admin URL with the key parameter:

**Example URLs:**
- Development: `http://localhost:5000/admin?key=giggy-admin-2025`
- Production: `https://your-domain.com/admin?key=giggy-admin-2025`

### Step 2: Bookmark for Easy Access
Bookmark the URL above for one-click admin access anytime.

**That's it!** No browser extensions or complex setup required.

## What You'll See
✅ **System Health**: Server uptime, memory usage, status
✅ **Platform Analytics**: User counts, activity, error rates  
✅ **User Lookup**: Search users by email or ID (privacy-safe)
✅ **System Logs**: Recent activity and health messages

## Security Features
- Header-based authentication prevents unauthorized access
- Privacy-safe user data (no sensitive details exposed)
- Read-only access (cannot modify user data)
- Automatic 30-second refresh for real-time monitoring

## Alternative Access Methods
If the query parameter doesn't work for some reason, the old header method is still supported:

### Browser Extension Method (Backup)
1. Install "ModHeader" or "Header Editor" browser extension
2. Add header: `X-Admin-Key: giggy-admin-2025`
3. Visit: `/admin` (without query parameter)

## Troubleshooting
- **"Not Found" error**: Check the key parameter is correct
- **Data not loading**: Check browser console for errors  
- **Dashboard blank**: Verify URL includes `?key=giggy-admin-2025`

---
**Security Note**: Keep the admin key secure and never share publicly.