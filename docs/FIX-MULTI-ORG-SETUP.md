# 🔧 FIX: Multi-Organization Support in Setup Wizard

## Problem

**Error**: `A user with this email address has already been registered`

**Expected Behavior**: Users should be able to create multiple organizations
**Actual Behavior**: Setup wizard tries to create a new auth user every time, failing if email exists

**Root Cause**: Setup wizard at `src/routes/setup.js:144` always calls `admin.createUser()` without checking if user already exists

---

## 🎯 The Solution (Two-Part Fix)

### Part 1: Apply Migration 026 (Database)

**Why**: Ensure `user_types` table has required entries

**Apply Now**:
1. Open Supabase SQL Editor
2. Run: `database/migrations/026_fix_multi_org_setup.sql`
3. Verify you see: `✅ User types verified: 2 system types`

---

### Part 2: Fix Setup Wizard Code

**File**: `src/routes/setup.js`
**Line**: ~140-160

**Current Code** (BROKEN):
```javascript
// Always creates new user - fails if email exists
const { data: authUser, error: authError } = await req.supabaseService.auth.admin.createUser({
    email: adminData.admin_email,
    password: adminData.admin_password,
    email_confirm: true,
    user_metadata: {
        setup_user: true,
        created_via: 'setup_wizard'
    }
});

if (authError) {
    console.error('[SETUP-AUTH] Error creating auth user:', authError);
    return res.status(400).json({
        success: false,
        error: authError.message || 'Failed to create admin account'
    });
}
```

**Fixed Code** (SUPPORTS MULTI-ORG):
```javascript
// Check if user already exists
console.log('[SETUP-AUTH] Checking for existing user:', adminData.admin_email);
const { data: existingUsers, error: getUserError } = await req.supabaseService.auth.admin.listUsers();

let authUser;
const existingAuthUser = existingUsers?.users?.find(u => u.email === adminData.admin_email);

if (existingAuthUser) {
    console.log('[SETUP-AUTH] User already exists, using existing account:', existingAuthUser.id);

    // Verify password is correct (user must authenticate)
    const { data: signInData, error: signInError } = await req.supabaseService.auth.signInWithPassword({
        email: adminData.admin_email,
        password: adminData.admin_password
    });

    if (signInError) {
        console.error('[SETUP-AUTH] Password verification failed:', signInError);
        return res.status(400).json({
            success: false,
            error: 'Invalid password for existing account. Please use the correct password.'
        });
    }

    authUser = { user: existingAuthUser };
    console.log('[SETUP-AUTH] Existing user authenticated successfully');
} else {
    // Create new user
    console.log('[SETUP-AUTH] Creating new Supabase Auth user for:', adminData.admin_email);
    const { data: newAuthUser, error: authError } = await req.supabaseService.auth.admin.createUser({
        email: adminData.admin_email,
        password: adminData.admin_password,
        email_confirm: true,
        user_metadata: {
            setup_user: true,
            created_via: 'setup_wizard'
        }
    });

    if (authError) {
        console.error('[SETUP-AUTH] Error creating auth user:', authError);
        return res.status(400).json({
            success: false,
            error: authError.message || 'Failed to create admin account'
        });
    }

    authUser = newAuthUser;
    console.log('[SETUP-AUTH] New auth user created successfully:', authUser.user.id);
}
```

---

## 📋 Complete Fix Instructions

### Step 1: Apply Migration 026

```sql
-- Run in Supabase SQL Editor
-- Copy from: database/migrations/026_fix_multi_org_setup.sql
```

### Step 2: Update Setup.js

**Location**: `src/routes/setup.js` lines 142-162

**Replace**: The entire user creation block
**With**: The fixed code above

### Step 3: Restart Server

```bash
npm start
```

### Step 4: Test Multi-Org Creation

**Scenario 1: First Organization (New User)**
1. Register: `newuser@example.com`
2. Create organization "Org 1"
3. ✅ Should work - creates new auth user

**Scenario 2: Second Organization (Existing User)**
1. Login: `newuser@example.com` (same user)
2. Navigate to setup wizard (or /setup/organization)
3. Enter same email: `newuser@example.com`
4. Enter correct password
5. Create organization "Org 2"
6. ✅ Should work - uses existing auth user, creates new org link

---

## 🔍 How Multi-Org Should Work

### Database Structure

```
auth.users (Supabase Auth)
  └─ user_id: abc-123

public.users
  └─ id: abc-123 (same as auth.users)
  └─ user_type_id: → user_types.id

public.user_organizations (JUNCTION TABLE)
  ├─ user_id: abc-123
  ├─ organization_id: org-1
  ├─ org_role_id: → organization_roles.id (owner)
  └─
  ├─ user_id: abc-123
  ├─ organization_id: org-2
  └─ org_role_id: → organization_roles.id (owner)

public.organizations
  ├─ id: org-1 (Org 1)
  └─ id: org-2 (Org 2)
```

