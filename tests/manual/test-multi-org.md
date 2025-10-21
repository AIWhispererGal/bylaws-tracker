# 🧪 Multi-Organization Support Test

## Quick Test Guide

### Test 1: Create First Organization (New User)

**Steps**:
1. Restart server: `npm start`
2. Open: http://localhost:3000/setup/organization
3. Fill in:
   - Organization name: `Test Org 1`
   - Email: `multiorgtest@example.com`
   - Password: `TestPassword123!`
4. Complete setup wizard
5. ✅ Should succeed - creates new user + org

---

### Test 2: Create Second Organization (Same User)

**Steps**:
1. Open: http://localhost:3000/setup/organization
2. Fill in:
   - Organization name: `Test Org 2`
   - Email: `multiorgtest@example.com` (SAME email)
   - Password: `TestPassword123!` (SAME password)
3. Complete setup wizard
4. ✅ Should succeed - links existing user to new org

**Expected Result**:
- No error about "email already registered"
- New organization created
- Same user is owner of both orgs

---

### Test 3: Wrong Password (Security Check)

**Steps**:
1. Open: http://localhost:3000/setup/organization
2. Fill in:
   - Organization name: `Test Org 3`
   - Email: `multiorgtest@example.com` (SAME email)
   - Password: `WrongPassword123!` (WRONG password)
3. Try to proceed
4. ✅ Should FAIL with error: "This email is already registered. Please enter your correct password..."

---

## Verification Queries

After Tests 1 and 2, run in Supabase:

```sql
-- Should show 2 organizations for same user
SELECT
  u.email,
  o.name as org_name,
  or_role.role_code,
  uo.created_at
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
JOIN organization_roles or_role ON or_role.id = uo.org_role_id
WHERE u.email = 'multiorgtest@example.com'
ORDER BY uo.created_at;
```

**Expected**:
```
email                    | org_name    | role_code | created_at
-------------------------|-------------|-----------|-------------------
multiorgtest@example.com | Test Org 1  | owner     | 2025-10-20 ...
multiorgtest@example.com | Test Org 2  | owner     | 2025-10-20 ...
```

---

## Pass Criteria

✅ **PASS if**:
- Test 1 creates new user successfully
- Test 2 links existing user to new org (no error)
- Test 3 rejects wrong password
- Database shows 1 user with 2 org links

❌ **FAIL if**:
- Test 2 shows "email already registered" error
- Test 3 allows wrong password
- Database shows duplicate users

---

## Quick Status Check

```bash
# After tests, check logs for:
[SETUP-AUTH] Checking for existing user: multiorgtest@example.com
[SETUP-AUTH] User already exists, verifying password for: [user-id]
[SETUP-AUTH] Existing user authenticated successfully
```

**If you see these logs**: Multi-org is working! ✅
