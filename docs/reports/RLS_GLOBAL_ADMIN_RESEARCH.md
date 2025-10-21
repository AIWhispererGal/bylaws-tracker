# RLS Global Admin Research Report

**Date:** 2025-10-13
**Researcher:** Hive Mind Research Agent
**Task:** Verify RLS policies for global admin access
**Status:** ✅ COMPLETE

---

## 🔍 Executive Summary

**CRITICAL FINDING:** Global admin RLS policies exist for core tables (documents, document_sections, organizations) but are **MISSING for suggestions table**. This means global admins cannot see ALL suggestions across organizations, which is likely a security gap.

**Migration Status:** Migrations 007 and 008 have been created but deployment status is unknown (need database verification).

**Immediate Action Required:** Add global admin policies for suggestions table.

---

## 📋 Migration Analysis

### Migration 007: Create Global Superuser Support
**File:** `/database/migrations/007_create_global_superuser.sql`
**Date:** 2025-10-12
**Status:** ⚠️ Deployment status unknown

#### Features Implemented:
1. ✅ **Column Added:** `is_global_admin` boolean flag to `user_organizations` table
2. ✅ **Function Created:** `is_global_admin(p_user_id UUID)` helper function
3. ✅ **RLS Policies Created:**
   - `global_admin_see_all_documents` (SELECT on documents)
   - `global_admin_manage_all_documents` (ALL on documents)
   - `global_admin_see_all_sections` (SELECT on document_sections)
   - `global_admin_manage_all_sections` (ALL on document_sections)
   - `global_admin_see_all_organizations` (SELECT on organizations)
   - `global_admin_manage_all_organizations` (ALL on organizations)
4. ✅ **Helper Function:** `link_global_admin_to_all_orgs(p_user_id UUID)` to link user to all orgs

#### Implementation Details:

```sql
-- Helper function that checks is_global_admin flag
CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_organizations
    WHERE user_id = p_user_id
      AND is_global_admin = true
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Example policy using the function
CREATE POLICY "global_admin_see_all_documents"
  ON documents
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );
```

---

### Migration 008: Enhanced User Roles and Approval Workflow
**File:** `/database/migrations/008_enhance_user_roles_and_approval.sql`
**Date:** 2025-10-13
**Status:** ⚠️ Deployment status unknown

#### Features Implemented:
1. ✅ **Re-adds is_global_admin column** (with idempotent check)
2. ✅ **Creates indexes** for global admin lookups
3. ✅ **Document versioning** system for approval tracking
4. ✅ **User activity audit log** table
5. ✅ **RBAC helper functions:**
   - `user_has_role(user_id, org_id, required_role)`
   - `user_can_approve_stage(user_id, workflow_stage_id)`
6. ✅ **RLS policies for new tables:**
   - `document_versions` - users see versions of accessible documents
   - `user_activity_log` - users see activity in their organizations

---

### Migration 009: Enhanced RLS Organization Filtering
**File:** `/database/migrations/009_enhance_rls_organization_filtering.sql`
**Date:** 2025-10-13
**Status:** ⚠️ Deployment status unknown

#### Key Changes:
1. ✅ **Adds `organization_id` directly to:**
   - `document_sections` (for fast RLS filtering)
   - `suggestions` (for fast RLS filtering)
2. ✅ **Creates triggers** to auto-maintain organization_id
3. ✅ **Enhanced RLS policies** with direct organization_id filtering (no JOINs)
4. ✅ **Performance indexes** on organization_id columns

#### Suggestions Table RLS Policies (Migration 009):
```sql
-- ✅ SELECT: Users can only see suggestions in their organizations (FAST - no JOIN)
CREATE POLICY "users_see_own_org_suggestions"
  ON suggestions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ✅ INSERT: Users can create suggestions in their organizations OR public if enabled
CREATE POLICY "users_create_suggestions"
  ON suggestions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    OR
    (
      auth.uid() IS NULL AND
      EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = suggestions.organization_id
        AND (o.settings->>'allow_public_suggestions')::boolean = true
      )
    )
  );

-- ✅ UPDATE: Authors can update their own suggestions, admins can update any
CREATE POLICY "users_update_suggestions"
  ON suggestions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    AND (
      author_user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.organization_id = suggestions.organization_id
          AND uo.is_active = true
          AND uo.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ✅ DELETE: Authors can delete their own suggestions, admins can delete any
CREATE POLICY "users_delete_suggestions"
  ON suggestions
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    AND (
      author_user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.organization_id = suggestions.organization_id
          AND uo.is_active = true
          AND uo.role IN ('owner', 'admin')
      )
    )
  );

-- ✅ Service role bypass (for setup and migrations)
CREATE POLICY "service_role_manage_suggestions"
  ON suggestions
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

---

## 🚨 CRITICAL GAPS IDENTIFIED

### ❌ Missing: Global Admin Policies for Suggestions Table

**Problem:**
- Migration 007 creates global admin policies for `documents`, `document_sections`, and `organizations`
- Migration 009 creates standard RLS policies for `suggestions` with organization filtering
- **BUT NO global admin bypass policies exist for suggestions!**

**Impact:**
- Global admins cannot see suggestions from ALL organizations
- This breaks the global admin use case
- Inconsistent with other tables that DO have global admin policies

**Required Fix:**
```sql
-- Add to migration 007 or create new migration 011

