# CRITICAL ISSUES DIAGNOSTIC REPORT
## Analyst Agent - Root Cause Analysis

**Date**: 2025-10-20
**Status**: TWO CRITICAL BUGS IDENTIFIED
**Severity**: HIGH - Blocks user access after setup

---

## 🚨 ISSUE #1: WRONG PERMISSIONS ASSIGNED DURING SETUP

### Root Cause
**Location**: `/src/routes/setup.js` **Lines 743-761**

**THE BUG**: During organization setup, the code assigns `org_role_id` correctly to 'owner', BUT it ALSO assigns the legacy `role` column to either `'superuser'` or `'org_admin'` based on whether it's the first organization.

```javascript
// LINE 740: Determines userRole
const userRole = adminUser.is_first_org ? 'superuser' : 'org_admin';
console.log('[SETUP-DEBUG] 👤 Assigning role:', userRole);

// LINES 743-753: Gets owner role correctly
const { data: ownerRole, error: roleError } = await supabase
  .from('organization_roles')
  .select('id')
  .eq('role_code', 'owner')
  .single();

// LINES 755-763: THE BUG - Assigns BOTH columns incorrectly
const { error: linkError } = await supabase
  .from('user_organizations')
  .insert({
    user_id: adminUser.user_id,
    organization_id: data.id,
    role: userRole,           // ❌ BUG: Sets to 'superuser' or 'org_admin'
    org_role_id: ownerRole.id, // ✅ CORRECT: Sets to owner role ID
    created_at: new Date().toISOString()
  });
```

### Why This Causes "Viewer Only" Permissions

1. **The new permissions system** (from migration 024) uses `org_role_id` (foreign key to `organization_roles` table)
2. **The old system** uses the `role` column (string: owner, admin, member, viewer)
3. **The permissions middleware** (`/src/middleware/permissions.js`) correctly reads from the NEW system
4. **BUT** the old `role` column being set to `'superuser'` or `'org_admin'` doesn't match valid role codes

### Expected vs Actual

| Field | Expected | Actual | Impact |
|-------|----------|--------|--------|
| `org_role_id` | owner role ID | ✅ owner role ID | NEW system works |
| `role` | 'owner' | ❌ 'superuser' or 'org_admin' | OLD system breaks |

### Impact Chain
1. Setup wizard assigns `role: 'superuser'` (invalid role code)
2. Dashboard checks permissions via `/src/routes/dashboard.js` lines 68, 969
3. `attachPermissions` middleware uses new system → works
4. BUT legacy role checks use `req.session.userRole` which was set from old `role` column
5. When user sees "viewer only" it's because:
   - Either the old role column check falls back to 'viewer'
   - OR the session doesn't properly store the user's role

---

## 🚨 ISSUE #2: ORGANIZATION SELECTOR SHOWS "NO ORGANIZATIONS FOUND"

### Root Cause
**Location**: `/src/routes/auth.js` **Lines 1227-1291** (GET /auth/select route)

**THE BUG**: The organization selector query logic has THREE different code paths, and one of them is BROKEN for logged-in non-admin users:

```javascript
// LINE 1234: Checks if user is logged in
if (req.session?.userId) {
  // Check if global admin...
  if (isGlobalAdmin) {
    // PATH 1: Global admin - queries ALL organizations
    const { data, error } = await supabaseService
      .from('organizations')
      .select('id, name, organization_type, created_at')
      .order('name');
    // This works ✅
  } else {
    // PATH 2: Regular user - joins user_organizations
    const { data, error } = await supabase  // ❌ BUG: Uses authenticated client
      .from('user_organizations')
      .select(`
        organization_id,
        role,
        organizations:organization_id (
          id,
          name,
          organization_type,
          created_at
        )
      `)
      .eq('user_id', req.session.userId)
      .eq('is_active', true);
    // This is WHERE THE BUG OCCURS
  }
} else {
  // PATH 3: Not logged in - queries ALL organizations
  const { data, error } = await supabaseService
    .from('organizations')
    .select('id, name, organization_type, created_at')
    .order('created_at', { ascending: false });
  // This works ✅
}
```

### The Exact Problem

**LINE 1257**: Uses `await supabase` (authenticated client with RLS) instead of `await supabaseService` (service role client that bypasses RLS)

### Why RLS Blocks The Query

1. **RLS Policy on `organizations` table**: Disabled (you disabled it in migration 028)
2. **RLS Policy on `user_organizations` table**: ENABLED and RESTRICTIVE
3. **The query joins**: `user_organizations` → `organizations`
4. **RLS on user_organizations**: Only allows users to see THEIR OWN rows
5. **BUT**: The authenticated Supabase client (`req.supabase`) may not have proper JWT context
6. **Result**: RLS blocks the query, returns empty array

