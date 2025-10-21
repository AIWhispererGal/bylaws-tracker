# Permissions System Architecture Redesign

**Date:** 2025-10-19
**Status:** Proposed
**Author:** System Architect Agent

## Executive Summary

The current permissions system has accumulated technical debt through multiple migrations, resulting in:
- **Dual `is_global_admin` locations** (both `users` and `user_organizations` tables)
- **Scattered permission checks** across 71+ files
- **Mixed role + permission-based patterns** without clear separation
- **RLS infinite recursion** requiring workarounds

This document proposes a clean, centralized permissions architecture that:
1. Separates global user types from organization roles
2. Consolidates permission logic in a single source of truth
3. Provides backwards compatibility during migration
4. Eliminates RLS recursion issues permanently

---

## PART 1: Current Permissions Analysis

### 1.1 Permission Storage Locations

**Current State:**
```
users table:
  ├─ is_global_admin (BOOLEAN) ← Added in migration 023 to fix RLS recursion

user_organizations table:
  ├─ role (VARCHAR) ← 'owner', 'admin', 'member', 'viewer'
  ├─ is_global_admin (BOOLEAN) ← Original location, now deprecated
  ├─ permissions (JSONB) ← Custom permission flags
  ├─ is_active (BOOLEAN)
  ├─ invited_at, invited_by, last_active
```

**Issues:**
- `is_global_admin` exists in TWO places (users and user_organizations)
- No clear migration path to remove old column
- Role hierarchy hardcoded in multiple places
- Permission checks scattered across codebase

### 1.2 Current Permission Check Patterns

**Pattern 1: Role-Based (Hierarchy)**
```javascript
// src/middleware/roleAuth.js
const roleHierarchy = {
  'owner': 4,
  'admin': 3,
  'member': 2,
  'viewer': 1
};

async function hasRole(req, requiredRole) {
  // Global admins bypass all role checks
  if (await isGlobalAdmin(req)) return true;

  // Check user's role in organization
  const userRoleLevel = roleHierarchy[data.role] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
  return userRoleLevel >= requiredRoleLevel;
}
```

**Pattern 2: Permission-Based (Flags)**
```javascript
// src/middleware/roleAuth.js
function requirePermission(permission) {
  return async (req, res, next) => {
    const { data } = await supabase
      .from('user_organizations')
      .select('permissions, is_active')
      // ...

    const permissions = data.permissions || {};
    if (!permissions[permission]) {
      return res.status(403).json({ error: 'Permission denied' });
    }
  };
}
```

**Pattern 3: Workflow Stage Approval**
```javascript
async function canApproveStage(req, stageId) {
  // Get stage required roles
  const { data: stage } = await supabase
    .from('workflow_stages')
    .select('required_roles, ...')

  // Check if user's role is in required roles
  return requiredRoles.includes(userOrg.role);
}
```

### 1.3 Files Requiring Permission Checks

**Backend (71 files):**
- `src/middleware/roleAuth.js` ← Core permission logic
- `src/middleware/globalAdmin.js` ← Global admin checks
- `src/middleware/organization-context.js` ← Context attachment
- `src/routes/admin.js` ← Admin routes
- `src/routes/auth.js` ← Authentication
- `src/routes/users.js` ← User management
- `src/routes/workflow.js` ← Workflow operations
- `src/routes/approval.js` ← Approval operations
- `src/routes/setup.js` ← Setup wizard
- `src/routes/dashboard.js` ← Dashboard

**Frontend (7 files):**
- `views/admin/*.ejs` ← Admin UI templates
- `views/dashboard/*.ejs` ← Dashboard UI
- `views/auth/*.ejs` ← Auth UI

**Database (15+ migrations):**
- RLS policies checking `is_global_admin`
- Helper functions (`user_has_role`, `user_can_approve_stage`)
- Workflow stage policies

---

## PART 2: Recommended Architecture

### 2.1 Design Decision: Option B (Hybrid Approach)

**Selected: Separate User Types + Organization Roles**

**Rationale:**
- ✅ Clear separation: Global permissions vs org-specific permissions
- ✅ Prevents RLS recursion (user types stored in `users` table)
- ✅ Flexible: Can add more user types without affecting org roles
- ✅ Matches current mental model (global admins vs org members)
- ✅ Easier to audit and debug

### 2.2 New Schema Design

