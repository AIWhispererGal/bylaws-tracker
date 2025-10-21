# Permissions Architecture - Implementation Guide

**Date:** 2025-10-19
**Related:** PERMISSIONS-ARCHITECTURE-REDESIGN.md
**Status:** Ready for Implementation

## Quick Start

### Step 1: Apply Database Migration

```bash
# Connect to your Supabase database
psql $DATABASE_URL

# Run migration
\i database/migrations/024_permissions_architecture.sql

# Verify migration
SELECT COUNT(*) FROM user_types;  -- Should return 2
SELECT COUNT(*) FROM organization_roles;  -- Should return 4
```

### Step 2: Test Permission Functions

```sql
-- Test global admin check
SELECT user_has_global_permission(
  'YOUR_USER_ID'::uuid,
  'can_access_all_organizations'
);

-- Test org permission check
SELECT user_has_org_permission(
  'YOUR_USER_ID'::uuid,
  'YOUR_ORG_ID'::uuid,
  'can_manage_users'
);

-- Test role level check
SELECT user_has_min_role_level(
  'YOUR_USER_ID'::uuid,
  'YOUR_ORG_ID'::uuid,
  3  -- Admin level
);
```

### Step 3: Update Server Imports (Gradual)

**Option A: Keep using old middleware (backwards compatible)**
```javascript
// No changes needed - old middleware still works
const { requireAdmin } = require('./middleware/roleAuth');
```

**Option B: Switch to new permissions middleware (recommended)**
```javascript
// New cleaner API
const { requireRole, requireOrgPermission } = require('./middleware/permissions');

// Instead of: requireAdmin
// Use: requireRole('admin') OR requireOrgPermission('can_manage_users')
```

---

## File-by-File Implementation Checklist

### Phase 1: Core Middleware (Week 1)

#### ✅ COMPLETED
- [x] `database/migrations/024_permissions_architecture.sql` - Migration created
- [x] `src/middleware/permissions.js` - New middleware created
- [x] `docs/architecture/PERMISSIONS-ARCHITECTURE-REDESIGN.md` - Architecture doc

#### 🔄 TODO

**File: `src/middleware/organization-context.js`**

Current:
```javascript
res.locals.currentUser = {
  role: req.session.userRole || 'viewer',
  is_global_admin: req.isGlobalAdmin || false
};
```

New (after migration):
```javascript
const { getEffectivePermissions, isGlobalAdmin } = require('./permissions');

async function attachOrganizationContext(req, res, next) {
  // ... existing organization fetch ...

  if (req.session?.userId && req.session?.organizationId) {
    const permissions = await getEffectivePermissions(req);
    const globalAdmin = await isGlobalAdmin(req);

    res.locals.currentUser = {
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName || req.session.userEmail,
      is_global_admin: globalAdmin,
      permissions: permissions  // NEW: Attach full permissions
    };
  }

  next();
}
```

**Impact:** Frontend templates can now use `currentUser.permissions.can_manage_users`

---

### Phase 2: Route Updates (Week 2-3)

#### High Priority Routes

**File: `src/routes/admin.js`**

Lines to update:
- Line ~15: `const { requireAdmin } = require('../middleware/roleAuth');`
- All `requireAdmin` middleware usage

Before:
```javascript
const { requireAdmin } = require('../middleware/roleAuth');

router.post('/api/organizations/:id/users/invite', requireAdmin, async (req, res) => {
  // ...
});
```

After:
```javascript
const { requireRole, requireOrgPermission } = require('../middleware/permissions');

// Option 1: Role-based (simpler, backwards compatible)
router.post('/api/organizations/:id/users/invite', requireRole('admin'), async (req, res) => {
  // ...
});

// Option 2: Permission-based (more granular)
router.post('/api/organizations/:id/users/invite', requireOrgPermission('can_manage_users'), async (req, res) => {
  // ...
});
```

**Routes to update in admin.js:**
- `/api/organizations/:id/users/invite` - Use `requireOrgPermission('can_manage_users')`
- `/api/organizations/:id/users/:userId/role` - Use `requireOrgPermission('can_manage_users')`
- `/api/organizations/:id/settings` - Use `requireOrgPermission('can_configure_organization')`
- `/api/organizations/:id/workflows` - Use `requireOrgPermission('can_manage_workflows')`

