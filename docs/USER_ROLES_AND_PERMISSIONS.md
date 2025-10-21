# User Roles and Permissions Guide

**Last Updated:** 2025-10-14

---

## 🎭 User Roles Overview

The system supports **two levels** of administrative access:

1. **Organization-Level Roles** - Permissions within a specific organization
2. **Global Admin** - Cross-organization platform admin (rare, typically 1-2 users)

---

## 📊 Organization-Level Roles

### 1. **Viewer** 👁️

**Access Level:** Read-only

**Permissions:**
- ✅ View documents
- ✅ View sections
- ✅ View suggestions
- ✅ View organization members
- ❌ Cannot create suggestions
- ❌ Cannot vote on suggestions
- ❌ Cannot edit anything
- ❌ Cannot access admin pages

**Use Case:** External consultants, board observers, auditors

**Set in database:** `user_organizations.role = 'viewer'`

---

### 2. **Member** 👤

**Access Level:** Standard user

**Permissions:**
- ✅ Everything Viewer can do
- ✅ **Create suggestions** (primary action)
- ✅ **Vote on suggestions**
- ✅ Edit their own suggestions
- ✅ Delete their own suggestions
- ✅ Comment on suggestions
- ❌ Cannot lock sections
- ❌ Cannot approve workflow stages
- ❌ Cannot manage users
- ❌ Cannot access admin pages

**Use Case:** Regular committee members, staff, contributors

**Set in database:** `user_organizations.role = 'member'`

**Session Flag:** `req.session.isAdmin = false`

---

### 3. **Admin** 🛡️

**Access Level:** Organization administrator

**Permissions:**
- ✅ Everything Member can do
- ✅ **Lock sections** with selected suggestions
- ✅ **Approve workflow stages** (committee level)
- ✅ **Manage users** (invite, remove, change roles)
- ✅ Access organization admin pages
- ✅ View organization analytics
- ✅ Configure organization settings
- ❌ Cannot delete organization
- ❌ Cannot change organization name (owner only)

**Use Case:** Committee chairs, managers, team leads

**Set in database:** `user_organizations.role = 'admin'`

**Session Flag:** `req.session.isAdmin = true`

---

### 4. **Owner** 👑

**Access Level:** Full organization control

**Permissions:**
- ✅ Everything Admin can do
- ✅ **Final workflow approval** (board level)
- ✅ **Delete organization**
- ✅ **Change organization settings** (name, type, etc.)
- ✅ **Promote/demote admins**
- ✅ **Configure workflows**
- ✅ Full access to all features
- ✅ Typically the first user in an organization

**Use Case:** Organization president, CEO, primary account holder

**Set in database:** `user_organizations.role = 'owner'`

**Session Flag:** `req.session.isAdmin = true`

**Auto-assigned:** First user created during setup wizard

---

## 🌍 Global Admin (Platform-Level)

### **Global Admin** (Superuser) 🌟

**Access Level:** Cross-organization platform admin

**Permissions:**
- ✅ **See ALL organizations**
- ✅ **Access any organization** without membership
- ✅ **View all data** across organizations
- ✅ **Delete any organization**
- ✅ **Create organizations**
- ✅ **Manage global settings**
- ✅ Bypasses all organization RLS policies
- ⚠️ Should be granted VERY sparingly (1-2 users max)

**Use Case:** Platform administrators, system operators, support staff

**Set in database:** `user_organizations.is_global_admin = true`

**Session Flag:** `req.isGlobalAdmin = true` (set by middleware)

**Created via:** `SELECT link_global_admin_to_all_orgs('user-id'::uuid);`

---

## 🔐 Permission Matrix

