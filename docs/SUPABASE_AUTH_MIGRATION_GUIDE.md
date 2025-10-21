# Supabase Authentication Migration Guide

**Migration 006: Implement Supabase Auth Integration**
**Version:** 2.2.0
**Date:** 2025-10-12
**Status:** Ready for deployment

---

## Overview

This migration enhances the multi-tenant system with full Supabase Authentication integration, adding user roles, invitation system, and superuser management while maintaining existing RLS policies.

### Key Features

- **User Profiles**: Links to `auth.users` with display information
- **Role Hierarchy**: superuser → org_admin → admin → member → viewer
- **Invitation System**: Email-based user invitations with tokens
- **Superuser Init**: Function to create first admin user
- **User Limits**: Enforces max users per organization by plan
- **RLS Integration**: All policies work with `auth.uid()`

---

## Pre-Migration Checklist

### Required Prerequisites

- ✅ Migration 005 applied (RLS policies in place)
- ✅ Supabase project configured
- ✅ `SUPABASE_SERVICE_ROLE_KEY` in environment
- ✅ Database backup created
- ✅ Auth providers configured (email, OAuth, etc.)

### Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Optional
MAX_USERS_FREE_PLAN=10
MAX_USERS_PRO_PLAN=50
MAX_USERS_ENTERPRISE_PLAN=500
```

---

## Migration Steps

### Step 1: Review Current State

```sql
-- Check existing users
SELECT COUNT(*) as user_count FROM users;

-- Check existing memberships
SELECT COUNT(*) as membership_count FROM user_organizations;

-- Check RLS status
SELECT * FROM verify_rls_enabled();
```

### Step 2: Run Migration

```bash
# Connect to Supabase database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Or use Supabase SQL Editor
# Copy and paste the migration file contents

# Run migration
\i database/migrations/006_implement_supabase_auth.sql
```

### Step 3: Verify Migration

```sql
-- Run verification function
SELECT * FROM verify_auth_setup();

-- Expected output:
-- user_profiles table        | ✅ EXISTS    | 0 profiles
-- user_profiles RLS           | ✅ ENABLED   | 5 policies
-- user_organizations.role     | ✅ EXISTS    | X members
-- Invitation system           | ✅ READY     | 0 pending
-- Helper functions            | ✅ INSTALLED | initialize_superuser, ...
```

---

## Post-Migration Tasks

### 1. Create First Superuser

**Option A: New User** (recommended for fresh setup)

```sql
-- First, create auth user via Supabase Auth UI or API
-- Then link to profile and organization:

SELECT initialize_superuser(
  'auth-user-uuid-here'::UUID,
  'admin@yourdomain.com',
  'Super Admin',
  NULL -- Creates new organization automatically
);
```

**Option B: Existing Organization**

```sql
SELECT initialize_superuser(
  'auth-user-uuid-here'::UUID,
  'admin@yourdomain.com',
  'Super Admin',
  'existing-org-uuid'::UUID
);
```

### 2. Migrate Existing Users (if applicable)

If you have existing users in the old `users` table:

```javascript
// Node.js migration script
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateExistingUsers() {
  // 1. Get old users
  const { data: oldUsers } = await supabase
    .from('users')
    .select('*');

  for (const user of oldUsers) {
    // 2. Create auth user (if not exists)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        migrated_from: user.id
      }
    });

    if (authError) {
      console.error(`Failed to create auth user for ${user.email}:`, authError);
      continue;
    }

    // 3. Create user profile
    await supabase
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        email: user.email,
        display_name: user.name,
        avatar_url: user.avatar_url
      });

    // 4. Update user_organizations references
    await supabase
      .from('user_organizations')
      .update({ user_id: authUser.user.id })
      .eq('user_id', user.id);
  }

  console.log('Migration complete!');
}
```

### 3. Configure Supabase Auth

Enable desired auth providers in Supabase Dashboard:

- **Email/Password**: Always enabled
- **Magic Link**: Good for passwordless
- **OAuth Providers**: Google, GitHub, etc.

### 4. Update Application Code

**Before (old users table):**

```javascript
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
  .single();
```

**After (user_profiles + auth):**

```javascript
// Get current authenticated user
const { data: { user } } = await supabase.auth.getUser();

// Get profile information
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single();

// Get user organizations
const { data: memberships } = await supabase
  .from('v_organization_members')
  .select('*')
  .eq('user_id', user.id);
```

---

## New Features Usage

### User Invitation System

**Invite User to Organization:**

```sql
-- As admin/superuser
SELECT invite_user_to_organization(
  'inviter-user-id'::UUID,
  'newuser@example.com',
  'organization-id'::UUID,
  'member' -- Role: member, admin, viewer
);

