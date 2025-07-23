# Authentication Consistency Guide

## CRITICAL: Preventing Data Access Failures

This guide ensures that authentication changes never break user data access.

## Root Cause Analysis
The recent data access failure occurred because:
1. Authentication middleware set user ID in `req.userId`
2. Route handlers expected user ID in `req.session.userId`
3. This mismatch caused all API calls to fail silently

## Prevention Strategy

### 1. Single Source of Truth
- **ALWAYS** use `req.userId` for authenticated user ID
- **NEVER** use `req.session.userId` in route handlers
- The `requireAuth` middleware sets `req.userId` - all routes must use this

### 2. Automated Testing Protocol
Before deploying any authentication changes:

```bash
# Test authentication flow
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test data access (save cookie from login)
curl -X GET http://localhost:5000/api/gigs \
  -H "Cookie: sessionId=COOKIE_FROM_LOGIN"

# Test user data
curl -X GET http://localhost:5000/api/user \
  -H "Cookie: sessionId=COOKIE_FROM_LOGIN"
```

### 3. Code Review Checklist
Before ANY authentication changes:
- [ ] Verify `requireAuth` middleware sets `req.userId`
- [ ] Verify ALL routes use `req.userId` (not `req.session.userId`)
- [ ] Test login -> gig data access flow
- [ ] Test with existing user account
- [ ] Verify no authentication errors in console

### 4. Production Safety Protocol
1. **Never change authentication patterns without testing**
2. **Always test with real user data before deploying**
3. **Keep authentication middleware and routes in sync**
4. **Test the complete user flow: login -> dashboard -> data display**

## Current Authentication Pattern (DO NOT CHANGE)
```javascript
// Middleware sets req.userId
export function requireAuth(req, res, next) {
  // ... validation logic ...
  req.userId = session.userId;  // ✅ CORRECT
  next();
}

// Routes use req.userId
app.get('/api/gigs', requireAuth, async (req, res) => {
  const gigs = await storage.getGigsByUser(req.userId);  // ✅ CORRECT
  res.json(gigs);
});
```

## FORBIDDEN Patterns
```javascript
// ❌ NEVER DO THIS - will break user data access
app.get('/api/gigs', requireAuth, async (req, res) => {
  const gigs = await storage.getGigsByUser(req.session.userId);  // ❌ WRONG
  res.json(gigs);
});
```

## Emergency Recovery
If authentication breaks:
1. Check `requireAuth` middleware in `server/unified-auth.ts`
2. Verify it sets `req.userId`
3. Search for `req.session.userId` in `server/routes.ts`
4. Replace ALL instances with `req.userId`
5. Test immediately with real user account

## File Locations to Monitor
- `server/unified-auth.ts` - Authentication middleware
- `server/routes.ts` - All API routes
- These files MUST stay in sync regarding user ID access pattern