```sql
-- ============================================================================
-- GLOBAL USER TYPES (Platform-Level)
-- ============================================================================

CREATE TABLE user_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code VARCHAR(50) UNIQUE NOT NULL, -- 'global_admin', 'regular_user'
  type_name VARCHAR(100) NOT NULL,       -- Display name
  description TEXT,

  -- Global permissions (platform-wide)
  global_permissions JSONB DEFAULT '{
    "can_access_all_organizations": false,
    "can_create_organizations": false,
    "can_delete_organizations": false,
    "can_manage_platform_users": false,
    "can_view_system_logs": false,
    "can_configure_system": false
  }'::jsonb,

  -- Metadata
  is_system_type BOOLEAN DEFAULT FALSE,  -- Prevent deletion
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default user types
INSERT INTO user_types (type_code, type_name, description, global_permissions, is_system_type)
VALUES
  ('global_admin', 'Global Administrator', 'Platform-wide administrator with access to all organizations',
   '{"can_access_all_organizations": true, "can_create_organizations": true, "can_delete_organizations": true, "can_manage_platform_users": true, "can_view_system_logs": true, "can_configure_system": true}'::jsonb,
   true),
  ('regular_user', 'Regular User', 'Standard user with organization-based access only',
   '{"can_access_all_organizations": false, "can_create_organizations": false, "can_delete_organizations": false, "can_manage_platform_users": false, "can_view_system_logs": false, "can_configure_system": false}'::jsonb,
   true);

-- Add user_type_id to users table
ALTER TABLE users
  ADD COLUMN user_type_id UUID REFERENCES user_types(id) DEFAULT (
    SELECT id FROM user_types WHERE type_code = 'regular_user'
  );

CREATE INDEX idx_users_type ON users(user_type_id);

-- ============================================================================
-- ORGANIZATION ROLES (Organization-Specific)
-- ============================================================================

CREATE TABLE organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code VARCHAR(50) UNIQUE NOT NULL,  -- 'owner', 'admin', 'member', 'viewer'
  role_name VARCHAR(100) NOT NULL,        -- Display name
  description TEXT,
  hierarchy_level INTEGER NOT NULL,       -- 4=owner, 3=admin, 2=member, 1=viewer

  -- Organization-level permissions
  org_permissions JSONB DEFAULT '{
    "can_edit_sections": false,
    "can_create_suggestions": false,
    "can_vote": false,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false,
    "can_upload_documents": false,
    "can_delete_documents": false,
    "can_configure_organization": false
  }'::jsonb,

  -- Metadata
  is_system_role BOOLEAN DEFAULT FALSE,   -- Prevent deletion
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(hierarchy_level)
);

-- Insert default organization roles
INSERT INTO organization_roles (role_code, role_name, description, hierarchy_level, org_permissions, is_system_role)
VALUES
  ('owner', 'Owner', 'Organization owner with full permissions', 4,
   '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": ["all"], "can_manage_users": true, "can_manage_workflows": true, "can_upload_documents": true, "can_delete_documents": true, "can_configure_organization": true}'::jsonb,
   true),
  ('admin', 'Administrator', 'Organization administrator with management permissions', 3,
   '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": ["committee", "board"], "can_manage_users": true, "can_manage_workflows": true, "can_upload_documents": true, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
   true),
  ('member', 'Member', 'Regular member with editing permissions', 2,
   '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": [], "can_manage_users": false, "can_manage_workflows": false, "can_upload_documents": false, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
   true),
  ('viewer', 'Viewer', 'Read-only access to organization', 1,
   '{"can_edit_sections": false, "can_create_suggestions": false, "can_vote": false, "can_approve_stages": [], "can_manage_users": false, "can_manage_workflows": false, "can_upload_documents": false, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
   true);

-- Update user_organizations to reference role_id instead of role string
ALTER TABLE user_organizations
  ADD COLUMN org_role_id UUID REFERENCES organization_roles(id);

-- Migrate existing role strings to role IDs
UPDATE user_organizations uo
SET org_role_id = (
  SELECT id FROM organization_roles
  WHERE role_code = uo.role
);

-- Create index
CREATE INDEX idx_user_orgs_role_id ON user_organizations(org_role_id);
```

### 2.3 Permission Check Functions (Centralized)

