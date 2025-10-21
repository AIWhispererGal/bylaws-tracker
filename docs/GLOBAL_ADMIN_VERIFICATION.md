# Global Admin Verification Guide

**User ID:** `7193f7ad-2f86-4e13-af61-102de9e208de`
**Organizations Linked:** 4
**Status:** ✅ Successfully configured

---

## Step 1: Verify Database Configuration

Run these queries in Supabase SQL Editor:

```sql
-- 1. Verify global admin flag is set
SELECT is_global_admin('7193f7ad-2f86-4e13-af61-102de9e208de'::uuid);
-- Expected: true

-- 2. Check user_organizations records
SELECT
  uo.organization_id,
  o.name as org_name,
  uo.role,
  uo.is_global_admin,
  uo.is_active,
  uo.permissions
FROM user_organizations uo
JOIN organizations o ON uo.organization_id = o.id
WHERE uo.user_id = '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid
ORDER BY o.name;
-- Expected: 4 rows, all with is_global_admin = true

-- 3. Verify RLS policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE policyname LIKE '%global_admin%'
ORDER BY tablename, policyname;
-- Expected: Multiple policies across documents, sections, organizations, suggestions, etc.

-- 4. Check policy audit (if migration 011 was run)
SELECT * FROM global_admin_policy_audit;
-- Expected: Shows comprehensive policy coverage
```

---

## Step 2: Test Application Access

### A. Logout and Login

**Important:** You MUST logout and login again for session to update.

```javascript
// In browser console on your app:
fetch('/auth/logout', { method: 'POST' })
  .then(() => window.location.href = '/auth/login');
```

Or just:
1. Navigate to your app
2. Logout manually
3. Login with the email associated with user ID `7193f7ad-2f86-4e13-af61-102de9e208de`

---

## Step 3: Verify Session Flags

After logging in, check the session:

```javascript
// In browser console:
fetch('/auth/session')
  .then(r => r.json())
  .then(data => {
    console.log('Session Data:', data);
    console.log('Is Global Admin:', data.isGlobalAdmin); // Should be true
  });
```

**Expected Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "7193f7ad-2f86-4e13-af61-102de9e208de",
    "email": "your-email@example.com",
    "name": "Your Name"
  },
  "organization": {
    "id": "...",
    "name": "...",
    "role": "superuser" // or "owner"
  },
  "session": {
    "expiresAt": "...",
    "expiresIn": ...
  }
}
```

---

## Step 4: Test Global Admin Access

### A. Organization Selection Page
Navigate to: `/auth/select`

**Expected:**
- Should see ALL 4 organizations
- Badge or indicator showing "Global Admin" mode
- Can switch between any organization

### B. Admin Dashboard
Navigate to: `/admin/dashboard`

**Expected:**
- ✅ Access granted (no 403 error)
- Shows all 4 organizations with statistics
- Each org shows:
  - Document count
  - Section count
  - Suggestion count
  - User count

**If you get 403:**
- Check: Did you logout and login?
- Check: Is server restarted? (`npm start`)
- Check: Browser console for errors

### C. Organization Management
Navigate to: `/admin/organization`

**Expected:**
- Lists all 4 organizations
- Can view/edit settings for any organization
- Access not restricted by membership

---

## Step 5: Test RLS Policies (Database Level)

Run these queries as the authenticated user (using JWT):

```sql
-- Test 1: Documents across all organizations
SELECT d.id, d.title, o.name as org_name
FROM documents d
JOIN organizations o ON d.organization_id = o.id
ORDER BY o.name, d.title;
-- Expected: See documents from ALL 4 organizations

-- Test 2: Suggestions across all organizations
SELECT s.id, s.suggested_text, o.name as org_name
FROM suggestions s
JOIN documents d ON s.document_id = d.id
JOIN organizations o ON d.organization_id = o.id
ORDER BY o.name, s.created_at DESC;
-- Expected: See suggestions from ALL 4 organizations

