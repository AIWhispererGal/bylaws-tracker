# Quick Guide: Apply Migration 013

**Priority 2 Security Fix - Global Admin RLS**

## TL;DR

```bash
# 1. Apply migration via Supabase
supabase db push

# 2. Verify success
psql $DATABASE_URL -c "SELECT * FROM verify_global_admin_rls();"

# 3. Expected output: All 6 tables show "true" for has_global_admin_policies
```

## What This Fixes

Global admins were blocked from 6 tables. This migration adds `is_global_admin(auth.uid())` checks to:
- `suggestions` - ✅ Now accessible
- `suggestion_sections` - ✅ Now accessible
- `suggestion_votes` - ✅ Now accessible
- `document_workflows` - ✅ Now accessible
- `section_workflow_states` - ✅ Now accessible
- `user_organizations` - ✅ Now accessible

## Prerequisites

✅ Migration 012 must be applied (provides `is_global_admin()` function)
✅ Supabase project must be accessible
✅ Database credentials in environment

## Apply Migration

### Option A: Via Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase migration up 013_fix_global_admin_rls
```

### Option B: Via Supabase Dashboard

1. Navigate to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy entire content of `database/migrations/013_fix_global_admin_rls.sql`
4. Paste into SQL editor
5. Click **Run** (bottom right)
6. Wait for success message

### Option C: Via Direct psql

```bash
psql $DATABASE_URL -f database/migrations/013_fix_global_admin_rls.sql
```

## Verify Success

### Check 1: Verification Function Output

```sql
SELECT * FROM verify_global_admin_rls();
```

**Expected Output:**
```
table_name              | policy_count | has_global_admin_policies
------------------------|--------------|-------------------------
document_workflows      | 4            | t
section_workflow_states | 4            | t
suggestion_sections     | 4            | t
suggestion_votes        | 4            | t
suggestions             | 4            | t
user_organizations      | 4            | t
(6 rows)
```

### Check 2: Policy Names

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN (
    'suggestions', 'suggestion_sections', 'suggestion_votes',
    'document_workflows', 'section_workflow_states', 'user_organizations'
)
AND policyname LIKE '%global_admin%'
ORDER BY tablename, policyname;
```

**Expected:** 24 policies with "global_admin" in name

### Check 3: Function Exists

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'is_global_admin';
```

**Expected:**
```
routine_name     | routine_type
-----------------|-------------
is_global_admin  | FUNCTION
```

## Functional Testing

### Test Global Admin Access

```sql
-- Set your global admin user ID
SET LOCAL app.current_user_id = 'YOUR-GLOBAL-ADMIN-UUID';

-- Should return TRUE
SELECT is_global_admin('YOUR-GLOBAL-ADMIN-UUID'::uuid);

-- Should see suggestions from ALL organizations
SELECT COUNT(DISTINCT organization_id)
FROM suggestions s
JOIN documents d ON s.document_id = d.id;

-- Should see all user memberships
SELECT COUNT(*) FROM user_organizations;
```

### Test Regular User Access

```sql
-- Set regular user ID
SET LOCAL app.current_user_id = 'REGULAR-USER-UUID';

-- Should return FALSE
SELECT is_global_admin('REGULAR-USER-UUID'::uuid);

-- Should only see suggestions from their org
SELECT COUNT(DISTINCT organization_id)
FROM suggestions s
JOIN documents d ON s.document_id = d.id;
-- Expected: 1 (their organization only)
```

## Troubleshooting

### Error: "function is_global_admin does not exist"

**Solution:** Apply migration 012 first:
```bash
supabase migration up 012_workflow_enhancements_fixed
```

### Error: "policy already exists"

**Solution:** Migration is idempotent. Existing policies are dropped before creation.

### Some tables show false for has_global_admin_policies

**Solution:** Re-run migration:
```bash
psql $DATABASE_URL -f database/migrations/013_fix_global_admin_rls.sql
```

### Performance Issues

**Check indexes:**
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename IN ('user_organizations', 'suggestions')
ORDER BY idx_scan DESC;
```

**Expected indexes:**
- `idx_user_orgs_user_id` on `user_organizations(user_id)`
- `idx_suggestions_doc_id` on `suggestions(document_id)`

## Rollback (Emergency Only)

If critical issues arise, revert to migration 005 policies:

```sql
-- WARNING: This removes global admin access!

-- Drop global admin policies (repeat for all 6 tables)
DROP POLICY IF EXISTS "users_see_org_suggestions_or_global_admin" ON suggestions;
DROP POLICY IF EXISTS "public_create_suggestions_or_global_admin" ON suggestions;
-- ... (drop all 24 policies)

-- Recreate original policies from migration 005
-- See rollback section in 013_fix_global_admin_rls.sql
```

## Success Indicators

✅ All 6 tables show `has_global_admin_policies = true`
✅ 24 policies with "global_admin" in name
✅ Global admin can access data across all organizations
✅ Regular users still restricted to their organization
✅ No performance degradation (check slow query log)
✅ No errors in Supabase logs

## Post-Deployment

1. **Monitor logs** for RLS-related errors
2. **Check dashboard** for global admin user access
3. **Test workflow** management across organizations
4. **Verify suggestion** viewing in all organizations
5. **Update documentation** if needed

## Files Modified

- **Created:** `database/migrations/013_fix_global_admin_rls.sql` (574 lines)
- **Created:** `docs/MIGRATION_013_SUMMARY.md` (comprehensive guide)
- **Created:** `docs/QUICK_APPLY_MIGRATION_013.md` (this file)

## Related Migrations

- **Migration 005:** Base RLS policies
- **Migration 007:** Global admin infrastructure
- **Migration 012:** `is_global_admin()` function
- **Migration 013:** Complete global admin coverage (this)

## Support

**Issue:** Global admin still blocked?
**Check:** `SELECT is_global_admin(auth.uid());` should return `true`

**Issue:** Performance slow?
**Check:** `EXPLAIN ANALYZE` on slow queries

**Issue:** Policies missing?
**Check:** `SELECT * FROM verify_global_admin_rls();`

---

**Migration File:** `/database/migrations/013_fix_global_admin_rls.sql`
**Summary Doc:** `/docs/MIGRATION_013_SUMMARY.md`
**Applied:** Pending
**Estimated Time:** 2-5 seconds
**Risk:** Low (backward compatible)
