# Authentication API Documentation

Complete authentication system with Supabase Auth integration for the Bylaws Amendment Tracker.

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Authentication Flow](#authentication-flow)
4. [Security Features](#security-features)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

## Overview

The authentication system provides secure user registration, login, session management, and user invitation capabilities. It integrates with Supabase Auth for authentication and uses Express sessions for state management.

### Key Features

- **User Registration**: Create new user accounts with email verification
- **Login**: Authenticate users with email and password
- **Session Management**: JWT-based sessions with automatic refresh
- **Logout**: Secure session cleanup
- **User Invitations**: Invite users to organizations with role-based access
- **Organization Limits**: Enforce user limits per organization (default: 10 users)
- **Input Validation**: Joi-based request validation
- **Error Handling**: Comprehensive error responses

## API Endpoints

### 1. POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "organizationId": "uuid-optional"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Minimum 8 characters, required
- `name`: 2-255 characters, optional
- `organizationId`: Valid UUID, optional

**Success Response (200):**
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
    "access_token": "jwt-token",
    "refresh_token": "refresh-token"
  },
  "needsEmailVerification": true
}
```

**Error Responses:**
- `400`: Validation error or registration failed
- `403`: Organization has reached user limit
- `500`: Internal server error

---

### 2. POST /auth/login

Authenticate a user and create a session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Required

**Success Response (200):**
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

**Session Data Stored:**
- `userId`: User UUID
- `userEmail`: User email
- `userName`: User name
- `accessToken`: JWT access token
- `refreshToken`: JWT refresh token
- `organizationId`: Default organization ID
- `organizationName`: Default organization name
- `userRole`: User role in organization

**Error Responses:**
- `401`: Invalid credentials
- `500`: Internal server error

---

### 3. POST /auth/logout

Log out the user and clear session data.

**Request:** No body required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "redirectTo": "/auth/login"
}
```

**Error Responses:**
- `500`: Failed to destroy session

---

### 4. GET /auth/session

Get current session information and validate JWT.

**Request:** No parameters required (uses session cookie)

**Success Response (200):**
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
  },
  "refreshed": false
}
```

**Features:**
- Validates JWT token
- Automatically refreshes expired tokens
- Returns updated session if refreshed

**Error Responses:**
- `401`: No active session or session expired
- `500`: Session validation failed

---

### 5. POST /auth/invite-user

Invite a user to join an organization (admin only).

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "name": "Jane Smith",
  "role": "member",
  "organizationId": "org-uuid"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `name`: 2-255 characters, optional
- `role`: One of ['owner', 'admin', 'member', 'viewer'], default: 'member'
- `organizationId`: Valid UUID, required

**Authorization:**
- Requires authenticated session
- User must be 'owner' or 'admin' of the organization

**Success Response (200):**
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

**Error Responses:**
- `400`: Validation error or user already exists
- `401`: Authentication required
- `403`: Not authorized or user limit reached
- `500`: Failed to send invitation

**User Limit Enforcement:**
- Default limit: 10 users per organization
- Configurable via `organizations.max_users` column
- Invitation rejected if limit reached

---

### 6. GET /auth/select

Render organization selection page (existing functionality).

---

### 7. POST /auth/select

Set selected organization in session (existing functionality).

---

### 8. GET /auth/switch/:organizationId

Quick organization switcher (existing functionality).

---

## Authentication Flow

### Registration Flow

```
1. Client → POST /auth/register
2. Server validates input (Joi schema)
3. Server checks organization user limit (if organizationId provided)
4. Server creates Supabase Auth user
5. Server creates user record in users table
6. Server creates user_organization record (if organizationId provided)
7. Server sets Express session
8. Server returns user data and session info
9. User receives verification email
```

### Login Flow

```
1. Client → POST /auth/login
2. Server validates input (Joi schema)
3. Server authenticates with Supabase Auth
4. Server updates user record (last_login)
5. Server fetches user's organizations
6. Server sets Express session with tokens
7. Server returns user data, organizations, and redirect URL
```

### Session Validation Flow

```
1. Client → GET /auth/session
2. Server checks Express session exists
3. Server validates JWT with Supabase
4. If expired:
   a. Server attempts token refresh
   b. If refresh succeeds: update session and return
   c. If refresh fails: destroy session and return 401
