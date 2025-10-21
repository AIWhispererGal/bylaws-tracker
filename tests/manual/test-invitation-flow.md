# Manual Testing Guide: User Invitation Flow

## Prerequisites

1. Database migration 014 has been run
2. Server is running (`npm start`)
3. You have an organization with an admin user
4. You're logged in as an org admin

## Test Scenarios

### Scenario 1: Create and Accept Invitation (Happy Path)

#### Step 1: Create Invitation
```bash
# Method 1: Using curl
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "email": "newuser@example.com",
    "name": "New User",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'

# Expected Response:
{
  "success": true,
  "message": "Invitation sent to newuser@example.com",
  "invitation": {
    "id": "...",
    "email": "newuser@example.com",
    "role": "member",
    "organizationId": "...",
    "inviteUrl": "http://localhost:3000/auth/accept-invite?token=...",
    "sentAt": "...",
    "expiresAt": "..."
  }
}
```

#### Step 2: Check Server Console
Look for the invitation URL in server logs:
```
Invitation URL: http://localhost:3000/auth/accept-invite?token=ABC123...
```

#### Step 3: Visit Invitation URL
1. Copy the invitation URL from the response or console
2. Open in browser (use incognito/private mode if already logged in)
3. Verify the form displays:
   - Organization name
   - Invited email
   - Role badge
   - Expiration date
   - Full name field
   - Password field
   - Confirm password field

#### Step 4: Fill Form
1. Enter full name: "Test User"
2. Enter password: "TestPassword123"
3. Confirm password: "TestPassword123"
4. Click "Accept Invitation & Join"

#### Step 5: Verify Success
- Should see success message
- Should be redirected to /dashboard
- Should be logged in
- Session should be set with organization context

#### Step 6: Verify Database
```sql
-- Check invitation was marked as accepted
SELECT * FROM user_invitations
WHERE email = 'newuser@example.com';
-- status should be 'accepted', accepted_at should be set

-- Check user was created
SELECT * FROM users
WHERE email = 'newuser@example.com';

-- Check user_organization link was created
SELECT * FROM user_organizations
WHERE user_id = (SELECT id FROM users WHERE email = 'newuser@example.com');
-- Should have correct organization_id and role
```

---

### Scenario 2: Expired Invitation

#### Step 1: Create Invitation
Create an invitation (same as Scenario 1, Step 1)

#### Step 2: Manually Expire Invitation
```sql
UPDATE user_invitations
SET expires_at = NOW() - INTERVAL '1 day'
WHERE email = 'expired@example.com';
```

#### Step 3: Try to Accept
Visit the invitation URL

**Expected Result:**
- 410 Gone status
- Error page: "Invitation expired"
- Message: "This invitation has expired. Please request a new invitation..."
- Invitation status in DB updated to 'expired'

---

### Scenario 3: Invalid Token

#### Step 1: Visit Invalid URL
```
http://localhost:3000/auth/accept-invite?token=invalid-token-12345
```

**Expected Result:**
- 404 Not Found status
- Error page: "Invitation not found"
- Message: "This invitation may have expired or already been accepted"

---

### Scenario 4: Duplicate Invitation Prevention

#### Step 1: Create First Invitation
```bash
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "email": "duplicate@example.com",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected:** Success

#### Step 2: Create Second Invitation (Same Email)
```bash
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "email": "duplicate@example.com",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected Result:**
```json
{
  "success": false,
  "error": "A pending invitation already exists for this email"
}
```

---

### Scenario 5: User Already Exists

#### Step 1: Create and Accept First Invitation
Complete Scenario 1 to create a user

#### Step 2: Try to Invite Same Email Again
```bash
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "email": "newuser@example.com",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected Result:**
```json
{
  "success": false,
  "error": "User is already a member of this organization"
}
```

---

### Scenario 6: Non-Admin Cannot Invite

#### Step 1: Login as Regular Member
Login with a user who has role 'member' or 'viewer'

#### Step 2: Try to Create Invitation
```bash
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "email": "test@example.com",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected Result:**
```json
{
  "success": false,
  "error": "Only organization admins can invite users"
}
```
HTTP Status: 403 Forbidden

---

### Scenario 7: User Limit Reached

#### Step 1: Set Low User Limit
```sql
UPDATE organizations
SET max_users = 2
WHERE id = 'YOUR_ORG_ID';
```

#### Step 2: Ensure Organization Has 2 Users
Add users if needed until count = max_users

