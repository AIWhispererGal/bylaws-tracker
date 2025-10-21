# Migration 016: Fix Verification Function

## What Happened

Your migration 015 results showed:
```
admins_create_invitations_or_global_admin | null
```

This looked broken, but **the INSERT policy is actually CORRECT!** The verification function was just checking the wrong field.

## The Issue

PostgreSQL RLS policies have two different fields:
- **`qual`** (USING clause) - used for SELECT, UPDATE, DELETE
- **`with_check`** (WITH CHECK clause) - used for INSERT

My verification function only checked `qual`, so INSERT policies showed `null`.

## The Fix

Migration 016 updates the verification function to check **BOTH** fields:

```sql
CASE
  WHEN p.qual::TEXT LIKE '%is_global_admin%' THEN true          -- SELECT/UPDATE/DELETE
  WHEN p.with_check::TEXT LIKE '%is_global_admin%' THEN true    -- INSERT
  ELSE false
END
```

## Apply Migration 016

```bash
psql $DATABASE_URL -f database/migrations/016_fix_verification_function.sql
```

## Expected Output After Migration 016

```
| policy_name                               | policy_command | has_global_admin_check | check_location    |
| ----------------------------------------- | -------------- | ---------------------- | ----------------- |
| admins_create_invitations_or_global_admin | INSERT         | true                   | WITH CHECK clause |
| admins_delete_invitations_or_global_admin | DELETE         | true                   | USING clause      |
| admins_update_invitations_or_global_admin | UPDATE         | true                   | USING clause      |
| users_view_invitations_or_global_admin    | SELECT         | true                   | USING clause      |
```

All 4 should show `true` now!

## Test Invitation Creation

**The invitation creation should already work now** (after migration 015), even though the verification showed null. Try creating an invitation:

1. Go to `/admin/users`
2. Click "Invite User"
3. Fill form and submit
4. Should work! ✅

If it still fails, check:
- Are you logged in as a global admin? (`is_global_admin(auth.uid())` must return true)
- Check browser console for errors
- Check Supabase logs for RLS policy violations

## Verification Without Migration 016

If you want to verify manually without running migration 016:

```sql
-- Check the actual policy definition
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_invitations'
  AND policyname = 'admins_create_invitations_or_global_admin';
```

The `with_check` field should contain `is_global_admin(auth.uid())`.

## Bottom Line

✅ **Migration 015 fixed the problem** - global admins can now create invitations
⚠️ **Migration 016 just fixes the verification** - makes the verification function accurate
🧪 **Test now** - invitation creation should work immediately
