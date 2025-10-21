# Database Research Summary: user_types Error

**Date:** 2025-10-20
**Researcher:** Database Researcher Agent
**Priority:** CRITICAL

---

## Quick Summary

**ERROR:** "relation 'user_types' does not exist"
**ROOT CAUSE:** RLS (Row Level Security) blocking queries, NOT a missing table
**IMPACT:** Setup wizard fails, new organizations cannot be created
**FIX TIME:** 5 minutes with provided SQL scripts

---

## The Problem

The setup wizard is failing with this error:
```
relation "user_types" does not exist
```

But the table **DOES exist**! The real issue is:

1. ✅ Table exists (created by migration 024)
2. ✅ Table has correct data (global_admin, regular_user)
3. ❌ **RLS is ENABLED and BLOCKING queries**
4. ❌ Setup wizard query fails because no auth session exists

---

## Why This Happens

### The Setup Flow

```
/src/routes/setup.js line 713-717:

const { data: userType, error: userTypeError } = await supabase
  .from('user_types')
  .select('id')
  .eq('type_code', userTypeCode)
  .single();
```

### The RLS Policy (Migration 024)

```sql
CREATE POLICY "Global admins can manage user types"
  ON user_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()  -- ❌ FAILS: No auth session during setup!
      ...
    )
  );
```

### The Mismatch

- Setup wizard runs **before** user is authenticated
- RLS policy requires `auth.uid()` to exist
- When RLS check fails, Supabase reports "table doesn't exist"
- This is a misleading error message!

---

## Immediate Fix

**Run this command in Supabase SQL Editor:**

```sql
-- Disable RLS on permission tables
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles DISABLE ROW LEVEL SECURITY;

-- Fix any users missing user_type_id
UPDATE users
SET user_type_id = (SELECT id FROM user_types WHERE type_code = 'regular_user')
WHERE user_type_id IS NULL;
```

**Or use the provided script:**
```bash
# In Supabase SQL Editor, paste contents of:
database/diagnosis/fix_user_types_immediate.sql
```

---

## Complete Fix (3 Parts)

### Part 1: Database (Immediate)

**File:** `/database/diagnosis/fix_user_types_immediate.sql`

This script:
- ✅ Disables RLS on user_types and organization_roles
- ✅ Ensures default data exists (global_admin, regular_user)
- ✅ Assigns user_type_id to all users missing it
- ✅ Assigns org_role_id to all user_organizations missing it

### Part 2: Code Fix - Registration

**File:** `/src/routes/auth.js` (line 232)

Add after `upsertUser()` call:

```javascript
// Set user_type_id for new users
const regularUserType = await supabaseService
  .from('user_types')
  .select('id')
  .eq('type_code', 'regular_user')
  .single();

if (regularUserType.data) {
  await supabaseService
    .from('users')
    .update({ user_type_id: regularUserType.data.id })
    .eq('id', authData.user.id);
}
```

### Part 3: Code Fix - Invitation Acceptance

**File:** `/src/routes/auth.js` (line 1125)

Add after `upsertUser()` call:

```javascript
// Set user_type_id for invited users
const regularUserType = await supabaseService
  .from('user_types')
  .select('id')
  .eq('type_code', 'regular_user')
  .single();

if (regularUserType.data) {
  await supabaseService
    .from('users')
    .update({ user_type_id: regularUserType.data.id })
    .eq('id', userId);
}
```

---

## Verification

**1. Check RLS Status:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('user_types', 'organization_roles');
-- Should show: rowsecurity = false
```

**2. Check User Types:**
```sql
SELECT * FROM user_types;
-- Should show: global_admin, regular_user
```

**3. Check Users:**
```sql
SELECT
  u.email,
  u.user_type_id,
  ut.type_code
FROM users u
LEFT JOIN user_types ut ON u.user_type_id = ut.id;
-- All users should have user_type_id populated
```

**4. Test Setup Wizard:**
- Create new organization
- Should complete without "relation does not exist" error

---

## Files Created

### Research Documentation
- `/docs/diagnosis/database-schema-research.md` (comprehensive analysis)
- `/docs/diagnosis/RESEARCH_SUMMARY.md` (this file)

### SQL Scripts
- `/database/diagnosis/check_user_types_state.sql` (diagnostic script)
- `/database/diagnosis/fix_user_types_immediate.sql` (fix script)

---

## Related Migrations

**Migration 024:** Creates user_types and organization_roles
- File: `/database/migrations/024_permissions_architecture.sql`
- Status: ✅ Applied (tables exist)

**Migration 030:** Attempts to disable RLS
- File: `/database/migrations/030_disable_rls_CORRECTED.sql`
- Status: ❓ **VERIFY THIS HAS BEEN RUN**

---

## Action Items

### For Developer (NOW)

1. ✅ Review `/docs/diagnosis/database-schema-research.md`
2. ⏳ Run `/database/diagnosis/fix_user_types_immediate.sql` in Supabase
3. ⏳ Verify migration 030 has been applied
4. ⏳ Test setup wizard creates new organization successfully

### For Developer (Later)

5. ⏳ Add user_type_id assignment to registration flow
6. ⏳ Add user_type_id assignment to invitation acceptance flow
7. ⏳ Add integration test for setup wizard
8. ⏳ Document RLS best practices for team

---

## Prevention

**Going Forward:**

1. **Never enable RLS on reference tables** (user_types, organization_roles)
   - These are lookup tables, not user data
   - They need to be accessible during setup

2. **Always set user_type_id during user creation**
   - Registration
   - Invitation acceptance
   - Setup wizard

3. **Use service client for setup operations**
   - Setup happens before authentication
   - Service client should bypass RLS

4. **Test with RLS enabled in development**
   - Catches these issues early
   - Prevents production surprises

---

## Contact

**Questions?** Review the complete analysis:
- `/docs/diagnosis/database-schema-research.md`

**Need SQL help?** Use the diagnostic script:
- `/database/diagnosis/check_user_types_state.sql`

**Ready to fix?** Run the immediate fix:
- `/database/diagnosis/fix_user_types_immediate.sql`
