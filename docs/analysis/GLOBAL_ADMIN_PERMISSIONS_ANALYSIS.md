# Global Admin Permissions Bug Analysis

**Status**: Critical Bug - Global Admins Cannot See Organizations
**Created**: 2025-10-23
**Detective Case**: "The Invisible Admin Mystery"

---

## Executive Summary

**Problem**: Global Admin users cannot see ANY organizations, but they should be able to see ALL organizations and have full access everywhere.

**Root Cause**: The new permissions architecture (migration 024) introduced `user_types` and `organization_roles` tables with a `can_access_all_organizations` global permission, but the RLS (Row Level Security) policies on the `organizations` table were never updated to check for global admin permissions. The RLS policy still only checks `user_organizations` membership.

**Impact**: High - Global admins are effectively locked out of the system despite having the highest permission level.

---

## Technical Root Cause

### The Permission Architecture Mismatch

#### What Changed (Migration 024 - New Permissions System)

**New Tables**:
- `user_types` - Defines global permission sets (e.g., `global_admin`, `regular_user`)
  - Contains `global_permissions` JSONB with permissions like `can_access_all_organizations`

- `organization_roles` - Defines org-level roles (e.g., `org_owner`, `org_admin`, `org_member`)
  - Contains `org_permissions` JSONB with permissions like `can_manage_users`

**New Column**:
- `users.user_type_id` - Links users to their global user type
- `user_organizations.org_role_id` - Links users to their org role

**New RPC Functions** (Migration 006):
- `user_has_global_permission(user_id, permission)` - ✅ Working
- `user_has_org_permission(user_id, org_id, permission)` - ✅ Working
- `get_user_effective_permissions(user_id, org_id)` - ✅ Working

#### What DIDN'T Change (Migration 001 - Old RLS Policies)

**Organizations Table RLS Policy** (Created in migration 001):

```sql
-- Line 496 of database/migrations/001_generalized_schema.sql
CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- ❌ PROBLEM: Only checks membership
    )
  );
```

