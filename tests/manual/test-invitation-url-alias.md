# Manual Test: Invitation URL Alias Fix

## Test Date
October 15, 2025

## Test Objective
Verify that both `/auth/accept-invitation` and `/auth/accept-invite` URLs work correctly for user invitation acceptance.

## Prerequisites
- Server running on http://localhost:3000
- Valid invitation token (or use test token)
- Browser or curl for testing

## Test Scenarios

### Test 1: GET /auth/accept-invitation with valid token
**Expected:** Redirects to /auth/accept-invite?token=xxx

```bash
# Test with curl
curl -v http://localhost:3000/auth/accept-invitation?token=test123 2>&1 | grep -E "(Location|HTTP)"

# Expected output:
# HTTP/1.1 302 Found
# Location: /auth/accept-invite?token=test123
```

**Browser Test:**
1. Visit: `http://localhost:3000/auth/accept-invitation?token=test123`
2. Verify URL changes to: `http://localhost:3000/auth/accept-invite?token=test123`
3. Should show invitation acceptance form (or error if token invalid)

**Result:** [ ] PASS [ ] FAIL

---

### Test 2: GET /auth/accept-invitation without token
**Expected:** Shows 400 error page

```bash
# Test with curl
curl -v http://localhost:3000/auth/accept-invitation 2>&1 | grep -E "HTTP"

# Expected output:
# HTTP/1.1 400 Bad Request
```

**Browser Test:**
1. Visit: `http://localhost:3000/auth/accept-invitation`
2. Should show error page with message "Invalid invitation link"
3. Details should say "No invitation token provided"

**Result:** [ ] PASS [ ] FAIL

---

### Test 3: POST /auth/accept-invitation with valid data
**Expected:** Processes invitation acceptance like /auth/accept-invite

```bash
# Prerequisites: Create a real invitation first
# Then test with:

curl -X POST http://localhost:3000/auth/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{
    "token": "REAL_TOKEN_HERE",
    "full_name": "Test User",
    "password": "password123"
  }'

# Expected output (if token valid):
# {"success":true,"message":"Welcome! Your account has been created successfully.","redirectTo":"/dashboard"}
```

**Result:** [ ] PASS [ ] FAIL

---

### Test 4: Original route still works
**Expected:** /auth/accept-invite works unchanged

```bash
# Test GET
curl -v http://localhost:3000/auth/accept-invite?token=test123 2>&1 | grep -E "HTTP"

# Expected output:
# HTTP/1.1 200 OK (if valid token)
# Shows invitation form
```

**Browser Test:**
1. Visit: `http://localhost:3000/auth/accept-invite?token=test123`
2. Should show invitation acceptance form directly (no redirect)

**Result:** [ ] PASS [ ] FAIL

---

### Test 5: Token with special characters
**Expected:** Token properly encoded in redirect

```bash
# Test with special characters in token
curl -v "http://localhost:3000/auth/accept-invitation?token=abc+def%2Fghi" 2>&1 | grep Location

# Expected output:
# Location: /auth/accept-invite?token=abc%2Bdef%2Fghi
# (URL-encoded properly)
```

**Result:** [ ] PASS [ ] FAIL

---

### Test 6: Full invitation flow (End-to-End)

**Setup:**
1. Login as org admin
2. Create invitation:
```bash
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "email": "newuser@example.com",
    "name": "New User",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

3. Copy the invitation token from response
4. Test with BOTH URLs:

**Test 6A: Using /auth/accept-invitation**
```bash
# Browser:
1. Visit: http://localhost:3000/auth/accept-invitation?token=COPIED_TOKEN
2. Verify redirect to /auth/accept-invite
3. Fill form:
   - Full Name: "New User"
   - Password: "password123"