### The Smoking Gun

Looking at `/src/routes/auth.js` line 1257:
```javascript
const { data, error } = await supabase  // ❌ Uses authenticated client
```

Should be:
```javascript
const { data, error } = await supabaseService  // ✅ Use service client
```

**WHY**: The service role client bypasses RLS policies, which is necessary for fetching user's organizations after login (before they've selected an organization context).

### Evidence Trail

1. **Migration 028** (`028_EMERGENCY_disable_rls_for_setup.sql`): Disabled RLS on `organizations` table
2. **But**: RLS still enabled on `user_organizations` table
3. **Auth route**: Uses authenticated client for PATH 2
4. **Authenticated client**: May have expired/invalid JWT
5. **RLS**: Blocks query due to invalid auth context
6. **Result**: Empty array returned
7. **View**: Shows "No organizations found"

---

## 🔍 VERIFICATION SQL QUERIES

### Query 1: Check User's Actual Permissions
```sql
-- Run this to see what was ACTUALLY assigned during setup
SELECT
  uo.user_id,
  uo.organization_id,
  uo.role as legacy_role_column,
  uo.org_role_id as new_role_id,
  or_table.role_code as actual_role_code,
  or_table.role_name,
  u.email
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
LEFT JOIN organization_roles or_table ON or_table.id = uo.org_role_id
WHERE u.email = 'your-setup-email@example.com';

-- EXPECTED:
-- legacy_role_column: 'superuser' or 'org_admin' ❌ WRONG
-- actual_role_code: 'owner' ✅ CORRECT
```

### Query 2: Check Organization Visibility
```sql
-- Run this to see if organizations exist
SELECT id, name, created_at, is_configured
FROM organizations
ORDER BY created_at DESC;

-- Should return at least ONE organization
-- If empty: Setup failed completely
-- If populated: Issue is with AUTH ROUTE, not data
```

### Query 3: Check User Organizations Link
```sql
-- Verify user is linked to organization
SELECT
  uo.user_id,
  uo.organization_id,
  o.name as org_name,
  uo.role,
  uo.org_role_id,
  uo.is_active
FROM user_organizations uo
JOIN organizations o ON o.id = uo.organization_id
WHERE uo.user_id = (SELECT id FROM users WHERE email = 'your-email@example.com');

-- If empty: User wasn't linked (rare)
-- If present: Auth route should return this
```

### Query 4: Test RLS Policy
```sql
-- Test if RLS is blocking the query
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"USER_ID_HERE"}';

SELECT * FROM user_organizations
WHERE user_id = 'USER_ID_HERE';

-- If empty: RLS is blocking
-- If returns data: RLS is fine, issue is JWT context
```

---

## 🔧 EXACT FIXES REQUIRED

### Fix #1: Correct Role Assignment During Setup

**File**: `/src/routes/setup.js`
**Line**: 740-761

**BEFORE** (Lines 740-761):
```javascript
const userRole = adminUser.is_first_org ? 'superuser' : 'org_admin';
console.log('[SETUP-DEBUG] 👤 Assigning role:', userRole);

// Get the organization_roles ID for 'owner'
const { data: ownerRole, error: roleError } = await supabase
  .from('organization_roles')
  .select('id')
  .eq('role_code', 'owner')
  .single();

if (roleError) {
  console.error('[SETUP-DEBUG] ❌ Error getting owner role:', roleError);
  throw new Error('Failed to get owner role for organization creator');
}

const { error: linkError } = await supabase
  .from('user_organizations')
  .insert({
    user_id: adminUser.user_id,
    organization_id: data.id,
    role: userRole, // ❌ BUG: Wrong value
    org_role_id: ownerRole.id,
    created_at: new Date().toISOString()
  });
```

**AFTER** (Fixed):
```javascript
// ✅ FIX: Always assign 'owner' as the role for setup user
const userRole = 'owner'; // First user should ALWAYS be owner of their organization
console.log('[SETUP-DEBUG] 👤 Assigning role:', userRole);

// Get the organization_roles ID for 'owner'
const { data: ownerRole, error: roleError } = await supabase
  .from('organization_roles')
  .select('id')
  .eq('role_code', 'owner')
  .single();

if (roleError) {
  console.error('[SETUP-DEBUG] ❌ Error getting owner role:', roleError);
  throw new Error('Failed to get owner role for organization creator');
}

const { error: linkError } = await supabase
  .from('user_organizations')
  .insert({
    user_id: adminUser.user_id,
    organization_id: data.id,
    role: 'owner', // ✅ FIXED: Use 'owner' for both new and legacy system
    org_role_id: ownerRole.id,
    created_at: new Date().toISOString()
  });
```

