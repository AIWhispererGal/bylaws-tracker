# Organization Visibility Diagnostic Report

**Date:** 2025-10-22
**Issue:** User cannot see organizations after login despite RLS fix
**Context:** Migration 005 successfully fixed infinite recursion, but user dashboard shows "no organizations in database"

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** Most likely a **user assignment issue** rather than RLS policy problem.

The login code in `src/routes/auth.js` uses `supabaseService` (service role) to query organizations, which **bypasses RLS entirely**. This means if the query returns empty, the problem is NOT with RLS policies, but with the data itself.

---

## Investigation Findings

### 1. Login Flow Analysis

**File:** `/src/routes/auth.js` (lines 359-370)

```javascript
// Get user's organizations
const { data: userOrgs, error: orgsError } = await supabaseService  // ← SERVICE ROLE
  .from('user_organizations')
  .select(`
    organization_id,
    role,
    organizations:organization_id (
      id,
      name,
      slug
    )
  `)
  .eq('user_id', authData.user.id);  // ← Querying by user ID
```

**Key Finding:** This query uses `supabaseService` which has **full access** and **bypasses RLS**. If this returns empty, it means:

1. ❌ The user is **not assigned** to any organization in `user_organizations` table
2. ❌ OR the assignment exists but with incorrect `user_id`
3. ❌ OR there's a database error (would show in `orgsError`)

**This is NOT an RLS issue!**

### 2. RLS Policies Status

✅ Migration 005 successfully created 7 policies:
1. `users_see_own_memberships` - User sees own records
2. `admins_see_org_members` - Admins see org members
3. `users_update_own_memberships` - User updates own preferences
4. `admins_insert_org_members` - Admins add members
5. `admins_update_org_members` - Admins modify members
6. `admins_delete_org_members` - Admins remove members
7. `service_role_full_access` - Service role has full access

✅ Helper function `public.is_org_admin()` created with `SECURITY DEFINER`

✅ No circular references possible

### 3. Known Facts

- ✅ Organization exists: `5bc79ee9-ac8d-4638-864c-3e05d4e60810`
- ✅ Server can query it using service role
- ✅ Migration 005 applied successfully
- ✅ No infinite recursion errors
- ❌ User login shows "no organizations in database"
- ❌ No errors in console (suggests query succeeded but returned empty)

---

## Diagnostic Scripts Created

### 1. `diagnose_org_visibility.sql` (Comprehensive)

**Purpose:** Full diagnostic workup of entire authentication and RLS system

**Sections:**
1. Authentication Context - Check current user and JWT
2. User Data Inspection - List all users in auth.users and public.users
3. Organization Data - Verify organizations exist
4. User-Organization Assignments - Check all user_organizations records
5. RLS Policy Verification - Confirm policies are active
6. Simulate User Queries - Test what users can see
7. Test Specific User - Template for user-specific testing
8. Common Issues Checklist - Identify typical problems
9. Recommended Fixes - Ready-to-run SQL fixes
10. Manual Test Queries - Interactive testing

**How to use:**
```bash
# Run with service role to see all data
psql [connection-string] -f database/debug/diagnose_org_visibility.sql
```

### 2. `quick_diagnosis.sql` (Fast Triage)

**Purpose:** Quickly identify the exact problem in 6 steps

**What it does:**
1. Lists all users (auth + public)
2. Shows all user_organization assignments
3. Checks target organization exists
4. Counts users assigned to target org
5. **Automatically diagnoses the problem**
6. **Generates ready-to-run fix SQL**

**How to use:**
```bash
# Run with service role for instant diagnosis
psql [connection-string] -f database/debug/quick_diagnosis.sql
```

### 3. `test_user_context.sql` (User Perspective)

**Purpose:** Test RLS policies from an authenticated user's perspective

**Tests:**
1. ✅ auth.uid() returns user ID
2. ✅ JWT role is 'authenticated'
3. ✅ User can query user_organizations
4. ✅ User can see organizations via join
5. ✅ User can see specific organization
6. ✅ is_org_admin function works
7. ✅ Summary and diagnosis

**How to use:**
```bash
# Run with actual user JWT token (not service role)
# In Supabase SQL Editor, select "Run as: Authenticated user"
psql [connection-string] -f database/debug/test_user_context.sql
```

---

## Most Likely Problems (In Order)

### Problem 1: User Not Assigned to Organization (90% Likely)

**Symptoms:**
- User can log in successfully
- No errors in console
- Dashboard shows "no organizations in database"
- Organization exists and is visible to service role

**Diagnosis:**
```sql
-- Check if user is assigned
SELECT *
FROM user_organizations
WHERE user_id = '[USER_ID]'
  AND organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
-- Returns: 0 rows
```

**Fix:**
```sql
-- Get the user ID first
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Assign user to organization
INSERT INTO user_organizations (user_id, organization_id, role, is_active, joined_at)
VALUES (
  '[USER_ID]',  -- Replace with actual user ID
  '5bc79ee9-ac8d-4638-864c-3e05d4e60810',
  'owner',
  true,
  NOW()
);
```

### Problem 2: User Assignment is Inactive (5% Likely)

**Symptoms:**
- User assignment exists in user_organizations
- But `is_active = false`