4. Submit
5. Should redirect to /dashboard
6. Verify user is logged in
```

**Test 6B: Using /auth/accept-invite (canonical)**
```bash
# Create another invitation
# Browser:
1. Visit: http://localhost:3000/auth/accept-invite?token=NEW_TOKEN
2. Should show form directly (no redirect)
3. Fill form and submit
4. Should redirect to /dashboard
5. Verify user is logged in
```

**Result 6A:** [ ] PASS [ ] FAIL
**Result 6B:** [ ] PASS [ ] FAIL

---

## Verification Queries

### Check user was created
```sql
SELECT u.*, uo.role, o.name as organization
FROM users u
JOIN user_organizations uo ON u.id = uo.user_id
JOIN organizations o ON uo.organization_id = o.id
WHERE u.email = 'newuser@example.com';
```

### Check invitation was marked accepted
```sql
SELECT * FROM user_invitations
WHERE email = 'newuser@example.com'
  AND status = 'accepted';
```

---

## Edge Cases

### Edge Case 1: Malformed token
```bash
curl -v "http://localhost:3000/auth/accept-invitation?token=<script>alert('xss')</script>" 2>&1 | grep Location

# Should encode safely
```
**Result:** [ ] PASS [ ] FAIL

### Edge Case 2: Multiple redirects
```bash
# Ensure no redirect loop
curl -L -v http://localhost:3000/auth/accept-invitation?token=test 2>&1 | grep -c "HTTP/1.1 302"

# Should show only 1 redirect
```
**Result:** [ ] PASS [ ] FAIL

### Edge Case 3: POST without token
```bash
curl -X POST http://localhost:3000/auth/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test","password":"password123"}'

# Should return 400 error
```
**Result:** [ ] PASS [ ] FAIL

---

## Performance Test

### Response Time
```bash
# Test redirect speed
time curl -s -o /dev/null -w "%{time_total}\n" \
  http://localhost:3000/auth/accept-invitation?token=test

# Should be < 0.1 seconds
```
**Time:** _____ seconds
**Result:** [ ] PASS (< 0.1s) [ ] FAIL

---

## Test Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. GET with token | [ ] PASS [ ] FAIL | |
| 2. GET without token | [ ] PASS [ ] FAIL | |
| 3. POST with data | [ ] PASS [ ] FAIL | |
| 4. Original route | [ ] PASS [ ] FAIL | |
| 5. Special characters | [ ] PASS [ ] FAIL | |
| 6A. E2E new URL | [ ] PASS [ ] FAIL | |
| 6B. E2E original URL | [ ] PASS [ ] FAIL | |
| Edge Case 1 | [ ] PASS [ ] FAIL | |
| Edge Case 2 | [ ] PASS [ ] FAIL | |
| Edge Case 3 | [ ] PASS [ ] FAIL | |
| Performance | [ ] PASS [ ] FAIL | |

**Total Pass:** ___/11
**Total Fail:** ___/11

---

## Sign-off

**Tester Name:** _________________
**Date:** _________________
**Overall Result:** [ ] APPROVED [ ] NEEDS FIXES

**Issues Found:**
1.
2.
3.

**Comments:**


---

## Automation Candidate

These tests could be automated with:

```javascript
// tests/integration/invitation-url-alias.test.js
describe('Invitation URL Alias', () => {
  it('should redirect /auth/accept-invitation to /auth/accept-invite', async () => {
    const response = await request(app)
      .get('/auth/accept-invitation?token=test123')
      .expect(302);

    expect(response.headers.location).toBe('/auth/accept-invite?token=test123');
  });

  it('should return 400 for missing token', async () => {
    await request(app)
      .get('/auth/accept-invitation')
      .expect(400);
  });

  it('should forward POST requests', async () => {
    const response = await request(app)
      .post('/auth/accept-invitation')
      .send({ token: 'test', full_name: 'Test', password: 'pass123' })
      .expect(404); // 404 because token doesn't exist

    expect(response.body.error).toContain('invitation');
  });
});
```

---

**Document Version:** 1.0
**Last Updated:** October 15, 2025