-- Returns: {
--   "success": true,
--   "invitation_token": "base64-encoded-token",
--   "user_exists": false,
--   "message": "Invitation created for new user"
-- }
```

**Accept Invitation:**

```sql
-- User accepts invitation (after signup)
SELECT accept_organization_invitation(
  'user-id'::UUID,
  'invitation-token-from-email'
);
```

**Client-side (JavaScript):**

```javascript
// Invite user
async function inviteUser(email, role = 'member') {
  const { data: invitation } = await supabase.rpc('invite_user_to_organization', {
    p_inviter_id: currentUser.id,
    p_email: email,
    p_organization_id: currentOrg.id,
    p_role: role
  });

  if (invitation.success) {
    // Send invitation email with token
    await sendInvitationEmail(email, invitation.invitation_token);
  }

  return invitation;
}

// Accept invitation
async function acceptInvitation(token) {
  const { data: result } = await supabase.rpc('accept_organization_invitation', {
    p_user_id: currentUser.id,
    p_invitation_token: token
  });

  return result;
}
```

### Role-Based Access Control

**Check User Role:**

```javascript
async function getUserRole(userId, orgId) {
  const { data } = await supabase
    .from('user_organizations')
    .select('role, permissions')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single();

  return data;
}

// Usage
const userRole = await getUserRole(user.id, org.id);

if (userRole.role === 'superuser' || userRole.role === 'org_admin') {
  // Allow admin actions
}

if (userRole.permissions.can_manage_users) {
  // Allow user management
}
```

**Role Hierarchy:**

```
superuser (global admin)
    ↓
org_admin (organization owner)
    ↓
admin (organization manager)
    ↓
member (standard user)
    ↓
viewer (read-only)
```

### User Management Views

**Get Organization Members:**

```sql
-- View all members
SELECT * FROM v_organization_members
WHERE organization_id = 'org-uuid'
ORDER BY role, display_name;
```

**Get Pending Invitations:**

```sql
-- View pending invitations (last 30 days)
SELECT * FROM v_pending_invitations
WHERE organization_id = 'org-uuid'
ORDER BY invited_at DESC;
```

---

## Security Model

### Row-Level Security (RLS)

All tables have RLS enabled with layered policies:

**Layer 1: user_organizations** (base layer)
- Users see only their own memberships
- Service role can manage all
- Admins can invite users

**Layer 2: user_profiles**
- All users can see all profiles (for collaboration)
- Users can only update their own profile
- Superusers can manage all profiles

**Layer 3+: All other tables**
- Inherit organization access via `user_organizations`
- Maintain existing patterns from migration 005

### Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and should be used only for:

- Setup wizard operations
- User migration scripts
- Admin panel operations (server-side only)
- Automated background jobs

**Never expose service role key to client!**

### User Limits

Organizations enforce `max_users` based on plan:

```sql
-- Check current usage
SELECT
  o.name,
  o.plan_type,
  o.max_users,
  COUNT(uo.id) as current_users
FROM organizations o
LEFT JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.is_active = true
GROUP BY o.id, o.name, o.plan_type, o.max_users;

-- Upgrade organization plan
UPDATE organizations
SET plan_type = 'pro',
    max_users = 50
WHERE id = 'org-uuid';
```

---

## Testing Guide

### 1. Basic Auth Flow

```bash
# Test signup
curl -X POST 'https://[PROJECT].supabase.co/auth/v1/signup' \
  -H "apikey: [ANON-KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'

# Verify user profile created
SELECT * FROM user_profiles WHERE email = 'test@example.com';
```

### 2. Invitation Flow

```sql
-- 1. Admin invites user
SELECT invite_user_to_organization(
  '[admin-user-id]'::UUID,
  'invited@example.com',
  '[org-id]'::UUID,
  'member'
);

-- 2. Check pending invitation
SELECT * FROM v_pending_invitations
WHERE organization_id = '[org-id]';

-- 3. User accepts (after signup)
SELECT accept_organization_invitation(
  '[new-user-id]'::UUID,
  '[invitation-token]'
);

-- 4. Verify membership
SELECT * FROM v_organization_members
WHERE user_id = '[new-user-id]';
```

### 3. Role Permissions

```sql
-- Test different roles
BEGIN;

-- Create test user
INSERT INTO user_profiles (id, email, display_name)
VALUES (gen_random_uuid(), 'test@example.com', 'Test User');

-- Try to invite as member (should fail)
SELECT invite_user_to_organization(
  (SELECT id FROM user_profiles WHERE email = 'test@example.com'),
  'another@example.com',
  '[org-id]'::UUID,
  'member'
);
-- Expected: {"success": false, "error": "Insufficient permissions"}

ROLLBACK;
```

### 4. User Limits

```sql
-- Test user limit enforcement
-- Set low limit for testing
UPDATE organizations SET max_users = 2 WHERE id = '[org-id]';

-- Add users up to limit
SELECT invite_user_to_organization('[admin-id]', 'user1@example.com', '[org-id]', 'member');
SELECT invite_user_to_organization('[admin-id]', 'user2@example.com', '[org-id]', 'member');