-- Suggestions: Allow global admins to see all suggestions
DROP POLICY IF EXISTS "global_admin_see_all_suggestions" ON suggestions;
CREATE POLICY "global_admin_see_all_suggestions"
  ON suggestions
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

DROP POLICY IF EXISTS "global_admin_manage_all_suggestions" ON suggestions;
CREATE POLICY "global_admin_manage_all_suggestions"
  ON suggestions
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );
```

---

## 📊 RLS Policy Coverage Matrix

| Table | Standard User RLS | Global Admin RLS | Status |
|-------|-------------------|------------------|--------|
| **documents** | ✅ (Migration 009) | ✅ (Migration 007) | Complete |
| **document_sections** | ✅ (Migration 009) | ✅ (Migration 007) | Complete |
| **organizations** | ✅ (Migration 009) | ✅ (Migration 007) | Complete |
| **suggestions** | ✅ (Migration 009) | ❌ **MISSING** | **Incomplete** |
| **suggestion_sections** | ✅ (Migration 001) | ❌ Not reviewed | Needs review |
| **suggestion_votes** | ✅ (Migration 001) | ❌ Not reviewed | Needs review |
| **workflow_templates** | ✅ (Migration 001) | ❌ Not reviewed | Needs review |
| **workflow_stages** | ✅ (Migration 001) | ❌ Not reviewed | Needs review |
| **document_workflows** | ✅ (Migration 001) | ❌ Not reviewed | Needs review |
| **section_workflow_states** | ✅ (Migration 001) | ❌ Not reviewed | Needs review |
| **document_versions** | ✅ (Migration 008) | ❌ Not added | Needs addition |
| **user_activity_log** | ✅ (Migration 008) | ❌ Not added | Needs addition |
| **user_organizations** | ✅ (Migration 009) | N/A | N/A |
| **users** | ✅ (Migration 001) | ⚠️ Maybe needed | Needs review |

---

## 📝 RLS Policy Verification Checklist

### To Verify Deployment Status:

Run these SQL queries in Supabase:

```sql
-- 1. Check if is_global_admin column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_organizations'
  AND column_name = 'is_global_admin';
-- Expected: 1 row with data_type = 'boolean'

-- 2. Check if is_global_admin function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_global_admin';
-- Expected: 1 row with function definition

-- 3. Check which global admin policies exist
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE policyname LIKE '%global_admin%'
ORDER BY tablename, policyname;
-- Expected: 6 policies (documents x2, document_sections x2, organizations x2)

-- 4. Check suggestions table policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'suggestions'
ORDER BY policyname;
-- Expected: Should see user policies but NO global_admin policies

-- 5. Check if organization_id exists on suggestions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'suggestions'
  AND column_name = 'organization_id';
-- Expected: 1 row if migration 009 was run

-- 6. List all policies on each table
SELECT
  tablename,
  COUNT(*) as policy_count,
  ARRAY_AGG(policyname) as policies
FROM pg_policies
WHERE tablename IN (
  'documents',
  'document_sections',
  'suggestions',
  'organizations',
  'user_organizations'
)
GROUP BY tablename
ORDER BY tablename;
```

---

## 🎯 Deployment Requirements

### Step 1: Verify Migration Order
Migrations must be run in this order:
1. ✅ `001_generalized_schema.sql` (base schema)
2. ✅ `006_implement_supabase_auth.sql` (auth integration)
3. ⚠️ `007_create_global_superuser.sql` (adds is_global_admin)
4. ⚠️ `008_enhance_user_roles_and_approval.sql` (enhances roles)
5. ⚠️ `009_enhance_rls_organization_filtering.sql` (adds organization_id)

### Step 2: Create Missing Global Admin Policies
**New Migration Required:** `011_add_global_admin_suggestions.sql`

### Step 3: Test Global Admin Access
```sql
-- Create a test global admin user
SELECT link_global_admin_to_all_orgs('YOUR-AUTH-USER-ID'::uuid);