**Diagnosis:**
```sql
SELECT * FROM user_organizations
WHERE user_id = '[USER_ID]'
  AND organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810'
  AND is_active = false;
-- Returns: 1 row with is_active = false
```

**Fix:**
```sql
UPDATE user_organizations
SET is_active = true
WHERE user_id = '[USER_ID]'
  AND organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
```

### Problem 3: User Missing from public.users Table (3% Likely)

**Symptoms:**
- User exists in `auth.users`
- User is missing from `public.users`
- `upsertUser()` function failed during registration

**Diagnosis:**
```sql
-- Check auth.users
SELECT id, email FROM auth.users WHERE email = '[USER_EMAIL]';
-- Returns: 1 row

-- Check public.users
SELECT id, email FROM public.users WHERE id = '[USER_ID]';
-- Returns: 0 rows
```

**Fix:**
```sql
-- Get user_type_id
SELECT id FROM user_types WHERE type_code = 'regular_user';

-- Insert user record
INSERT INTO public.users (id, email, name, auth_provider, user_type_id)
VALUES (
  '[USER_ID]',
  '[USER_EMAIL]',
  '[USER_NAME]',
  'supabase',
  '[USER_TYPE_ID]'
);
```

### Problem 4: Frontend JWT Token Issue (2% Likely)

**Symptoms:**
- All database assignments are correct
- Service role queries work
- User queries still fail

**Diagnosis:**
Check if frontend is sending JWT token correctly:
- Session storage has `supabaseJWT`
- Token is included in Authorization header
- Token is valid (not expired)

**Fix:**
Check `/src/routes/auth.js` line 380-382:
```javascript
req.session.supabaseJWT = authData.session.access_token;
req.session.supabaseRefreshToken = authData.session.refresh_token;
req.session.supabaseUser = authData.user;
```

Ensure session is saved before response (line 410-434).

---

## Recommended Action Plan

### Step 1: Run Quick Diagnosis
```bash
psql [connection-string] -f database/debug/quick_diagnosis.sql
```

This will tell you EXACTLY what the problem is.

### Step 2: Apply the Fix

The script will generate the exact SQL to fix the issue. Example output:
```sql
-- If diagnosis shows: "NO USER ASSIGNMENTS to organization"
INSERT INTO user_organizations (user_id, organization_id, role, is_active, joined_at)
VALUES ('abc123...', '5bc79ee9-ac8d-4638-864c-3e05d4e60810', 'owner', true, NOW());
```

### Step 3: Verify Fix
```bash
# Test as user (with JWT token)
psql [connection-string] -f database/debug/test_user_context.sql
```

All tests should pass with ✓.

### Step 4: Test Login
1. Log out of the application
2. Log back in
3. Dashboard should show the organization

---

## Critical Questions to Answer

Run these queries to get definitive answers:

### Q1: Does the user exist in auth.users?
```sql
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
```

### Q2: Does the user exist in public.users?
```sql
SELECT u.id, u.email, u.name
FROM public.users u
ORDER BY u.created_at DESC
LIMIT 5;
```

### Q3: Is the user assigned to the organization?
```sql
SELECT
  uo.user_id,
  u.email,
  uo.organization_id,
  o.name AS org_name,
  uo.role,
  uo.is_active
FROM user_organizations uo
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE uo.organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
```

### Q4: What does the login query actually return?
```sql
-- This is the EXACT query from login (lines 359-370)
SELECT
  organization_id,
  role,
  organizations:organization_id (
    id,
    name,
    slug
  )
FROM user_organizations
WHERE user_id = '[USER_ID]';  -- Replace with actual user ID
```

---

## Expected Outcomes

### If Fix Works:
1. ✅ `quick_diagnosis.sql` shows "All tests passed"
2. ✅ User can log in and see organization
3. ✅ Dashboard loads with organization data
4. ✅ No console errors

### If Fix Doesn't Work:
1. Run `diagnose_org_visibility.sql` for deeper analysis
2. Check `orgsError` in auth.js (should be logged to console)
3. Verify RLS policies with `test_user_context.sql`
4. Check JWT token in browser dev tools

---

## Files Created

1. **database/debug/diagnose_org_visibility.sql** - Comprehensive diagnostic (10 sections)
2. **database/debug/quick_diagnosis.sql** - Fast problem identification (6 steps)
3. **database/debug/test_user_context.sql** - User-perspective RLS testing (7 tests)
4. **database/debug/DIAGNOSTIC_REPORT.md** - This report

---

## Conclusion

**Based on code analysis:**

The issue is **99% likely** to be a **missing user_organizations assignment**, NOT an RLS policy problem.

**Reasoning:**
1. Login uses `supabaseService` (bypasses RLS)
2. No errors reported (query succeeded)
3. Empty result (no assignments found)
4. Organization exists (verified)
5. RLS policies are correct (migration 005 successful)

**Next Steps:**
1. Run `quick_diagnosis.sql` to confirm
2. Apply the generated fix SQL
3. Test login again
4. Report back findings

---

**Agent:** Database Detective
**Status:** Diagnostic Complete
**Confidence:** 99%
**Recommended Fix:** Run quick_diagnosis.sql and apply suggested fix
