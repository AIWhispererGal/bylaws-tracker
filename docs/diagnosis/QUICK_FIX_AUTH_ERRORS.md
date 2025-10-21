# 🚀 QUICK FIX: Authentication Errors

**Issue**: Users getting permission errors after login
**Error**: `PGRST116 - The result contains 0 rows`
**Cause**: Missing `user_type_id` in users table
**Fix Time**: 5 minutes

---

## ⚡ INSTANT FIX (Do This Now)

### Step 1: Run Database Migration

```bash
# Connect to Supabase and run migration 031
psql -h [your-supabase-host] -U postgres -d postgres -f database/migrations/031_fix_missing_user_type_ids.sql
```

**OR** via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `database/migrations/031_fix_missing_user_type_ids.sql`
3. Click "Run"
4. Verify output shows "✅ BACKFILL COMPLETE"

### Step 2: Fix User Registration Code

**File**: `/src/routes/auth.js`
**Lines**: 98-116

**Replace this**:
```javascript
async function upsertUser(supabase, authUser) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || null,
      avatar_url: authUser.user_metadata?.avatar_url || null,
      auth_provider: 'supabase',
      last_login: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**With this**:
```javascript
async function upsertUser(supabase, authUser) {
  // Get regular_user type_id
  const { data: userType, error: typeError } = await supabase
    .from('user_types')
    .select('id')
    .eq('type_code', 'regular_user')
    .single();

  if (typeError) {
    throw new Error(`Failed to get regular_user type: ${typeError.message}`);
  }

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || null,
      avatar_url: authUser.user_metadata?.avatar_url || null,
      auth_provider: 'supabase',
      user_type_id: userType.id,  // ✅ FIX: Set user_type_id
      last_login: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Step 3: Restart Server

```bash
npm run dev
# or
pm2 restart bylaws-tool
```

---

## ✅ VERIFICATION

### Test 1: Check Existing Users Fixed
```sql
-- Should return 0
SELECT COUNT(*) FROM users WHERE user_type_id IS NULL;
```

### Test 2: Register New User
1. Go to `/auth/register`
2. Create new user
3. Check database:
```sql
SELECT email, user_type_id FROM users ORDER BY created_at DESC LIMIT 1;
```
4. Verify `user_type_id` is NOT NULL

### Test 3: Login and Access Dashboard
1. Login as any user
2. Navigate to `/dashboard`
3. Check browser console - should see NO errors like:
   - ❌ `Error getting user type`
   - ❌ `PGRST116`
   - ❌ `Cannot coerce the result to a single JSON object`

---

## 🔍 What This Fixes

**Before**:
```javascript
// User record in database
{
  id: '2234d0d2-60d5-4f86-84b8-dd0dd44dc042',
  email: 'user@domain.com',
  user_type_id: NULL  // ❌ MISSING
}

// Permission query fails
SELECT user_types.type_code
FROM users
INNER JOIN user_types ON users.user_type_id = user_types.id
WHERE users.id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042'
-- Returns: 0 rows (INNER JOIN fails with NULL)
```

**After**:
```javascript
// User record in database
{
  id: '2234d0d2-60d5-4f86-84b8-dd0dd44dc042',
  email: 'user@domain.com',
  user_type_id: '[uuid-of-regular-user]'  // ✅ FIXED
}

// Permission query succeeds
SELECT user_types.type_code
FROM users
INNER JOIN user_types ON users.user_type_id = user_types.id
WHERE users.id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042'
-- Returns: { type_code: 'regular_user' }
```

---

## 📚 Full Investigation Report

See: `docs/diagnosis/auth-errors-investigation.md`

For complete forensic analysis including:
- 🔍 How the bug was discovered
- 📊 Evidence and query analysis
- 🎯 Root cause explanation
- 🏆 Prevention strategies

---

## 🆘 If Still Broken

### Quick Diagnostic:
```sql
-- Check user_types table exists
SELECT * FROM user_types;

-- Check specific user
SELECT
  u.id,
  u.email,
  u.user_type_id,
  ut.type_code
FROM users u
LEFT JOIN user_types ut ON u.user_type_id = ut.id
WHERE u.email = 'YOUR-EMAIL-HERE';
```

### If user_types is empty:
```bash
# Run migration 024 first
psql -f database/migrations/024_permissions_architecture.sql
# Then run migration 031
psql -f database/migrations/031_fix_missing_user_type_ids.sql
```

### If still getting errors:
1. Check server logs for exact error
2. Verify RLS is disabled on `user_types` table:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_types';
   ```
   Should show `rowsecurity = false`
3. Run migration 030 if needed:
   ```bash
   psql -f database/migrations/030_disable_rls_all_setup_tables.sql
   ```

---

**Issue Solved!** ✨

*Case closed by DETECTIVE "WHO DONE IT?"*
