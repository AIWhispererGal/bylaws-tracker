# Fix: Documents Not Loading on Dashboard

## Problem Summary

Documents were not displaying on the dashboard despite correct document counts showing in stats. The symptoms were:

1. ✅ Document count showing correctly (e.g., "5 documents")
2. ✅ Section count showing correctly
3. ❌ Documents table showing loading spinner forever
4. ❌ Console showing: "No JWT in session - using anonymous access"
5. ❌ RLS policies blocking document queries

## Root Cause

**Session persistence issue causing JWT authentication to fail**

The login flow stored the JWT in the session:

```javascript
req.session.supabaseJWT = authData.session.access_token;
req.session.supabaseRefreshToken = authData.session.refresh_token;
```

BUT the response was sent immediately without explicitly saving the session:

```javascript
res.json({ success: true, redirectTo: '/dashboard' });
```

With `saveUninitialized: false` in session config, the session wasn't guaranteed to persist before the client-side redirect occurred. This caused a race condition where:

1. User logs in → JWT stored in session
2. Server sends JSON response
3. Client-side JavaScript redirects (`window.location.href`)
4. **Session not yet saved to store**
5. Dashboard loads → No JWT in session → Anonymous access
6. RLS policies block document queries → Empty table

## Why Stats Worked But Documents Didn't

The `/api/dashboard/overview` endpoint uses `count: 'exact', head: true` which returns a count without fetching actual rows:

```javascript
const { count: docsCount } = await supabase
  .from('documents')
  .select('*', { count: 'exact', head: true })  // Only counts, doesn't fetch rows
  .eq('organization_id', orgId);
```

This bypassed some RLS checks or returned 0 gracefully, so stats appeared to work.

The `/api/dashboard/documents` endpoint fetches actual document rows:

```javascript
const { data: documents } = await supabase
  .from('documents')
  .select('*')  // Fetches actual rows
  .eq('organization_id', orgId);
```

Without JWT authentication, RLS policies blocked this query completely, returning empty array.

## The Fix

**Added explicit session save before response** in auth.js:

### 1. Login Handler (line 362-388)

```javascript
// CRITICAL FIX: Explicitly save session before sending response
// This ensures JWT is persisted before client-side redirect happens
req.session.save((saveErr) => {
  if (saveErr) {
    console.error('Error saving session:', saveErr);
    return res.status(500).json({
      success: false,
      error: 'Session save failed'
    });
  }

  res.json({
    success: true,
    message: 'Login successful',
    user: { ... },
    redirectTo: '/dashboard'
  });
});
```

### 2. Organization Selection Handler (line 787-803)

```javascript
// Save session before responding (ensures persistence before client redirect)
req.session.save((saveErr) => {
  if (saveErr) {
    console.error('Error saving session:', saveErr);
    return res.status(500).json({
      success: false,
      error: 'Session save failed'
    });
  }

  res.json({
    success: true,
    message: `Switched to ${org.name}`,
    organizationId: org.id,
    organizationName: org.name
  });
});
```

## How RLS Policies Work

The documents table has RLS policies that check user authentication:

```sql
CREATE POLICY "Users see own organization documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- ⚠️ Requires JWT authentication!
      AND is_active = true
    )
  );
```

- `auth.uid()` returns the authenticated user's ID from JWT
- Without JWT → `auth.uid()` returns NULL
- Policy blocks query → Empty results

## Testing the Fix

### 1. Clear Browser Data
```bash
# Clear cookies and localStorage
# Or use Incognito/Private window
```

### 2. Test Login Flow
1. Go to login page: `/auth/login`
2. Enter credentials
3. Submit form
4. **Check browser console** - should NOT see "No JWT in session"
5. Dashboard should load with documents visible

### 3. Test Organization Switching
1. Go to organization selector: `/auth/select`
2. Click on different organization
3. Dashboard should load immediately with documents

### 4. Verify JWT in Session
Open browser console and run:
```javascript
fetch('/auth/session')
  .then(r => r.json())
  .then(data => console.log('Session:', data));
```

Should show:
```json
{
  "success": true,
  "authenticated": true,
  "user": { "id": "...", "email": "..." },
  "session": { "expiresAt": ..., "expiresIn": 3600 }
}
```

### 5. Check Server Logs
Should see:
```
[MIDDLEWARE] Creating authenticated Supabase client for user: user@example.com
[MIDDLEWARE] JWT valid until: 2025-01-13T...
```

Should NOT see:
```
No JWT in session - using anonymous access
```

## Database Diagnostic Queries

Run these in Supabase SQL Editor to verify data exists:

```sql
-- Check if user has JWT session
SELECT
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
WHERE email = 'mgallagh@gmail.com';

-- Check user-organization link
SELECT
    uo.user_id,
    uo.organization_id,
    uo.role,
    uo.is_active,
    o.name as org_name
FROM user_organizations uo
JOIN organizations o ON uo.organization_id = o.id
WHERE uo.user_id = '7193f7ad-2f86-4e13-af61-102de9e208de';

-- Check documents for organization
SELECT
    d.id,
    d.title,
    d.document_type,
    d.created_at,
    (SELECT COUNT(*) FROM document_sections WHERE document_id = d.id) as section_count
FROM documents d
WHERE d.organization_id = '23176b14-8597-41ba-a99d-f2e13bd8ead7'
ORDER BY d.created_at DESC;
```

## Expected Behavior After Fix

1. ✅ Login stores JWT in session
2. ✅ Session saved before response
3. ✅ Client redirect happens AFTER session persisted
4. ✅ Dashboard loads with JWT authentication
5. ✅ RLS policies pass auth check
6. ✅ Documents query succeeds
7. ✅ Documents table populates with data

## Files Modified

1. **src/routes/auth.js**
   - Line 362-388: Login handler with session.save()
   - Line 787-803: Organization selection with session.save()

2. **database/tests/diagnose_documents_loading.sql** (NEW)
   - Diagnostic queries to verify data and RLS policies

## Related Issues Fixed Previously

1. ✅ Missing `is_active` column in user_organizations
2. ✅ Missing `rememberMe` in login validation
3. ✅ Missing GET routes for /auth/login and /auth/register
4. ✅ Client-side redirect using fetch instead of form.submit()
5. ✅ Landing page with login button
6. ✅ Organization selection page improvements

## Deployment Instructions

1. Pull latest changes
2. Restart server (session middleware needs reload)
3. Clear all existing sessions (users need to re-login)
4. Test login flow end-to-end
5. Monitor server logs for JWT authentication messages

## Technical Notes

- Express-session with `saveUninitialized: false` requires explicit save
- Client-side redirects create race conditions without explicit save
- RLS policies depend on JWT authentication context
- `auth.uid()` returns NULL for anonymous clients
- Service role client bypasses RLS (used for stats counting)
- Authenticated client respects RLS (used for data fetching)

## Success Criteria

✅ Documents display on dashboard after login
✅ No "anonymous access" console messages
✅ JWT session persists across page loads
✅ Organization switching works instantly
✅ All RLS policies pass with proper auth

---

**Status:** FIXED - Session persistence issue resolved with explicit save before response
**Date:** 2025-01-13
**Session:** Continued from previous authentication implementation
