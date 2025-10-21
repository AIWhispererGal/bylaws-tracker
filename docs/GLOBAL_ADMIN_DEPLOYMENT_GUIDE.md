# Global Admin Deployment Guide

**Quick Reference for Deploying Global Admin RLS Policies**

---

## 🎯 Overview

Global admins are superusers who can access and manage data across **ALL organizations** in the system. This guide covers deploying the RLS policies that enable global admin functionality.

---

## 📋 Prerequisites

Before deploying global admin features:

1. ✅ Supabase Auth configured (`auth.uid()` working)
2. ✅ Base schema deployed (migration 001)
3. ✅ User authentication working (migration 006)
4. ✅ Multi-tenant RLS active (migrations 003, 005, 009)

---

## 🚀 Deployment Steps

### Step 1: Run Required Migrations (In Order)

```bash
# In Supabase SQL Editor, run these in sequence:

# 1. Create global admin infrastructure
database/migrations/007_create_global_superuser.sql

# 2. Enhance user roles and approval workflow
database/migrations/008_enhance_user_roles_and_approval.sql

# 3. Add organization_id columns for performance
database/migrations/009_enhance_rls_organization_filtering.sql

# 4. Complete global admin RLS coverage
database/migrations/011_add_global_admin_suggestions.sql
```

### Step 2: Verify Migration Success

```sql
-- Check if is_global_admin function exists
SELECT proname FROM pg_proc WHERE proname = 'is_global_admin';
-- Expected: 1 row

-- Check if column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_organizations' AND column_name = 'is_global_admin';
-- Expected: 1 row

-- Count global admin policies
SELECT COUNT(*) FROM pg_policies WHERE policyname LIKE '%global_admin%';
-- Expected: 20+ policies

-- View policy coverage
SELECT * FROM global_admin_policy_audit;
-- Expected: All core tables covered
```

### Step 3: Create a Global Admin User

```sql
-- Option A: Make existing user global admin in all orgs
SELECT link_global_admin_to_all_orgs('YOUR-AUTH-USER-ID'::uuid);

-- Option B: Manually set global admin flag
UPDATE user_organizations
SET is_global_admin = true,
    role = 'superuser',
    permissions = jsonb_build_object(
      'can_edit_sections', true,
      'can_create_suggestions', true,
      'can_vote', true,
      'can_approve_stages', ARRAY['all'],
      'can_manage_users', true,
      'can_manage_workflows', true,
      'is_superuser', true,
      'is_global_admin', true
    )
WHERE user_id = 'YOUR-AUTH-USER-ID'::uuid;
```

### Step 4: Test Global Admin Access

```sql
-- Test 1: Verify flag is set
SELECT
  u.email,
  uo.organization_id,
  o.name as org_name,
  uo.role,
  uo.is_global_admin,
  uo.is_active
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
WHERE uo.is_global_admin = true;
-- Expected: Your user with is_global_admin = true

-- Test 2: Check function returns true
SELECT is_global_admin('YOUR-AUTH-USER-ID'::uuid);
-- Expected: true

-- Test 3: Test RLS policies (as authenticated user)
SET LOCAL request.jwt.claims = '{"sub": "YOUR-AUTH-USER-ID", "role": "authenticated"}';

-- Should see ALL documents across ALL organizations
SELECT COUNT(DISTINCT organization_id) as org_count FROM documents;

-- Should see ALL suggestions across ALL organizations
SELECT COUNT(DISTINCT organization_id) as org_count FROM suggestions;

-- Should see ALL sections across ALL organizations
SELECT COUNT(DISTINCT organization_id) as org_count FROM document_sections;
```

---

## 🔐 Security Checklist

Before enabling global admin in production:

- [ ] Audit who needs global admin access
- [ ] Document business justification for global admin users
- [ ] Enable activity logging for global admin actions
- [ ] Set up alerts for global admin flag changes
- [ ] Create backup of database before migration
- [ ] Test in staging environment first
- [ ] Verify regular users are NOT affected
- [ ] Confirm organization isolation still works for non-admins

---

## 📊 What Gets Deployed

### Migration 007: Core Global Admin Infrastructure
- `is_global_admin` column on `user_organizations`
- `is_global_admin(user_id)` helper function
- RLS policies for documents, document_sections, organizations
- `link_global_admin_to_all_orgs()` helper function

### Migration 008: Enhanced Role Management
- `is_active` column for user memberships
- `invited_at`, `invited_by`, `last_active` tracking
- Document versioning system
- User activity audit log
- RBAC helper functions

### Migration 009: Performance Optimization
- `organization_id` column on document_sections
- `organization_id` column on suggestions
- Triggers to auto-maintain organization_id
- Enhanced RLS policies with direct filtering
- Performance indexes

### Migration 011: Complete Global Admin Coverage
- Global admin policies for **suggestions** (CRITICAL FIX)
- Global admin policies for suggestion_sections, suggestion_votes
- Global admin policies for workflow_templates, workflow_stages
- Global admin policies for document_workflows, section_workflow_states
- Global admin policies for document_versions, user_activity_log
- Audit view: `global_admin_policy_audit`

---

## 🎯 Global Admin Policy Coverage

After deployment, global admins have full access to:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| documents | ✅ | ✅ | ✅ | ✅ |
| document_sections | ✅ | ✅ | ✅ | ✅ |
| organizations | ✅ | ✅ | ✅ | ✅ |
| suggestions | ✅ | ✅ | ✅ | ✅ |
| suggestion_sections | ✅ | ✅ | ✅ | ✅ |
| suggestion_votes | ✅ | ✅ | ✅ | ✅ |
| workflow_templates | ✅ | ✅ | ✅ | ✅ |
| workflow_stages | ✅ | ✅ | ✅ | ✅ |
| document_workflows | ✅ | ✅ | ✅ | ✅ |
| section_workflow_states | ✅ | ✅ | ✅ | ✅ |
| document_versions | ✅ | ✅ | ✅ | ✅ |
| user_activity_log | ✅ | ❌ | ❌ | ❌ |

