# Admin Access Fix - Complete Guide

## 🐛 The Problem

Users were getting **403 Access Denied** when trying to access `/admin/organization` even though they were the first user to create the organization and should automatically be an admin.

### Root Cause

The login flow in `/src/routes/auth.js` was **NOT setting `req.session.isAdmin`** based on the user's role in the database. The middleware checked for this flag, but it was never being set!

---

## ✅ The Fix

### 1. Updated Login Flow (`/src/routes/auth.js`)

**Lines 361-375:** Added automatic admin status detection during login:

```javascript
// If user has organizations, set the first one as default
if (userOrgs && userOrgs.length > 0) {
  const defaultOrg = userOrgs[0];
  req.session.organizationId = defaultOrg.organization_id;
  req.session.organizationName = defaultOrg.organizations.name;
  req.session.userRole = defaultOrg.role;
  req.session.isConfigured = true;

  // CRITICAL FIX: Set admin status based on role
  req.session.isAdmin = ['owner', 'admin'].includes(defaultOrg.role);
}

// Check if user is a global admin (can access any organization)
const { data: globalAdminCheck } = await supabaseService
  .from('user_organizations')
  .select('is_global_admin')
  .eq('user_id', authData.user.id)
  .eq('is_global_admin', true)
  .eq('is_active', true)
  .limit(1)
  .maybeSingle();

req.session.isGlobalAdmin = !!globalAdminCheck;
```

### 2. Updated Organization Selection (`/src/routes/auth.js`)

**Lines 797-820:** Added admin status check when switching organizations:

```javascript
// Get user's role in this organization
let userRole = 'member';
let isAdmin = false;
if (req.session.userId) {
  const { data: userOrg } = await supabaseService
    .from('user_organizations')
    .select('role')
    .eq('user_id', req.session.userId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single();

  if (userOrg) {
    userRole = userOrg.role;
    isAdmin = ['owner', 'admin'].includes(userOrg.role);
  }
}

// Set organization in session
req.session.organizationId = organizationId;
req.session.organizationName = org.name;
req.session.userRole = userRole;
req.session.isAdmin = isAdmin;
req.session.isConfigured = true;
```

### 3. Database Fix Script

**Created:** `/database/migrations/010_fix_first_user_admin.sql`

This script automatically makes the first user of each organization an 'owner' with admin privileges:

```sql
-- Update the first user (by joined_at) of each organization to be 'owner'
WITH first_users AS (
  SELECT DISTINCT ON (organization_id)
    user_id,
    organization_id
  FROM user_organizations
  WHERE is_active = true
  ORDER BY organization_id, joined_at ASC
)
UPDATE user_organizations uo
SET
  role = 'owner',
  is_admin = true,
  updated_at = NOW()
FROM first_users fu
WHERE uo.user_id = fu.user_id
  AND uo.organization_id = fu.organization_id
  AND uo.role NOT IN ('owner');
```

---

## 🚀 Deployment Steps

### Step 1: Run the Database Migration

```bash
# Option A: Via psql
psql -U your_user -d your_database -f database/migrations/010_fix_first_user_admin.sql

# Option B: Via Supabase SQL Editor
# Copy contents of 010_fix_first_user_admin.sql and run in Supabase dashboard
```

### Step 2: Restart the Server

```bash
# The code changes are already in auth.js
npm start
```

### Step 3: Clear Your Session and Re-login

```bash
# In browser console:
fetch('/auth/logout', { method: 'POST' })
  .then(() => window.location.href = '/auth/login');
```

Then log back in with your credentials.

---

## ✅ Verification

### Test Admin Access:

1. **Navigate to:** `http://localhost:3000/admin/organization`
2. **Expected:** Page loads successfully showing organization settings
3. **Previously:** 403 Access Denied error

### Check Session Status:

```javascript
// In browser console:
fetch('/auth/session')
  .then(r => r.json())
  .then(console.log);

// Should show:
// {
//   "success": true,
//   "authenticated": true,
//   "user": { ... },
//   "organization": {
//     "role": "owner",  // or "admin"
//     ...
//   }
// }
```

### Verify Database:

```sql
-- Check your user's role
SELECT
  u.email,
  o.name as org_name,
  uo.role,
  uo.is_admin,
  uo.joined_at
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
WHERE u.email = 'your-email@example.com';

-- Should show role = 'owner' or 'admin' and is_admin = true
```

