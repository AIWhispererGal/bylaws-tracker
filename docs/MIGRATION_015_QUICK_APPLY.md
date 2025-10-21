# 🚨 CRITICAL FIX: Migration 015 - Global Admin Invitation Access

## Problem

**Global admins cannot create invitations** because migration 014 forgot to add `is_global_admin()` bypass to the RLS policies on `user_invitations` table.

## Solution

Migration 015 updates all 4 RLS policies to include global admin bypass:
- SELECT policy
- INSERT policy
- UPDATE policy
- DELETE policy

## Apply Migration NOW

```bash
# Connect to your Supabase database
psql $DATABASE_URL -f database/migrations/015_fix_invitations_global_admin_rls.sql

# Or via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste contents of 015_fix_invitations_global_admin_rls.sql
# 3. Run
```

## Verification

After applying, run:
```sql
SELECT * FROM verify_invitation_global_admin_policies();
```

Expected output: All 4 policies should show `has_global_admin_check = true`

## What This Fixes

✅ Global admins can now create invitations for ANY organization
✅ Global admins can view all invitations
✅ Global admins can update/revoke invitations
✅ Global admins can delete invitations

## Related Files

- **Migration**: `database/migrations/015_fix_invitations_global_admin_rls.sql`
- **Original**: `database/migrations/014_user_invitations.sql` (had the bug)
- **Route**: `/users/invite` (POST) - already exists in `src/routes/users.js:211`

## UI Access

Once migration is applied, global admins can create invitations via:
1. Navigate to user management page
2. Click "Invite User" button
3. POST to `/users/invite` with:
   ```json
   {
     "email": "user@example.com",
     "role": "member",
     "organizationId": "org-uuid"
   }
   ```

## Priority: CRITICAL

This blocks global admins from basic user management functionality. Apply immediately.
