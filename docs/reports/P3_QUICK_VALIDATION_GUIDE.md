# P3 Quick Validation Guide

**Generated:** 2025-10-15
**Purpose:** Quick commands to verify org admin setup

---

## 🚀 One-Liner Validation Script

```bash
# Run this to check all setup components
psql YOUR_DATABASE_URL <<EOF
\echo '=== 1. Check Auth User ==='
SELECT id, email, email_confirmed_at,
       raw_user_meta_data->>'setup_user' as from_setup
FROM auth.users
WHERE email = 'YOUR_ADMIN_EMAIL'
LIMIT 1;

\echo '=== 2. Check Public Users Table ==='
SELECT id, email, name, auth_provider, created_at
FROM users
WHERE email = 'YOUR_ADMIN_EMAIL'
LIMIT 1;

\echo '=== 3. Check Organization Membership ==='
SELECT
  uo.user_id,
  uo.role,
  uo.is_active,
  uo.is_global_admin,
  o.name as organization_name,
  o.is_configured
FROM user_organizations uo
JOIN organizations o ON uo.organization_id = o.id
WHERE uo.user_id = (SELECT id FROM users WHERE email = 'YOUR_ADMIN_EMAIL')
LIMIT 1;

\echo '=== 4. Check Workflow Template Created ==='
SELECT
  wt.id,
  wt.name,
  wt.is_default,
  wt.is_active,
  COUNT(ws.id) as stage_count
FROM workflow_templates wt
LEFT JOIN workflow_stages ws ON ws.workflow_template_id = wt.id
WHERE wt.organization_id = (
  SELECT organization_id
  FROM user_organizations
  WHERE user_id = (SELECT id FROM users WHERE email = 'YOUR_ADMIN_EMAIL')
  LIMIT 1
)
GROUP BY wt.id, wt.name, wt.is_default, wt.is_active;

\echo '=== 5. Check Session (if available) ==='
SELECT * FROM sessions WHERE sess::text LIKE '%YOUR_ADMIN_EMAIL%' LIMIT 1;
EOF
```

**Replace `YOUR_ADMIN_EMAIL` with actual admin email**

---

## ✅ Expected Output

### 1. Auth User
```
            id             |       email        | email_confirmed_at | from_setup
---------------------------+-------------------+-------------------+------------
 uuid-xxxx-xxxx-xxxx-xxxx | admin@example.com | 2025-10-15...     | true
```
✅ User exists, email confirmed, created via setup

### 2. Public Users Table
```
            id             |       email        |    name    | auth_provider | created_at
---------------------------+-------------------+-----------+--------------+-------------
 uuid-xxxx-xxxx-xxxx-xxxx | admin@example.com | Admin User | supabase     | 2025-10-15...
```
✅ Same ID as auth.users, auto-populated by trigger

### 3. Organization Membership
```
          user_id          |    role    | is_active | is_global_admin | organization_name | is_configured
---------------------------+-----------+----------+----------------+------------------+--------------
 uuid-xxxx-xxxx-xxxx-xxxx | org_admin | true     | false          | Test Organization | true
```
✅ User linked to organization with org_admin role

### 4. Workflow Template
```
          id             |           name            | is_default | is_active | stage_count
------------------------+---------------------------+-----------+----------+------------
 workflow-uuid-xxxx... | Default Approval Workflow | true       | true      | 2
```
✅ Workflow created with 2 stages (Committee Review, Board Approval)

### 5. Session (if available)
```
Session data will show userId, organizationId, supabaseJWT, etc.
```
✅ Session persisted with JWT tokens

---

## ❌ Common Issues & Fixes

### Issue 1: User Not in auth.users
```
(0 rows)
```
**Problem:** Auth user creation failed
**Check:** `src/routes/setup.js:144` - Error handling
**Fix:** Check Supabase service role key is correct

### Issue 2: User Not in public.users
```
Auth user exists, but public.users is empty
```
**Problem:** Trigger not firing
**Check:** Database migration `001_generalized_schema.sql`
**Fix:**
```sql
-- Manually create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### Issue 3: No Organization Membership
```
Auth user and public.users exist, but user_organizations is empty
```
**Problem:** Link not created during setup
**Check:** `src/routes/setup.js:654-669`
**Fix:** Check RLS policies on user_organizations table
```sql
-- Temporarily disable RLS for testing
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;