---

**File: `src/routes/users.js`**

Lines to update:
- Line ~5: Imports
- All permission checks

Before:
```javascript
const { requireAdmin, requireOwner } = require('../middleware/roleAuth');

router.delete('/:userId', requireOwner, async (req, res) => {
  // ...
});
```

After:
```javascript
const { requireRole } = require('../middleware/permissions');

router.delete('/:userId', requireRole('owner'), async (req, res) => {
  // ...
});
```

---

**File: `src/routes/workflow.js`**

Complex case - uses custom approval logic

Before:
```javascript
const { canApproveStage } = require('../middleware/roleAuth');

router.post('/approve/:sectionId', async (req, res) => {
  if (!await canApproveStage(req, req.body.stageId)) {
    return res.status(403).json({ error: 'Cannot approve at this stage' });
  }
  // ...
});
```

After:
```javascript
const { hasOrgPermission } = require('../middleware/permissions');

router.post('/approve/:sectionId', async (req, res) => {
  // Check if user can approve at this stage (custom logic)
  const canApprove = await hasOrgPermission(req, 'can_approve_stages');

  if (!canApprove) {
    return res.status(403).json({ error: 'Cannot approve at this stage' });
  }

  // Additional stage-specific checks can be done here
  // ...
});
```

---

**File: `src/routes/auth.js`**

Minimal changes - just update context attachment

Before:
```javascript
const { attachGlobalAdminStatus } = require('../middleware/globalAdmin');

router.use(attachGlobalAdminStatus);
```

After:
```javascript
const { attachUserPermissions } = require('../middleware/permissions');

router.use(attachUserPermissions);
```

---

### Phase 3: Frontend Templates (Week 4)

#### Admin Templates

**File: `views/admin/users.ejs`**

Before:
```ejs
<% if (currentUser.is_global_admin || currentUser.role === 'admin' || currentUser.role === 'owner') { %>
  <button class="btn-invite">Invite User</button>
<% } %>
```

After:
```ejs
<% if (currentUser.permissions.can_manage_users) { %>
  <button class="btn-invite">Invite User</button>
<% } %>
```

**Files to update:**
- `views/admin/users.ejs` - Update role checks → permission checks
- `views/admin/user-management.ejs` - Update admin UI visibility
- `views/admin/workflow-assign.ejs` - Update workflow assignment checks
- `views/admin/workflow-editor.ejs` - Update workflow editor permissions
- `views/dashboard/dashboard.ejs` - Update dashboard action visibility
- `views/dashboard/document-viewer.ejs` - Update edit/delete button visibility

---

### Phase 4: Database RLS Policies (Week 4)

**Files to update:**
- `database/migrations/013_fix_global_admin_rls.sql` - Already partially fixed
- Any custom RLS policies in other migrations

Before (causes recursion):
```sql
CREATE POLICY "Global admins access all" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_global_admin = true  -- RECURSION!
    )
  );
```

After (no recursion):
```sql
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

## Testing Checklist

### Unit Tests

**Create: `tests/unit/permissions.test.js`**

```javascript
const { hasGlobalPermission, hasOrgPermission, hasMinRoleLevel } = require('../../src/middleware/permissions');

