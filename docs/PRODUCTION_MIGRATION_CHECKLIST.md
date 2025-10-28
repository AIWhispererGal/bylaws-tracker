# 🗄️ Production Supabase Migration Checklist

**Date:** 2025-10-28
**Purpose:** Migrate production Supabase from OLD schema to NEW multi-tenant schema

---

## 📋 Migration Files to Run (In Order)

### **Core Schema Migrations:**

1. **001_generalized_schema.sql** ⭐ **CRITICAL**
   - Creates new multi-tenant tables: `organizations`, `documents`, `document_sections`
   - Creates `users`, `user_organizations` junction table
   - Sets up RLS policies
   - Creates workflow tables
   - **This is THE BIG ONE that creates the `organizations` table**

2. **002_migrate_existing_data.sql**
   - Migrates old `bylaw_sections` data to new schema (if you have existing data)
   - **SKIP THIS** if starting fresh production database

3. **003_add_document_order.sql**
   - Adds document ordering functionality

4. **003_enable_user_organizations_rls.sql**
   - Enables RLS for user-organization relationships

5. **004_fix_rls_recursion.sql**
   - Fixes RLS recursion issues

6. **005_fix_rls_recursion_safe.sql**
   - Safer version of recursion fix

7. **006_create_permission_rpc_functions.sql**
   - Creates permission checking functions

8. **006_fix_permission_functions.sql**
   - Fixes permission functions (run this, not the previous one)

9. **007_service_role_bypass_rls.sql**
   - Allows service role to bypass RLS

10. **008_fix_global_admin_rls.sql**
    - Fixes global admin permissions

11. **008b_fix_rls_recursion.sql**
    - Additional recursion fix

12. **008c_fix_recursion_properly.sql**
    - Final recursion fix (run this one)

13. **009_add_section_rpc_functions.sql**
    - Adds section manipulation functions

14. **025_fix_depth_trigger.sql**
    - Fixes section depth calculation

15. **026_fix_path_ids_constraint.sql**
    - Fixes path_ids constraints

16. **027_add_users_updated_at.sql**
    - Adds updated_at timestamps to users table

---

## 🚀 Quick Start: Run These Essential Migrations

**If you want to get up and running FAST, run these 5 migrations:**

```sql
-- 1. Core schema (REQUIRED)
-- Run: database/migrations/001_generalized_schema.sql

-- 2. Latest recursion fix (REQUIRED)
-- Run: database/migrations/008c_fix_recursion_properly.sql

-- 3. Permission functions (REQUIRED)
-- Run: database/migrations/006_fix_permission_functions.sql

-- 4. Service role bypass (REQUIRED)
-- Run: database/migrations/007_service_role_bypass_rls.sql

-- 5. Section functions (REQUIRED for document upload)
-- Run: database/migrations/009_add_section_rpc_functions.sql
```

These 5 will give you a working system. You can run the others later if you encounter issues.

---

## 📖 How to Run Migrations in Supabase

### **Method 1: SQL Editor (Recommended)**

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your production project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy contents of migration file (e.g., `001_generalized_schema.sql`)
6. Paste into SQL Editor
7. Click **Run**
8. Wait for "Success" message
9. Repeat for each migration file

### **Method 2: Command Line**

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your production project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

---

## ⚠️ Important Notes

### **About Migration 002:**
`002_migrate_existing_data.sql` is designed to migrate data from the OLD schema to the NEW schema.

**ONLY run this if:**
- ✅ Your production database has existing data in `bylaw_sections` table
- ✅ You want to preserve that data

**SKIP this if:**
- ❌ You're creating a fresh production database
- ❌ Your production database is already empty
- ❌ You don't care about preserving old data

### **About Multiple Fixes for Same Issue:**
You'll notice files like:
- `006_create_permission_rpc_functions.sql`
- `006_fix_permission_functions.sql`

This is because bugs were fixed during development. **Always run the LATEST version** (the one with "fix" in the name).

### **Duplicate Migration Numbers:**
Some migrations have the same number (e.g., `008`, `008b`, `008c`). Run them in alphabetical order:
- `008_fix_global_admin_rls.sql` first
- Then `008b_fix_rls_recursion.sql`
- Then `008c_fix_recursion_properly.sql`

---

## 🔍 Verify Migrations Worked

After running migrations, verify in Supabase SQL Editor:

```sql
-- 1. Check organizations table exists
SELECT COUNT(*) FROM organizations;
-- Expected: 0 (or more if you have data)

-- 2. Check documents table exists
SELECT COUNT(*) FROM documents;
-- Expected: 0 (or more if you have data)

-- 3. Check document_sections table exists
SELECT COUNT(*) FROM document_sections;
-- Expected: 0 (or more if you have data)

-- 4. Check users table exists
SELECT COUNT(*) FROM users;
-- Expected: 0 (or more if you have users)

-- 5. Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'documents', 'document_sections');
-- Expected: All should show rowsecurity = true
```

---

## 🐛 Troubleshooting

### Error: "relation already exists"
**Cause:** You're trying to run a migration that's already been applied
**Fix:** Skip that migration and move to the next one

### Error: "column already exists"
**Cause:** Partial migration was applied
**Fix:** Check which columns exist and skip those ALTER TABLE statements

### Error: "function already exists"
**Cause:** Function was created in previous migration
**Fix:** Add `OR REPLACE` to function definition or skip

### Error: "permission denied"
**Cause:** Using anon key instead of service role
**Fix:** Make sure you're connected with database password or service role key

---

## 📊 Migration Timeline Estimate

| Task | Time | Difficulty |
|------|------|------------|
| Copy migration 001 to SQL Editor | 1 min | Easy |
| Run migration 001 | 1-2 min | Easy |
| Run remaining essential migrations (4 files) | 5 min | Easy |
| Verify with test queries | 2 min | Easy |
| **TOTAL** | **~10 minutes** | **Easy** |

---

## ✅ Success Criteria

Your production database is ready when:

- [ ] `organizations` table exists and is queryable
- [ ] `documents` table exists
- [ ] `document_sections` table exists
- [ ] `users` table exists with `is_global_admin` column
- [ ] `user_organizations` junction table exists
- [ ] RLS policies are enabled on all tables
- [ ] Permission functions (`get_user_role`, `check_permission`) exist
- [ ] Test query succeeds: `SELECT * FROM organizations;`

---

## 🔄 What Happens After Migrations

1. **Render app will start successfully** - No more "table not found" errors
2. **Setup wizard will load** - First user can create an organization
3. **Document upload will work** - Sections will be stored in `document_sections`
4. **User management will work** - Users can be invited and assigned roles

---

**Current Status:** Migrations ready to run

**Next Action:** Open Supabase Dashboard → SQL Editor → Run 001_generalized_schema.sql
