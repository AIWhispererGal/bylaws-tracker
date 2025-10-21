# Authentication API Testing Examples

Complete set of curl commands and test scenarios for the authentication system.

## Prerequisites

```bash
# Set environment variables
export API_URL="http://localhost:3000"
export ORG_ID="your-organization-uuid"
```

## 1. User Registration

### Basic Registration (No Organization)

```bash
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePass123",
    "name": "John Doe"
  }' \
  -c cookies.txt
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "access_token": "eyJhbGc...",
    "refresh_token": "refresh-token"
  },
  "needsEmailVerification": true
}
```

### Registration with Organization

```bash
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePass123",
    "name": "John Doe",
    "organizationId": "'"${ORG_ID}"'"
  }' \
  -c cookies.txt
```

### Invalid Registration (Short Password)

```bash
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "short",
    "name": "John Doe"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "\"password\" length must be at least 8 characters long"
}
```

### Invalid Registration (Invalid Email)

```bash
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "securePass123"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "\"email\" must be a valid email"
}
```

## 2. User Login

### Successful Login

```bash
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePass123"
  }' \
  -c cookies.txt
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "organizations": [
    {
      "organization_id": "org-uuid",
      "role": "admin",
      "organizations": {
        "id": "org-uuid",
        "name": "Reseda Neighborhood Council",
        "slug": "reseda-nc"
      }
    }
  ],
  "session": {
    "expiresAt": 1698765432,
    "expiresIn": 3600
  },
  "redirectTo": "/dashboard"
}
```

### Failed Login (Invalid Credentials)

```bash
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "wrongpassword"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

### Failed Login (Missing Fields)

```bash
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "\"password\" is required"
}
```

## 3. Session Validation

### Check Active Session

```bash
curl -X GET "${API_URL}/auth/session" \
  -b cookies.txt
```

**Expected Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Reseda Neighborhood Council",
    "role": "admin"
  },
  "session": {
    "expiresAt": 1698765432,
    "expiresIn": 3600
  }
}
```

### Check Session (Not Authenticated)

```bash
curl -X GET "${API_URL}/auth/session"
```

**Expected Error:**
```json
{
  "success": false,
  "authenticated": false,
  "error": "No active session"
}
```

### Session with Token Refresh

```bash
# Wait for token to expire (1 hour) then:
curl -X GET "${API_URL}/auth/session" \
  -b cookies.txt
```

**Expected Response (if refresh succeeds):**
```json
{
  "success": true,
  "authenticated": true,
  "user": { ... },
  "organization": { ... },
  "session": { ... },
  "refreshed": true
}
```

## 4. User Logout

### Successful Logout

```bash
curl -X POST "${API_URL}/auth/logout" \
  -b cookies.txt
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "redirectTo": "/auth/login"
}
```

### Verify Logout (Session Should Be Invalid)

```bash
curl -X GET "${API_URL}/auth/session" \
  -b cookies.txt
```

**Expected Error:**
```json
{
  "success": false,
  "authenticated": false,
  "error": "No active session"
}
```

## 5. User Invitation (Admin Only)

### Successful Invitation

```bash
# Must be logged in as admin
curl -X POST "${API_URL}/auth/invite-user" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "member",
    "organizationId": "'"${ORG_ID}"'"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invitation sent to newuser@example.com",
  "invitation": {
    "email": "newuser@example.com",
    "role": "member",
    "organizationId": "org-uuid",
    "sentAt": "2025-10-12T00:00:00.000Z"
  }
}
```

### Failed Invitation (Not Admin)

```bash
# Logged in as regular member
curl -X POST "${API_URL}/auth/invite-user" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "role": "member",
    "organizationId": "'"${ORG_ID}"'"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Only organization admins can invite users"
}
```

### Failed Invitation (User Limit Reached)

```bash
curl -X POST "${API_URL}/auth/invite-user" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "role": "member",
    "organizationId": "'"${ORG_ID}"'"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Organization has reached its user limit (10 users)",
  "currentUsers": 10,
  "maxUsers": 10
}
```

### Failed Invitation (User Already Exists)

```bash
curl -X POST "${API_URL}/auth/invite-user" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "existinguser@example.com",
    "role": "member",
    "organizationId": "'"${ORG_ID}"'"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "User is already a member of this organization"
}
```

### Failed Invitation (Not Authenticated)

```bash
curl -X POST "${API_URL}/auth/invite-user" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "role": "member",
    "organizationId": "'"${ORG_ID}"'"
  }'
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

## 6. Organization Selection (Existing Routes)

### Get Organization Selection Page

```bash
curl -X GET "${API_URL}/auth/select" \
  -b cookies.txt
