# Quick Test Guide - Authentication Fixes

## 🚀 IMMEDIATE ACTION REQUIRED

### Step 1: Apply Database Migration (FIRST!)
```bash
# Run this SQL migration to fix existing users:
psql $DATABASE_URL < database/migrations/031_fix_missing_user_type_ids.sql
```

Or paste the migration content into Supabase SQL Editor and run it.

### Step 2: Restart Server
```bash
# Restart to pick up code changes
npm run dev
# or
pm2 restart all
```

### Step 3: Test Login (Existing User)
1. Open browser to http://localhost:3000/auth/login
2. Login with existing credentials
3. **CHECK**: No errors in browser console
4. **CHECK**: Successfully redirected to dashboard
5. **CHECK**: Dashboard loads without permission errors

### Step 4: Test Registration (New User)
1. Open incognito/private window
2. Go to http://localhost:3000/auth/register
3. Register new account
4. **CHECK**: Registration succeeds
5. **CHECK**: Can login immediately
6. **CHECK**: Dashboard accessible

## 🔍 What to Look For

### ✅ SUCCESS Signs:
- No PGRST116 errors in console
- No "Cannot read properties of null" errors
- Dashboard loads completely
- User info displays correctly
- Can navigate between pages

### ❌ FAILURE Signs:
- Still seeing PGRST116 errors
- 500 errors on dashboard
- "Permission denied" messages
- Cannot access any pages after login

## 📊 Quick Database Check

Run this query to verify fix worked:
```sql
-- Should return 0
SELECT COUNT(*) FROM users WHERE user_type_id IS NULL;

-- Should show all users have a type
SELECT
  COUNT(*) FILTER (WHERE user_type_id IS NOT NULL) as with_type,
  COUNT(*) FILTER (WHERE user_type_id IS NULL) as without_type
FROM users;
```

## 🆘 If Issues Persist

1. Check server logs for errors
2. Verify migration ran successfully
3. Clear browser cache/cookies
4. Try incognito mode
5. Check Supabase Auth logs

## 📝 Report Results

After testing, note:
- [ ] Migration applied successfully?
- [ ] Existing users can login?
- [ ] New users can register?
- [ ] Dashboard accessible?
- [ ] No PGRST116 errors?

---
**Time to Test: ~5 minutes**
**Priority: CRITICAL - Test immediately**