-- Test 3: Sections across all organizations
SELECT ds.id, ds.section_title, o.name as org_name
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
JOIN organizations o ON d.organization_id = o.id
ORDER BY o.name, ds.section_number;
-- Expected: See sections from ALL 4 organizations
```

---

## Step 6: Test Regular User Access (Comparison)

Create or login as a regular user (non-global-admin):

**Expected Behavior:**
- `/auth/select` - Shows only THEIR organizations
- `/admin/dashboard` - Returns 403 Forbidden
- Database queries - Filtered to ONLY their organizations

This confirms multi-tenant isolation is working correctly.

---

## Step 7: Verify Middleware Integration

Check server logs when accessing admin routes:

```bash
# In terminal where server is running:
# Look for logs showing:
# - attachGlobalAdminStatus middleware executing
# - req.isGlobalAdmin being set
# - Access granted to admin routes
```

Or check programmatically:

```javascript
// In browser console on admin dashboard:
console.log('Global Admin Status:',
  document.cookie.includes('connect.sid') // Session exists
);
```

---

## ✅ Success Checklist

- [ ] Database query confirms `is_global_admin('...')` returns `true`
- [ ] User_organizations table shows `is_global_admin = true` for all 4 orgs
- [ ] Logged out and logged back in
- [ ] Session shows authenticated and has organization
- [ ] Can access `/auth/select` and see all 4 organizations
- [ ] Can access `/admin/dashboard` without 403 error
- [ ] Admin dashboard shows statistics for all 4 organizations
- [ ] Can switch between organizations freely
- [ ] Database queries return data from all organizations
- [ ] Regular users still restricted to their own organizations

---

## 🐛 Troubleshooting

### Issue: 403 Forbidden on /admin/dashboard

**Check:**
1. Server restarted after code changes? (`npm start`)
2. Logged out and back in?
3. Middleware order in server.js correct?
4. Browser session cleared? (try incognito mode)

**Verify:**
```javascript
// Check if middleware is attached
fetch('/admin/dashboard')
  .then(r => {
    console.log('Status:', r.status);
    if (r.status === 403) console.error('Global admin check failed');
  });
```

### Issue: Only See Own Organizations

**Check:**
1. Database confirms `is_global_admin = true`?
2. Middleware properly sets `req.isGlobalAdmin`?
3. Session was refreshed after database change?

**Fix:**
- Force logout: Delete cookies manually
- Clear server session store if using file-based sessions
- Restart server

### Issue: RLS Policies Not Working

**Check:**
1. Was migration 011 run?
2. Are policies created for suggestions table?
3. Is `is_global_admin()` function defined?

**Verify:**
```sql
-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'is_global_admin';

-- Check policies for suggestions
SELECT policyname FROM pg_policies
WHERE tablename = 'suggestions' AND policyname LIKE '%global%';
```

---

## 📊 Expected Test Results

### Organization Access
- **Global Admin:** 4 organizations visible
- **Regular User:** Only their organizations visible

### Admin Dashboard
- **Global Admin:** ✅ Access granted, shows all org stats
- **Regular User:** ❌ 403 Forbidden

### Database Queries (with RLS)
- **Global Admin:** All organizations' data visible
- **Regular User:** Only their org's data visible

### Performance
- **First Load:** May be slightly slower (checking 4 orgs)
- **Cached:** Fast (database query caching)
- **No N+1 queries:** Proper JOIN queries used

---

## 🎯 Next Actions After Verification

Once verified working:

1. **Document Process** - Add to team wiki/docs
2. **Create Admin Guide** - For managing users/orgs
3. **Set Up Monitoring** - Track global admin actions
4. **Add Audit Logging** - Log global admin activities
5. **UI Enhancements** - Show global admin indicator
6. **Regular Audits** - Review global admin list monthly

---

## 🔒 Security Reminders

- Global admin access should be RARE (1-2 users max)
- Audit all global admin actions
- Require approval process for granting global admin
- Consider 2FA requirement for global admins
- Monitor for unauthorized privilege escalation attempts
- Regular security reviews of `user_organizations.is_global_admin` column

---

**Verification Complete When:** All checklist items marked ✅

**Status:** Ready for production use after verification passes.
