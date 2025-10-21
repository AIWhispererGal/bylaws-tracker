# 🚀 Quick Start: RLS Fix Deployment

**Time Required:** 5-10 minutes
**Risk Level:** Low (safe, idempotent migration)
**Rollback:** Not needed (improves existing broken state)

---

## ⚡ 3-Step Deployment

### Step 1: Run Migration (2 minutes)

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click "SQL Editor" in left sidebar

2. **Run Migration Script**
   - Open file: `database/migrations/005_fix_rls_properly.sql`
   - Copy entire contents (Ctrl+A, Ctrl+C)
   - Paste into SQL Editor
   - Click "Run" button

3. **Verify Success**
   - Look for success message:
     ```
     ✅ RLS FIXED PROPERLY!
     🎉 DATABASE IS READY FOR PRODUCTION!
     ```
   - If you see errors, check the error message
   - Most common issue: Already run (safe to ignore)

---

### Step 2: Test Setup Wizard (2 minutes)

1. **Navigate to Setup**
   - Go to: `http://localhost:3000/setup` (or your domain)

2. **Create Test Organization**
   - Enter organization name: "Test NC"
   - Enter slug: "test-nc"
   - Click "Next"

3. **Import Document**
   - Upload a test document OR
   - Enter Google Doc ID
   - Click "Import"

4. **Verify Success**
   - Should complete without errors
   - Should see success message
   - No "infinite recursion" errors

---

### Step 3: Verify Multi-Tenant Isolation (3 minutes)

1. **Create Second Organization**
   - Use different browser/incognito
   - Create "Test NC 2"
   - Import different document

2. **Test Data Isolation**
   - In first browser: Should only see "Test NC" documents
   - In second browser: Should only see "Test NC 2" documents
   - Cross-check: Each org cannot see the other's data

3. **Success Criteria**
   - ✅ No "infinite recursion" errors
   - ✅ Setup wizard completes successfully
   - ✅ Organizations cannot see each other's data
   - ✅ All queries return results < 200ms

---

## 🔍 Quick Verification Commands

### Check RLS is Enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

**Expected:** All tables show `rowsecurity = true`

---

### Check Policies Exist:
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected:** Multiple policies with names like `allow_read_*`, `allow_create_*`

---

### Test Query Performance:
```sql
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE organization_id = 'your-org-id-here';
```

**Expected:** Execution time < 10ms

---

## 🐛 Troubleshooting

### Issue 1: "Policy already exists"
**Cause:** Migration already run
**Solution:** Safe to ignore, or drop policies first

```sql
-- Drop all policies (safe, script recreates them)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;
```

---

### Issue 2: "Function already exists"
**Cause:** Helper functions already created
**Solution:** Drop and recreate

```sql
DROP FUNCTION IF EXISTS is_org_member(UUID, UUID);
DROP FUNCTION IF EXISTS has_org_role(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_organizations(UUID);
```

Then re-run migration.

---

### Issue 3: Setup wizard still fails
**Cause:** Application code needs organization_id filters

**Check:** Review application code for missing filters

```bash
# Search for queries without org_id filter
grep -r "\.from(" src/ | grep -v "\.eq('organization_id'"
```

**Fix:** Add `.eq('organization_id', userOrgId)` to each query

---

### Issue 4: Performance is slow
**Cause:** Missing indexes on organization_id

**Check:** Verify indexes exist

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE '%organization%';
```

**Fix:** Add missing indexes

```sql
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);
```

---

## 📋 Post-Deployment Checklist

- [ ] Migration completed without errors
- [ ] Success message displayed
- [ ] Setup wizard creates organization
- [ ] Setup wizard imports document
- [ ] Second organization can be created
- [ ] Organizations cannot see each other's data
- [ ] No "infinite recursion" errors
- [ ] All queries return in < 200ms
- [ ] Application code has organization_id filters
- [ ] Integration tests pass (if available)

---

## 🎯 One-Line Validation

```bash
# Run this to verify everything works:
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test NC","slug":"test-nc"}'
```

**Expected:** Status 200, organization created

---

## 📞 Quick Help

### For Developers:
- **Security Rules:** See `docs/SECURITY_CHECKLIST.md`
- **Testing Guide:** See `docs/TESTING_MULTI_TENANT.md`
- **Architecture:** See `docs/ADR-001-RLS-SECURITY-MODEL.md`

### For Errors:
1. Check Supabase logs (Dashboard → Logs)
2. Check browser console (F12)
3. Review error message in migration output
4. Search error text in `README_RLS_FIX.md`

---

## ✅ You're Done!

**If all checks pass:**
- ✅ RLS is fixed
- ✅ Multi-tenant isolation works
- ✅ Setup wizard functional
- ✅ Ready for production

**Next steps:**
1. Review application code for organization_id filters
2. Run integration tests
3. Deploy to production
4. Monitor for 24 hours

---

**Deployment Time:** < 10 minutes
**Downtime:** None (zero-downtime migration)
**Risk:** Very Low (only fixes broken policies)
**Rollback:** Not needed (improves security)

🎉 **Congratulations! Multi-tenant RLS is now properly configured!**