-- Verify global admin flag
SELECT user_id, organization_id, is_global_admin, role
FROM user_organizations
WHERE user_id = 'YOUR-AUTH-USER-ID'::uuid;

-- Test that global admin can see all suggestions
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "YOUR-AUTH-USER-ID"}';

SELECT COUNT(*) as total_suggestions FROM suggestions;
-- Should return ALL suggestions across ALL organizations
```

---

## 🔐 Security Considerations

### Global Admin Security Model:
1. **Two-tier Access:**
   - Standard users: Filtered by organization_id via `user_organizations` membership
   - Global admins: Bypass organization filtering via `is_global_admin` flag

2. **Flag-based Control:**
   - `is_global_admin = true` in `user_organizations` table
   - Checked by `is_global_admin(auth.uid())` function
   - Must be `is_active = true` to work

3. **Policy Precedence:**
   - RLS evaluates policies with OR logic
   - If ANY policy returns true, access is granted
   - Global admin policies use simple `is_global_admin(auth.uid())` check
   - Standard user policies use organization membership checks

4. **Recommendation:**
   - Audit global admin grants regularly
   - Log all global admin access in `user_activity_log`
   - Consider adding approval workflow for global admin assignment
   - Monitor `is_global_admin = true` changes in audit trail

---

## 📚 Related Documentation

- `/docs/HIVE_SESSION_MEMORY.md` - Previous session findings
- `/docs/ADMIN_ACCESS_FIX.md` - Admin session fix documentation
- `/database/migrations/007_create_global_superuser.sql` - Global admin implementation
- `/database/migrations/008_enhance_user_roles_and_approval.sql` - Role enhancements
- `/database/migrations/009_enhance_rls_organization_filtering.sql` - RLS optimization

---

## 🚀 Recommended Action Plan

### Immediate (Critical):
1. ✅ **Create Migration 011:** Add global admin policies for suggestions
2. ⚠️ **Verify Migration Status:** Check which migrations have been applied
3. ⚠️ **Test RLS Isolation:** Ensure organizations are properly isolated

### Short-term (Important):
4. 📋 Review global admin policies for remaining tables (suggestion_sections, workflow_*, etc.)
5. 🧪 Create comprehensive RLS test suite for global admin access
6. 📖 Document global admin setup procedure

### Long-term (Enhancement):
7. 📊 Add monitoring/logging for global admin actions
8. 🔐 Implement approval workflow for global admin grants
9. 🎯 Create admin dashboard for global admin management

---

## 📈 Testing Strategy

### Unit Tests:
```javascript
// Test that is_global_admin function exists and works
describe('is_global_admin function', () => {
  it('returns true for users with is_global_admin = true', async () => {
    const { data } = await supabase.rpc('is_global_admin', {
      p_user_id: globalAdminUserId
    });
    expect(data).toBe(true);
  });

  it('returns false for regular users', async () => {
    const { data } = await supabase.rpc('is_global_admin', {
      p_user_id: regularUserId
    });
    expect(data).toBe(false);
  });
});
```

### Integration Tests:
```javascript
// Test that global admin can see all suggestions
describe('Global Admin RLS', () => {
  it('allows global admin to see suggestions from all orgs', async () => {
    // Login as global admin
    const { data: suggestions } = await supabase
      .from('suggestions')
      .select('*');

    // Should return suggestions from ALL organizations
    const orgIds = [...new Set(suggestions.map(s => s.organization_id))];
    expect(orgIds.length).toBeGreaterThan(1);
  });

  it('prevents regular user from seeing other org suggestions', async () => {
    // Login as regular user in org A
    const { data: suggestions } = await supabase
      .from('suggestions')
      .select('*');

    // Should only return suggestions from org A
    const orgIds = [...new Set(suggestions.map(s => s.organization_id))];
    expect(orgIds).toEqual([userOrganizationId]);
  });
});
```

---

## 🎯 Summary of Findings

### ✅ What's Working:
- `is_global_admin` column defined in migrations
- `is_global_admin(UUID)` helper function created
- Global admin RLS policies for documents, document_sections, organizations
- Helper function to link global admin to all orgs
- Enhanced RLS with direct organization_id filtering

### ❌ What's Missing:
- Global admin RLS policies for **suggestions** table
- Global admin policies for suggestion_sections, votes, workflows
- Deployment verification (unknown if migrations 007-009 are applied)
- Comprehensive testing of global admin access

### ⚠️ What Needs Review:
- Apply migrations 007, 008, 009 to database
- Create migration 011 for suggestions global admin policies
- Test global admin access end-to-end
- Document setup procedure for production deployment

---

**Research Status:** ✅ COMPLETE
**Next Steps:** Create Migration 011 and verify deployment
**Priority:** HIGH (security gap in suggestions access)