**Note:** Global admins can only SELECT from `user_activity_log` to prevent audit trail tampering.

---

## 🧪 Testing Procedure

### Test Case 1: Regular User Cannot See Other Orgs
```sql
-- Login as regular user in Org A
SET LOCAL request.jwt.claims = '{"sub": "regular-user-id", "role": "authenticated"}';

-- Should only see Org A data
SELECT DISTINCT organization_id FROM documents;
-- Expected: Only Org A's ID

SELECT DISTINCT organization_id FROM suggestions;
-- Expected: Only Org A's ID
```

### Test Case 2: Global Admin Sees All Orgs
```sql
-- Login as global admin
SET LOCAL request.jwt.claims = '{"sub": "global-admin-id", "role": "authenticated"}';

-- Should see ALL organizations
SELECT DISTINCT organization_id FROM documents ORDER BY organization_id;
-- Expected: Multiple organization IDs

SELECT DISTINCT organization_id FROM suggestions ORDER BY organization_id;
-- Expected: Multiple organization IDs

-- Verify function works
SELECT is_global_admin(auth.uid());
-- Expected: true
```

### Test Case 3: Global Admin Flag Respected
```sql
-- User has is_global_admin = false
UPDATE user_organizations
SET is_global_admin = false
WHERE user_id = 'test-user-id'::uuid;

-- Login as that user
SET LOCAL request.jwt.claims = '{"sub": "test-user-id", "role": "authenticated"}';

-- Should only see their own org
SELECT is_global_admin(auth.uid());
-- Expected: false

-- Now enable global admin
UPDATE user_organizations
SET is_global_admin = true, is_active = true
WHERE user_id = 'test-user-id'::uuid;

-- Should now see all orgs
SELECT is_global_admin('test-user-id'::uuid);
-- Expected: true
```

---

## 🐛 Troubleshooting

### Issue: Global admin still can't see other orgs

**Possible Causes:**
1. `is_global_admin` column not set correctly
2. `is_active = false` on user_organizations record
3. Migration 011 not run (suggestions policies missing)
4. RLS policies not created

**Debug Steps:**
```sql
-- Check user's global admin status
SELECT * FROM user_organizations WHERE user_id = 'USER-ID';

-- Check if policies exist
SELECT tablename, policyname FROM pg_policies
WHERE policyname LIKE '%global_admin%'
ORDER BY tablename;

-- Check function exists
SELECT proname, prosrc FROM pg_proc WHERE proname = 'is_global_admin';

-- Test function directly
SELECT is_global_admin('USER-ID'::uuid);
```

### Issue: Regular users see too much data

**Possible Causes:**
1. RLS accidentally disabled
2. User has global admin flag when they shouldn't
3. Service role key being used instead of auth.uid()

**Debug Steps:**
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'documents', 'suggestions', 'document_sections'
);
-- All should have rowsecurity = true

-- Check for unexpected global admins
SELECT u.email, COUNT(*) as admin_orgs
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
WHERE uo.is_global_admin = true
GROUP BY u.email;
```

### Issue: Migrations fail

**Error: "function is_global_admin does not exist"**
- Solution: Run migration 007 first

**Error: "column organization_id does not exist"**
- Solution: Run migration 009 before 011

**Error: "table document_versions does not exist"**
- Solution: Run migration 008 before 011

**Error: "infinite recursion detected in policy"**
- Solution: Make sure RLS is using `auth.uid()` not recursive checks

---

## 📚 Related Files

- `/database/migrations/007_create_global_superuser.sql` - Core infrastructure
- `/database/migrations/008_enhance_user_roles_and_approval.sql` - Enhanced roles
- `/database/migrations/009_enhance_rls_organization_filtering.sql` - Performance
- `/database/migrations/011_add_global_admin_suggestions.sql` - Complete coverage
- `/docs/reports/RLS_GLOBAL_ADMIN_RESEARCH.md` - Detailed research findings
- `/docs/HIVE_SESSION_MEMORY.md` - Session context
- `/docs/ADMIN_ACCESS_FIX.md` - Admin session setup

---

## 🎉 Success Criteria

After deployment, you should be able to:

1. ✅ Create a global admin user
2. ✅ Global admin sees ALL documents across ALL organizations
3. ✅ Global admin sees ALL suggestions across ALL organizations
4. ✅ Global admin can manage data in ANY organization
5. ✅ Regular users only see their own organization's data
6. ✅ Organization isolation maintained for non-global-admins
7. ✅ Activity logging captures global admin actions
8. ✅ No RLS recursion errors
9. ✅ Performance is acceptable (indexed organization_id)

---

## 🚀 Quick Start Commands

```bash
# 1. Run all migrations in Supabase SQL Editor
cat database/migrations/007_create_global_superuser.sql \
    database/migrations/008_enhance_user_roles_and_approval.sql \
    database/migrations/009_enhance_rls_organization_filtering.sql \
    database/migrations/011_add_global_admin_suggestions.sql

# 2. Create global admin (replace USER-ID)
# SELECT link_global_admin_to_all_orgs('USER-ID'::uuid);

# 3. Verify deployment
# SELECT * FROM global_admin_policy_audit;

# 4. Test access
# SELECT is_global_admin(auth.uid());
```

---

**Deployment Status:** Ready for production
**Risk Level:** Medium (affects security model)
**Rollback:** Disable RLS policies or set is_global_admin = false
**Support:** See research report for detailed analysis
