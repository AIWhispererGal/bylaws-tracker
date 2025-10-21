# Supabase Auth - Quick Reference Card

**Migration 006** | Version 2.2.0 | Updated: 2025-10-12

---

## 🚀 Quick Start

### 1. Initialize First Superuser

```sql
SELECT initialize_superuser(
  'auth-user-uuid'::UUID,
  'admin@example.com',
  'Admin Name'
);
```

### 2. Get Current User

```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```

### 3. Check User Role

```javascript
const { data: membership } = await supabase
  .from('user_organizations')
  .select('role, permissions')
  .eq('user_id', user.id)
  .eq('organization_id', orgId)
  .single();

// membership.role: 'superuser' | 'org_admin' | 'admin' | 'member' | 'viewer'
```

---

## 👥 User Management

### Invite User

```sql
-- SQL
SELECT invite_user_to_organization(
  '[inviter-id]'::UUID,
  'newuser@example.com',
  '[org-id]'::UUID,
  'member' -- role
);
```

```javascript
// JavaScript
const { data } = await supabase.rpc('invite_user_to_organization', {
  p_inviter_id: currentUser.id,
  p_email: 'newuser@example.com',
  p_organization_id: orgId,
  p_role: 'member'
});

if (data.success) {
  await sendEmail(data.invitation_token);
}
```

### Accept Invitation

```sql
-- SQL
SELECT accept_organization_invitation(
  '[user-id]'::UUID,
  'invitation-token'
);
```

```javascript
// JavaScript
const { data } = await supabase.rpc('accept_organization_invitation', {
  p_user_id: user.id,
  p_invitation_token: token
});
```

### List Organization Members

```sql
SELECT * FROM v_organization_members
WHERE organization_id = '[org-id]'
ORDER BY role, display_name;
```

```javascript
const { data: members } = await supabase
  .from('v_organization_members')
  .select('*')
  .eq('organization_id', orgId);
```

### List Pending Invitations

```sql
SELECT * FROM v_pending_invitations
WHERE organization_id = '[org-id]';
```

```javascript
const { data: invitations } = await supabase
  .from('v_pending_invitations')
  .select('*')
  .eq('organization_id', orgId);
```

---

## 🔐 Role Hierarchy

```
superuser      - Global admin, bypasses all limits
    ↓
org_admin      - Organization owner, full org access
    ↓
admin          - Organization manager, can invite users
    ↓
member         - Standard user with edit permissions
    ↓
viewer         - Read-only access
```

### Role Permissions Matrix

| Action | superuser | org_admin | admin | member | viewer |
|--------|-----------|-----------|-------|--------|--------|
| View content | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit sections | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create suggestions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve workflows | ✅ | ✅ | ✅ | ⚙️ | ❌ |
| Invite users | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ⚙️ | ❌ | ❌ |
| Manage workflows | ✅ | ✅ | ⚙️ | ❌ | ❌ |
| Delete org | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bypass limits | ✅ | ❌ | ❌ | ❌ | ❌ |

⚙️ = Configurable via permissions JSONB

---

## 🔍 Common Queries

### Get User's Organizations

```sql
SELECT o.*, uo.role
FROM organizations o
JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.user_id = auth.uid()
  AND uo.is_active = true;
```

### Check If User Is Admin

```sql
SELECT EXISTS (
  SELECT 1 FROM user_organizations
  WHERE user_id = auth.uid()
    AND organization_id = '[org-id]'
    AND role IN ('superuser', 'org_admin', 'admin')
    AND is_active = true
) as is_admin;
```

### Get Organization Member Count

```sql
SELECT
  o.name,
  o.max_users,
  COUNT(uo.id) as current_users,
  o.max_users - COUNT(uo.id) as available_slots
FROM organizations o
LEFT JOIN user_organizations uo ON o.id = uo.organization_id
WHERE o.id = '[org-id]'
  AND uo.is_active = true
GROUP BY o.id, o.name, o.max_users;
```