describe('Permissions System', () => {
  describe('hasGlobalPermission', () => {
    it('should return true for global admins', async () => {
      const req = {
        session: { userId: 'global-admin-id' },
        supabase: {
          rpc: jest.fn().mockResolvedValue({ data: true, error: null })
        }
      };

      const result = await hasGlobalPermission(req, 'can_access_all_organizations');
      expect(result).toBe(true);
    });

    it('should return false for regular users', async () => {
      const req = {
        session: { userId: 'regular-user-id' },
        supabase: {
          rpc: jest.fn().mockResolvedValue({ data: false, error: null })
        }
      };

      const result = await hasGlobalPermission(req, 'can_access_all_organizations');
      expect(result).toBe(false);
    });
  });

  // Add more tests for hasOrgPermission, hasMinRoleLevel, etc.
});
```

**Update existing tests:**
- `tests/unit/roleAuth.test.js` - Update to use new permissions
- `tests/unit/admin-integration.test.js` - Update admin tests
- `tests/integration/admin-api.test.js` - Update API tests

---

### Integration Tests

**Test scenarios:**

1. **Global Admin Access**
   - Global admin can access all organizations
   - Global admin can perform admin actions in any org
   - Global admin bypasses org role checks

2. **Organization Role Hierarchy**
   - Owner can do everything
   - Admin can manage users but not delete org
   - Member can edit but not manage
   - Viewer can only view

3. **Permission Granularity**
   - User with `can_manage_users` can invite users
   - User without `can_upload_documents` cannot upload
   - User with `can_approve_stages` can approve workflow stages

4. **Backwards Compatibility**
   - Old `requireAdmin` middleware still works
   - Old role checks still work
   - No breaking changes for existing code

---

## Rollout Strategy

### Week 1: Database Migration
- [ ] Run migration on staging database
- [ ] Verify data migration (all users have user_type_id)
- [ ] Test permission functions with real data
- [ ] Run staging tests

### Week 2: Middleware Update
- [ ] Deploy new `permissions.js` middleware
- [ ] Update `organization-context.js` to attach permissions
- [ ] Verify no breaking changes (backwards compatibility)
- [ ] Deploy to staging

### Week 3: Route Updates
- [ ] Update `admin.js` routes
- [ ] Update `users.js` routes
- [ ] Update `auth.js` routes
- [ ] Update `workflow.js` routes
- [ ] Deploy to staging, run full test suite

### Week 4: Frontend + Production
- [ ] Update admin templates
- [ ] Update dashboard templates
- [ ] Update RLS policies
- [ ] Final staging validation
- [ ] **Deploy to production**
- [ ] Monitor for errors

---

## Monitoring & Validation

### Post-Deployment Checks

```sql
-- Verify all users have user types
SELECT COUNT(*) FROM users WHERE user_type_id IS NULL;
-- Should return 0

-- Verify all user_organizations have role IDs
SELECT COUNT(*) FROM user_organizations WHERE org_role_id IS NULL;
-- Should return 0

-- Check permission function performance
EXPLAIN ANALYZE
SELECT user_has_org_permission(
  'YOUR_USER_ID'::uuid,
  'YOUR_ORG_ID'::uuid,
  'can_manage_users'
);
-- Should be < 50ms
```

### Error Monitoring

Watch for these errors in logs:
- `Error checking global permission`
- `Error checking org permission`
- `Error in hasMinRoleLevel`
- `Permission denied: can_*`

### Metrics to Track

- Permission check latency (should be < 50ms)
- Failed permission checks (should decrease, not increase)
- RLS errors (should be 0 after migration)

---

## Common Issues & Solutions

### Issue 1: Permission function returns null

**Cause:** User doesn't have `user_type_id` or `org_role_id` set

**Solution:**
```sql
-- Fix missing user_type_id
UPDATE users SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'regular_user'
)
WHERE user_type_id IS NULL;

-- Fix missing org_role_id
UPDATE user_organizations uo SET org_role_id = (
  SELECT id FROM organization_roles WHERE role_code = uo.role
)
WHERE org_role_id IS NULL;
```

### Issue 2: Global admin can't access organization

**Cause:** RLS policy still using old `user_organizations.is_global_admin`

**Solution:** Update RLS policy to use `users.user_type_id`

### Issue 3: Permission check is slow

**Cause:** Missing index on new columns

**Solution:**
```sql
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_role_id ON user_organizations(org_role_id);
```

---

## Success Criteria

✅ All users migrated to new permission system
✅ Zero RLS recursion errors
✅ Permission checks < 50ms latency
✅ 100% backwards compatibility maintained
✅ Frontend shows correct permissions
✅ All tests passing

---

**Next Steps:**
1. Review this guide with team
2. Run migration on staging
3. Begin Week 1 implementation
4. Update this checklist as items are completed
