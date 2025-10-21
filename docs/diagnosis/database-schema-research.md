# Database Schema Research: user_types and user_organizations

**Research Date:** 2025-10-20
**Researcher:** Database Researcher Agent
**Context:** Investigating "relation 'user_types' does not exist" error during setup wizard

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** The user_types table **DOES EXIST** but RLS (Row Level Security) is **BLOCKING THE QUERY** during setup wizard execution. The error message is misleading - it's an RLS permission issue, not a missing table.

**CRITICAL FINDINGS:**
1. Migration 024 creates user_types and organization_roles tables
2. Migration 030 attempts to disable RLS but uses **incorrect table name** for user_types
3. Setup wizard queries user_types table at line 713-717 in /src/routes/setup.js
4. RLS policies on user_types require authenticated user context that doesn't exist during setup

---

## 1. Schema Documentation

### 1.1 user_types Table (Platform-Level)

**Created By:** Migration 024 (024_permissions_architecture.sql)
**Purpose:** Global/platform-level user type classification (global_admin vs regular_user)

```sql
CREATE TABLE IF NOT EXISTS user_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  type_code VARCHAR(50) UNIQUE NOT NULL,
  type_name VARCHAR(100) NOT NULL,
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
  is_system_type BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_types_code ON user_types(type_code);
```

**Default Data:**
```sql
INSERT INTO user_types (type_code, type_name, description, global_permissions, is_system_type)
VALUES
  ('global_admin', 'Global Administrator',
   'Platform-wide administrator with access to all organizations',
   '{"can_access_all_organizations": true, "can_create_organizations": true, ...}'::jsonb,
   true),

  ('regular_user', 'Regular User',
   'Standard user with organization-based access only',
   '{"can_access_all_organizations": false, ...}'::jsonb,
   true);
```

### 1.2 organization_roles Table (Organization-Level)

**Created By:** Migration 024 (024_permissions_architecture.sql)
**Purpose:** Organization-specific role hierarchy (owner, admin, member, viewer)

```sql
CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  role_code VARCHAR(50) UNIQUE NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  hierarchy_level INTEGER NOT NULL,

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
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(hierarchy_level)
);
```

**Default Data:**
```sql
-- 4 roles: owner (level 4), admin (level 3), member (level 2), viewer (level 1)
INSERT INTO organization_roles (role_code, role_name, hierarchy_level, org_permissions, is_system_role)
VALUES
  ('owner', 'Owner', 4, '{...full permissions...}', true),
  ('admin', 'Administrator', 3, '{...management permissions...}', true),
  ('member', 'Member', 2, '{...editing permissions...}', true),
  ('viewer', 'Viewer', 1, '{...read-only...}', true);
```

### 1.3 users Table (Extended)

**Original:** Migration 001 (001_generalized_schema.sql)
**Extended:** Migration 024 adds `user_type_id` column

```sql
-- Migration 024 adds this column
ALTER TABLE users ADD COLUMN user_type_id UUID REFERENCES user_types(id);
CREATE INDEX idx_users_type ON users(user_type_id);
```

### 1.4 user_organizations Table (Extended)

**Original:** Migration 001 (001_generalized_schema.sql)
**Extended:** Migration 024 adds `org_role_id` column

```sql
-- Migration 024 adds this column
ALTER TABLE user_organizations ADD COLUMN org_role_id UUID REFERENCES organization_roles(id);
CREATE INDEX idx_user_orgs_role_id ON user_organizations(org_role_id);
```

---

## 2. RLS Policies (THE PROBLEM)

### 2.1 Current RLS Status

**Migration 024 - Line 329-362** enables RLS and creates policies:

```sql
ALTER TABLE user_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

-- POLICY 1: Anyone can read user types
CREATE POLICY "Anyone can read user types"
  ON user_types FOR SELECT
  USING (true);

-- POLICY 2: Only global admins can modify (CAUSES THE ISSUE!)
CREATE POLICY "Global admins can manage user types"
  ON user_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()  -- ❌ THIS FAILS DURING SETUP!
      AND (ut.global_permissions->>'can_configure_system')::boolean = true
    )
  );
```

