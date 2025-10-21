# Role Management System Specification

**Document Version:** 1.0
**Date:** 2025-10-13
**Status:** Analysis Complete
**Author:** Analyst Agent (Hive Mind Collective)

---

## Executive Summary

This specification defines a comprehensive role-based access control (RBAC) system for the multi-tenant Bylaws Amendment Tracker. The system will support organization-level role hierarchy, user invitation flows, and granular permission management while maintaining California Brown Act compliance.

---

## 1. Current State Analysis

### 1.1 Existing Database Schema

**Table: `user_organizations`**
```sql
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  role VARCHAR(50) DEFAULT 'member', -- Current roles: owner, admin, member, viewer
  permissions JSONB DEFAULT '{
    "can_edit_sections": true,
    "can_create_suggestions": true,
    "can_vote": true,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false
  }',
  joined_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  is_global_admin BOOLEAN DEFAULT FALSE
);
```

**Existing Auth Implementation:**
- Supabase Auth integration (`/src/routes/auth.js`)
- JWT-based session management with refresh tokens
- Helper function `isOrgAdmin()` checks for 'owner' or 'admin' roles
- User invitation via `auth.admin.inviteUserByEmail()` with 50-user org limit

---

## 2. Role Hierarchy Design

### 2.1 Role Definitions

| Role | Level | Description | Default Permissions |
|------|-------|-------------|---------------------|
| **Global Admin** | System | Super-user access across all organizations | All permissions, all organizations |
| **Organization Owner** | Org-Level | Organization creator, full control | All org permissions, cannot be removed |
| **Organization Admin** | Org-Level | Administrative access within org | Manage users, workflows, approve all stages |
| **Committee Member** | Org-Level | Voting member with approval authority | Create/edit suggestions, vote, approve specific stages |
| **Staff/Editor** | Org-Level | Non-voting contributor | Create/edit suggestions, no approval authority |
| **Public Suggester** | Org-Level | Read-only with suggestion ability | View documents, create suggestions only |
| **Viewer** | Org-Level | Read-only access | View documents and suggestions |

### 2.2 Permission Matrix

| Permission | Global Admin | Owner | Org Admin | Committee | Staff | Suggester | Viewer |
|-----------|--------------|-------|-----------|-----------|-------|-----------|--------|
| **Document Management** |
| Create documents | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit documents | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete documents | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Section Management** |
| Edit section content | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Lock sections | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Unlock sections | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Workflow Actions** |
| Approve Stage 1 (Committee) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Approve Stage 2 (Board) | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reject amendments | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Suggestions** |
| Create suggestions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit own suggestions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Delete own suggestions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Vote on suggestions | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **User Management** |
| Invite users | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Change user roles | ✓ | ✓ | ✓ (except owner) | ✗ | ✗ | ✗ | ✗ |
| Remove users | ✓ | ✓ | ✓ (except owner) | ✗ | ✗ | ✗ | ✗ |
| **Configuration** |
| Manage workflows | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Configure org settings | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 3. User Invitation Flow

### 3.1 Invitation Process

```
┌─────────────────────────────────────────────────────────────┐
│ INVITATION WORKFLOW                                         │
└─────────────────────────────────────────────────────────────┘

1. Admin initiates invitation
   ├─ Input: email, name, role (committee/staff/suggester)
   ├─ Validation: Check org user limit (max 50 users)
   └─ Check: User doesn't already exist in org

2. System creates invitation
   ├─ Supabase: auth.admin.inviteUserByEmail()
   ├─ Create user record in users table
   └─ Create pending user_organizations record

3. User receives email
   ├─ Contains: Invitation link with token
   ├─ Org name and role information
   └─ Expiry: 7 days (configurable)

4. User accepts invitation
   ├─ Clicks link → /auth/accept-invite?token=xxx
   ├─ User completes registration (if new)
   └─ User sets password

5. System activates membership
   ├─ Mark user_organizations.is_active = true
   ├─ Grant role and permissions
   └─ Redirect to dashboard
```

### 3.2 Invitation API Endpoint

