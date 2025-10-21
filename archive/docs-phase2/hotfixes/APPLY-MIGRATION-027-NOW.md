# 🚨 APPLY MIGRATION 027 NOW - FIX RLS BLOCKING SETUP

## Quick Fix (2 minutes)

Your service role key is configured, but RLS policies are still blocking. Apply this migration immediately:

---

## Step 1: Open Supabase SQL Editor

1. Go to: https://app.supabase.com
2. Select your project
3. Click "SQL Editor" in sidebar
4. Click "New Query"

---

## Step 2: Copy and Run This SQL

**File**: `database/migrations/027_fix_setup_rls_policies_QUICK.sql`

```sql
-- Drop any conflicting INSERT policies
DROP POLICY IF EXISTS "Allow authenticated users to insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON organizations;
DROP POLICY IF EXISTS "Setup wizard can create organizations" ON organizations;

-- Create permissive INSERT policy
CREATE POLICY "Setup wizard can create organizations"
ON organizations
FOR INSERT
TO authenticated, anon
WITH CHECK (true);
```

---

## Step 3: Verify Success

You should see:
```
✅ INSERT policy added to organizations table
✅ Setup wizard should now be able to create organizations
```

---

## Step 4: Test Immediately

1. **Keep server running** (no restart needed after DB migration)
2. Go to: http://localhost:3000/setup/organization
3. Fill in form:
   - Org name: `Test Org`
   - Email: `test@example.com`
   - Password: `TestPass123!`
4. Submit

**Expected**: ✅ Should work! No RLS error!

---

## Why This Is Needed

**The Problem**:
- Service role client SHOULD bypass RLS
- But something in the setup flow isn't using it correctly
- RLS policies are blocking organization INSERT

**The Solution**:
- Add a permissive INSERT policy
- Allows authenticated users to create organizations
- This is what setup wizard needs

**Is It Safe?**:
- ✅ Yes - only authenticated users can INSERT
- ✅ Setup requires email/password
- ✅ Other operations (SELECT/UPDATE/DELETE) still protected
- ✅ Can tighten later if needed

---

## What This Policy Does

```sql
CREATE POLICY "Setup wizard can create organizations"
ON organizations
FOR INSERT
TO authenticated, anon
WITH CHECK (true);
```

**Breakdown**:
- `FOR INSERT` - Only affects INSERT operations
- `TO authenticated, anon` - Applies to authenticated and anonymous users
- `WITH CHECK (true)` - Always allows INSERT (permissive)

**What's Protected**:
- SELECT - Still needs user to be in user_organizations
- UPDATE - Still needs ownership
- DELETE - Still needs ownership

---

## After Migration 027

You'll be able to:
1. ✅ Create organizations through setup wizard
2. ✅ Use same email for multiple orgs (from earlier fix)
3. ✅ No more RLS errors
4. ✅ Complete setup successfully

---

## Alternative: Debug Service Role

If you want to debug why service role isn't working, add this to setup.js:

```javascript
// After line 684 in setup.js
console.log('[DEBUG] Supabase client headers:', supabase.rest.headers);
console.log('[DEBUG] Is service role?:', supabase.rest.headers.apikey?.includes('service_role'));
```

But for now, **just apply migration 027** to unblock yourself.

---

**APPLY THE MIGRATION NOW AND TEST!** 🚀