```sql
-- ============================================================================
-- PERMISSION HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- Check if user has global permission
CREATE OR REPLACE FUNCTION user_has_global_permission(
  p_user_id UUID,
  p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  SELECT (ut.global_permissions->>p_permission)::boolean
  INTO has_permission
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = p_user_id;

  RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if user has organization permission
CREATE OR REPLACE FUNCTION user_has_org_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  -- Global admins have all org permissions
  IF user_has_global_permission(p_user_id, 'can_access_all_organizations') THEN
    RETURN TRUE;
  END IF;

  -- Check org-specific permission
  SELECT (r.org_permissions->>p_permission)::boolean
  INTO has_permission
  FROM user_organizations uo
  JOIN organization_roles r ON uo.org_role_id = r.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE;

  RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if user has minimum role level in organization
CREATE OR REPLACE FUNCTION user_has_min_role_level(
  p_user_id UUID,
  p_organization_id UUID,
  p_min_level INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  user_level INTEGER;
BEGIN
  -- Global admins have max level
  IF user_has_global_permission(p_user_id, 'can_access_all_organizations') THEN
    RETURN TRUE;
  END IF;

  -- Get user's role level
  SELECT r.hierarchy_level
  INTO user_level
  FROM user_organizations uo
  JOIN organization_roles r ON uo.org_role_id = r.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE;

  RETURN COALESCE(user_level, 0) >= p_min_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get user's effective permissions (merged global + org)
CREATE OR REPLACE FUNCTION get_user_effective_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  global_perms JSONB;
  org_perms JSONB;
  effective_perms JSONB;
BEGIN
  -- Get global permissions
  SELECT ut.global_permissions
  INTO global_perms
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = p_user_id;

  -- Get org permissions
  SELECT r.org_permissions
  INTO org_perms
  FROM user_organizations uo
  JOIN organization_roles r ON uo.org_role_id = r.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE;

  -- Merge permissions (global | org)
  effective_perms := COALESCE(global_perms, '{}'::jsonb) || COALESCE(org_perms, '{}'::jsonb);

  RETURN effective_perms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## PART 3: Migration Plan

### 3.1 Step-by-Step Migration

**Phase 1: Create New Tables (Non-Breaking)**
```sql
-- Step 1: Create new tables
-- (user_types, organization_roles from Section 2.2)

-- Step 2: Add new columns
ALTER TABLE users ADD COLUMN user_type_id UUID REFERENCES user_types(id);
ALTER TABLE user_organizations ADD COLUMN org_role_id UUID REFERENCES organization_roles(id);

-- Step 3: Migrate existing data
-- Migrate is_global_admin from user_organizations to users.user_type_id
UPDATE users
SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'global_admin'
)
WHERE id IN (
  SELECT DISTINCT user_id
  FROM user_organizations
  WHERE is_global_admin = true
);

-- Set regular users
UPDATE users
SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'regular_user'
)
WHERE user_type_id IS NULL;

-- Migrate role strings to role IDs
UPDATE user_organizations uo
SET org_role_id = (
  SELECT id FROM organization_roles WHERE role_code = uo.role
);

-- Step 4: Create helper functions
-- (Permission helper functions from Section 2.3)
```

**Phase 2: Update Middleware (Backwards Compatible)**
```javascript
// src/middleware/permissions.js (NEW FILE)

/**
 * Centralized permission checking
 */
async function hasGlobalPermission(req, permission) {
  if (!req.session?.userId) return false;

  const { data, error } = await req.supabase.rpc(
    'user_has_global_permission',
    { p_user_id: req.session.userId, p_permission: permission }
  );

  return !error && data;
}

async function hasOrgPermission(req, permission) {
  if (!req.session?.userId || !req.session?.organizationId) return false;

  const { data, error } = await req.supabase.rpc(
    'user_has_org_permission',
    {
      p_user_id: req.session.userId,
      p_organization_id: req.session.organizationId,
      p_permission: permission
    }
  );

  return !error && data;
}

async function hasMinRoleLevel(req, minLevel) {
  if (!req.session?.userId || !req.session?.organizationId) return false;

  const { data, error } = await req.supabase.rpc(
    'user_has_min_role_level',
    {
      p_user_id: req.session.userId,
      p_organization_id: req.session.organizationId,
      p_min_level: minLevel
    }
  );

  return !error && data;
}

// Backwards-compatible wrapper
async function isGlobalAdmin(req) {
  return hasGlobalPermission(req, 'can_access_all_organizations');
}

// Role hierarchy mapping
const ROLE_LEVELS = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};

async function hasRole(req, roleName) {
  return hasMinRoleLevel(req, ROLE_LEVELS[roleName] || 0);
}

