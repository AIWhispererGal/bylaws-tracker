# ⚡ QUICK SETUP TEST - After RLS Fix

## 🚀 Test It Now (3 minutes)

### Step 1: Restart Server

```bash
# Stop server (Ctrl+C)
npm start
```

### Step 2: Clear Browser Cache

- Press `Ctrl+Shift+Delete` (Chrome/Edge)
- Or use Incognito/Private window

### Step 3: Test Organization Creation

1. **Open**: http://localhost:3000/setup/organization

2. **Fill in form**:
   - Organization name: `Quick Test Org`
   - Organization type: `Non-profit`
   - Email: `quicktest@example.com`
   - Password: `TestPass123!`
   - Confirm password: `TestPass123!`

3. **Click Submit**

4. **Expected Result**:
   - ✅ Should see "Processing..." message
   - ✅ Should advance to next step (document type)
   - ✅ NO RLS error
   - ✅ NO "email already registered" error (if using new email)

---

## ✅ Success Indicators

### Console Logs (Server)

Look for these messages in your terminal:

```
[SETUP-DEBUG] 🚀 START processSetupData()
[SETUP-DEBUG] 💾 Inserting into Supabase organizations table...
[SETUP-DEBUG] ✅ Organization created with ID: [some-uuid]
[SETUP-DEBUG] 🔗 Linking user to organization...
[SETUP-DEBUG] ✅ User linked to organization with role: owner
```

### Browser Console (F12)

Should NOT see:
- ❌ `new row violates row-level security policy`
- ❌ RLS errors
- ❌ 500 errors

---

## ❌ If Still Failing

### Still See RLS Error?

**Quick Fix**:
1. Check `.env` file has `SUPABASE_SERVICE_ROLE_KEY`
2. Restart server after any `.env` changes
3. Try applying migration 027 (see below)

### Apply Migration 027 (Backup Plan)

If code fix alone doesn't work, run this in Supabase SQL Editor:

```sql
-- Allow authenticated users to insert organizations
CREATE POLICY "Allow authenticated users to insert organizations"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);
```

This relaxes RLS to allow any authenticated user to create orgs.

---

## 🎯 Quick Status

After test:

**✅ Working** if:
- Organization created
- No RLS errors
- Advanced to next step

**❌ Not Working** if:
- RLS error persists
- Can't create organization
- Setup wizard crashes

---

## 📞 Next Steps

### If Test Passes:
1. ✅ Continue with setup wizard
2. ✅ Run multi-org test
3. ✅ Proceed with smoke tests

### If Test Fails:
1. Check server logs for errors
2. Verify `.env` has service role key
3. Apply migration 027
4. Report exact error for further debugging

---

**Try it now and let me know what happens!** 🚀