-- Try to insert manually
INSERT INTO user_organizations (user_id, organization_id, role)
VALUES (
  (SELECT id FROM users WHERE email = 'admin@example.com'),
  (SELECT id FROM organizations LIMIT 1),
  'org_admin'
);

-- Re-enable RLS
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
```

### Issue 4: No Workflow Template
```
User and org exist, but no workflow template
```
**Problem:** Workflow creation failed
**Check:** `src/routes/setup.js:672-736`
**Fix:** Create manually
```sql
-- Get organization ID
SELECT id FROM organizations WHERE is_configured = true LIMIT 1;

-- Create workflow template
INSERT INTO workflow_templates (
  organization_id, name, is_default, is_active
) VALUES (
  'org-uuid-here',
  'Default Approval Workflow',
  true,
  true
) RETURNING id;

-- Create stages (replace workflow-template-id)
INSERT INTO workflow_stages (
  workflow_template_id, stage_name, stage_order,
  can_lock, can_edit, can_approve, requires_approval,
  required_roles, display_color, icon, description
) VALUES
(
  'workflow-template-id',
  'Committee Review', 1,
  true, true, true, true,
  '["admin", "owner"]'::jsonb,
  '#FFD700', 'clipboard-check',
  'Initial review by committee members'
),
(
  'workflow-template-id',
  'Board Approval', 2,
  false, false, true, true,
  '["owner"]'::jsonb,
  '#90EE90', 'check-circle',
  'Final approval by board members'
);
```

---

## 🧪 Test Session After Setup

```bash
# Replace YOUR_SESSION_COOKIE with actual cookie value
curl -v http://localhost:3000/auth/session \
  --cookie "connect.sid=YOUR_SESSION_COOKIE"
```

**Expected Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "uuid-here",
    "email": "admin@example.com",
    "name": "Admin User"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Test Organization",
    "role": "org_admin"
  },
  "session": {
    "expiresAt": "2025-10-15T10:00:00Z",
    "expiresIn": 3600
  }
}
```

**If 401 Unauthorized:**
- Session not saved properly
- Cookie not being sent
- JWT expired and refresh failed

---

## 🔍 Deep Dive Queries

### Check Complete User Profile
```sql
SELECT
  u.id,
  u.email,
  u.name,
  u.auth_provider,
  u.created_at,
  COUNT(DISTINCT uo.organization_id) as org_count,
  STRING_AGG(DISTINCT uo.role, ', ') as roles,
  MAX(uo.is_global_admin) as is_global_admin
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
WHERE u.email = 'YOUR_ADMIN_EMAIL'
GROUP BY u.id, u.email, u.name, u.auth_provider, u.created_at;
```

### Check Workflow Configuration
```sql
SELECT
  ws.workflow_template_id,
  wt.name as workflow_name,
  ws.stage_name,
  ws.stage_order,
  ws.can_lock,
  ws.can_edit,
  ws.can_approve,
  ws.requires_approval,
  ws.required_roles,
  ws.display_color
FROM workflow_stages ws
JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
WHERE wt.organization_id = (
  SELECT organization_id
  FROM user_organizations
  WHERE user_id = (SELECT id FROM users WHERE email = 'YOUR_ADMIN_EMAIL')
  LIMIT 1
)
ORDER BY ws.stage_order;
```

### Check RLS Policies on Critical Tables
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'user_organizations', 'organizations')
ORDER BY tablename, policyname;
```

---

## 📊 Performance Check

```sql
-- Check if indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'user_organizations', 'workflow_templates')
ORDER BY tablename, indexname;
```

**Expected Indexes:**
- `users_pkey` on users(id)
- `idx_user_orgs_user_id` on user_organizations(user_id)
- `idx_user_orgs_org_id` on user_organizations(organization_id)
- `idx_user_orgs_composite` on user_organizations(user_id, organization_id)
- `idx_user_orgs_global_admin` on user_organizations(user_id, is_global_admin)

---

## 🎯 Final Validation

Run all 5 checks above. If ALL pass:
- ✅ Setup is working correctly
- ✅ User is properly created
- ✅ Organization link exists
- ✅ Workflow configured

If ANY fail:
- ❌ Check specific section above
- ❌ Review error logs
- ❌ Verify RLS policies
- ❌ Check session middleware

---

**Next Steps:** If all validation passes but dashboard still fails, investigate:
1. RLS policies blocking queries
2. Session persistence issues
3. JWT not being passed to Supabase client
4. Organization context middleware

See full trace in `P3_ORG_ADMIN_SETUP_TRACE.md`
