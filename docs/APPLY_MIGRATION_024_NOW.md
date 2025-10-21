# 🚀 APPLY MIGRATION 024 - Permissions Architecture

## ⚡ QUICK START (2 minutes)

### Step 1: Open Supabase SQL Editor
Visit: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/sql

### Step 2: Copy Migration File
Location: `database/migrations/024_permissions_architecture.sql`

### Step 3: Paste and Run
Click "Run" button in SQL Editor

### Step 4: Verify Success
You should see:
- ✅ Tables created: `user_types`, `organization_roles`
- ✅ Default types inserted: global_admin, org_admin, member, view_only
- ✅ Data migrated from old columns
- ✅ Backwards compatibility maintained

---

## 📋 What This Migration Does

### Creates New Tables:
1. **`user_types`** - Global permission types (4 types)
   - `global_admin` - Platform superuser
   - `org_admin` - Organization administrator (default for new orgs)
   - `member` - Regular member with full permissions within org
   - `view_only` - Read-only access

2. **`organization_roles`** - Organization-specific roles
   - Links users to organizations with specific roles
   - Replaces scattered permission columns
   - Enables fine-grained permission control

### Migrates Existing Data:
- ✅ Converts `is_global_admin` flags to user_types
- ✅ Converts organization memberships to organization_roles
- ✅ Preserves all existing permissions
- ✅ Maintains backwards compatibility

### Adds Helper Functions:
- `get_user_type(user_uuid)` - Get user's global type
- `get_org_role(user_uuid, org_uuid)` - Get user's role in specific org
- `has_global_admin(user_uuid)` - Check if user is global admin
- `has_org_admin(user_uuid, org_uuid)` - Check if user is org admin

---

## ✅ POST-MIGRATION CHECKLIST

After running migration, verify:

```sql
-- Check user_types table
SELECT * FROM user_types ORDER BY hierarchy_level;

-- Check organization_roles for your user
SELECT u.email, o.organization_name, r.role_name, ut.type_name
FROM organization_roles r
JOIN users u ON r.user_id = u.id
JOIN organizations o ON r.organization_id = o.id
JOIN user_types ut ON r.user_type_id = ut.id;

-- Test helper function
SELECT get_user_type(auth.uid());
```

Expected results:
- 4 rows in user_types (global_admin, org_admin, member, view_only)
- Your user should have organization_roles entry
- Helper functions should return proper values

---

## 🔄 BACKWARDS COMPATIBILITY

Migration 024 is **100% backwards compatible**:

1. **Old columns preserved**:
   - `users.is_global_admin` still exists
   - `user_organizations.is_global_admin` still exists
   - Old queries continue to work

2. **Data synced automatically**:
   - Changes to new tables update old columns via triggers
   - Changes to old columns update new tables via triggers
   - No code breaks during transition

3. **Gradual migration**:
   - Update code incrementally
   - Test each change
   - Rollback if needed

---

## 🎯 NEXT STEPS AFTER MIGRATION

### Immediate (Today):
1. ✅ Apply migration 024
2. ✅ Test login still works
3. ✅ Test dashboard loads correctly
4. ✅ Verify permissions display properly

### This Week:
1. Deploy new permissions middleware (`src/middleware/permissions.js`)
2. Update critical routes first (dashboard, admin, setup)
3. Update views to use new permission checks
4. Test thoroughly

### Next Week:
1. Migrate remaining routes
2. Update all views
3. Remove old permission columns (optional)
4. Deploy to production

---

## 🚨 TROUBLESHOOTING

### If Migration Fails:

**Error: "relation already exists"**
- Tables already created from previous run
- Safe to ignore or drop tables first:
  ```sql
  DROP TABLE IF EXISTS organization_roles CASCADE;
  DROP TABLE IF EXISTS user_types CASCADE;
  ```

**Error: "column does not exist"**
- Check migration 023 was applied first
- Run: `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='is_global_admin';`

**Error: "permission denied"**
- Ensure using service role key in SQL Editor
- Check RLS policies not blocking

### If Login Stops Working:

1. Check helper functions:
   ```sql
   SELECT get_user_type(auth.uid());
   SELECT has_global_admin(auth.uid());
   ```

2. Check organization_roles:
   ```sql
   SELECT * FROM organization_roles WHERE user_id = auth.uid();
   ```

3. Rollback if needed (see below)

---

## 🔙 ROLLBACK PROCEDURE

If something goes wrong, rollback:

```sql
-- Drop new tables
DROP TABLE IF EXISTS organization_roles CASCADE;
DROP TABLE IF EXISTS user_types CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_user_type(UUID);
DROP FUNCTION IF EXISTS get_org_role(UUID, UUID);
DROP FUNCTION IF EXISTS has_global_admin(UUID);
DROP FUNCTION IF EXISTS has_org_admin(UUID, UUID);

-- Old columns still intact, system continues working
```

---

## 📊 MONITORING

After migration, monitor:

1. **Error logs** - Check server console for permission errors
2. **Login success** - Ensure users can still log in
3. **Dashboard access** - Verify dashboard loads without 500 errors
4. **Permission display** - Check role badges show correct roles

---

## 💡 WHY THIS MIGRATION?

**Problems Solved:**
- ✅ Eliminates 300+ scattered permission checks
- ✅ Centralizes permission logic
- ✅ Improves performance (indexed lookups vs computed checks)
- ✅ Enables fine-grained permission control
- ✅ Simplifies adding new roles/permissions
- ✅ Better security (single source of truth)

**Architecture:**
- **user_types** - Global platform permissions (4 types)
- **organization_roles** - Org-specific roles (many-to-many)
- **Hybrid model** - Best of both worlds

---

## 🎉 SUCCESS CRITERIA

You'll know migration succeeded when:

1. ✅ Server starts without errors
2. ✅ Login works normally
3. ✅ Dashboard loads without 500 errors
4. ✅ Correct role badges display (admin/owner, member, view-only)
5. ✅ All permission gates work (6 critical gates)
6. ✅ Helper functions return expected values

---

**Status**: Ready to apply
**Risk Level**: Low (backwards compatible)
**Time Required**: 2 minutes
**Rollback Available**: Yes (1 minute)

🚀 **Ready to proceed? Copy migration 024 to Supabase SQL Editor and run it!**
