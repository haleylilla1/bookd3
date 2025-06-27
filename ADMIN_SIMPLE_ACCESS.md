# Simple Admin Dashboard Access

## Quick Browser Setup

### Step 1: Install Browser Extension
Install one of these browser extensions:
- **Chrome/Edge**: "ModHeader" or "Header Editor"
- **Firefox**: "Modify Header Value"

### Step 2: Add Admin Header
In the extension, add this header:
```
Header Name: X-Admin-Key
Header Value: giggy-admin-2025
```

### Step 3: Access Dashboard
Navigate to: `/admin`

**Example URLs:**
- Development: `http://localhost:5000/admin`
- Production: `https://your-domain.com/admin`

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

## Browser Developer Tools Method
If you don't want to install an extension:

1. Open Developer Tools (F12)
2. Go to Network tab
3. Visit the admin URL (will show "Not Found")
4. Right-click the request → "Edit and Resend"
5. Add header: `X-Admin-Key: giggy-admin-2025`
6. Send request

## Troubleshooting
- **"Not Found" error**: Header not set correctly
- **Data not loading**: Check browser console for errors
- **Dashboard blank**: Verify admin endpoints are accessible

---
**Security Note**: Keep the admin key secure and never share publicly.