**The Bug**:
- Global admins have `can_access_all_organizations = true` in their user type
- BUT the RLS policy on `organizations` table ONLY checks `user_organizations` membership
- Global admins are NOT in `user_organizations` for every org (they shouldn't need to be!)
- Result: Global admins see ZERO organizations

---

## Detailed Analysis

### 1. How Global Admin Should Work

**Expected Behavior**:
```
User Type: global_admin
  └─ global_permissions.can_access_all_organizations = true
  └─ Should see ALL organizations (bypass user_organizations check)
  └─ Should have admin access to ALL organizations
  └─ Should NOT need entries in user_organizations for every org
```

**Current Behavior**:
```
User Type: global_admin
  └─ global_permissions.can_access_all_organizations = true
  └─ Organizations RLS: Checks user_organizations membership only
  └─ Not in user_organizations? SEE NOTHING ❌
```

### 2. Where Global Admin Permission is Correctly Checked

✅ **Backend Middleware** (`src/middleware/permissions.js`):
- Line 23-40: `hasGlobalPermission()` - Correctly queries `user_types` table
- Line 325-327: `requireGlobalAdmin()` - Uses `can_access_all_organizations` permission
- Line 375-378: `isGlobalAdmin()` - Legacy helper, returns `userType === 'global_admin'`

✅ **Backend Helper** (`src/middleware/globalAdmin.js`):
- Line 11-36: `isGlobalAdmin()` - Checks `user_organizations.is_global_admin = true`
- Line 45-95: `getAccessibleOrganizations()` - **Correctly queries ALL orgs for global admins**
  - Line 54-62: If global admin, queries `organizations` table directly

**BUT**: These backend checks use `supabaseService` (service role) which **BYPASSES RLS**. The RLS policies are what fail for regular user queries.

### 3. Where the Problem Manifests

❌ **Database RLS Policies** (Applied on ALL queries, including service role in some cases):

**Location**: `/database/migrations/001_generalized_schema.sql` lines 496-505

```sql
CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- ❌ Only checks membership, not global permissions
    )
  );
```

**What's Missing**:
```sql
-- Should ALSO check if user has global admin permission
OR EXISTS (
  SELECT 1 FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = auth.uid()
  AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
)
```

### 4. Secondary RLS Policy Issue: user_organizations Table

**Location**: `/database/migrations/003_enable_user_organizations_rls.sql` lines 22-32

```sql
CREATE POLICY "Admins see org members"
  ON user_organizations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')  -- ❌ Checks old role column, not org_role_id
    )
  );
```

**Problems**:
1. Uses deprecated `role` column instead of checking `organization_roles.hierarchy_level`
2. Doesn't check for global admin permissions
3. Creates circular dependency (user_organizations policy queries user_organizations)

---

## Affected Code Locations

### Database Files (RLS Policies - PRIMARY ISSUE)

1. **`/database/migrations/001_generalized_schema.sql`**
   - Line 496-505: `CREATE POLICY "Users see own organizations"` ❌
   - Needs: Global admin check added to USING clause

2. **`/database/migrations/003_enable_user_organizations_rls.sql`**
   - Line 16-32: `CREATE POLICY "Users see own memberships"` ❌
   - Line 22-32: `CREATE POLICY "Admins see org members"` ❌
   - Needs: Global admin bypass for both policies

3. **`/database/schema.sql`** (Context file - shows current state)
   - No RLS policies shown (schema is for reference only)
   - Actual policies live in migrations

### Backend Code (WORKING CORRECTLY - Uses service role bypass)

These files correctly check global admin permissions, but they use `supabaseService` which bypasses RLS:

1. **`/src/middleware/permissions.js`** ✅
   - Line 62-91: `user_has_global_permission()` RPC function
   - Line 325-327: `requireGlobalAdmin()` middleware
   - Uses new permission architecture correctly

2. **`/src/middleware/globalAdmin.js`** ✅
   - Line 11-36: `isGlobalAdmin()` - Works via service role
   - Line 45-95: `getAccessibleOrganizations()` - Returns ALL orgs for global admin
   - Line 54-62: Direct query to `organizations` table (bypasses RLS)

3. **`/src/routes/admin.js`** ✅
   - Line 154-254: `/admin/dashboard` - Uses service role
   - Line 260-303: `/admin/organization` - Uses service role
   - All admin routes use `supabaseService` which bypasses RLS

4. **`/src/routes/auth.js`** ✅
   - Line 785-788: Queries organizations with `supabaseService`
   - Line 857-860: Same pattern
   - Works because service role bypasses RLS

### Frontend Code (May need updates after fix)

1. **`/views/admin/*`** - Admin views may need permission checks updated
2. **`/views/dashboard/dashboard.ejs`** - May reference permissions

---

## Step-by-Step Fix Strategy

### Phase 1: Fix RLS Policies (Critical - Do This First)

#### 1.1 Fix Organizations Table RLS Policy

**File**: Create new migration `/database/migrations/008_fix_global_admin_rls.sql`

```sql
-- Drop old policy
DROP POLICY IF EXISTS "Users see own organizations" ON organizations;

-- Create new policy with global admin check
CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    -- Regular users: see orgs they're members of
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR
    -- Global admins: see ALL organizations
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()
      AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
    )
  );
```

#### 1.2 Fix user_organizations Table RLS Policies

**File**: Same migration `/database/migrations/008_fix_global_admin_rls.sql`

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins see org members" ON user_organizations;

-- Policy 1: Users see their own memberships
CREATE POLICY "Users see own memberships"
  ON user_organizations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    -- Global admins see all memberships
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()
      AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
    )
  );

-- Policy 2: Org admins see org members (using new role architecture)
CREATE POLICY "Admins see org members"
  ON user_organizations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
      AND uo.is_active = true
      AND orel.hierarchy_level <= 3  -- Admin level or higher (owner=1, admin=2,3)
    )
    OR
    -- Global admins see all memberships
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()
      AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
    )
  );
```

### Phase 2: Add Helper Function (Optional Optimization)

**File**: Same migration `/database/migrations/008_fix_global_admin_rls.sql`

```sql
-- Create reusable function for global admin check
CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN user_types ut ON u.user_type_id = ut.id
    WHERE u.id = p_user_id
    AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_global_admin(UUID) TO authenticated;

-- Simplified policy using helper function
DROP POLICY IF EXISTS "Users see own organizations" ON organizations;

CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR is_global_admin(auth.uid())  -- Much cleaner!
  );
