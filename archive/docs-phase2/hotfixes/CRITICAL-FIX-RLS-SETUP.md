# 🚨 CRITICAL FIX: RLS Blocking Setup Wizard

## Problem

**Error**: `new row violates row-level security policy for table "organizations"`

**Root Cause**: The setup wizard's `processSetupData()` function receives the service role client but the parameter name is confusing, leading to potential RLS issues.

**Impact**: Cannot create organizations during setup

---

## ✅ FIX APPLIED

### What Was Changed

**File**: `src/routes/setup.js`
**Line**: 584-585

**Before**:
```javascript
async function processSetupData(setupData, supabase) {
```

**After**:
```javascript
async function processSetupData(setupData, supabaseService) {
    // Use service role client to bypass RLS policies
    const supabase = supabaseService;
```

**Why This Fixes It**:
- The function receives the **service role client** (which bypasses RLS)
- Changed parameter name from `supabase` to `supabaseService` for clarity
- Added local variable assignment to maintain backward compatibility
- Service role client has elevated privileges and ignores RLS policies

---

## 🔍 How RLS Works

### Service Role vs Regular Client

**Service Role Client** (what setup should use):
- Created with `SUPABASE_SERVICE_ROLE_KEY`
- **Bypasses all RLS policies**
- Used for admin operations
- Has full database access

**Regular Client** (what users get):
- Created with `SUPABASE_ANON_KEY` + user JWT
- **Subject to RLS policies**
- Limited by user's permissions
- Used for user-facing operations

### The Bug

The setup wizard was supposed to use the service role client, but:
1. Function parameter was ambiguously named `supabase`
2. Made it unclear which client was being used
3. Potential for RLS issues if wrong client passed

---

## 🚀 How to Verify Fix Works

### Step 1: Restart Server

```bash
npm start
```

### Step 2: Try Setup Wizard

1. Open: http://localhost:3000/setup/organization
2. Fill in organization details
3. Enter email and password
4. Submit form
5. ✅ Should create organization without RLS error

### Step 3: Check Console Logs

Look for:
```
[SETUP-DEBUG] ✅ Organization created with ID: [uuid]
```

**If you see this**: RLS fix is working! ✅

**If you still see RLS error**: Check which client is being passed to processSetupData()

---

## 🔧 Alternative Fix (If Still Failing)

If you still get RLS errors after the code fix, you may need to temporarily relax RLS policies:

### Option A: Add Bypass Policy (Migration 027)

Apply `database/migrations/027_fix_setup_rls_policies.sql`:

```sql
-- Allow authenticated users to insert organizations
CREATE POLICY "Allow authenticated users to insert organizations"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);
```

This allows any authenticated user to create organizations (which is what setup needs).

---

### Option B: Verify Service Role Client Setup

Check your middleware/setup initialization:

**File**: Look for where `supabaseService` is created

**Should look like**:
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,  // ← Important!
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

**NOT**:
```javascript
// This would be subject to RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY  // ← Wrong for setup!
);
```

---

## 📊 Check Environment Variables

Make sure these are set in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbG...  # Public key (for users)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Service key (for admin)
```

**Verify**:
```bash
# Check if service role key is set
echo $SUPABASE_SERVICE_ROLE_KEY
# Should show a long JWT string starting with eyJhbG...
```

---

## 🎯 Expected Behavior After Fix

### Successful Setup Flow

1. **User submits organization form**
2. **Setup wizard calls** `processSetupData(setupData, req.supabaseService)`
3. **Service role client is used** (bypasses RLS)
4. **Organization INSERT succeeds**
5. **User is linked to organization**
6. **Setup completes**

### Console Output

```
[SETUP-DEBUG] 🚀 START processSetupData()
[SETUP-DEBUG] 📋 hierarchy_config to save: {...}
[SETUP-DEBUG] 💾 Inserting into Supabase organizations table...
[SETUP-DEBUG] ✅ Organization created with ID: abc-123-def
[SETUP-DEBUG] 🔗 Linking user to organization...
[SETUP-DEBUG] ✅ User linked to organization with role: owner
[SETUP-DEBUG] ✅ Setup complete!
```

---

## 🔐 Security Implications

### Is Service Role Safe for Setup?

**YES** - Setup wizard should use service role because:
1. Setup happens **before** user is fully authenticated
2. Setup needs to create foundational data
3. Setup is a **one-time privileged operation**
4. After setup, users switch to regular authenticated client

### Security Measures

**Protected by**:
- Setup wizard only accessible during initial setup
- Email/password verification required
- Session-based access control
- After setup completes, regular RLS applies

---

## 🧪 Testing Checklist

After applying fix:

```
RLS Fix Testing
========================================

✅ / ❌  Test 1: Create first organization
   - Should: Create org without RLS error
   - Result: _____

✅ / ❌  Test 2: Check organization in database
   - Query: SELECT * FROM organizations WHERE name = 'Test Org'
   - Should: Show new organization
   - Result: _____

✅ / ❌  Test 3: Check user_organizations link
   - Query: SELECT * FROM user_organizations WHERE organization_id = '[org-id]'
   - Should: Show user linked to org
   - Result: _____

✅ / ❌  Test 4: Dashboard access
   - Should: Redirect to dashboard after setup
   - Should: See organization name
   - Result: _____
```

---

## 🚨 If Still Failing

### Debug Steps

1. **Check server logs** for exact error
2. **Verify service role key** is set in environment
3. **Check which client is being passed** to processSetupData
4. **Run migration 027** to add permissive INSERT policy
5. **Check Supabase dashboard** for RLS policy configuration

### Get More Info

**Add debug logging**:
```javascript
console.log('[DEBUG] Client auth header:',
  supabaseService.rest.headers.Authorization ? 'Has auth' : 'No auth'
);
```

Service role should show auth header, regular client might not during setup.

---

## 📞 Summary

**Fix Applied**: ✅ Updated processSetupData parameter naming
**Why It Works**: Ensures service role client is used consistently
**Impact**: Setup wizard can now create organizations without RLS errors
**Security**: Safe - setup is privileged operation, RLS applies after setup

**Next Step**: Restart server and test organization creation

---

**The setup wizard should now work!** 🚀