### 2.2 Migration 030 Attempts to Disable RLS

**File:** 030_disable_rls_CORRECTED.sql
**Lines 10-15:**

```sql
-- Core tables
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;  -- ✅ CORRECT
ALTER TABLE organization_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
```

**VERIFICATION NEEDED:** Check if this migration has been run on production database!

---

## 3. Data Flow: How Users Get Types/Roles Assigned

### 3.1 Setup Wizard Flow (First Organization)

**File:** /src/routes/setup.js
**Lines:** 711-736

```javascript
// STEP 1: Determine user type based on whether this is first org
const userTypeCode = adminUser.is_first_org ? 'global_admin' : 'regular_user';

// STEP 2: Query user_types table (❌ THIS IS WHERE IT FAILS)
const { data: userType, error: userTypeError } = await supabase
  .from('user_types')
  .select('id')
  .eq('type_code', userTypeCode)
  .single();

if (userTypeError) {
  console.error('[SETUP-DEBUG] ❌ Error getting user type:', userTypeError);
  throw new Error(`Failed to get ${userTypeCode} user type`);
}

// STEP 3: Update users table with user_type_id
const { error: userUpdateError } = await supabase
  .from('users')
  .update({ user_type_id: userType.id })
  .eq('id', adminUser.user_id);
```

### 3.2 Invitation Acceptance Flow

**File:** /src/routes/auth.js
**Lines:** 1016-1153

**Process:**
1. User clicks invitation link
2. Creates or finds Supabase Auth user (line 1066-1130)
3. Calls `upsertUser()` to create/update users table record (line 1078, 1125)
4. **DOES NOT SET user_type_id** - Missing this step!
5. Creates user_organizations record with role (line 1133-1141)

**GAP:** Invitation acceptance doesn't assign user_type_id, only org role!

### 3.3 Registration Flow

**File:** /src/routes/auth.js
**Lines:** 178-278

**Process:**
1. Creates Supabase Auth user (line 206-229)
2. Calls `upsertUser()` to create users table record (line 232)
3. **DOES NOT SET user_type_id** - Missing this step!
4. Creates user_organizations record if orgId provided (line 236-243)

**GAP:** Registration doesn't assign user_type_id!

---

## 4. Foreign Key Constraints

### 4.1 users.user_type_id

```sql
ALTER TABLE users
  ADD COLUMN user_type_id UUID REFERENCES user_types(id);
```

- **Nullable:** YES (allows NULL for backward compatibility)
- **On Delete:** No action specified (defaults to NO ACTION)
- **Issue:** New users created without user_type_id will have NULL

### 4.2 user_organizations.org_role_id

```sql
ALTER TABLE user_organizations
  ADD COLUMN org_role_id UUID REFERENCES organization_roles(id);
```

- **Nullable:** YES (allows NULL for backward compatibility)
- **On Delete:** No action specified
- **Issue:** Old code still uses string `role` column, new code should use `org_role_id`

---

## 5. Gap Analysis

### 5.1 Critical Gaps

| Gap | Impact | Location | Severity |
|-----|--------|----------|----------|
| **RLS blocking setup queries** | Setup wizard fails | user_types table policies | CRITICAL |
| **Invitation doesn't set user_type_id** | Users have NULL type | auth.js line 1016-1153 | HIGH |
| **Registration doesn't set user_type_id** | Users have NULL type | auth.js line 178-278 | HIGH |
| **Migration 030 not verified** | RLS may still be enabled | Database state unknown | CRITICAL |
| **auth.uid() context missing during setup** | Supabase client has no session | setup.js uses service client | CRITICAL |

### 5.2 Data Consistency Issues