```

### Phase 3: Update Other RLS Policies (Consistency)

Apply same pattern to all data tables that filter by organization:

1. **documents** - Should allow global admin to see all docs
2. **document_sections** - Should allow global admin to see all sections
3. **suggestions** - Should allow global admin to see all suggestions
4. **workflow_templates** - Should allow global admin to see all workflows

**Pattern**:
```sql
USING (
  organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  )
  OR is_global_admin(auth.uid())
)
```

### Phase 4: Deprecate Old is_global_admin Column (Future Cleanup)

**Note**: The `user_organizations.is_global_admin` column is deprecated and should be removed after migration to `user_types` is complete.

**Migration**: `/database/migrations/009_remove_deprecated_global_admin_column.sql`

```sql
-- Remove deprecated column (after verifying all code uses user_types)
ALTER TABLE user_organizations DROP COLUMN IF EXISTS is_global_admin;

-- Remove deprecated is_global_admin column from users table too
ALTER TABLE users DROP COLUMN IF EXISTS is_global_admin;
```

---

## Test Cases to Verify Fix

### Test 1: Global Admin Can See All Organizations

```sql
-- Setup: Create a global admin user
-- 1. Get global_admin user type ID
SELECT id FROM user_types WHERE type_code = 'global_admin';

-- 2. Create or update user
UPDATE users
SET user_type_id = '<global_admin_type_id>'
WHERE email = 'admin@example.com';

-- 3. Verify permissions
SELECT
  u.email,
  ut.type_code,
  ut.global_permissions->>'can_access_all_organizations' as can_see_all
FROM users u
JOIN user_types ut ON u.user_type_id = ut.id
WHERE u.email = 'admin@example.com';

-- Expected: can_see_all = true

-- 4. Test organization visibility (as global admin)
SET LOCAL jwt.claims.sub TO '<admin_user_id>';
SELECT id, name FROM organizations;

-- Expected: ALL organizations visible (not zero!)
```

### Test 2: Regular User Sees Only Their Organizations

```sql
-- Setup: Create a regular user
-- 1. Get regular_user type ID
SELECT id FROM user_types WHERE type_code = 'regular_user';

-- 2. Create user
UPDATE users
SET user_type_id = '<regular_user_type_id>'
WHERE email = 'user@example.com';

-- 3. Add to ONE organization
INSERT INTO user_organizations (user_id, organization_id, org_role_id)
VALUES ('<user_id>', '<org_1_id>', '<member_role_id>');

-- 4. Test visibility
SET LOCAL jwt.claims.sub TO '<user_id>';
SELECT id, name FROM organizations;

-- Expected: Only org_1 visible (not all orgs!)
```

### Test 3: Global Admin Can See All user_organizations

```sql
-- As global admin
SET LOCAL jwt.claims.sub TO '<admin_user_id>';
SELECT COUNT(*) FROM user_organizations;

-- Expected: COUNT = total user_organization records (all orgs, all users)
```

### Test 4: Regular User Cannot See Other Org Memberships

```sql
-- As regular user
SET LOCAL jwt.claims.sub TO '<user_id>';
SELECT COUNT(*) FROM user_organizations;

-- Expected: COUNT = only their own membership records
```

### Test 5: Backend API Endpoints Work

```bash
# Login as global admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get all organizations (should return ALL orgs)
curl http://localhost:3000/api/admin/dashboard \
  -H "Cookie: connect.sid=<session_cookie>"