-- Try to exceed limit (should fail)
SELECT invite_user_to_organization('[admin-id]', 'user3@example.com', '[org-id]', 'member');
-- Expected: Error: "Organization has reached maximum user limit of 2"
```

---

## Troubleshooting

### Issue: Migration fails with "auth.users does not exist"

**Solution:** Ensure Supabase Auth is enabled for your project. Auth schema is automatically created by Supabase.

### Issue: Cannot create user profile

**Problem:** Foreign key constraint fails on `auth.users(id)`

**Solution:**
1. Verify auth user exists: `SELECT * FROM auth.users WHERE id = 'user-id';`
2. Ensure using correct UUID format
3. Check service role key has proper permissions

### Issue: User limit trigger not working

**Problem:** Users can join beyond max_users limit

**Solution:**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trg_check_org_user_limit';

-- Verify constraint function
SELECT proname, prosrc FROM pg_proc WHERE proname = 'check_org_user_limit';

-- Test manually
SELECT check_org_user_limit();
```

### Issue: RLS policies blocking access

**Problem:** Users cannot see data they should have access to

**Solution:**
1. Verify user has active membership:
   ```sql
   SELECT * FROM user_organizations
   WHERE user_id = auth.uid()
   AND is_active = true;
   ```

2. Check RLS policies:
   ```sql
   SELECT * FROM verify_auth_setup();
   ```

3. Test with service role key temporarily (server-side only):
   ```javascript
   const adminClient = createClient(url, serviceRoleKey);
   ```

### Issue: Invitation tokens not working

**Problem:** `accept_organization_invitation` returns invalid token

**Solution:**
```sql
-- Check if invitation exists and is not expired
SELECT * FROM v_pending_invitations
WHERE invitation_token = 'token-here';

-- Check if already accepted
SELECT * FROM user_organizations
WHERE invitation_token = 'token-here'
AND invitation_accepted_at IS NOT NULL;

-- Manually reset if needed
UPDATE user_organizations
SET invitation_accepted_at = NULL,
    is_active = false
WHERE invitation_token = 'token-here';
```

---

## Rollback Procedure

If you need to rollback this migration, run the rollback script at the end of the migration file:

```sql
-- See "ROLLBACK INSTRUCTIONS" section in migration file
-- database/migrations/006_implement_supabase_auth.sql
```

**Warning:** Rollback will:
- Drop `user_profiles` table
- Remove new columns from `user_organizations`
- Delete helper functions
- Lose invitation system data

**Before rollback:**
1. Export data: `pg_dump -t user_profiles > backup.sql`
2. Document active invitations
3. Notify users of service interruption

---

## Migration Summary

### New Database Objects

**Tables:**
- `user_profiles` - User profile data linked to auth.users

**Columns added to user_organizations:**
- `role` - User role (superuser, org_admin, admin, member, viewer)
- `invited_by` - Who invited this user
- `invited_at` - When invitation was sent
- `is_active` - Membership status
- `invitation_token` - Token for email invitations
- `invitation_accepted_at` - When invitation was accepted

**Functions:**
- `initialize_superuser()` - Create first superuser
- `invite_user_to_organization()` - Send user invitation
- `accept_organization_invitation()` - Accept invitation
- `check_org_user_limit()` - Enforce user limits
- `verify_auth_setup()` - Verify migration success

**Views:**
- `v_organization_members` - Members with full profile info
- `v_pending_invitations` - Pending invitations

**Triggers:**
- `trg_check_org_user_limit` - Enforce max users per org
- `trg_user_profile_updated` - Update timestamp on profile changes

**RLS Policies:**
- 5 policies for `user_profiles`
- Enhanced policies for `user_organizations`

---

## Next Steps

1. **Configure Auth Providers** - Enable email, OAuth in Supabase Dashboard
2. **Create Superuser** - Use `initialize_superuser()` function
3. **Update Frontend** - Integrate Supabase Auth client
4. **Test User Flows** - Signup, login, invitations, roles
5. **Deploy** - Update production environment variables
6. **Monitor** - Watch for auth errors in logs
7. **Train Users** - Document new invitation system

---

## Support Resources

- **Migration File:** `/database/migrations/006_implement_supabase_auth.sql`
- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **This Guide:** `/docs/SUPABASE_AUTH_MIGRATION_GUIDE.md`

For issues or questions, check:
1. Verify setup: `SELECT * FROM verify_auth_setup();`
2. Check logs: Supabase Dashboard → Logs
3. Test RLS: Supabase Dashboard → SQL Editor
4. Review policies: `SELECT * FROM pg_policies WHERE tablename = 'user_profiles';`

---

**Status:** ✅ Ready for Production
**Last Updated:** 2025-10-12
**Version:** 2.2.0