| Action | Viewer | Member | Admin | Owner | Global Admin |
|--------|--------|--------|-------|-------|--------------|
| View documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create suggestions | ❌ | ✅ | ✅ | ✅ | ✅ |
| Vote on suggestions | ❌ | ✅ | ✅ | ✅ | ✅ |
| Lock sections | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve (committee) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve (board) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Invite users | ❌ | ❌ | ✅ | ✅ | ✅ |
| Remove users | ❌ | ❌ | ✅ | ✅ | ✅ |
| Change user roles | ❌ | ❌ | ✅ | ✅ | ✅ |
| Access /admin pages | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete organization | ❌ | ❌ | ❌ | ✅ | ✅ |
| Access ALL orgs | ❌ | ❌ | ❌ | ❌ | ✅ |
| Global admin dashboard | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🔄 Role Assignment

### During User Invitation

When inviting a user via `/admin/organization/:id`:

```javascript
// Admin clicks "Invite User" button
// Modal form with role dropdown:
- Member (default)
- Admin
- Owner
- Viewer

// POST /auth/invite-user
{
  "email": "user@example.com",
  "name": "User Name",
  "role": "member", // or "admin", "owner", "viewer"
  "organizationId": "org-uuid"
}
```

### Role Enforcement

**In Login (auth.js:362):**
```javascript
req.session.isAdmin = ['owner', 'admin'].includes(role);
```

**In Organization Switch (auth.js:811):**
```javascript
req.session.isAdmin = ['owner', 'admin'].includes(userOrg.role);
```

**In Global Admin Middleware (globalAdmin.js):**
```javascript
req.isGlobalAdmin = await isGlobalAdmin(req);
```

---

## 🚪 Route Protection

### Organization Admin Routes

**Protected by:** `requireAdmin` middleware

**Routes:**
- `/admin/users` - User management
- `/admin/organization` - Organization settings
- `/admin/organization/:id` - Organization details

**Checks:**
```javascript
if (!req.session.isAdmin && !req.isGlobalAdmin) {
  return res.status(403); // Access denied
}
```

### Global Admin Routes

**Protected by:** `requireGlobalAdmin` middleware

**Routes:**
- `/admin/dashboard` - Cross-organization admin dashboard

**Checks:**
```javascript
if (!req.isGlobalAdmin) {
  return res.status(403); // Access denied
}
```

---

## 📝 Common Scenarios

### Scenario 1: Standard User Adding Suggestion

**User:** Member role

**Flow:**
1. Navigate to document viewer
2. Select a section
3. Click "Add Suggestion" button
4. Fill in suggestion text and rationale
5. Submit

**Backend Check:**
```javascript
// No special permission check required
// All authenticated users can create suggestions
// RLS policies filter by organization automatically
```

**Result:** ✅ Suggestion created and visible to all org members

---

### Scenario 2: Admin Locking Section

**User:** Admin or Owner role

**Flow:**
1. Navigate to document section
2. Review suggestions
3. Select preferred suggestion
4. Click "Lock Section" button
5. Add approval notes

**Backend Check:**
```javascript
// In workflow stage configuration:
if (!user_can_approve_stage(userId, stageId)) {
  return 403; // Not authorized for this stage
}
```

**Result:** ✅ Section locked with selected suggestion

---

### Scenario 3: Admin Inviting User

**User:** Admin or Owner role

**Flow:**
1. Navigate to `/admin/organization/:id`
2. Click "Invite User" button
3. Enter email, name, and role
4. Submit invitation

**Backend Check:**
```javascript
// In /auth/invite-user:
const isAdmin = await isOrgAdmin(userId, organizationId);
if (!isAdmin) {
  return 403; // Only admins can invite
}
```

**Result:** ✅ Invitation email sent, user added to organization

---

### Scenario 4: Global Admin Accessing Any Organization

**User:** Global admin

**Flow:**
1. Login as global admin
2. Navigate to `/admin/dashboard`
3. See ALL 4 organizations
4. Click any organization
5. View/manage without membership

**Backend Check:**
```javascript
// In middleware:
if (req.isGlobalAdmin) {
  // Bypass organization membership checks
  // Allow access to any org
}
```

**Result:** ✅ Full access to all organizations

---

## 🗄️ Database Schema

### user_organizations Table

