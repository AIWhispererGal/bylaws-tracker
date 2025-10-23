# Quick Test Guide - Issue #1 Authentication Fix

## 🚀 Quick Start Testing

### Test 1: ORG_OWNER Access (2 minutes)
```bash
# 1. Start server
npm start

# 2. Login as ORG_OWNER
# Navigate to: http://localhost:3000/login
# Use credentials: (your test ORG_OWNER account)

# 3. Test admin access
# Navigate to: http://localhost:3000/admin/users
# EXPECTED: ✅ User list page loads (200 OK)
# FAIL IF: ❌ AUTH_REQUIRED error
```

### Test 2: ORG_ADMIN Access (2 minutes)
```bash
# 1. Login as ORG_ADMIN
# Navigate to: http://localhost:3000/login
# Use credentials: (your test ORG_ADMIN account)

# 2. Test admin access
# Navigate to: http://localhost:3000/admin/users
# EXPECTED: ✅ User list page loads (200 OK)
# FAIL IF: ❌ AUTH_REQUIRED error
```

### Test 3: REGULAR_USER Rejection (2 minutes)
```bash
# 1. Login as REGULAR_USER
# Navigate to: http://localhost:3000/login
# Use credentials: (your test REGULAR_USER account)

# 2. Test admin access
# Navigate to: http://localhost:3000/admin/users
# EXPECTED: ✅ 403 Forbidden error
# FAIL IF: ❌ 401 AUTH_REQUIRED (should be 403 not 401)
```

---

## 🔍 Browser DevTools Check

### Verify Session Data
1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Check Cookies or Session Storage
4. Look for session data containing:
   - ✅ `userId`: "some-uuid"
   - ✅ `organizationId`: "some-uuid"
   - ✅ `userRole`: "ORG_OWNER" or "ORG_ADMIN"

### Network Tab Verification
1. Open Network tab (F12)
2. Navigate to `/admin/users`
3. Check response:
   - **200 OK** → Success! ✅
   - **401 AUTH_REQUIRED** → Session not set ❌
   - **403 Forbidden** → Correct rejection for REGULAR_USER ✅

---

## 🐛 Troubleshooting

### Problem: Still getting AUTH_REQUIRED
**Cause:** Session not set properly during login

**Fix:**
1. Check login route sets `req.session.userId`
2. Verify session middleware is loaded before routes
3. Check cookie is being sent with requests

**Quick Check:**
```javascript
// In browser console on /admin/users page:
document.cookie
// Should contain session cookie
```

### Problem: 403 instead of 200 for ORG_OWNER
**Cause:** Role check failing

**Fix:**
1. Verify user has correct role in database
2. Check `user_organizations` table has `hierarchy_level >= 3`
3. Verify `requireMinRoleLevel(3)` is correct threshold

**SQL Check:**
```sql
SELECT uo.user_id, uo.role, or.hierarchy_level
FROM user_organizations uo
JOIN organization_roles or ON uo.role_id = or.id
WHERE uo.user_id = 'your-user-id';
```

### Problem: Organization not found error
**Cause:** `req.session.organizationId` not set

**Fix:**
1. Check login/setup flow sets organization
2. Verify user is assigned to organization
3. Check session data includes `organizationId`

---

## ✅ Success Indicators

| Indicator | Status |
|-----------|--------|
| ORG_OWNER sees user list | ✅ |
| ORG_ADMIN sees user list | ✅ |
| REGULAR_USER gets 403 | ✅ |
| No 401 errors for admins | ✅ |
| Session includes userId | ✅ |
| Session includes organizationId | ✅ |

---

## 📊 Test Results Template

```markdown
### Test Results - [Date]

**Tester:** [Your Name]
**Environment:** [Local/Staging/Production]

| Test | User Role | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | ORG_OWNER | 200 OK | [200/401/403] | [✅/❌] |
| 2 | ORG_ADMIN | 200 OK | [200/401/403] | [✅/❌] |
| 3 | REGULAR_USER | 403 Forbidden | [200/401/403] | [✅/❌] |
| 4 | Not logged in | 401 AUTH_REQUIRED | [401/403] | [✅/❌] |

**Notes:**
[Any issues, observations, or additional testing needed]

**Overall Status:** [✅ PASS / ❌ FAIL]
```

---

## 🎯 One-Liner Tests

```bash
# Test 1: ORG_OWNER (should succeed)
curl -b cookies.txt http://localhost:3000/admin/users
# Expected: 200 OK with HTML

# Test 2: No auth (should fail)
curl http://localhost:3000/admin/users
# Expected: 401 or redirect to login

# Test 3: Check session cookie
curl -i http://localhost:3000/login
# Expected: Set-Cookie header with session ID
```

---

## 📞 Report Issues

If any test fails:

1. **Capture:**
   - Browser console errors
   - Network tab response
   - Session data (DevTools → Application)
   - Server logs

2. **Document:**
   - User role attempting access
   - Expected vs actual result
   - Error message/code received

3. **Contact:**
   - Coder Agent #1 (Authentication Specialist)
   - Reference: Issue #1