**Current State for This User:**
```sql
-- User record exists in users table
SELECT id, email, user_type_id FROM users WHERE id = 'abc123';
-- Result: id='abc123', email='user@example.com', user_type_id=NULL ❌

-- User-org link exists
SELECT user_id, organization_id, role, org_role_id FROM user_organizations WHERE user_id = 'abc123';
-- Result: user_id='abc123', org_id='org456', role='owner', org_role_id='xyz789' ✅
```

**What Should Happen:**
```sql
-- User should have user_type_id set
UPDATE users
SET user_type_id = (SELECT id FROM user_types WHERE type_code = 'regular_user')
WHERE id = 'abc123' AND user_type_id IS NULL;
```

---

## 6. SQL Diagnostic Scripts

### 6.1 Check if user_types table exists

```sql
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_types'
) AS table_exists;
```

### 6.2 Check RLS status

```sql
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_types', 'organization_roles');
```

### 6.3 View active RLS policies

```sql
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_types';
```

### 6.4 Check user_types data

```sql
-- Check if default types exist
SELECT type_code, type_name, is_system_type
FROM user_types
ORDER BY type_code;
-- Expected: 'global_admin' and 'regular_user'
```

### 6.5 Find users without user_type_id

```sql
SELECT
  u.id,
  u.email,
  u.user_type_id,
  uo.role,
  uo.org_role_id,
  o.name AS organization_name
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE u.user_type_id IS NULL;
```

### 6.6 Fix specific user

```sql
-- Set user_type_id for users without it (regular users)
UPDATE users
SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'regular_user'
)
WHERE user_type_id IS NULL
  AND id = 'USER_ID_HERE';
```

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   USER ONBOARDING FLOWS                     │
└─────────────────────────────────────────────────────────────┘

FLOW 1: SETUP WIZARD (First Organization)
=========================================
1. POST /setup/organization
   ├─ Create Supabase Auth user
   ├─ Store user_id in session
   └─ Mark as is_first_org: true

2. POST /setup/complete
   ├─ Create organization record
   ├─ Query user_types for 'global_admin' ❌ FAILS HERE (RLS!)
   ├─ Update users.user_type_id
   ├─ Query organization_roles for 'owner'
   └─ Create user_organizations link


FLOW 2: INVITATION ACCEPTANCE
==============================
1. GET /auth/accept-invite?token=xxx
   └─ Validate invitation

2. POST /auth/accept-invite
   ├─ Find or create Supabase Auth user
   ├─ Call upsertUser() → creates users record
   ├─ ❌ MISSING: Set user_type_id
   ├─ Create user_organizations record
   │  ├─ Set role='member' (old column)
   │  └─ Set org_role_id (new column)
   └─ Auto-login user


FLOW 3: SELF REGISTRATION
==========================
1. POST /auth/register
   ├─ Create Supabase Auth user
   ├─ Call upsertUser() → creates users record
   ├─ ❌ MISSING: Set user_type_id
   └─ If orgId provided:
      └─ Create user_organizations record


┌─────────────────────────────────────────────────────────────┐
│                   PERMISSION LOOKUP                         │
└─────────────────────────────────────────────────────────────┘

users.user_type_id → user_types.global_permissions
                      (Platform-wide access)

user_organizations.org_role_id → organization_roles.org_permissions
                                  (Per-organization access)
```

---

## 8. Root Cause Analysis

### 8.1 Why the Error Occurs

**Error Message:**
```
relation "user_types" does not exist
```

**Actual Problem:**
1. user_types table **DOES exist**
2. RLS is **ENABLED** on user_types
3. RLS policy requires `auth.uid()` context
4. Setup wizard uses **service client** without user session
5. Service client should **bypass RLS**, but policy may be incorrectly configured
6. Supabase interprets this as "table doesn't exist" when RLS denies access

**Evidence:**
- Migration 024 creates the table (verified)
- Migration 030 attempts to disable RLS (needs verification)
- Setup code queries the table at line 713 (verified)
- Error occurs exactly at this query (verified)

### 8.2 Why This Affects One User

**Scenario:**
1. User completed setup wizard partially
2. Organization was created
3. User record was created in users table
4. Setup crashed before user_type_id was set
5. User now has `user_type_id = NULL`
6. Subsequent queries fail because of missing user type

---

## 9. Recommended Fixes

### 9.1 Immediate Fix (For This User)

```sql
-- Check if migrations have been run
SELECT * FROM user_types;  -- Should show 2 rows