---

## 🎯 How It Works Now

### Login Flow:
1. User logs in with email/password
2. System fetches user's organizations from `user_organizations` table
3. **NEW:** Checks user's `role` in each organization
4. **NEW:** Sets `req.session.isAdmin = true` if role is 'owner' or 'admin'
5. **NEW:** Checks for `is_global_admin = true` flag
6. User is redirected to dashboard with proper permissions

### Organization Switching:
1. User selects an organization from `/auth/select`
2. **NEW:** System looks up user's role in that specific organization
3. **NEW:** Sets `req.session.isAdmin` based on that organization's role
4. Session is saved and user is redirected

### Admin Middleware Check:
1. User navigates to `/admin/*` route
2. Middleware checks `req.session.isAdmin`
3. ✅ If true: Allow access
4. ❌ If false: Show 403 error page

---

## 📋 Role Hierarchy

| Role | Admin Access | Can Add Users | Can Edit Org | Description |
|------|--------------|---------------|--------------|-------------|
| **owner** | ✅ Yes | ✅ Yes | ✅ Yes | Full control, first user |
| **admin** | ✅ Yes | ✅ Yes | ✅ Yes | Administrative access |
| **member** | ❌ No | ❌ No | ❌ No | Can suggest changes only |
| **viewer** | ❌ No | ❌ No | ❌ No | Read-only access |

---

## 🔐 Security Notes

1. **Role is checked TWICE:**
   - At login (stored in session)
   - At route access (middleware checks session)

2. **Database is source of truth:**
   - Session reflects database role
   - Changing role in DB requires re-login

3. **Organization-specific:**
   - Users can be admin in ORG A but member in ORG B
   - `isAdmin` flag updates when switching orgs

4. **Global Admin Override:**
   - `is_global_admin = true` users can access ALL organizations
   - Stored separately in `req.session.isGlobalAdmin`

---

## 🐛 Troubleshooting

### Still Getting 403?

**Check 1: Is your role correct in the database?**
```sql
SELECT role, is_admin FROM user_organizations
WHERE user_id = 'YOUR_USER_ID'
AND organization_id = 'YOUR_ORG_ID';
```

**Check 2: Did you log out and back in after the fix?**
```bash
# Clear session completely
curl -X POST http://localhost:3000/auth/logout
```

**Check 3: Is the session being set?**
```javascript
// Add console.log in auth.js after line 362:
console.log('Setting isAdmin to:', req.session.isAdmin);
console.log('User role:', defaultOrg.role);
```

**Check 4: Run the database migration**
```bash
psql -U user -d database -f database/migrations/010_fix_first_user_admin.sql
```

### Wrong User Has Admin Access?

The migration makes the **first user by `joined_at`** an owner. If that's the wrong user:

```sql
-- Manually set admin for specific user
UPDATE user_organizations
SET role = 'owner', is_admin = true
WHERE user_id = 'CORRECT_USER_ID'
AND organization_id = 'YOUR_ORG_ID';

-- Remove admin from wrong user
UPDATE user_organizations
SET role = 'member', is_admin = false
WHERE user_id = 'WRONG_USER_ID'
AND organization_id = 'YOUR_ORG_ID';
```

---

## 📚 Related Files

- `/src/routes/auth.js` - Login and organization selection (MODIFIED)
- `/src/routes/admin.js` - Admin routes with requireAdmin middleware
- `/database/migrations/010_fix_first_user_admin.sql` - Database fix (NEW)
- `/views/error.ejs` - Error page template (CREATED)

---

## ✅ Summary

**What was broken:**
- `req.session.isAdmin` was never being set during login
- First users weren't automatically made owners/admins
- Users couldn't access `/admin/*` routes even with correct DB roles

**What was fixed:**
- Login flow now checks user role and sets `req.session.isAdmin`
- Organization switching updates admin status per-org
- Migration script fixes existing first users
- Global admin detection added

**How to verify:**
1. Run migration: `010_fix_first_user_admin.sql`
2. Restart server
3. Log out and log back in
4. Navigate to `/admin/organization`
5. ✅ Should load successfully!

---

**Status:** ✅ COMPLETE
**Deployment Risk:** LOW (non-breaking changes)
**Requires:** Database migration + server restart + user re-login
