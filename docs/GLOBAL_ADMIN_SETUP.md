# Global Superuser Setup Guide

## Overview

A **global superuser** can:
- ✅ Access ALL organizations (not just one)
- ✅ Switch between organizations from the org selector
- ✅ Bypass organization-specific restrictions
- ✅ See all documents across all orgs

---

## Setup Steps

### Step 1: Run Database Migration

Copy and run this in **Supabase SQL Editor**:

```sql
-- Run the full migration
-- File: database/migrations/007_create_global_superuser.sql
```

Or just run the essential parts:

```sql
-- Add global admin column
ALTER TABLE user_organizations
ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN DEFAULT false;

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_orgs_global_admin
ON user_organizations(user_id)
WHERE is_global_admin = true;

-- Create helper function
CREATE OR REPLACE FUNCTION link_global_admin_to_all_orgs(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_org_record RECORD;
  v_linked_count INTEGER := 0;
BEGIN
  FOR v_org_record IN SELECT id FROM organizations LOOP
    INSERT INTO user_organizations (
      user_id, organization_id, role, is_global_admin,
      permissions, created_at
    )
    VALUES (
      p_user_id, v_org_record.id, 'superuser', true,
      '{
        "can_edit_sections": true,
        "can_create_suggestions": true,
        "can_vote": true,
        "can_approve_stages": ["all"],
        "can_manage_users": true,
        "can_manage_workflows": true,
        "is_superuser": true,
        "is_global_admin": true
      }'::jsonb,
      NOW()
    )
    ON CONFLICT (user_id, organization_id) DO UPDATE
    SET role = 'superuser',
        is_global_admin = true,
        updated_at = NOW();
    v_linked_count := v_linked_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'organizations_linked', v_linked_count
  );
END;
$$ LANGUAGE plpgsql;
```

---

### Step 2: Complete Setup Wizard

1. **Start server:**
   ```bash
   npm start
   ```

2. **Go to:** `http://localhost:3000/setup`

3. **Complete all steps:**
   - Organization info (enter your email & password)
   - Document structure
   - Workflow
   - Import (optional)

4. **Watch for these logs:**
   ```
   [SETUP-AUTH] Creating Supabase Auth user for: your-email@example.com
   [SETUP-AUTH] Auth user created successfully: <USER-ID>
   [SETUP-AUTH] Successfully stored JWT tokens in session
   ```

5. **Copy the USER-ID from the logs** (or get it from Supabase Auth UI)

---

### Step 3: Make Yourself a Global Admin

**Option A: Run SQL with your User ID**

In Supabase SQL Editor:

```sql
-- Replace with your actual auth user ID
SELECT link_global_admin_to_all_orgs('YOUR-USER-ID-HERE'::uuid);
```

Example:
```sql
SELECT link_global_admin_to_all_orgs('123e4567-e89b-12d3-a456-426614174000'::uuid);
```

**Option B: Get User ID from Supabase UI**

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find your user, copy the ID
3. Run the SQL above

---

### Step 4: Verify Global Admin Status

```sql
-- Check your global admin status
SELECT
  uo.user_id,
  o.name as organization_name,
  uo.role,
  uo.is_global_admin
FROM user_organizations uo
JOIN organizations o ON uo.organization_id = o.id
WHERE uo.user_id = 'YOUR-USER-ID'
ORDER BY o.name;
```

**Expected Result:**
- Multiple rows (one per organization)
- `is_global_admin = true` for ALL rows
- `role = superuser` for ALL rows

---

## Using Global Admin Powers

### Organization Switcher

1. **Navigate to:** `http://localhost:3000/auth/select`

2. **You'll see ALL organizations** in the list (not just yours)

3. **Click any organization** to switch to it

4. **Dashboard will show that org's data**

### Quick Switching

Add this to your dashboard navigation (optional):

```html
<div class="org-switcher">
  <select onchange="window.location.href='/auth/switch/' + this.value">
    <option>Switch Organization...</option>
    <% organizations.forEach(org => { %>
      <option value="<%= org.id %>" <%= org.id === currentOrgId ? 'selected' : '' %>>
        <%= org.name %>
      </option>
    <% }); %>
  </select>
</div>
```

---

## How It Works

### Without Global Admin
```
User → Login → Check user_organizations → See 1 Organization → Limited Access
```

### With Global Admin
```
User → Login → Check is_global_admin=true → See ALL Organizations → Full Access
```

### RLS Policies

Global admins bypass organization filters:

```sql
-- Regular user sees only their org's documents:
SELECT * FROM documents WHERE organization_id = <their-org-id>;

-- Global admin sees ALL documents:
SELECT * FROM documents;  -- No filter needed!
```

---

## Troubleshooting

### Problem: Still can't see all organizations

**Check 1: Verify global admin flag**
```sql
SELECT * FROM user_organizations
WHERE user_id = 'your-user-id'
AND is_global_admin = true;
```

If empty, run `link_global_admin_to_all_orgs()` again.

**Check 2: Check session**
- Log out and log back in
- Session needs to refresh to pick up new permissions

**Check 3: Verify RLS policies**
```sql
-- In Supabase SQL Editor:
SELECT * FROM pg_policies
WHERE tablename IN ('documents', 'document_sections', 'organizations')
AND policyname LIKE '%global_admin%';
```

Should see policies like `global_admin_see_all_documents`.

---

### Problem: Can see all orgs but can't access documents

**Cause:** RLS policies not updated

**Fix:** Run the RLS policy creation from migration 007:

```sql
-- Documents: Allow global admins
CREATE POLICY "global_admin_see_all_documents"
  ON documents FOR SELECT
  USING (is_global_admin(auth.uid()));
```

---

## Security Notes

⚠️ **Important:**
- Global admins have FULL access to ALL data
- Only grant this to trusted administrators
- For multi-tenant production, consider limiting global admin to specific IP ranges
- Log all global admin actions for audit trail

---

## Removing Global Admin Access

To remove global admin from a user:

```sql
-- Remove global admin flag
UPDATE user_organizations
SET is_global_admin = false
WHERE user_id = 'user-id-to-remove';

-- Or remove from specific organizations
DELETE FROM user_organizations
WHERE user_id = 'user-id-to-remove'
  AND organization_id != 'their-primary-org-id';
```

---

## Quick Reference

**Make user global admin:**
```sql
SELECT link_global_admin_to_all_orgs('USER-ID'::uuid);
```

**Check global admin status:**
```sql
SELECT * FROM user_organizations WHERE is_global_admin = true;
```

**Org switcher URL:**
```
http://localhost:3000/auth/select
```

**Quick switch URL:**
```
http://localhost:3000/auth/switch/<ORG-ID>
```

---

**Status:** Ready to use after Step 3! 🎉