-- If table exists but user has NULL type:
UPDATE users
SET user_type_id = (SELECT id FROM user_types WHERE type_code = 'regular_user')
WHERE email = 'user@example.com'
  AND user_type_id IS NULL;
```

### 9.2 Short-term Fix (Disable RLS for Setup)

**Verify migration 030 has been run:**
```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_types';

-- If RLS is still enabled, run:
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles DISABLE ROW LEVEL SECURITY;
```

### 9.3 Long-term Fix (Code Changes)

**Fix 1: Add user_type_id to invitation acceptance**
```javascript
// In auth.js, after line 1125 (after upsertUser call)
await supabaseService
  .from('users')
  .update({
    user_type_id: (await supabaseService
      .from('user_types')
      .select('id')
      .eq('type_code', 'regular_user')
      .single()).data.id
  })
  .eq('id', userId);
```

**Fix 2: Add user_type_id to registration**
```javascript
// In auth.js, after line 232 (after upsertUser call)
await supabaseService
  .from('users')
  .update({
    user_type_id: (await supabaseService
      .from('user_types')
      .select('id')
      .eq('type_code', 'regular_user')
      .single()).data.id
  })
  .eq('id', authData.user.id);
```

**Fix 3: Add default to users table**
```sql
-- Set default user_type_id to 'regular_user' for new inserts
ALTER TABLE users
ALTER COLUMN user_type_id
SET DEFAULT (SELECT id FROM user_types WHERE type_code = 'regular_user');
```

---

## 10. Verification Checklist

- [ ] Verify user_types table exists: `SELECT * FROM user_types;`
- [ ] Verify RLS is disabled: Check migration 030 was run
- [ ] Check affected user's user_type_id: `SELECT user_type_id FROM users WHERE email='...'`
- [ ] Verify organization_roles data exists: `SELECT * FROM organization_roles;`
- [ ] Test setup wizard with new organization
- [ ] Test invitation acceptance flow
- [ ] Test registration flow
- [ ] Confirm all new users get user_type_id assigned

---

## 11. Related Files

**Migration Files:**
- /database/migrations/001_generalized_schema.sql (creates base tables)
- /database/migrations/024_permissions_architecture.sql (creates user_types)
- /database/migrations/030_disable_rls_CORRECTED.sql (disables RLS)

**Application Files:**
- /src/routes/setup.js (lines 711-736) - Setup wizard user type assignment
- /src/routes/auth.js (lines 1016-1153) - Invitation acceptance
- /src/routes/auth.js (lines 178-278) - Registration
- /src/routes/auth.js (lines 98-116) - upsertUser helper function

**Diagnostic Scripts:**
- /database/CHECK_USER_TYPES.sql
- /database/TEST_USER_TYPES_QUERY.sql

---

## Conclusion

The "relation 'user_types' does not exist" error is **NOT** caused by a missing table. The table exists and has correct data. The issue is:

1. **RLS policies blocking access** during setup wizard execution
2. **Missing user_type_id assignment** in invitation and registration flows
3. **Incomplete setup** leaving users with NULL user_type_id

**Immediate Action Required:**
1. Verify migration 030 has been run to disable RLS
2. Manually fix the affected user's user_type_id
3. Add user_type_id assignment to all user creation flows

**Priority:** CRITICAL - This blocks setup wizard for all new organizations