```sql
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),

  -- Role within this organization
  role VARCHAR(50) NOT NULL, -- 'viewer', 'member', 'admin', 'owner'

  -- Global admin flag (rare, typically false)
  is_global_admin BOOLEAN DEFAULT FALSE,

  -- Active status
  is_active BOOLEAN DEFAULT TRUE,

  -- Permissions JSON (workflow-specific)
  permissions JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔍 Checking User Permissions

### In Backend Code

```javascript
// Check if user is org admin
const isAdmin = ['owner', 'admin'].includes(req.session.userRole);

// Check if user is global admin
const isGlobalAdmin = req.isGlobalAdmin;

// Check specific permission for workflow stage
const canApprove = await user_can_approve_stage(userId, stageId);

// Check if user has role in organization
const hasRole = await user_has_role(userId, orgId, 'admin');
```

### In EJS Templates

```ejs
<% if (req.session.isAdmin) { %>
  <button>Admin Action</button>
<% } %>

<% if (req.isGlobalAdmin) { %>
  <div>Global Admin View</div>
<% } %>
```

### In Database Queries (RLS)

```sql
-- Example RLS policy for documents
CREATE POLICY "Users see their org documents"
  ON documents FOR SELECT
  USING (
    is_global_admin(auth.uid()) OR -- Global admins see all
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

---

## ⚠️ Security Considerations

### 1. **Database Authority**

Session flags (`req.session.isAdmin`) are set from database roles.

**Never** allow session values to override database permissions:

```javascript
// ❌ WRONG
if (req.session.isAdmin) {
  // Grant access based on session alone
}

// ✅ CORRECT
const dbRole = await getRole(userId, orgId);
if (['owner', 'admin'].includes(dbRole)) {
  // Grant access based on database
}
```

### 2. **RLS Policy Enforcement**

All database queries go through RLS policies:

- Standard users: Filtered by organization membership
- Global admins: Bypass filters with `is_global_admin()` function
- Service role: Bypasses RLS entirely (used for setup/migrations only)

### 3. **Global Admin Restrictions**

- Should be granted VERY sparingly (1-2 users max)
- Audit all global admin actions
- Log changes to `is_global_admin` flag
- Require 2FA for global admins (future enhancement)
- Regular review of global admin list

### 4. **Workflow Permissions**

Workflow stages define which roles can approve:

```sql
-- In workflow_stages table:
required_roles = '["admin", "owner"]'::jsonb

-- Helper function checks this:
user_can_approve_stage(user_id, stage_id)
```

**Never** bypass workflow stage checks, even for global admins within an org context.

---

## 📚 Related Documentation

- `docs/GLOBAL_ADMIN_DEPLOYMENT_GUIDE.md` - How to set up global admins
- `docs/GLOBAL_ADMIN_VERIFICATION.md` - Testing procedures
- `database/migrations/007_create_global_superuser.sql` - Global admin schema
- `database/migrations/008_enhance_user_roles_and_approval.sql` - Workflow permissions
- `src/middleware/globalAdmin.js` - Global admin middleware
- `src/routes/auth.js:573` - User invitation endpoint

---

## 🎯 Summary

**Key Points:**

1. **Four organization roles:** Viewer (read-only), Member (suggestions), Admin (management), Owner (full control)

2. **Two admin types:** Organization admin (within one org), Global admin (across all orgs)

3. **Session flags:** `req.session.isAdmin` (org), `req.isGlobalAdmin` (global)

4. **Permission checks:** Always validate against database, never trust session alone

5. **Invite users:** Admin/Owner can invite via `/admin/organization/:id` page

6. **Standard users:** Members can create suggestions (primary action)

7. **Locking sections:** Admin/Owner can lock after workflow approval

8. **Global admin:** Very rare, for platform administration only

---

**For Users:** Members can add suggestions. Admins can lock sections and manage users.

**For Developers:** Always check database roles. Use middleware for protection. Follow RLS policies.

**For Workflow:** Next session will implement workflow approval stages for locking sections.