#### Step 3: Try to Create Invitation
```bash
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "email": "overflow@example.com",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected Result:**
```json
{
  "success": false,
  "error": "Organization has reached its user limit (2 users)",
  "currentUsers": 2,
  "maxUsers": 2
}
```

---

### Scenario 8: Password Validation

#### Step 1: Create Invitation (Scenario 1, Steps 1-3)

#### Step 2: Try Short Password
1. Enter full name: "Test User"
2. Enter password: "short"
3. Click submit

**Expected Result:**
- Client-side validation error
- "Password must be at least 8 characters"
- Form not submitted

#### Step 3: Try Mismatched Passwords
1. Enter password: "Password123"
2. Enter confirm: "Password456"
3. Click submit

**Expected Result:**
- Client-side validation error
- "Passwords do not match"
- Form not submitted

---

### Scenario 9: Already Accepted Invitation

#### Step 1: Create and Accept Invitation
Complete Scenario 1

#### Step 2: Try to Use Same Token Again
Visit the same invitation URL again

**Expected Result:**
- 404 Not Found (invitation status is no longer 'pending')
- Error: "Invitation not found"

---

### Scenario 10: Missing Token Parameter

#### Step 1: Visit URL Without Token
```
http://localhost:3000/auth/accept-invite
```

**Expected Result:**
- 400 Bad Request
- Error page: "Invalid invitation link"
- Message: "No invitation token provided"

---

## Browser Testing Checklist

### Visual/UI Testing
- [ ] Form renders correctly on desktop
- [ ] Form renders correctly on mobile
- [ ] Organization details display properly
- [ ] Role badge has correct styling
- [ ] Password requirements list is visible
- [ ] Icons display correctly
- [ ] Loading spinner appears on submission
- [ ] Success/error messages display properly

### Functionality Testing
- [ ] Email field is read-only and pre-filled
- [ ] Full name field accepts input
- [ ] Password field masks input
- [ ] Confirm password field shows mismatch error
- [ ] Submit button disables during submission
- [ ] Form validation works client-side
- [ ] AJAX submission works
- [ ] Redirect happens after success
- [ ] Session is created after acceptance
- [ ] Back to login link works

### Accessibility Testing
- [ ] All form fields have labels
- [ ] Tab navigation works properly
- [ ] Screen reader support (ARIA labels)
- [ ] Keyboard-only navigation works
- [ ] Focus states are visible
- [ ] Error messages are announced

---

## Database Verification Queries

### Check Invitation Status
```sql
SELECT
  i.*,
  o.name as org_name,
  u.email as invited_by_email
FROM user_invitations i
JOIN organizations o ON i.organization_id = o.id
LEFT JOIN users u ON i.invited_by = u.id
ORDER BY i.created_at DESC
LIMIT 10;
```

### Check User Creation
```sql
SELECT
  u.*,
  uo.organization_id,
  uo.role,
  o.name as org_name
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE u.email = 'newuser@example.com';
```

### Check Pending Invitations
```sql
SELECT
  email,
  role,
  status,
  expires_at,
  created_at
FROM user_invitations
WHERE status = 'pending'
  AND expires_at > NOW()
ORDER BY created_at DESC;
```

### Clean Up Test Data
```sql
-- Delete test invitation
DELETE FROM user_invitations
WHERE email LIKE '%@example.com';

-- Delete test user (cascade will handle user_organizations)
DELETE FROM users
WHERE email LIKE '%@example.com';
```

---

## Performance Testing

### Invitation Creation Performance
```bash
# Create 10 invitations rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/invite-user \
    -H "Content-Type: application/json" \
    -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
    -d "{\"email\":\"user$i@example.com\",\"role\":\"member\",\"organizationId\":\"YOUR_ORG_ID\"}"
done
```

**Expected:** All should complete in < 5 seconds total

### Token Lookup Performance
```sql
EXPLAIN ANALYZE
SELECT * FROM user_invitations
WHERE token = 'sample-token';
-- Should use idx_user_invitations_token index
-- Execution time should be < 5ms
```

---

## Security Testing

### SQL Injection Attempts
```bash
# Try SQL injection in email field
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com; DROP TABLE users;--",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected:** Validation error (invalid email format)

### XSS Attempts
```bash
# Try XSS in name field
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "<script>alert(\"XSS\")</script>",
    "role": "member",
    "organizationId": "YOUR_ORG_ID"
  }'
```

**Expected:** Name is sanitized/escaped in UI

### Token Brute Force
```bash
# Try random tokens
for i in {1..10}; do
  curl "http://localhost:3000/auth/accept-invite?token=random-token-$i"
done
```

**Expected:** All return 404, no sensitive info leaked

---

## Test Results Template

```markdown
## Test Execution Results - [Date]

Tester: [Your Name]
Environment: [Development/Staging/Production]
Browser: [Chrome/Firefox/Safari]
Database: [PostgreSQL version]

### Scenario Results

- [ ] Scenario 1: Create and Accept Invitation - PASS/FAIL
- [ ] Scenario 2: Expired Invitation - PASS/FAIL
- [ ] Scenario 3: Invalid Token - PASS/FAIL
- [ ] Scenario 4: Duplicate Prevention - PASS/FAIL
- [ ] Scenario 5: User Already Exists - PASS/FAIL
- [ ] Scenario 6: Non-Admin Cannot Invite - PASS/FAIL
- [ ] Scenario 7: User Limit Reached - PASS/FAIL
- [ ] Scenario 8: Password Validation - PASS/FAIL
- [ ] Scenario 9: Already Accepted - PASS/FAIL
- [ ] Scenario 10: Missing Token - PASS/FAIL

### Issues Found
[List any bugs or issues discovered]

### Notes
[Any additional observations or recommendations]
```

---

## Quick Test Script

Save this as `test-invitation.sh`:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000"
SESSION_COOKIE="YOUR_SESSION_COOKIE"
ORG_ID="YOUR_ORG_ID"

echo "Testing User Invitation Flow..."

# Test 1: Create invitation
echo -e "\n1. Creating invitation..."
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/invite-user" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=$SESSION_COOKIE" \
  -d "{\"email\":\"test-$(date +%s)@example.com\",\"role\":\"member\",\"organizationId\":\"$ORG_ID\"}")

echo "$RESPONSE" | jq .

# Extract token from response
TOKEN=$(echo "$RESPONSE" | jq -r '.invitation.inviteUrl' | sed 's/.*token=//')

echo -e "\n2. Testing invitation URL..."
curl -s "$BASE_URL/auth/accept-invite?token=$TOKEN" | grep -o "<h1>.*</h1>"

echo -e "\n3. Testing invalid token..."
curl -s "$BASE_URL/auth/accept-invite?token=invalid" | grep -o "<h1>.*</h1>"

echo -e "\nTests complete!"
```

Run with: `chmod +x test-invitation.sh && ./test-invitation.sh`
