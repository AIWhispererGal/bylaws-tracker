# 🚨 HOTFIX: Global Admin Cannot Create Invitations

## Status: ✅ FIXED - Apply Migration 015

---

## Problem

**Global admins cannot create user invitations** because migration 014 forgot to add the `is_global_admin()` bypass to RLS policies.

### What Works:
- ✅ UI exists: "Invite User" button at `/admin/users`
- ✅ Modal form exists with email and role selection
- ✅ Route exists: `POST /users/invite` in `src/routes/users.js:211`
- ✅ JavaScript submits to `/admin/users/invite`

### What's Broken:
- ❌ Database RLS blocks INSERT on `user_invitations` table
- ❌ Migration 014 has NO `is_global_admin()` bypass
- ❌ Only org admins in `user_organizations` can insert

---

## Root Cause

**Migration 014** created 4 RLS policies WITHOUT global admin bypass:

```sql
-- ❌ WRONG: No global admin check
CREATE POLICY "Org admins can create invitations"
  ON user_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
    )
  );
```

**Should be:**

```sql
-- ✅ CORRECT: Global admin bypass added
CREATE POLICY "admins_create_invitations_or_global_admin"
  ON user_invitations
  FOR INSERT
  WITH CHECK (
    is_global_admin(auth.uid())  -- ✅ Global admin bypass
    OR
    EXISTS (...)
  );
```

---

## Solution: Migration 015

Created **`database/migrations/015_fix_invitations_global_admin_rls.sql`**

### What It Does:

1. **Drops** all 4 existing policies on `user_invitations`
2. **Recreates** them with `is_global_admin(auth.uid())` bypass
3. **Verifies** all policies have the bypass

### Policies Updated:

| Policy | Operation | What Changes |
|--------|-----------|--------------|
| `users_view_invitations_or_global_admin` | SELECT | Adds global admin view all invitations |
| `admins_create_invitations_or_global_admin` | INSERT | Adds global admin create for any org |
| `admins_update_invitations_or_global_admin` | UPDATE | Adds global admin update any invitation |
| `admins_delete_invitations_or_global_admin` | DELETE | Adds global admin delete any invitation |

---

## Apply the Fix NOW

### Option 1: Supabase Dashboard (Recommended)

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of `database/migrations/015_fix_invitations_global_admin_rls.sql`
3. Paste and **Run**
4. Verify output shows all 4 policies with `has_global_admin_check = true`

### Option 2: psql Command Line

```bash
# Connect to your database
psql $DATABASE_URL -f database/migrations/015_fix_invitations_global_admin_rls.sql

# Verify
psql $DATABASE_URL -c "SELECT * FROM verify_invitation_global_admin_policies();"
```

### Expected Verification Output:

```
                    policy_name                    | has_global_admin_check
---------------------------------------------------+------------------------
 admins_create_invitations_or_global_admin         | t
 admins_delete_invitations_or_global_admin         | t
 admins_update_invitations_or_global_admin         | t
 users_view_invitations_or_global_admin            | t
```

---

## Testing After Fix

### Test as Global Admin:

1. **Login** as global admin
2. **Navigate** to `/admin/users`
3. **Click** "Invite User" button
4. **Fill form**:
   - Email: `test@example.com`
   - Role: `member`
5. **Submit**
6. **Expected**: Success! Invitation created

### What You'll See:

```json
{
  "success": true,
  "message": "Invitation sent to test@example.com",
  "invitation": {
    "id": "uuid",
    "email": "test@example.com",
    "role": "member",
    "status": "pending",
    "organization_id": "org-uuid",
    "invited_by": "your-user-id",
    "invited_at": "2025-10-14T..."
  }
}
```

---

## Related Files

### Created:
- `database/migrations/015_fix_invitations_global_admin_rls.sql` (100 lines)
- `docs/MIGRATION_015_QUICK_APPLY.md` (Quick reference)
- `docs/HOTFIX_GLOBAL_ADMIN_INVITATIONS.md` (This file)

### Referenced:
- `database/migrations/014_user_invitations.sql` (Original with bug)
- `src/routes/users.js:211` (POST /users/invite route)
- `views/admin/users.ejs:412-549` (UI and JavaScript)

---

## Impact

### Before Migration 015:
- ❌ Global admins blocked from inviting users
- ❌ Must manually insert into database
- ❌ Poor admin experience

### After Migration 015:
- ✅ Global admins can invite users to ANY organization
- ✅ UI works perfectly
- ✅ Full cross-org user management

---

## Why This Happened

Migration 013 fixed global admin RLS for 6 tables:
- ✅ suggestions
- ✅ suggestion_sections
- ✅ suggestion_votes
- ✅ document_workflows
- ✅ section_workflow_states
- ✅ user_organizations

But migration 014 (created later for Sprint 0) added a NEW table and forgot the pattern! This is now documented to prevent future issues.

---

## Prevention: Checklist for Future Tables

Whenever creating a new table with RLS:

```sql
-- ✅ ALWAYS include this pattern in ALL policies:
CREATE POLICY "policy_name_or_global_admin"
USING (
  is_global_admin(auth.uid())  -- ✅ REQUIRED
  OR
  [tenant isolation logic]
);
```

**Add to code review checklist:**
- [ ] All SELECT policies have `is_global_admin()` OR clause
- [ ] All INSERT policies have `is_global_admin()` OR clause
- [ ] All UPDATE policies have `is_global_admin()` OR clause
- [ ] All DELETE policies have `is_global_admin()` OR clause

---

## Priority: 🔴 CRITICAL

**Apply immediately.** This blocks basic user management for global admins.

**Estimated time to apply:** 2 minutes
**Downtime required:** None (RLS policy changes are instant)
**Risk level:** Low (only extends permissions, doesn't restrict)

---

**Status:** ✅ Migration created and documented
**Next step:** Apply to database
**Testing:** Required after application