5. If valid: return session info
```

### Invitation Flow

```
1. Admin → POST /auth/invite-user
2. Server validates admin permissions
3. Server checks organization user limit
4. Server checks if user already exists
5. Server sends Supabase Auth invitation email
6. Server creates pending user_organization record
7. Invited user receives email with invitation link
8. User clicks link → registers/logs in → joins organization
```

## Security Features

### Input Validation

All endpoints use Joi schemas for input validation:

```javascript
// Example: Registration schema
{
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(255).optional(),
  organizationId: Joi.string().uuid().optional()
}
```

### Password Security

- Minimum 8 characters required
- Handled by Supabase Auth (bcrypt hashing)
- Password reset via Supabase Auth flows

### Session Security

- **HttpOnly cookies**: Prevents XSS attacks
- **Secure flag**: HTTPS-only in production
- **Session expiry**: 24 hours (configurable)
- **JWT validation**: Validates on each protected request
- **Automatic refresh**: Refreshes expired tokens transparently

### Authorization

- **Role-based access**: owner, admin, member, viewer
- **Permission checks**: Verified before sensitive operations
- **Organization isolation**: Users can only access their organizations

### Error Handling

- **No sensitive data in errors**: Production mode hides details
- **Generic error messages**: "Authentication failed" instead of specific reasons
- **Logging**: Detailed errors logged server-side

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Detailed error (development only)"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid input, validation errors
- **401 Unauthorized**: Invalid credentials, expired session
- **403 Forbidden**: Insufficient permissions, user limit reached
- **404 Not Found**: Organization not found
- **500 Internal Server Error**: Server-side errors

### Development vs Production

**Development Mode (`NODE_ENV=development`):**
- Includes detailed error messages
- Stack traces in responses
- Verbose logging

**Production Mode (`NODE_ENV=production`):**
- Generic error messages
- No stack traces
- Minimal error details

## Examples

### Example 1: Register and Login

```javascript
// Register
const registerResponse = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePass123',
    name: 'John Doe',
    organizationId: 'org-uuid'
  })
});

// Login
const loginResponse = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePass123'
  })
});

const data = await loginResponse.json();
console.log('Redirect to:', data.redirectTo);
```

### Example 2: Check Session

```javascript
const sessionResponse = await fetch('/auth/session', {
  credentials: 'include' // Include cookies
});

const session = await sessionResponse.json();
if (session.authenticated) {
  console.log('User:', session.user.email);
  console.log('Organization:', session.organization.name);
} else {
  // Redirect to login
  window.location.href = '/auth/login';
}
```

### Example 3: Invite User (Admin)

```javascript
const inviteResponse = await fetch('/auth/invite-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'newuser@example.com',
    name: 'Jane Smith',
    role: 'member',
    organizationId: 'org-uuid'
  })
});

const result = await inviteResponse.json();
if (result.success) {
  console.log('Invitation sent!');
}
```

### Example 4: Logout

```javascript
const logoutResponse = await fetch('/auth/logout', {
  method: 'POST',
  credentials: 'include'
});

const result = await logoutResponse.json();
if (result.success) {
  window.location.href = result.redirectTo;
}
```

## Integration with Dashboard

The `requireAuth` middleware in `/src/routes/dashboard.js` should be updated to use the new session structure:

```javascript
function requireAuth(req, res, next) {
  if (!req.session.userId || !req.session.organizationId) {
    return res.redirect('/auth/select');
  }
  req.organizationId = req.session.organizationId;
  req.userId = req.session.userId;
  next();
}
```

## Database Schema

The authentication system relies on these tables:

- **users**: User profiles
- **organizations**: Organization data
- **user_organizations**: User-organization membership with roles

See `/database/migrations/001_generalized_schema.sql` for complete schema.

## Environment Variables

Required environment variables in `.env`:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=your-session-secret
APP_URL=http://localhost:3000
NODE_ENV=development
```

## Next Steps

1. **Frontend Integration**: Create login/register UI components
2. **Email Templates**: Customize Supabase Auth email templates
3. **Password Reset**: Implement forgot password flow
4. **OAuth**: Add Google/GitHub OAuth providers
5. **2FA**: Implement two-factor authentication
6. **Rate Limiting**: Add rate limiting to prevent brute force attacks
7. **Audit Logging**: Log authentication events for security audits

---

**Last Updated**: 2025-10-12
**Version**: 1.0.0
**Author**: Backend Authentication Engineer