module.exports = {
  hasGlobalPermission,
  hasOrgPermission,
  hasMinRoleLevel,
  hasRole,
  isGlobalAdmin,

  // Middleware factories
  requireGlobalPermission: (permission) => async (req, res, next) => {
    if (!await hasGlobalPermission(req, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  },

  requireOrgPermission: (permission) => async (req, res, next) => {
    if (!await hasOrgPermission(req, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  },

  requireRole: (roleName) => async (req, res, next) => {
    if (!await hasRole(req, roleName)) {
      return res.status(403).json({ error: `${roleName} role required` });
    }
    next();
  }
};
```

**Phase 3: Update Routes (Gradual)**
```javascript
// OLD (current pattern)
const { requireAdmin } = require('./middleware/roleAuth');
router.post('/invite', requireAdmin, async (req, res) => { ... });

// NEW (cleaner pattern)
const { requireRole, requireOrgPermission } = require('./middleware/permissions');

// Option 1: Role-based
router.post('/invite', requireRole('admin'), async (req, res) => { ... });

// Option 2: Permission-based (more granular)
router.post('/invite', requireOrgPermission('can_manage_users'), async (req, res) => { ... });
```

**Phase 4: Deprecate Old Columns (Future)**
```sql
-- After all code is migrated:

-- Mark old columns as deprecated (add comment)
COMMENT ON COLUMN user_organizations.role IS
  'DEPRECATED: Use org_role_id instead. Will be removed in v3.0';

COMMENT ON COLUMN user_organizations.is_global_admin IS
  'DEPRECATED: Use users.user_type_id instead. Will be removed in v3.0';

COMMENT ON COLUMN user_organizations.permissions IS
  'DEPRECATED: Use organization_roles.org_permissions instead. Will be removed in v3.0';

-- Eventually drop old columns (v3.0)
-- ALTER TABLE user_organizations DROP COLUMN role;
-- ALTER TABLE user_organizations DROP COLUMN is_global_admin;
-- ALTER TABLE user_organizations DROP COLUMN permissions;
```

### 3.2 Rollback Plan

If migration causes issues:

```sql
-- Rollback: Remove new columns
ALTER TABLE users DROP COLUMN user_type_id;
ALTER TABLE user_organizations DROP COLUMN org_role_id;

-- Rollback: Drop new tables
DROP TABLE IF EXISTS organization_roles CASCADE;
DROP TABLE IF EXISTS user_types CASCADE;

-- Rollback: Drop helper functions
DROP FUNCTION IF EXISTS user_has_global_permission;
DROP FUNCTION IF EXISTS user_has_org_permission;
DROP FUNCTION IF EXISTS user_has_min_role_level;
DROP FUNCTION IF EXISTS get_user_effective_permissions;

-- Revert to old middleware
git checkout HEAD -- src/middleware/permissions.js
```

---

## PART 4: Code Changes Required

### 4.1 Backend Files to Update

**High Priority (Core Logic):**
1. `src/middleware/roleAuth.js` → Refactor to use new permission system
2. `src/middleware/globalAdmin.js` → Update global admin checks
3. `src/middleware/organization-context.js` → Attach effective permissions
4. `src/routes/admin.js` → Update admin route guards
5. `src/routes/users.js` → Update user management permissions
6. `src/routes/workflow.js` → Update workflow permissions
7. `src/routes/auth.js` → Update auth context

**Medium Priority (Feature-Specific):**
8. `src/routes/approval.js` → Update approval permissions
9. `src/routes/setup.js` → Update setup wizard permissions
10. `src/routes/dashboard.js` → Update dashboard permissions
11. `src/services/setupService.js` → Update setup service

**Low Priority (Testing):**
12. `tests/unit/roleAuth.test.js` → Update tests
13. `tests/unit/admin-integration.test.js` → Update tests
14. `tests/integration/*.test.js` → Update integration tests

### 4.2 Frontend Files to Update

**Templates:**
1. `views/admin/users.ejs` → Update role display
2. `views/admin/user-management.ejs` → Update user management UI
3. `views/admin/workflow-assign.ejs` → Update workflow assignment
4. `views/admin/workflow-editor.ejs` → Update workflow editor
5. `views/dashboard/dashboard.ejs` → Update dashboard permissions
6. `views/dashboard/document-viewer.ejs` → Update document viewer
7. `views/auth/profile.ejs` → Update profile display

**Changes Required:**
```ejs
<!-- OLD -->
<% if (currentUser.is_global_admin || currentUser.role === 'admin') { %>
  <button>Admin Action</button>
<% } %>

<!-- NEW (cleaner) -->
<% if (currentUser.permissions.can_manage_users) { %>
  <button>Admin Action</button>
<% } %>
```

### 4.3 Database Files to Update

**RLS Policies:**
```sql
-- OLD: Check is_global_admin in user_organizations (causes recursion)
CREATE POLICY "Global admins access all" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_global_admin = true
    )
  );

-- NEW: Check user_type_id in users (no recursion)
CREATE POLICY "Global admins access all" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()
      AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
    )
  );
```

---

## PART 5: Implementation Order

### Week 1: Foundation (Non-Breaking)
- [ ] Create migration `024_permissions_architecture.sql`
- [ ] Create `user_types` and `organization_roles` tables
- [ ] Migrate existing data to new structure
- [ ] Create permission helper functions
- [ ] Test migration on staging database

### Week 2: Middleware Layer
- [ ] Create new `src/middleware/permissions.js`
- [ ] Implement backwards-compatible wrappers
- [ ] Update `organization-context.js` to attach effective permissions
- [ ] Write unit tests for new permission system
- [ ] Deploy to staging for testing

### Week 3: Route Updates (Gradual)
- [ ] Update `src/routes/admin.js` (highest traffic)
- [ ] Update `src/routes/users.js`
- [ ] Update `src/routes/auth.js`
- [ ] Update integration tests
- [ ] Deploy to staging

### Week 4: Frontend + Cleanup
- [ ] Update admin templates
- [ ] Update dashboard templates
- [ ] Update RLS policies to use new structure
- [ ] Add deprecation warnings to old columns
- [ ] Deploy to production

### Future (v3.0): Complete Migration
- [ ] Remove old `role` column from `user_organizations`
- [ ] Remove old `is_global_admin` from `user_organizations`
- [ ] Remove old `permissions` JSONB from `user_organizations`
- [ ] Remove backwards-compatibility wrappers

---

## PART 6: Benefits of New Architecture

### 6.1 Technical Benefits

✅ **No More RLS Recursion**
- Global admin check uses `users` table directly
- No circular queries through `user_organizations`

✅ **Centralized Permission Logic**
- Single source of truth in database functions
- Permission changes don't require code deploys

✅ **Better Auditability**
- Permission changes logged in `user_types` and `organization_roles` tables
- Clear history of who has what permissions

✅ **Type Safety**
- Role IDs instead of strings (prevents typos)
- JSONB permissions with defined schemas

✅ **Performance**
- Indexed lookups on `user_type_id` and `org_role_id`
- Fewer joins for permission checks

### 6.2 Developer Experience Benefits

✅ **Clearer Mental Model**
```
User Type (Global) → "Is this user special platform-wide?"
Organization Role → "What can this user do in THIS organization?"
```

✅ **Easier Testing**
```javascript
// OLD: Mock multiple tables and relationships
const mockUser = { role: 'admin', is_global_admin: false, permissions: {...} };

// NEW: Mock single permission check
jest.spyOn(permissions, 'hasOrgPermission').mockResolvedValue(true);
```

✅ **Self-Documenting Code**
```javascript
// OLD: What does 'admin' mean? Need to check hierarchy
requireAdmin(req, res, next);

// NEW: Explicit what permission is needed
requireOrgPermission('can_manage_users')(req, res, next);
```

---

## PART 7: Risk Analysis

### 7.1 Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|-----------|
| Data loss during migration | Low | Critical | Run migration in transaction, test on staging first |
| Broken permissions during transition | Medium | High | Keep old columns during migration, gradual rollout |
| Performance degradation | Low | Medium | Index new columns, benchmark before deploy |
| Frontend-backend mismatch | Medium | Medium | Deploy backend first, verify before frontend update |

### 7.2 Testing Strategy

**Unit Tests:**
- Test each helper function independently
- Mock database responses
- Cover all permission combinations

**Integration Tests:**
- Test actual database queries
- Verify RLS policies work correctly
- Test global admin vs regular user flows

**End-to-End Tests:**
- Test full user workflows
- Verify UI shows correct permissions
- Test role changes propagate correctly

---

## PART 8: Conclusion

### Recommended Approach

1. **Adopt Option B (Hybrid)** - Separate user types + organization roles
2. **Migrate gradually** - Keep backwards compatibility
3. **Test thoroughly** - Staging environment before production
4. **Document clearly** - Update all developer docs

### Next Steps

1. Review this architecture document with team
2. Create migration script (`024_permissions_architecture.sql`)
3. Test migration on local database
4. Deploy to staging for validation
5. Update middleware layer
6. Gradual rollout to production

### Success Metrics

- ✅ Zero RLS recursion errors
- ✅ All permission checks under 50ms
- ✅ 100% test coverage for permission logic
- ✅ Clear audit trail of permission changes
- ✅ Developers can understand permissions in <5 minutes

---

**Document Version:** 1.0
**Last Updated:** 2025-10-19
**Approval Status:** Pending Review