```

### Select Organization

```bash
curl -X POST "${API_URL}/auth/select" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "organizationId": "'"${ORG_ID}"'"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Switched to Reseda Neighborhood Council",
  "organizationId": "org-uuid",
  "organizationName": "Reseda Neighborhood Council"
}
```

### Switch Organization (Quick)

```bash
curl -X GET "${API_URL}/auth/switch/${ORG_ID}" \
  -b cookies.txt \
  -L
```

## Complete Test Workflow

### 1. Register → Login → Check Session → Logout

```bash
#!/bin/bash

API_URL="http://localhost:3000"

echo "=== 1. REGISTER ==="
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "testPass123",
    "name": "Test User"
  }' \
  -c cookies.txt
echo -e "\n"

sleep 2

echo "=== 2. LOGIN ==="
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "testPass123"
  }' \
  -c cookies.txt
echo -e "\n"

sleep 2

echo "=== 3. CHECK SESSION ==="
curl -X GET "${API_URL}/auth/session" \
  -b cookies.txt
echo -e "\n"

sleep 2

echo "=== 4. LOGOUT ==="
curl -X POST "${API_URL}/auth/logout" \
  -b cookies.txt
echo -e "\n"

sleep 2

echo "=== 5. VERIFY LOGOUT ==="
curl -X GET "${API_URL}/auth/session" \
  -b cookies.txt
echo -e "\n"
```

### 2. Admin Workflow: Login → Invite User

```bash
#!/bin/bash

API_URL="http://localhost:3000"
ORG_ID="your-org-uuid"

echo "=== 1. LOGIN AS ADMIN ==="
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "adminPass123"
  }' \
  -c cookies.txt
echo -e "\n"

sleep 2

echo "=== 2. INVITE USER ==="
curl -X POST "${API_URL}/auth/invite-user" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newuser@example.com",
    "name": "New User",
    "role": "member",
    "organizationId": "'"${ORG_ID}"'"
  }'
echo -e "\n"
```

## Using Postman

### Environment Variables

Create a Postman environment with:

```
API_URL: http://localhost:3000
ORG_ID: your-organization-uuid
```

### Collection Structure

```
Authentication API
├── Register
│   ├── Register (No Org)
│   ├── Register (With Org)
│   └── Register (Invalid)
├── Login
│   ├── Login (Success)
│   └── Login (Failed)
├── Session
│   ├── Check Session
│   └── Check Session (Not Auth)
├── Logout
│   └── Logout
└── Invite User
    ├── Invite (Success)
    ├── Invite (Not Admin)
    └── Invite (Limit Reached)
```

### Pre-request Scripts

For authenticated requests:

```javascript
// Store session cookie from login response
if (pm.response.json().success && pm.response.json().session) {
    pm.environment.set("session_cookie", pm.cookies.get("connect.sid"));
}
```

### Tests

```javascript
// Test for successful response
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Success is true", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.eql(true);
});

pm.test("User data is present", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.user).to.exist;
    pm.expect(jsonData.user.email).to.exist;
});
```

## Debugging Tips

### Check Cookies

```bash
# View cookies file
cat cookies.txt
```

### Verbose Output

```bash
# Add -v flag for verbose output
curl -v -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'
```

### Save Response to File

```bash
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}' \
  -o response.json

cat response.json | jq '.'
```

### Test Session Expiry

```bash
# 1. Login and save cookies
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}' \
  -c cookies.txt

# 2. Wait for token to expire (1 hour for JWT)
sleep 3601

# 3. Check session (should trigger refresh)
curl -X GET "${API_URL}/auth/session" \
  -b cookies.txt
```

## Security Testing

### SQL Injection Test

```bash
curl -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com OR 1=1",
    "password": "password"
  }'
```

**Expected**: Validation error or invalid credentials (protected by Joi and Supabase)

### XSS Test

```bash
curl -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "pass123",
    "name": "<script>alert(\"XSS\")</script>"
  }'
```

**Expected**: Input accepted but sanitized on output

### CSRF Test

```bash
# Try without session cookie
curl -X POST "${API_URL}/auth/logout"
```

**Expected**: Operation fails (no session)

## Performance Testing

### Load Test with ApacheBench

```bash
# Test login endpoint
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:3000/auth/login

# login.json content:
# {"email":"user@example.com","password":"pass123"}
```

### Concurrent Requests

```bash
# Run 10 parallel requests
for i in {1..10}; do
  curl -X GET "${API_URL}/auth/session" -b cookies.txt &
done
wait
```

---

**Last Updated**: 2025-10-12
**Version**: 1.0.0