# Expected: organizations array with ALL orgs, not empty
```

---

## Migration Application Order

**CRITICAL**: Apply migrations in this exact order:

1. ✅ **Already Applied**: Migration 001 (schema creation)
2. ✅ **Already Applied**: Migration 003 (user_organizations RLS - broken version)
3. ✅ **Already Applied**: Migration 006 (permission RPC functions)
4. 🆕 **NEW**: Migration 008 (fix global admin RLS policies)
5. 🔜 **FUTURE**: Migration 009 (remove deprecated columns)

**Application Command**:
```bash
psql $DATABASE_URL -f database/migrations/008_fix_global_admin_rls.sql
```

---

## Risk Assessment

### High Risk
- **RLS Policy Changes**: Could accidentally expose data to unauthorized users if policies are too permissive
- **Migration Timing**: Must be applied during maintenance window

### Medium Risk
- **Backward Compatibility**: Code using `user_organizations.is_global_admin` will break after column removal
- **Performance**: Additional JOIN in RLS policies may slow down queries

### Low Risk
- **Testing**: Can be tested thoroughly in development before production deployment
- **Rollback**: Policies can be rolled back by reapplying old migration

### Mitigation Strategies

1. **Test in Development First**: Apply migration to dev database and run full test suite
2. **Security Audit**: Review all RLS policies to ensure no unintended access
3. **Performance Monitoring**: Monitor query performance after deployment
4. **Gradual Rollout**: Deploy to staging → production with monitoring between steps
5. **Rollback Plan**: Keep old migration 003 ready to reapply if needed

---

## Success Criteria

✅ **Fix Successful When**:

1. Global admin user can see ALL organizations in the system
2. Global admin can access `/admin/dashboard` and see all orgs listed
3. Regular users still only see their assigned organizations
4. RLS security tests pass (users can't see other orgs they shouldn't)
5. Performance benchmarks show acceptable query times (<100ms for org listing)
6. All existing features continue to work (no regressions)

---

## Related Issues & References

**Related Files**:
- `/database/migrations/001_generalized_schema.sql` - Original RLS policies
- `/database/migrations/003_enable_user_organizations_rls.sql` - user_organizations RLS
- `/database/migrations/006_create_permission_rpc_functions.sql` - Permission helpers
- `/src/middleware/permissions.js` - Backend permission checks
- `/src/middleware/globalAdmin.js` - Global admin helpers

**Related Concepts**:
- Row Level Security (RLS) - Postgres security feature
- `auth.uid()` - Supabase function returning current user ID
- Service Role vs Authenticated Role - Supabase roles
- SECURITY DEFINER - Postgres function security modifier

**Similar Bugs Fixed**:
- Issue #3: user_organizations RLS recursion (fixed in migration 004-005)
- Issue #7: Permission function signatures (fixed in migration 006)

---

## Appendix: Complete Migration 008 SQL

```sql
-- Migration 008: Fix Global Admin RLS Policies
-- ============================================================================
--
-- ISSUE: Global admins cannot see organizations despite can_access_all_organizations permission
-- ROOT CAUSE: RLS policies only check user_organizations membership, not user_types permissions
-- FIX: Add global admin checks to all organization-related RLS policies
--
-- Created: 2025-10-23
-- Detective Case: "The Invisible Admin Mystery"
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Check if user is global admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN user_types ut ON u.user_type_id = ut.id
    WHERE u.id = p_user_id
    AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_global_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_global_admin(UUID) TO service_role;

COMMENT ON FUNCTION is_global_admin IS 'Check if user has global admin permissions (can_access_all_organizations)';

-- ============================================================================
-- FIX: Organizations Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see own organizations" ON organizations;

CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    -- Regular users: see orgs they're members of
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR
    -- Global admins: see ALL organizations
    is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: user_organizations Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins see org members" ON user_organizations;

-- Policy 1: Users see their own memberships OR global admins see all
CREATE POLICY "Users see own memberships"
  ON user_organizations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_global_admin(auth.uid())
  );

-- Policy 2: Org admins see org members (using new role architecture)
CREATE POLICY "Admins see org members"
  ON user_organizations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
      AND uo.is_active = true
      AND orel.hierarchy_level <= 3  -- Admin level or higher
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: Documents Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see own organization documents" ON documents;

CREATE POLICY "Users see own organization documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: Document Sections Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see sections in accessible documents" ON document_sections;

CREATE POLICY "Users see sections in accessible documents"
  ON document_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
      AND uo.user_id = auth.uid()
      AND uo.is_active = true
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: Suggestions Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see suggestions in accessible documents" ON suggestions;

CREATE POLICY "Users see suggestions in accessible documents"
  ON suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = suggestions.document_id
      AND uo.user_id = auth.uid()
      AND uo.is_active = true
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify global admin can see all organizations:
-- SELECT COUNT(*) FROM organizations; -- Should return total org count

-- Verify regular user sees limited organizations:
-- SELECT COUNT(*) FROM organizations; -- Should return only user's orgs

-- Verify is_global_admin function works:
-- SELECT is_global_admin(auth.uid());
```

---

**End of Analysis**
