# Authentication Flow Testing Guide

## Overview
This guide helps you verify that the Supabase authentication implementation is working correctly and documents are loading in the dashboard.

## Prerequisites
- Server running: `npm start`
- Supabase credentials configured in `.env`
- Setup wizard completed (or ready to complete)

## Test 1: Run Diagnostic Script

```bash
node tests/auth-diagnostic.js
```

**Expected Output:**
- ✅ Organizations found
- ✅ Documents found
- ✅ Auth users found
- ✅ User-organization mappings found
- ✅ Anonymous access blocked or returns empty

**If diagnostics fail:**
- Run setup wizard: http://localhost:3000/setup
- Check `.env` file for correct Supabase credentials

## Test 2: Complete Setup Flow

1. **Navigate to Setup**
   ```
   http://localhost:3000/setup
   ```

2. **Complete Organization Step**
   - Fill in organization details
   - Enter admin email and password
   - Submit form

   **Check server logs for:**
   ```
   [SETUP-AUTH] Creating Supabase Auth user for: your-email@example.com
   [SETUP-AUTH] Auth user created successfully: <user-id>
   ```

3. **Complete Remaining Steps**
   - Document structure
   - Workflow configuration
   - Document import (optional)

4. **Watch for Auto-Login**
   When you reach `/setup/success`, check server logs for:
   ```
   [SETUP-AUTH] Auto-logging in user: your-email@example.com
   [SETUP-AUTH] Successfully stored JWT tokens in session for: your-email@example.com
   [SETUP-AUTH] Session saved, redirecting to dashboard
   ```

## Test 3: Verify Session Contents

Add this middleware temporarily to `server.js` after line 163:

```javascript
// DEBUG: Log session contents
app.use((req, res, next) => {
  if (req.path === '/dashboard') {
    console.log('\n=== SESSION DEBUG ===');
    console.log('organizationId:', req.session.organizationId);
    console.log('userId:', req.session.userId);
    console.log('userEmail:', req.session.userEmail);
    console.log('supabaseJWT:', req.session.supabaseJWT ? 'Present (length: ' + req.session.supabaseJWT.length + ')' : 'Missing');
    console.log('supabaseRefreshToken:', req.session.supabaseRefreshToken ? 'Present' : 'Missing');
    console.log('isAuthenticated:', req.session.isAuthenticated);
    console.log('====================\n');
  }
  next();
});
```

**Expected Output when accessing /dashboard:**
```
=== SESSION DEBUG ===
organizationId: <uuid>
userId: <uuid>
userEmail: your-email@example.com
supabaseJWT: Present (length: 500+)
supabaseRefreshToken: Present
isAuthenticated: true
====================
```

## Test 4: Check Dashboard Loading

1. **Navigate to Dashboard**
   ```
   http://localhost:3000/dashboard
   ```

2. **Open Browser Developer Console**
   - Press F12
   - Go to Console tab
   - Check for errors

3. **Check Network Tab**
   - Look for `/dashboard/overview` request
   - Should return `200 OK`
   - Response should have `stats` with document counts

4. **Verify Documents Display**
   - Documents widget should show: "X Documents"
   - Sections widget should show: "X Active Sections"
   - If counts are 0, check if documents were imported during setup

## Test 5: Verify RLS is Working

### Test A: Check Authenticated Access
```javascript
// In browser console on /dashboard page:
fetch('/api/dashboard/documents')
  .then(r => r.json())
  .then(data => console.log('Authenticated:', data));
```

**Expected:** Documents array with data

### Test B: Test Anonymous Access (should fail)
```javascript
// In a new incognito window or after logging out:
fetch('/api/dashboard/documents')
  .then(r => r.json())
  .then(data => console.log('Anonymous:', data));
```

**Expected:** Empty array or error (RLS blocking access)

## Test 6: Check Supabase Logs

1. Go to Supabase Dashboard
2. Navigate to Logs → API Logs
3. Look for recent queries to `documents` table
4. Verify queries include `organization_id` filter
5. Check for authentication header: `Authorization: Bearer <jwt>`

## Troubleshooting

### Problem: No documents loading

**Check 1: Documents exist?**
```bash
node tests/auth-diagnostic.js
```

**Check 2: JWT in session?**
- Add debug middleware (Test 3)
- Verify `supabaseJWT` is present

**Check 3: RLS policies?**
```sql
-- In Supabase SQL Editor:
SELECT * FROM pg_policies
WHERE tablename = 'documents';
```

**Check 4: User-organization mapping?**
```sql
-- In Supabase SQL Editor:
SELECT * FROM user_organizations
WHERE user_id = '<your-user-id>';
```

### Problem: JWT token missing

**Solution:** Run setup wizard again
- Clear session: Delete cookies in browser
- Go to `/setup`
- Complete all steps
- JWT should be stored on success

### Problem: Anonymous access returns data

**Issue:** RLS policies may not be enabled

**Fix:**
1. Go to Supabase → Database → Tables
2. Select `documents` table
3. Enable RLS if disabled
4. Verify policies check `auth.uid()`

### Problem: "Token expired or invalid"

**Solution:** JWT tokens expire after 1 hour
- Server middleware auto-refreshes tokens
- Check server logs for refresh messages
- If refresh fails, log out and log back in

## Success Criteria

All tests should show:
- ✅ JWT tokens stored in session after setup
- ✅ Documents load in dashboard
- ✅ Server logs show authenticated Supabase client creation
- ✅ RLS blocks anonymous access
- ✅ User can see documents for their organization only

## Additional Monitoring

### Server Logs to Watch For

**Good Signs:**
```
[SETUP-AUTH] Successfully stored JWT tokens in session for: email
JWT refreshed successfully for user: email
Authenticated client created for user: <user-id>
```

**Warning Signs:**
```
JWT expired or invalid, attempting refresh...
Token refresh failed: <error>
No JWT in session - using anonymous access
Invalid JWT in session, clearing auth tokens
```

### Browser Console Checks

**Good Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "...",
      "title": "Organization Bylaws",
      "document_type": "bylaws"
    }
  ]
}
```

**Bad Response:**
```json
{
  "success": true,
  "documents": []
}
```
or
```json
{
  "success": false,
  "error": "Authentication required"
}
```

## Next Steps

Once authentication is working:
1. ✅ Documents load correctly
2. Consider building login/register UI for additional users
3. Implement user management dashboard
4. Add role-based access control
5. Enable user invitations for organizations

## Support

If tests fail, provide:
1. Diagnostic script output
2. Server logs (especially [SETUP-AUTH] messages)
3. Browser console errors
4. Session debug output