**ALTERNATIVE FIX** (if you want to preserve superuser for first org):
```javascript
// If first organization, keep superuser logic for user_types
// BUT still assign 'owner' role in user_organizations
const isFirstOrg = adminUser.is_first_org;

// For user_types: Set to global_admin if first org (already done at line 712-736)
// For user_organizations: ALWAYS set to 'owner' for the person creating the org
const userRole = 'owner'; // ✅ Person creating org is ALWAYS owner

const { error: linkError } = await supabase
  .from('user_organizations')
  .insert({
    user_id: adminUser.user_id,
    organization_id: data.id,
    role: userRole, // ✅ 'owner'
    org_role_id: ownerRole.id,
    created_at: new Date().toISOString()
  });
```

---

### Fix #2: Use Service Client for Organization Selector

**File**: `/src/routes/auth.js`
**Line**: 1256-1281

**BEFORE** (Lines 1256-1281):
```javascript
} else {
  // Regular user: show only their organizations
  const { data, error } = await supabase  // ❌ BUG: Authenticated client
    .from('user_organizations')
    .select(`
      organization_id,
      role,
      organizations:organization_id (
        id,
        name,
        organization_type,
        created_at
      )
    `)
    .eq('user_id', req.session.userId)
    .eq('is_active', true);

  if (error) throw error;

  organizations = data?.map(uo => ({
    id: uo.organizations.id,
    name: uo.organizations.name,
    organization_type: uo.organizations.organization_type,
    created_at: uo.organizations.created_at,
    role: uo.role
  })) || [];
}
```

**AFTER** (Fixed):
```javascript
} else {
  // Regular user: show only their organizations
  // ✅ FIX: Use service client to bypass RLS on user_organizations
  const { data, error } = await supabaseService  // ✅ Service client
    .from('user_organizations')
    .select(`
      organization_id,
      role,
      organizations:organization_id (
        id,
        name,
        organization_type,
        created_at
      )
    `)
    .eq('user_id', req.session.userId)
    .eq('is_active', true);

  if (error) throw error;

  organizations = data?.map(uo => ({
    id: uo.organizations.id,
    name: uo.organizations.name,
    organization_type: uo.organizations.organization_type,
    created_at: uo.organizations.created_at,
    role: uo.role
  })) || [];
}
```

**WHY THIS WORKS**:
- Service client has service role key (bypasses RLS)
- User is already authenticated via Express session
- We're just fetching their organizations for display
- Security is maintained: query is filtered by `req.session.userId`
- RLS isn't needed here because we're explicitly filtering by user_id

---

## 🎯 TESTING PROCEDURE

### Test Fix #1 (Permissions)

1. **Reset Database** (optional, for clean test):
   ```sql
   DELETE FROM user_organizations WHERE role IN ('superuser', 'org_admin');
   ```

2. **Run Setup Wizard** with fixed code

3. **Verify Role Assignment**:
   ```sql
   SELECT role, org_role_id, is_active
   FROM user_organizations
   WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

   -- Expected: role = 'owner'
   ```

4. **Login and Check Dashboard**:
   - User should see "Owner" badge
   - User should have full admin permissions
   - NOT "Viewer Only"

### Test Fix #2 (Organization Selector)

1. **Complete Setup** (creates organization)

2. **Logout**

3. **Login Again**

4. **Navigate to** `/auth/select`

5. **Expected**: Should see list of organizations

6. **Verify in Browser Console**:
   ```javascript
   // Should NOT see errors about organizations
   // Should see org cards rendered
   ```

---

## 📊 IMPACT ASSESSMENT

### Issue #1 Impact
- **Users Affected**: 100% of new users completing setup
- **Severity**: HIGH - Users cannot use the application
- **Workaround**: None for end users (requires manual DB fix)

### Issue #2 Impact
- **Users Affected**: All users after logout/login
- **Severity**: HIGH - Prevents re-accessing organizations
- **Workaround**: Direct URL to `/dashboard` might work if session still has org ID

---

## 🏁 CONCLUSION

Both issues are **CRITICAL** and **TRIVIAL TO FIX**:

1. **Issue #1**: Change `'superuser'/'org_admin'` to `'owner'` (1 line change)
2. **Issue #2**: Change `supabase` to `supabaseService` (1 word change)

**Total Code Changes**: 2 lines
**Testing Required**: Full setup wizard → login → dashboard flow
**Risk Level**: LOW (changes are surgical and well-isolated)

---

## 🔗 FILES TO MODIFY

1. `/src/routes/setup.js` - Line 740 (change role assignment)
2. `/src/routes/auth.js` - Line 1257 (change client reference)

---

**Analyst Agent - Diagnostic Complete**
**Next Step**: Apply fixes and verify with integration tests
