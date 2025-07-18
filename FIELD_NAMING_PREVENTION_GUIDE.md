# FIELD NAMING PREVENTION SYSTEM
## Critical Prevention Guide for Database Field Mapping Issues

### PROBLEM THAT WAS SOLVED
- API endpoints `/api/user` and `/api/gigs` were returning empty objects `{}`
- Root cause: Cache was storing empty objects due to field mapping inconsistencies
- Database uses snake_case (`user_id`) but some queries expected camelCase mapping
- This caused 33 gigs and user data to be inaccessible despite existing in database

### PREVENTION RULES

#### 1. Schema Consistency Rule
**ALWAYS** ensure Drizzle schema matches database queries:
```typescript
// In shared/schema.ts - CORRECT pattern
export const gigs = pgTable("gigs", {
  userId: integer("user_id").notNull(), // camelCase field → snake_case column
  gigType: text("gig_type").notNull(),
});

// In storage queries - MUST match schema field names
await db.select().from(gigs).where(eq(gigs.userId, userId)); // ✅ CORRECT
await db.select().from(gigs).where(eq(gigs.user_id, userId)); // ❌ WRONG
```

#### 2. Cache Validation Rule
**NEVER** allow empty objects to be cached:
```typescript
// In storage layer - CORRECT pattern
if (user) {
  await cache.set(cacheKey, user, 300); // Only cache valid data
}
```

#### 3. Authentication Consistency Rule
**ALWAYS** use consistent userId pattern:
```typescript
// In routes.ts - CORRECT pattern
function getUserId(req: any): number {
  if (!req.userId) {
    throw new Error('User not authenticated');
  }
  return req.userId;
}
```

### MONITORING COMMANDS

#### Check Field Mapping Health
```bash
# Verify database schema matches Drizzle definitions
node -e "
const { db } = require('./server/db.js');
const { gigs, users } = require('./shared/schema.js');
console.log('Schema check - if this runs without errors, mapping is correct');
db.select().from(gigs).limit(1).then(console.log);
"
```

#### Test Data Access for User
```bash
# Test specific user data access
curl -s 'http://localhost:5000/api/debug/gigs/14' | head -c 200
curl -s 'http://localhost:5000/api/user' -b /tmp/cookies.txt | head -c 100
curl -s 'http://localhost:5000/api/gigs' -b /tmp/cookies.txt | head -c 100
```

#### Clear Corrupted Cache
```bash
# Clear cache when data access issues occur
curl -s 'http://localhost:5000/api/cache/clear' -X POST -b /tmp/cookies.txt
```

### STARTUP VALIDATION
The server now automatically validates field mapping consistency on startup:
- Checks schema field names match database queries
- Warns if potential mismatches detected
- Logs validation results in startup console

### CRISIS RESOLUTION STEPS
If users report empty data (similar to this incident):

1. **Immediate**: Clear cache completely
2. **Debug**: Test direct storage layer access  
3. **Verify**: Check authentication is working (userId present)
4. **Fix**: Ensure schema field names match query field names
5. **Validate**: Test both cache-hit and cache-miss scenarios

### KEY LESSON
**"NEVER BUILD OVER-ENGINEERED GARBAGE"** - The cache was complex and stored invalid data. Simple, direct storage access revealed the real issue was field mapping inconsistency, not the storage layer itself.