**Key Point**: Same `user_id` appears multiple times in `user_organizations` table, linking to different organizations.

---

## ✅ Expected Behavior After Fix

### Scenario A: New User, First Org
1. User enters email: `alice@example.com`
2. System checks: User doesn't exist
3. System creates: New auth.users entry
4. System creates: New organizations entry
5. System creates: New user_organizations link (alice → Org 1)
6. ✅ Alice is owner of Org 1

### Scenario B: Existing User, Second Org
1. User enters email: `alice@example.com` (same as above)
2. System checks: User already exists
3. System verifies: Password is correct
4. System creates: New organizations entry (Org 2)
5. System creates: New user_organizations link (alice → Org 2)
6. ✅ Alice is owner of both Org 1 and Org 2

### Scenario C: Existing User, Wrong Password
1. User enters email: `alice@example.com`
2. System checks: User exists
3. User enters: Wrong password
4. System returns: "Invalid password for existing account"
5. ❌ Organization not created (security check passed)

---

## 🎨 UI Improvements (Optional)

### Better UX for Existing Users

**Add to setup form** (`views/setup/organization.ejs`):

```html
<div class="info-box" id="existing-user-notice" style="display: none;">
  <p><strong>Note:</strong> We detected you already have an account.
  Please enter your existing password to create a new organization.</p>
</div>

<script>
// Check if email exists (client-side hint)
document.getElementById('admin_email').addEventListener('blur', async (e) => {
  const email = e.target.value;
  // Could call a /api/check-email endpoint
  // If exists, show notice
});
</script>
```

---

## 🔐 Security Considerations

### Why Password Verification is Required

**Before Fix**: Anyone could create org with any email (security hole!)

**After Fix**:
- New user: Creates account with password
- Existing user: Must provide correct password
- ✅ Prevents unauthorized org creation

### Password Handling

- Password is verified via `signInWithPassword()`
- Never stored in plain text
- Supabase handles hashing/salting
- Password cleared from session after setup

---

## 🧪 Testing Checklist

After applying fixes:

```
Multi-Org Testing
========================================

✅ / ❌  Test 1: New user creates first org
   - Email: newuser1@test.com
   - Should: Create auth user + org
   - Result: _____

✅ / ❌  Test 2: Same user creates second org
   - Email: newuser1@test.com (same)
   - Password: (correct password)
   - Should: Link to new org
   - Result: _____

✅ / ❌  Test 3: Existing user wrong password
   - Email: newuser1@test.com
   - Password: (wrong password)
   - Should: Reject with error
   - Result: _____

✅ / ❌  Test 4: Check user_organizations table
   - Query: SELECT * FROM user_organizations WHERE user_id = 'newuser1-id'
   - Should: Show 2 rows (2 orgs)
   - Result: _____

✅ / ❌  Test 5: User can switch between orgs
   - Login as newuser1
   - Should: See org selector
   - Result: _____
```

---

## 📊 Database Queries for Verification

### Check User's Organizations

```sql
-- See all organizations for a user
SELECT
  u.email,
  o.name as org_name,
  or_role.role_code,
  uo.created_at
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
JOIN organization_roles or_role ON or_role.id = uo.org_role_id
WHERE u.email = 'YOUR_EMAIL_HERE'
ORDER BY uo.created_at;
```

### Check Multi-Org Users

```sql
-- Find users with multiple organizations
SELECT
  u.email,
  COUNT(uo.organization_id) as org_count,
  STRING_AGG(o.name, ', ') as orgs
FROM users u
JOIN user_organizations uo ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
GROUP BY u.id, u.email
HAVING COUNT(uo.organization_id) > 1;
```

---

## 🚀 Alternative: Skip Setup for Existing Users

If you don't want to modify setup.js, you could:

### Option B: Use Organization Switcher

**For existing users creating additional orgs**:

1. Login to existing account
2. Go to dashboard
3. Click "Create New Organization" button
4. Fill in org details
5. New org created, linked to existing user

**Requires**: Adding "Create New Organization" UI to dashboard

---

## 🎯 Quick Fix Summary

**Minimum Changes Needed**:
1. ✅ Apply migration 026 (user_types)
2. ✅ Update setup.js lines 142-162 (check existing user)
3. ✅ Restart server
4. ✅ Test multi-org creation

**Optional Enhancements**:
- Add UI notice for existing users
- Add "Create New Org" button in dashboard
- Add org switcher UI

**Time Required**: 10-15 minutes for core fix

---

## 📞 After You Apply the Fix

You should be able to:
1. ✅ Create first org with new email
2. ✅ Create second org with same email (correct password)
3. ✅ Have one user linked to multiple orgs
4. ✅ Switch between organizations

**No more deleting users!** 🎉

---

**Let me create the code patch file for easy application...**