**Existing Implementation:** `/auth/invite-user` (POST)

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "committee_member",
  "organizationId": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation sent to user@example.com",
  "invitation": {
    "email": "user@example.com",
    "role": "committee_member",
    "organizationId": "uuid-here",
    "sentAt": "2025-10-13T12:00:00Z"
  }
}
```

---

## 4. Role Assignment and Management

### 4.1 Role Change Workflow

**Constraints:**
- Only org admins/owners can change roles
- Cannot change owner role (permanent)
- Cannot demote yourself if you're the only admin
- Log all role changes for audit trail

**Implementation:**
```javascript
async function changeUserRole(adminId, targetUserId, orgId, newRole) {
  // 1. Verify admin has permission
  const isAdmin = await isOrgAdmin(supabase, adminId, orgId);
  if (!isAdmin) throw new Error('Insufficient permissions');

  // 2. Check constraints
  if (newRole === 'owner') throw new Error('Cannot assign owner role');

  const targetUser = await getUserOrgRole(targetUserId, orgId);
  if (targetUser.role === 'owner') {
    throw new Error('Cannot change owner role');
  }

  // 3. Update role
  await supabase
    .from('user_organizations')
    .update({
      role: newRole,
      permissions: getDefaultPermissionsForRole(newRole),
      updated_at: new Date()
    })
    .eq('user_id', targetUserId)
    .eq('organization_id', orgId);

  // 4. Audit log
  await logRoleChange(adminId, targetUserId, orgId, targetUser.role, newRole);
}
```

### 4.2 Batch Permission Updates

For efficiency, implement batch permission updates when role definitions change:

```javascript
async function updateRolePermissions(orgId, role, newPermissions) {
  await supabase
    .from('user_organizations')
    .update({ permissions: newPermissions })
    .eq('organization_id', orgId)
    .eq('role', role);
}
```

---

## 5. Database Schema Enhancements

### 5.1 Required Schema Changes

**Add to `user_organizations` table:**
```sql
-- Add role change tracking
ALTER TABLE user_organizations ADD COLUMN role_changed_at TIMESTAMP;
ALTER TABLE user_organizations ADD COLUMN role_changed_by UUID REFERENCES users(id);
ALTER TABLE user_organizations ADD COLUMN invitation_token VARCHAR(255);
ALTER TABLE user_organizations ADD COLUMN invitation_expires_at TIMESTAMP;
ALTER TABLE user_organizations ADD COLUMN invitation_accepted_at TIMESTAMP;
```

**Create `user_role_history` table for audit trail:**
```sql
CREATE TABLE user_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  previous_role VARCHAR(50),
  new_role VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT,

  INDEX idx_role_history_user (user_id, organization_id),
  INDEX idx_role_history_changed_at (changed_at)
);
```

**Create `user_invitations` table (separate from user_organizations):**
```sql
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invited_by UUID NOT NULL REFERENCES users(id),
  role VARCHAR(50) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired, revoked

  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),

  INDEX idx_invitations_email (email),
  INDEX idx_invitations_org (organization_id),
  INDEX idx_invitations_token (token),
  INDEX idx_invitations_status (organization_id, status)
);
```

### 5.2 Permission Defaults by Role

```sql
-- Function to get default permissions for role
CREATE OR REPLACE FUNCTION get_default_permissions(role_name VARCHAR)
RETURNS JSONB AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'owner' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee", "board"],
      "can_manage_users": true,
      "can_manage_workflows": true,
      "can_lock_sections": true
    }'::jsonb
    WHEN 'admin' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee", "board"],
      "can_manage_users": true,
      "can_manage_workflows": true,
      "can_lock_sections": true
    }'::jsonb
    WHEN 'committee_member' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee"],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": true
    }'::jsonb
    WHEN 'staff' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false
    }'::jsonb
    WHEN 'suggester' THEN '{
      "can_edit_sections": false,
      "can_create_suggestions": true,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false
    }'::jsonb
    ELSE '{
      "can_edit_sections": false,
      "can_create_suggestions": false,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false
    }'::jsonb
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## 6. Security Considerations

### 6.1 RLS Policy Updates

**Add role-based RLS policies:**

```sql
-- Allow committee members to approve stage 1
CREATE POLICY "Committee can approve committee stage"
  ON section_workflow_states
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      JOIN workflow_stages ws ON ws.id = section_workflow_states.workflow_stage_id
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id IN (
        SELECT d.organization_id
        FROM document_sections ds
        JOIN documents d ON ds.document_id = d.id
        WHERE ds.id = section_workflow_states.section_id
      )
      AND uo.role IN ('owner', 'admin', 'committee_member')
      AND ws.stage_name = 'Committee Review'
    )
  );

-- Allow only admins to manage users
CREATE POLICY "Admins manage organization users"
  ON user_organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations admin
      WHERE admin.user_id = auth.uid()
      AND admin.organization_id = user_organizations.organization_id
      AND admin.role IN ('owner', 'admin')
    )
  );
```

### 6.2 JWT Claims Enhancement

Add role information to JWT claims for faster permission checks:

