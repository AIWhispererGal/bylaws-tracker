# Permissions System - Quick Reference Card

**Version:** 2.0 (New Architecture)
**Status:** Ready for Implementation
**Last Updated:** 2025-10-19

---

## 🚀 Quick Start (For Developers)

### Import the New Middleware

```javascript
const { requireOrgPermission, requireRole, hasOrgPermission } = require('../middleware/permissions');
```

### Replace Old Patterns

| Old Pattern | New Pattern |
|------------|------------|
| `requireAdmin` | `requireRole('admin')` |
| `requireOwner` | `requireRole('owner')` |
| `requireMember` | `requireRole('member')` |
| `isGlobalAdmin(req)` | `hasGlobalPermission(req, 'can_access_all_organizations')` |

---

## 📚 Common Use Cases

### 1. Protect Route (Role-Based)

```javascript
// User management route - requires admin
router.post('/api/users/invite',
  requireRole('admin'),
  async (req, res) => {
    // Your code here
  }
);
```

### 2. Protect Route (Permission-Based)

```javascript
// Document upload - requires specific permission
router.post('/api/documents/upload',
  requireOrgPermission('can_upload_documents'),
  async (req, res) => {
    // Your code here
  }
);
```

### 3. Check Permission in Code

```javascript
// Check permission before showing UI element
const canEdit = await hasOrgPermission(req, 'can_edit_sections');

if (canEdit) {
  // Show edit button
}
```

### 4. Get All User Permissions

```javascript
// Get merged global + org permissions
const permissions = await getEffectivePermissions(req);

res.json({
  canEdit: permissions.can_edit_sections,
  canManageUsers: permissions.can_manage_users,
  // etc.
});
```

---

## 🎯 Permission Reference

### Global Permissions (Platform-Level)

| Permission | Description |
|-----------|-------------|
| `can_access_all_organizations` | Access all orgs (global admins only) |
| `can_create_organizations` | Create new organizations |
| `can_delete_organizations` | Delete organizations |
| `can_manage_platform_users` | Manage users across platform |
| `can_view_system_logs` | View system-wide logs |
| `can_configure_system` | Configure platform settings |

### Organization Permissions (Org-Specific)

| Permission | Description | Default Roles |
|-----------|-------------|---------------|
| `can_edit_sections` | Edit document sections | owner, admin, member |
| `can_create_suggestions` | Create amendment suggestions | owner, admin, member |
| `can_vote` | Vote on suggestions | owner, admin, member |
| `can_approve_stages` | Approve workflow stages | owner, admin |
| `can_manage_users` | Invite/manage org users | owner, admin |
| `can_manage_workflows` | Configure workflows | owner, admin |
| `can_upload_documents` | Upload documents | owner, admin |
| `can_delete_documents` | Delete documents | owner only |
| `can_configure_organization` | Configure org settings | owner only |

---

## 🔧 API Reference

### Check Functions

```javascript
// Check global permission
hasGlobalPermission(req, permissionName)
// Returns: Promise<boolean>

// Check organization permission
hasOrgPermission(req, permissionName)
// Returns: Promise<boolean>

// Check role level
hasMinRoleLevel(req, level)  // 4=owner, 3=admin, 2=member, 1=viewer
// Returns: Promise<boolean>

// Check role by name
hasRole(req, roleName)  // 'owner', 'admin', 'member', 'viewer'
// Returns: Promise<boolean>

// Get effective permissions
getEffectivePermissions(req)
// Returns: Promise<Object>
```

### Middleware Factories

```javascript
// Require global permission
requireGlobalPermission('can_create_organizations')

// Require organization permission
requireOrgPermission('can_manage_users')

// Require minimum role
requireRole('admin')

// Backwards compatible
requireAdmin  // Same as requireRole('admin')
requireOwner  // Same as requireRole('owner')
requireMember // Same as requireRole('member')
```

---

## 🏗️ Database Helper Functions

```sql
-- Check global permission
SELECT user_has_global_permission(
  'user-uuid'::uuid,
  'can_access_all_organizations'
);

-- Check org permission
SELECT user_has_org_permission(
  'user-uuid'::uuid,
  'org-uuid'::uuid,
  'can_manage_users'
);

-- Check role level
SELECT user_has_min_role_level(
  'user-uuid'::uuid,
  'org-uuid'::uuid,
  3  -- Admin level
);

-- Get effective permissions
SELECT get_user_effective_permissions(
  'user-uuid'::uuid,
  'org-uuid'::uuid
);
```

---

## 🎨 Frontend Templates

### Check User Type

```ejs
<!-- Check if global admin -->
<% if (currentUser.is_global_admin) { %>
  <button>Platform Admin Action</button>
<% } %>
```

### Check Permission

```ejs
<!-- Check specific permission -->
<% if (currentUser.permissions.can_manage_users) { %>
  <button>Invite User</button>
<% } %>
```

### Multiple Permission Check

```ejs
<!-- Check multiple permissions -->
<% if (currentUser.permissions.can_edit_sections || currentUser.is_global_admin) { %>
  <button>Edit Section</button>
<% } %>
```

---

## 🔄 Migration Examples

### Example 1: Admin Route

**Before:**
```javascript
const { requireAdmin } = require('../middleware/roleAuth');

router.post('/invite', requireAdmin, async (req, res) => {
  // ...
});
```

**After:**
```javascript
const { requireOrgPermission } = require('../middleware/permissions');

router.post('/invite',
  requireOrgPermission('can_manage_users'),
  async (req, res) => {
    // ...
  }
);
```

**Why better?** More explicit about what permission is needed.

### Example 2: Global Admin Check

**Before:**
```javascript
const { isGlobalAdmin } = require('../middleware/globalAdmin');

if (await isGlobalAdmin(req)) {
  // Global admin logic
}
```