### Find User by Email

```sql
SELECT * FROM user_profiles
WHERE email = 'user@example.com';
```

---

## 🛠️ Utilities

### Verify Setup

```sql
SELECT * FROM verify_auth_setup();
```

### Update User Profile

```sql
UPDATE user_profiles
SET display_name = 'New Name',
    avatar_url = 'https://example.com/avatar.jpg',
    updated_at = NOW()
WHERE id = auth.uid();
```

### Deactivate User

```sql
UPDATE user_organizations
SET is_active = false
WHERE user_id = '[user-id]'
  AND organization_id = '[org-id]';
```

### Reactivate User

```sql
UPDATE user_organizations
SET is_active = true
WHERE user_id = '[user-id]'
  AND organization_id = '[org-id]';
```

### Change User Role

```sql
UPDATE user_organizations
SET role = 'admin'
WHERE user_id = '[user-id]'
  AND organization_id = '[org-id]';
```

---

## 📊 Database Schema

### user_profiles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,                    -- Links to auth.users(id)
  display_name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar_url TEXT,
  phone VARCHAR(50),
  bio TEXT,
  preferences JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### user_organizations (enhanced)

```sql
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  organization_id UUID REFERENCES organizations(id),
  role VARCHAR(50),                       -- NEW: Role hierarchy
  permissions JSONB,
  invited_by UUID,                        -- NEW: Invitation tracking
  invited_at TIMESTAMP,                   -- NEW
  invitation_token VARCHAR(255),          -- NEW
  invitation_accepted_at TIMESTAMP,       -- NEW
  is_active BOOLEAN DEFAULT true,         -- NEW
  joined_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔒 RLS Policies

### user_profiles

- ✅ All users can see all profiles (for collaboration)
- ✅ Users can only update their own profile
- ✅ Users can create profile during signup
- ✅ Service role can manage all profiles
- ✅ Superusers can manage all profiles

### user_organizations

- ✅ Users see only their own memberships
- ✅ Service role can manage all memberships
- ✅ Admins can invite new users
- ✅ Users can update their own membership

All existing RLS policies from Migration 005 are maintained!

---

## 🚨 Error Handling

### Common Errors

**"Organization has reached maximum user limit"**
```sql
-- Solution: Upgrade plan or deactivate users
UPDATE organizations
SET max_users = 50  -- Increase limit
WHERE id = '[org-id]';
```

**"Insufficient permissions to invite users"**
```sql
-- Solution: User needs admin role
UPDATE user_organizations
SET role = 'admin'
WHERE user_id = '[user-id]'
  AND organization_id = '[org-id]';
```

**"Invalid or expired invitation token"**
```sql
-- Solution: Check invitation status
SELECT * FROM v_pending_invitations
WHERE invitation_token = 'token';

-- Resend invitation
SELECT invite_user_to_organization(...);
```

---

## 📝 Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Server-side only!
SUPABASE_ANON_KEY=eyJhbGc...           # Client-side safe

# Optional
MAX_USERS_FREE_PLAN=10
MAX_USERS_PRO_PLAN=50
INVITATION_EXPIRY_DAYS=30
```

---

## 🔗 Resources

- **Migration File:** `/database/migrations/006_implement_supabase_auth.sql`
- **Full Guide:** `/docs/SUPABASE_AUTH_MIGRATION_GUIDE.md`
- **Supabase Docs:** https://supabase.com/docs/guides/auth
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security

---

## 📞 Quick Help

```sql
-- Stuck? Run diagnostics
SELECT * FROM verify_auth_setup();

-- Check your access
SELECT * FROM user_organizations
WHERE user_id = auth.uid();

-- View your profile
SELECT * FROM user_profiles
WHERE id = auth.uid();

-- List your organizations
SELECT * FROM v_organization_members
WHERE user_id = auth.uid();
```

---

**Version:** 2.2.0 | **Migration:** 006 | **Status:** ✅ Production Ready