```javascript
// In Supabase Edge Function or auth hook
const token = {
  sub: user.id,
  email: user.email,
  app_metadata: {
    organizations: user.organizations.map(org => ({
      id: org.organization_id,
      role: org.role,
      permissions: org.permissions
    }))
  }
};
```

---

## 7. UI/UX Requirements

### 7.1 User Management Interface

**Location:** `/dashboard/settings/users`

**Features:**
1. User list with role badges
2. "Invite User" button (admin-only)
3. Role dropdown for each user (admin-only)
4. Remove user button (admin-only)
5. Filter by role
6. Search by name/email

**Wireframe:**
```
┌────────────────────────────────────────────────────────────┐
│ Organization Users                    [+ Invite User]      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 🔍 Search users...     Filter: [All Roles ▼]             │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ John Doe (owner)                    [Owner ▼] [×]    │ │
│ │ john@example.com                                     │ │
│ │ Joined: Jan 1, 2025                                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Jane Smith (admin)                  [Admin ▼] [×]    │ │
│ │ jane@example.com                                     │ │
│ │ Joined: Jan 5, 2025                                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ Showing 15 of 23 users                      [Load More]   │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Invitation Modal

```
┌─────────────────────────────────────────────────┐
│ Invite User to Organization               [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Email Address *                                 │
│ [_________________________________________]     │
│                                                 │
│ Full Name                                       │
│ [_________________________________________]     │
│                                                 │
│ Role *                                          │
│ [Committee Member ▼]                            │
│                                                 │
│ ℹ️ Committee members can vote and approve       │
│   amendments during committee review stage.    │
│                                                 │
│ [Cancel]                   [Send Invitation]   │
└─────────────────────────────────────────────────┘
```

### 7.3 Role Change Confirmation

```
┌─────────────────────────────────────────────────┐
│ Change User Role                          [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Change Jane Smith's role from:                  │
│                                                 │
│ Admin → Committee Member                        │
│                                                 │
│ ⚠️ This will remove the following permissions:  │
│ • Manage users and invitations                  │
│ • Configure workflows                           │
│ • Approve board-level amendments                │
│                                                 │
│ Reason for change (optional):                   │
│ [_________________________________________]     │
│                                                 │
│ [Cancel]                      [Confirm Change]  │
└─────────────────────────────────────────────────┘
```

---

## 8. Implementation Roadmap

### Phase 1: Database Schema (Week 1)
- [ ] Add new columns to `user_organizations`
- [ ] Create `user_role_history` table
- [ ] Create `user_invitations` table
- [ ] Create helper functions for permission defaults
- [ ] Update RLS policies

### Phase 2: Backend API (Week 2)
- [ ] Implement role change endpoint
- [ ] Implement invitation management endpoints
- [ ] Add permission checking middleware
- [ ] Create audit logging for role changes

### Phase 3: Frontend UI (Week 3)
- [ ] Build user management page
- [ ] Create invitation modal
- [ ] Add role change confirmation dialogs
- [ ] Implement permission-based UI hiding

### Phase 4: Testing & Documentation (Week 4)
- [ ] Unit tests for permission checks
- [ ] Integration tests for role workflows
- [ ] E2E tests for invitation flow
- [ ] Update user documentation

---

## 9. Open Questions & Decisions Needed

### 9.1 Questions for Stakeholders

1. **Role Naming:** Should we use "Committee Member" or simpler names like "Editor"?
2. **Self-service Registration:** Should suggesters be able to self-register, or invitation-only?
3. **Role Limits:** Should there be limits on number of admins per organization?
4. **Invitation Expiry:** Default 7 days, or configurable per organization?
5. **Role Demotion:** Can a user be demoted from committee to staff mid-session?

### 9.2 Technical Decisions

1. **Permission Storage:** JSONB (current) vs. separate permissions table?
2. **Invitation Tokens:** JWT-based or random UUID tokens?
3. **Role History:** Keep forever or expire after X years?
4. **Permission Caching:** Cache permissions in JWT claims or fetch on each request?

---

## 10. Success Criteria

- ✅ Org admins can invite users with specific roles
- ✅ Role changes are logged and auditable
- ✅ Permissions are enforced at database and API levels
- ✅ UI correctly shows/hides features based on permissions
- ✅ Invitation emails are sent and accepted successfully
- ✅ No security vulnerabilities in permission checking
- ✅ Performance impact < 50ms per request for permission checks

---

## Appendix A: Role Permission Reference

See [Permission Matrix](#22-permission-matrix) for complete reference.

## Appendix B: Database Migration Scripts

See `/docs/analysis/database-changes.md` for complete migration SQL.

---

**Document Status:** ✅ Complete
**Next Steps:** Review by architect and coder agents, then proceed with database schema implementation.