**After:**
```javascript
const { hasGlobalPermission } = require('../middleware/permissions');

if (await hasGlobalPermission(req, 'can_access_all_organizations')) {
  // Global admin logic
}
```

**Why better?** Uses centralized permission system, clearer intent.

### Example 3: Complex Permission Check

**Before:**
```javascript
const { hasRole, isGlobalAdmin } = require('../middleware/roleAuth');

const canEdit = await isGlobalAdmin(req) || await hasRole(req, 'admin');
```

**After:**
```javascript
const { hasOrgPermission } = require('../middleware/permissions');

const canEdit = await hasOrgPermission(req, 'can_edit_sections');
// Global admin check is automatic in hasOrgPermission
```

**Why better?** Single function call, global admin check built-in.

---

## 🧪 Testing Examples

### Unit Test

```javascript
const { hasOrgPermission } = require('../../src/middleware/permissions');

describe('hasOrgPermission', () => {
  it('should return true for admin with can_manage_users', async () => {
    const req = {
      session: { userId: 'user-id', organizationId: 'org-id' },
      supabase: {
        rpc: jest.fn().mockResolvedValue({ data: true, error: null })
      }
    };

    const result = await hasOrgPermission(req, 'can_manage_users');
    expect(result).toBe(true);
    expect(req.supabase.rpc).toHaveBeenCalledWith(
      'user_has_org_permission',
      expect.objectContaining({
        p_permission: 'can_manage_users'
      })
    );
  });
});
```

### Integration Test

```javascript
it('should allow admin to invite users', async () => {
  const response = await request(app)
    .post('/api/organizations/org-id/users/invite')
    .set('Cookie', `session=${adminSessionToken}`)
    .send({ email: 'newuser@example.com' });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
});

it('should deny member from inviting users', async () => {
  const response = await request(app)
    .post('/api/organizations/org-id/users/invite')
    .set('Cookie', `session=${memberSessionToken}`)
    .send({ email: 'newuser@example.com' });

  expect(response.status).toBe(403);
  expect(response.body.error).toMatch(/permission/i);
});
```

---

## 📊 Role Hierarchy

```
owner (level 4)
  ↓ can do everything
admin (level 3)
  ↓ can manage users, workflows
member (level 2)
  ↓ can edit, suggest, vote
viewer (level 1)
  ↓ read-only access
```

**Rule:** Higher level = more permissions

**Example:**
- `hasMinRoleLevel(req, 3)` → Returns true for admin and owner
- `hasMinRoleLevel(req, 2)` → Returns true for member, admin, and owner

---

## ⚠️ Common Mistakes

### ❌ Don't Do This

```javascript
// Hardcoding role strings
if (req.session.userRole === 'admin') { ... }

// Checking is_global_admin on user_organizations (causes RLS recursion)
SELECT * FROM user_organizations WHERE is_global_admin = true

// Using old middleware without migration
const { requireAdmin } = require('../middleware/roleAuth');
// This still works but is deprecated
```

### ✅ Do This Instead

```javascript
// Use new permission functions
if (await hasRole(req, 'admin')) { ... }

// Check user_type_id on users table (no recursion)
SELECT * FROM users u
JOIN user_types ut ON u.user_type_id = ut.id
WHERE (ut.global_permissions->>'can_access_all_organizations')::boolean

// Use new permissions middleware
const { requireRole } = require('../middleware/permissions');
```

---

## 🆘 Troubleshooting

### Permission check returns false unexpectedly

**Check:**
1. User has `user_type_id` set in `users` table
2. User has `org_role_id` set in `user_organizations` table
3. User's organization membership is active (`is_active = true`)
4. Permission name is spelled correctly

**Fix:**
```sql
-- Verify user setup
SELECT u.id, u.email, ut.type_code, uo.org_role_id, r.role_code
FROM users u
LEFT JOIN user_types ut ON u.user_type_id = ut.id
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organization_roles r ON uo.org_role_id = r.id
WHERE u.email = 'user@example.com';
```

### RLS policy still causing recursion

**Check:** Policy is using old `user_organizations.is_global_admin`

**Fix:** Update policy to use `users.user_type_id`:
```sql
-- OLD (causes recursion)
EXISTS (SELECT 1 FROM user_organizations WHERE is_global_admin = true)

-- NEW (no recursion)
EXISTS (
  SELECT 1 FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = auth.uid()
  AND (ut.global_permissions->>'can_access_all_organizations')::boolean
)
```

### Permission function returns null

**Cause:** User doesn't have required columns set

**Fix:**
```sql
-- Set missing user_type_id
UPDATE users SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'regular_user'
)
WHERE user_type_id IS NULL;

-- Set missing org_role_id
UPDATE user_organizations uo SET org_role_id = (
  SELECT id FROM organization_roles WHERE role_code = uo.role
)
WHERE org_role_id IS NULL;
```

---

## 📖 Further Reading

- **Architecture Design:** `/docs/architecture/PERMISSIONS-ARCHITECTURE-REDESIGN.md`
- **Implementation Guide:** `/docs/architecture/PERMISSIONS-IMPLEMENTATION-GUIDE.md`
- **Visual Diagram:** `/docs/architecture/PERMISSIONS-VISUAL-DIAGRAM.txt`
- **Migration Script:** `/database/migrations/024_permissions_architecture.sql`
- **Middleware Code:** `/src/middleware/permissions.js`

---

**Need Help?**
- Check the implementation guide for detailed examples
- Review the visual diagram for architecture overview
- Ask in team chat for clarification

**Found a Bug?**
- File an issue with detailed reproduction steps
- Include permission check that failed
- Include user role and organization context
