# Supabase Authentication Architecture

**Version:** 1.0
**Date:** 2025-10-12
**Status:** Design Phase
**Author:** System Architect

---

## Executive Summary

This document defines the authentication architecture for the Bylaws Amendment Tracker, integrating Supabase Authentication with the existing Express session-based flow. The design supports a single superuser for initial setup, multiple users per organization (up to 50), and seamless RLS integration with `auth.uid()`.

### Key Design Goals

1. **Superuser Bootstrap**: Single admin account to initialize the system
2. **Multi-User Organizations**: Up to 50 users per organization with role-based access
3. **Hybrid Session Management**: Express sessions + Supabase JWT tokens
4. **Backward Compatibility**: Works with existing setup wizard and Express routes
5. **RLS Security**: Leverage `auth.uid()` for database-level isolation
6. **User Management**: Org admins can add/remove users, assign roles

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User Flow Diagrams](#user-flow-diagrams)
3. [Database Schema](#database-schema)
4. [Session Management](#session-management)
5. [User Role Hierarchy](#user-role-hierarchy)
6. [API Endpoints](#api-endpoints)
7. [Security Model](#security-model)
8. [RLS Policies](#rls-policies)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                        USER FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User visits app → Redirected to /auth/login             │
│  2. Enter email/password → Supabase Auth validates           │
│  3. Supabase returns JWT + user metadata                     │
│  4. Express session stores: { userId, orgId, role, jwt }     │
│  5. Subsequent requests use session + JWT for Supabase       │
│  6. RLS policies check auth.uid() for data access            │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Frontend (EJS Templates)                   │   │
│  │  - Login form                                        │   │
│  │  - Organization selector                             │   │
│  │  - User management UI                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↕                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     Express Middleware Layer                         │   │
│  │  - express-session (cookie store)                    │   │
│  │  - Auth middleware (validates session + JWT)         │   │
│  │  - Org context middleware (sets current org)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↕                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Supabase Client (with JWT)                    │   │
│  │  - createClient(url, anonKey, { jwt })               │   │
│  │  - Queries use session JWT for auth.uid()            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↕                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Supabase Database                          │   │
│  │  - auth.users (Supabase managed)                     │   │
│  │  - users (app-level user data)                       │   │
│  │  - user_organizations (memberships)                  │   │
│  │  - RLS policies (auth.uid() checks)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow Types

#### 1. Superuser Flow (Initial Setup)
```
1. App first launch → No organizations exist
2. /setup route creates first organization
3. After setup → Prompt to create superuser account
4. Superuser registers with Supabase Auth
5. Superuser linked to organization as 'owner' role
6. Superuser can now manage organization and add users
```

#### 2. Regular User Flow (Post-Setup)
```
1. User visits /auth/login
2. Enter email/password
3. Supabase Auth validates credentials
4. On success:
   a. Retrieve user's organization memberships
   b. If multiple orgs → Show org selector
   c. If single org → Auto-select
   d. Store in Express session: { userId, orgId, role, jwt }
5. Redirect to /dashboard
6. All subsequent requests include session + JWT
```

#### 3. User Management Flow (Org Admin)
```
1. Org admin visits /admin/users
2. Click "Add User" → Email input form
3. System checks:
   a. Email not already in organization
   b. Organization has < 50 users
   c. Admin has 'org_admin' or 'owner' role
4. On submit:
   a. Create user in Supabase Auth (email invite)
   b. Create record in user_organizations table
   c. Send invitation email with magic link
5. New user clicks link → Set password → Login
```

---

## User Flow Diagrams

### Authentication State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                     UNAUTHENTICATED                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  No session cookie                                   │   │
│  │  → Redirect to /auth/login                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  User enters credentials                             │   │
│  │  → Supabase Auth validates                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│                    ┌─────────┐                              │
│            Success │         │ Failure                      │
│                ↓   └─────────┘   ↓                          │
│         ┌──────────┐         ┌──────────┐                  │
│         │AUTHENTICATED│       │ ERROR    │                  │
│         └──────────┘         └──────────┘                  │
│              ↓                      ↓                        │
│  ┌─────────────────────┐  ┌───────────────────┐           │
│  │ Create Express      │  │ Show error message │           │
│  │ session with JWT    │  │ Return to login    │           │
│  └─────────────────────┘  └───────────────────┘           │
│              ↓                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Check organization memberships                      │   │
│  │  → user_organizations.user_id = auth.uid()           │   │
│  └─────────────────────────────────────────────────────┘   │
│              ↓                                               │
│       ┌──────────────┐                                      │
│       │ How many orgs?                                      │
│       └──────────────┘                                      │
│      ↙              ↘                                       │
│  0 orgs           1+ orgs                                   │
│     ↓                ↓                                       │
│ ┌─────────┐    ┌──────────────┐                            │
│ │ ERROR:  │    │ 1 org?       │                            │
│ │ No org  │    │ Auto-select  │                            │
│ │ access  │    │              │                            │
│ └─────────┘    │ Multiple?    │                            │
│                │ Show selector│                            │
│                └──────────────┘                            │
│                      ↓                                       │
│          ┌──────────────────────┐                          │
│          │ Set session.orgId    │                          │
│          │ Redirect to /dashboard                          │
│          └──────────────────────┘                          │
│                                                               │
│                     ACTIVE SESSION                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Session contains:                                   │   │
│  │  - userId (auth.uid())                               │   │
│  │  - organizationId                                    │   │
│  │  - role (owner, org_admin, member, viewer)           │   │
│  │  - jwt (Supabase access token)                       │   │
│  │  - refreshToken (for JWT renewal)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION LIFECYCLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. LOGIN                                                    │
│     - User submits email/password                            │
│     - POST /auth/login                                       │
│     - Supabase Auth returns: { user, session, jwt }          │
│     - Express session created with 24hr expiry               │
│                                                               │
│  2. ACTIVE SESSION                                           │
│     - Each request includes session cookie                   │
│     - Middleware validates session + JWT expiry              │
│     - If JWT expired (< 5 min remaining):                    │
│       → Auto-refresh using refreshToken                      │
│       → Update session with new JWT                          │
│                                                               │
│  3. ORGANIZATION CONTEXT                                     │
│     - Every request has req.orgId and req.userRole           │
│     - Supabase queries use session JWT (auth.uid() set)      │
│     - RLS policies enforce org-level isolation               │
│                                                               │
│  4. LOGOUT                                                   │
│     - User clicks "Logout"                                   │
│     - POST /auth/logout                                      │
│     - Supabase Auth.signOut() invalidates JWT                │
│     - Express session destroyed                              │
│     - Redirect to /auth/login                                │
│                                                               │
│  5. SESSION EXPIRY                                           │
│     - After 24 hours of inactivity                           │
│     - Next request → Session invalid                         │
│     - Middleware redirects to /auth/login                    │
│     - User must re-authenticate                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Existing Tables (Already Defined)

#### `auth.users` (Supabase Managed)
```sql
-- Managed by Supabase Auth, read-only from app perspective
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  encrypted_password VARCHAR(255),
  email_confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- Other Supabase Auth fields...
);
```

#### `users` (Application Users - Already Exists)
```sql
-- From 001_generalized_schema.sql (lines 62-74)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(50) DEFAULT 'supabase',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- ADD: Link to Supabase Auth
ALTER TABLE users ADD COLUMN auth_user_id UUID UNIQUE;
ALTER TABLE users ADD CONSTRAINT fk_auth_user
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN users.auth_user_id IS 'Links to auth.users.id from Supabase Auth';
```

#### `user_organizations` (Already Exists)
```sql
-- From 001_generalized_schema.sql (lines 79-106)
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  role VARCHAR(50) NOT NULL DEFAULT 'member',
  -- Roles: 'owner', 'org_admin', 'member', 'viewer'

  permissions JSONB DEFAULT '{
    "can_edit_sections": true,
    "can_create_suggestions": true,
    "can_vote": true,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false
  }'::jsonb,

  joined_at TIMESTAMP DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  invitation_accepted_at TIMESTAMP,

  UNIQUE(user_id, organization_id)
);

-- ADD: Invitation tracking
ALTER TABLE user_organizations ADD COLUMN invitation_token VARCHAR(255);
ALTER TABLE user_organizations ADD COLUMN invitation_expires_at TIMESTAMP;
ALTER TABLE user_organizations ADD COLUMN invitation_status VARCHAR(50) DEFAULT 'pending';
-- Status: 'pending', 'accepted', 'expired', 'revoked'

CREATE INDEX idx_user_orgs_invitation ON user_organizations(invitation_token)
  WHERE invitation_status = 'pending';
```

### New Tables/Functions

#### User Invitation Tracking
```sql
-- Track invitation emails sent to users
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES users(id),

  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',

  accepted_at TIMESTAMP,
  accepted_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, email, status)
);

CREATE INDEX idx_invitations_token ON user_invitations(token) WHERE status = 'pending';
CREATE INDEX idx_invitations_email ON user_invitations(email, status);
CREATE INDEX idx_invitations_org ON user_invitations(organization_id, status);

COMMENT ON TABLE user_invitations IS 'Tracks pending/accepted user invitations to organizations';
```

#### Helper Functions
```sql
-- Check if user has permission in organization
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_organizations
    WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND (
      role IN ('owner', 'org_admin')
      OR (permissions->p_permission)::boolean = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role in organization
CREATE OR REPLACE FUNCTION user_org_role(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS VARCHAR AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role INTO v_role
  FROM user_organizations
  WHERE user_id = p_user_id
  AND organization_id = p_organization_id;

  RETURN COALESCE(v_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count users in organization
CREATE OR REPLACE FUNCTION org_user_count(p_organization_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM user_organizations
    WHERE organization_id = p_organization_id
    AND invitation_status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Session Management

### Express Session Configuration

```javascript
// server.js - Enhanced session configuration
const session = require('express-session');
const { SupabaseAdapter } = require('@supabase/session-adapter'); // Optional: Store sessions in Supabase

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  // Optional: Store sessions in Supabase for persistence
  // store: new SupabaseAdapter({
  //   supabaseUrl: process.env.SUPABASE_URL,
  //   supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  //   tableName: 'user_sessions'
  // }),

  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,                                 // No JS access
    maxAge: 24 * 60 * 60 * 1000,                   // 24 hours
    sameSite: 'lax'                                // CSRF protection
  }
}));
```

### Session Data Structure

```typescript
interface AppSession {
  // User identity
  userId: string;              // users.id (UUID)
  authUserId: string;          // auth.users.id (UUID)
  email: string;
  name: string;

  // Organization context
  organizationId: string;      // Current active organization
  organizationSlug: string;
  role: 'owner' | 'org_admin' | 'member' | 'viewer';
  permissions: {
    can_edit_sections: boolean;
    can_create_suggestions: boolean;
    can_vote: boolean;
    can_approve_stages: string[];
    can_manage_users: boolean;
    can_manage_workflows: boolean;
  };

  // Supabase JWT
  supabaseAccessToken: string;  // For Supabase client auth
  supabaseRefreshToken: string; // For token renewal
  tokenExpiresAt: number;       // Unix timestamp

  // Multi-org support
  organizations: Array<{
    id: string;
    slug: string;
    name: string;
    role: string;
  }>;

  // Metadata
  lastActivity: number;         // Unix timestamp
  loginMethod: 'password' | 'magic_link' | 'oauth';
}
```

### Session Middleware

```javascript
// src/middleware/auth.js

/**
 * Verify user is authenticated
 * Validates session exists and JWT is not expired
 */
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  // Check JWT expiry (refresh if < 5 minutes remaining)
  const now = Date.now();
  const expiresIn = req.session.tokenExpiresAt - now;

  if (expiresIn < 5 * 60 * 1000) { // Less than 5 minutes
    try {
      // Refresh token using Supabase Auth
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: req.session.supabaseRefreshToken
      });

      if (error) throw error;

      // Update session with new tokens
      req.session.supabaseAccessToken = data.session.access_token;
      req.session.supabaseRefreshToken = data.session.refresh_token;
      req.session.tokenExpiresAt = data.session.expires_at * 1000;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Force re-login
      req.session.destroy();
      return res.redirect('/auth/login');
    }
  }

  // Attach authenticated Supabase client to request
  req.supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${req.session.supabaseAccessToken}`
        }
      }
    }
  );

  // Attach user context
  req.userId = req.session.userId;
  req.organizationId = req.session.organizationId;
  req.userRole = req.session.role;
  req.userPermissions = req.session.permissions;

  next();
}

/**
 * Verify user has specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        actual: req.userRole
      });
    }
    next();
  };
}

/**
 * Verify user has specific permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.userPermissions[permission]) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission
      });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requirePermission
};
```

---

## User Role Hierarchy

### Role Definitions

```
┌─────────────────────────────────────────────────────────────┐
│                      ROLE HIERARCHY                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. SUPERUSER (First User / System Admin)                    │
│     - Created during initial setup                           │
│     - Role: 'owner' in first organization                    │
│     - Can create organizations                               │
│     - Cannot be removed from organization                    │
│     - Full system access                                     │
│                                                               │
│  2. OWNER (Organization Creator)                             │
│     - Role: 'owner'                                          │
│     - Can manage all organization settings                   │
│     - Can manage all users (add/remove/promote)              │
│     - Can delete organization                                │
│     - Can promote other users to org_admin                   │
│     - Cannot be demoted by others                            │
│                                                               │
│  3. ORG_ADMIN (Organization Administrator)                   │
│     - Role: 'org_admin'                                      │
│     - Can manage users (add/remove, except owner)            │
│     - Can configure workflows                                │
│     - Can manage documents                                   │
│     - Can approve at all workflow stages                     │
│     - Can edit/lock sections                                 │
│                                                               │
│  4. MEMBER (Regular User)                                    │
│     - Role: 'member'                                         │
│     - Can create/edit suggestions                            │
│     - Can vote on suggestions                                │
│     - Can view all documents                                 │
│     - Can comment on sections                                │
│     - Cannot manage users                                    │
│                                                               │
│  5. VIEWER (Read-Only Access)                                │
│     - Role: 'viewer'                                         │
│     - Can view documents                                     │
│     - Can view suggestions                                   │
│     - Cannot create/edit anything                            │
│     - Cannot vote                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission                | Owner | Org_Admin | Member | Viewer |
|---------------------------|-------|-----------|--------|--------|
| View documents            | ✅    | ✅        | ✅     | ✅     |
| Create suggestions        | ✅    | ✅        | ✅     | ❌     |
| Edit suggestions (own)    | ✅    | ✅        | ✅     | ❌     |
| Vote on suggestions       | ✅    | ✅        | ✅     | ❌     |
| Lock sections             | ✅    | ✅        | ❌     | ❌     |
| Unlock sections           | ✅    | ✅        | ❌     | ❌     |
| Approve workflow stages   | ✅    | ✅        | ❌*    | ❌     |
| Edit document structure   | ✅    | ✅        | ❌     | ❌     |
| Configure workflows       | ✅    | ✅        | ❌     | ❌     |
| Add users                 | ✅    | ✅        | ❌     | ❌     |
| Remove users (non-owner)  | ✅    | ✅        | ❌     | ❌     |
| Remove owner              | ❌    | ❌        | ❌     | ❌     |
| Promote to org_admin      | ✅    | ❌        | ❌     | ❌     |
| Change org settings       | ✅    | ❌        | ❌     | ❌     |
| Delete organization       | ✅    | ❌        | ❌     | ❌     |

*Members can approve stages if specifically granted in `permissions.can_approve_stages[]`

### Role Assignment Rules

```javascript
// Business Rules for Role Management

// 1. OWNER RULES
// - Only one owner per organization
// - Owner cannot be removed or demoted
// - Owner role assigned at org creation
// - Owner can promote others to org_admin

// 2. ORG_ADMIN RULES
// - Multiple org_admins allowed
// - Only owner can promote to org_admin
// - Org_admin can demote self back to member
// - Org_admin cannot promote others to org_admin

// 3. MEMBER RULES
// - Default role for new users
// - Can be promoted to org_admin by owner
// - Can have custom permissions in JSONB field

// 4. VIEWER RULES
// - Read-only access
// - Cannot be promoted to org_admin directly
// - Must first be promoted to member, then org_admin

// 5. USER LIMIT RULES
// - Free plan: 10 users per org
// - Pro plan: 50 users per org
// - Owner + admins count toward limit
```

---

## API Endpoints

### Authentication Routes (`/auth/*`)

#### POST `/auth/register`
**Purpose**: Create new user account (superuser or invited user)

```javascript
// Request
POST /auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecureP@ssw0rd",
  "name": "John Doe",
  "invitation_token": "optional-token-if-invited"
}

// Response (Success)
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "John Doe"
  },
  "message": "Registration successful. Please check your email to verify."
}

// Response (Error)
{
  "success": false,
  "error": "Email already registered"
}
```

#### POST `/auth/login`
**Purpose**: Authenticate user and create session

```javascript
// Request
POST /auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "SecureP@ssw0rd"
}

// Response (Success - Single Org)
{
  "success": true,
  "redirect": "/dashboard",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "John Doe",
    "organization": {
      "id": "org-uuid",
      "name": "Example Organization",
      "role": "owner"
    }
  }
}

// Response (Success - Multiple Orgs)
{
  "success": true,
  "redirect": "/auth/select-org",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "John Doe",
    "organizations": [
      { "id": "org1-uuid", "name": "Org 1", "role": "owner" },
      { "id": "org2-uuid", "name": "Org 2", "role": "member" }
    ]
  }
}

// Response (Error)
{
  "success": false,
  "error": "Invalid email or password"
}
```

#### GET `/auth/select-org`
**Purpose**: Show organization selector for multi-org users

```javascript
// Renders organization selector page with:
// - List of user's organizations
// - Role in each organization
// - Last accessed timestamp
```

#### POST `/auth/select-org`
**Purpose**: Set active organization in session

```javascript
// Request
POST /auth/select-org
Content-Type: application/json

{
  "organization_id": "org-uuid"
}

// Response
{
  "success": true,
  "redirect": "/dashboard",
  "organization": {
    "id": "org-uuid",
    "name": "Example Organization",
    "role": "member"
  }
}
```

#### POST `/auth/logout`
**Purpose**: Destroy session and sign out

```javascript
// Request
POST /auth/logout

// Response
{
  "success": true,
  "redirect": "/auth/login"
}
```

#### POST `/auth/forgot-password`
**Purpose**: Send password reset email

```javascript
// Request
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}

// Response
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### POST `/auth/reset-password`
**Purpose**: Reset password using token

```javascript
// Request
POST /auth/reset-password
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "password": "NewSecureP@ssw0rd"
}

// Response
{
  "success": true,
  "message": "Password reset successful"
}
```

### User Management Routes (`/admin/users/*`)

#### GET `/admin/users`
**Purpose**: List all users in organization
**Auth**: Requires `org_admin` or `owner` role

```javascript
// Response
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "member",
      "joined_at": "2025-01-15T10:30:00Z",
      "last_login": "2025-10-12T14:20:00Z",
      "invitation_status": "accepted"
    },
    // ... more users
  ],
  "total": 15,
  "limit": 50
}
```

#### POST `/admin/users/invite`
**Purpose**: Invite new user to organization
**Auth**: Requires `org_admin` or `owner` role

```javascript
// Request
POST /admin/users/invite
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "member",
  "permissions": {
    "can_edit_sections": true,
    "can_create_suggestions": true
  }
}

// Response (Success)
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "email": "newuser@example.com",
    "token": "invitation-token",
    "expires_at": "2025-10-19T00:00:00Z"
  },
  "message": "Invitation sent to newuser@example.com"
}

// Response (Error - User Limit)
{
  "success": false,
  "error": "Organization has reached user limit (50 users)"
}
```

#### DELETE `/admin/users/:userId`
**Purpose**: Remove user from organization
**Auth**: Requires `org_admin` or `owner` role

```javascript
// Request
DELETE /admin/users/abc-123-uuid

// Response (Success)
{
  "success": true,
  "message": "User removed from organization"
}

// Response (Error - Cannot Remove Owner)
{
  "success": false,
  "error": "Cannot remove organization owner"
}
```

#### PUT `/admin/users/:userId/role`
**Purpose**: Change user's role
**Auth**: Requires `owner` role (only owner can promote to org_admin)

```javascript
// Request
PUT /admin/users/abc-123-uuid/role
Content-Type: application/json

{
  "role": "org_admin"
}

// Response (Success)
{
  "success": true,
  "user": {
    "id": "abc-123-uuid",
    "email": "user@example.com",
    "role": "org_admin"
  }
}

// Response (Error - Insufficient Permissions)
{
  "success": false,
  "error": "Only owner can promote users to org_admin"
}
```

#### PUT `/admin/users/:userId/permissions`
**Purpose**: Update user's custom permissions
**Auth**: Requires `org_admin` or `owner` role

```javascript
// Request
PUT /admin/users/abc-123-uuid/permissions
Content-Type: application/json

{
  "permissions": {
    "can_edit_sections": false,
    "can_approve_stages": ["committee_review"]
  }
}

// Response
{
  "success": true,
  "user": {
    "id": "abc-123-uuid",
    "email": "user@example.com",
    "permissions": {
      "can_edit_sections": false,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee_review"],
      "can_manage_users": false,
      "can_manage_workflows": false
    }
  }
}
```

### Session Routes (`/api/session/*`)

#### GET `/api/session/current`
**Purpose**: Get current session info

```javascript
// Response
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Example Organization",
    "slug": "example-organization",
    "role": "member"
  },
  "permissions": {
    "can_edit_sections": true,
    "can_create_suggestions": true,
    // ... other permissions
  }
}
```

#### POST `/api/session/switch-org`
**Purpose**: Switch active organization

```javascript
// Request
POST /api/session/switch-org
Content-Type: application/json

{
  "organization_id": "other-org-uuid"
}

// Response
{
  "success": true,
  "organization": {
    "id": "other-org-uuid",
    "name": "Other Organization",
    "role": "org_admin"
  }
}
```

---

## Security Model

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Users get minimum permissions needed
3. **Session Security**: Secure cookies, HTTPS, CSRF protection
4. **JWT Security**: Short-lived tokens with refresh mechanism
5. **RLS Enforcement**: Database-level access control
6. **Audit Logging**: Track all authentication events

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. TRANSPORT LAYER                                          │
│     - HTTPS only (TLS 1.2+)                                  │
│     - Secure cookies (httpOnly, secure, sameSite)            │
│     - HSTS headers                                           │
│                                                               │
│  2. AUTHENTICATION LAYER                                     │
│     - Supabase Auth (bcrypt password hashing)                │
│     - JWT tokens (RS256 signing)                             │
│     - Token expiry (1 hour access, 7 day refresh)            │
│     - Magic link option (passwordless)                       │
│                                                               │
│  3. SESSION LAYER                                            │
│     - Express session with signed cookies                    │
│     - Session store (Redis recommended for prod)             │
│     - 24-hour session expiry                                 │
│     - CSRF protection                                        │
│                                                               │
│  4. AUTHORIZATION LAYER                                      │
│     - Role-based access control (RBAC)                       │
│     - Permission checks before actions                       │
│     - Helper functions: requireAuth, requireRole             │
│                                                               │
│  5. DATABASE LAYER (RLS)                                     │
│     - Row-level security policies                            │
│     - auth.uid() checks                                      │
│     - Organization-scoped queries                            │
│     - Audit trail in section_workflow_states                 │
│                                                               │
│  6. APPLICATION LAYER                                        │
│     - Input validation (email, password strength)            │
│     - Rate limiting (login attempts)                         │
│     - SQL injection prevention (parameterized queries)       │
│     - XSS protection (CSP headers)                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Password Policy

```javascript
// Password Requirements
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true  // No email/name in password
};

// Example validation
function validatePassword(password, user) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain a special character');
  }

  if (password.toLowerCase().includes(user.email.split('@')[0].toLowerCase())) {
    errors.push('Password cannot contain your email');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Rate Limiting

```javascript
// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// Login rate limiting (5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again in 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

// Registration rate limiting (3 per hour per IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many registration attempts, please try again later'
});

// API rate limiting (100 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please slow down'
});

// Apply to routes
app.post('/auth/login', loginLimiter, loginHandler);
app.post('/auth/register', registerLimiter, registerHandler);
app.use('/api/', apiLimiter);
```

### Audit Logging

```sql
-- Create audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),

  event_type VARCHAR(50) NOT NULL,
  -- 'login', 'logout', 'register', 'invite_user', 'remove_user',
  -- 'role_change', 'permission_change', 'password_reset'

  ip_address INET,
  user_agent TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_type ON audit_logs(event_type, created_at DESC);

-- Trigger to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, organization_id, event_type, metadata)
  VALUES (
    NEW.user_id,
    NEW.organization_id,
    TG_ARGV[0],
    jsonb_build_object(
      'old_value', to_jsonb(OLD),
      'new_value', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_organizations
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE OF role ON user_organizations
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_auth_event('role_change');
```

---

## RLS Policies

### Updated Policies with auth.uid()

The existing RLS policies need to be updated to use `auth.uid()` instead of `USING (true)`.

```sql
-- ============================================================================
-- ENHANCED RLS POLICIES WITH SUPABASE AUTH
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users see own organizations" ON organizations;
DROP POLICY IF EXISTS "Users see own organization documents" ON documents;
DROP POLICY IF EXISTS "Users see sections in accessible documents" ON document_sections;
DROP POLICY IF EXISTS "Users see suggestions in accessible documents" ON suggestions;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

-- Users can only see organizations they belong to
CREATE POLICY "auth_users_see_own_orgs"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Only owners can update organization settings
CREATE POLICY "auth_owners_update_orgs"
  ON organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role = 'owner'
    )
  );

-- Only owners can delete organizations
CREATE POLICY "auth_owners_delete_orgs"
  ON organizations
  FOR DELETE
  USING (
    id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role = 'owner'
    )
  );

-- ============================================================================
-- USERS
-- ============================================================================

-- Users can see their own record
CREATE POLICY "auth_users_see_self"
  ON users
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "auth_users_update_self"
  ON users
  FOR UPDATE
  USING (auth_user_id = auth.uid());

-- ============================================================================
-- USER_ORGANIZATIONS
-- ============================================================================

-- Users can see their own memberships
CREATE POLICY "auth_users_see_own_memberships"
  ON user_organizations
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Org admins can see all members in their orgs
CREATE POLICY "auth_admins_see_org_members"
  ON user_organizations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role IN ('owner', 'org_admin')
    )
  );

-- Org admins can add users (INSERT)
CREATE POLICY "auth_admins_add_users"
  ON user_organizations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role IN ('owner', 'org_admin')
    )
    AND role != 'owner' -- Cannot create new owners
  );

-- Owners can promote users to org_admin
CREATE POLICY "auth_owners_promote_users"
  ON user_organizations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role = 'owner'
    )
  )
  WITH CHECK (
    role != 'owner' -- Cannot change owner role
  );

-- Org admins can remove non-owner users
CREATE POLICY "auth_admins_remove_users"
  ON user_organizations
  FOR DELETE
  USING (
    role != 'owner' -- Cannot remove owner
    AND organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role IN ('owner', 'org_admin')
    )
  );

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

-- Users can see documents in their organizations
CREATE POLICY "auth_users_see_org_documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Members with permission can create documents
CREATE POLICY "auth_users_create_documents"
  ON documents
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'org_admin')
        OR (uo.permissions->>'can_edit_sections')::boolean = true
      )
    )
  );

-- ============================================================================
-- DOCUMENT_SECTIONS
-- ============================================================================

-- Users can see sections in accessible documents
CREATE POLICY "auth_users_see_sections"
  ON document_sections
  FOR SELECT
  USING (
    document_id IN (
      SELECT d.id
      FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Users with permission can edit sections
CREATE POLICY "auth_users_edit_sections"
  ON document_sections
  FOR UPDATE
  USING (
    document_id IN (
      SELECT d.id
      FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'org_admin')
        OR (uo.permissions->>'can_edit_sections')::boolean = true
      )
    )
  );

-- ============================================================================
-- SUGGESTIONS
-- ============================================================================

-- Users can see suggestions in accessible documents
CREATE POLICY "auth_users_see_suggestions"
  ON suggestions
  FOR SELECT
  USING (
    document_id IN (
      SELECT d.id
      FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Users with permission can create suggestions
CREATE POLICY "auth_users_create_suggestions"
  ON suggestions
  FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT d.id
      FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'org_admin', 'member')
        OR (uo.permissions->>'can_create_suggestions')::boolean = true
      )
    )
  );

-- Users can edit their own suggestions
CREATE POLICY "auth_users_edit_own_suggestions"
  ON suggestions
  FOR UPDATE
  USING (
    author_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Users can delete their own suggestions
CREATE POLICY "auth_users_delete_own_suggestions"
  ON suggestions
  FOR DELETE
  USING (
    author_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Org admins can delete any suggestion in their org
CREATE POLICY "auth_admins_delete_org_suggestions"
  ON suggestions
  FOR DELETE
  USING (
    document_id IN (
      SELECT d.id
      FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND uo.role IN ('owner', 'org_admin')
    )
  );

-- ============================================================================
-- SUGGESTION_VOTES
-- ============================================================================

-- Users can see votes in accessible documents
CREATE POLICY "auth_users_see_votes"
  ON suggestion_votes
  FOR SELECT
  USING (
    suggestion_id IN (
      SELECT s.id
      FROM suggestions s
      JOIN documents d ON s.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Users with permission can vote
CREATE POLICY "auth_users_vote"
  ON suggestion_votes
  FOR INSERT
  WITH CHECK (
    suggestion_id IN (
      SELECT s.id
      FROM suggestions s
      JOIN documents d ON s.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN users u ON uo.user_id = u.id
      WHERE u.auth_user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'org_admin', 'member')
        OR (uo.permissions->>'can_vote')::boolean = true
      )
    )
  );

-- Users can update their own votes
CREATE POLICY "auth_users_update_own_votes"
  ON suggestion_votes
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTION FOR RLS
-- ============================================================================

-- Get user's app user_id from auth.uid()
CREATE OR REPLACE FUNCTION get_app_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has role in organization
CREATE OR REPLACE FUNCTION user_has_org_role(
  p_org_id UUID,
  p_roles VARCHAR[]
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_organizations uo
    JOIN users u ON uo.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
    AND uo.organization_id = p_org_id
    AND uo.role = ANY(p_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has permission in organization
CREATE OR REPLACE FUNCTION user_has_org_permission(
  p_org_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_organizations uo
    JOIN users u ON uo.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
    AND uo.organization_id = p_org_id
    AND (
      uo.role IN ('owner', 'org_admin')
      OR (uo.permissions->>p_permission)::boolean = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### RLS Testing Queries

```sql
-- Test RLS policies with different users

-- 1. Test as superuser (owner of Org A)
SET request.jwt.claims.sub = 'auth-user-uuid-superuser';

-- Should see only Org A
SELECT * FROM organizations;

-- Should see only Org A's documents
SELECT * FROM documents;

-- Should see only Org A's users
SELECT * FROM user_organizations WHERE organization_id = 'org-a-uuid';

-- 2. Test as member of Org B
SET request.jwt.claims.sub = 'auth-user-uuid-member-b';

-- Should see only Org B
SELECT * FROM organizations;

-- Should NOT see Org A's documents
SELECT * FROM documents;

-- Should NOT be able to add users to Org A
INSERT INTO user_organizations (user_id, organization_id, role)
VALUES ('new-user-uuid', 'org-a-uuid', 'member'); -- Should fail

-- 3. Test as org_admin of Org B
SET request.jwt.claims.sub = 'auth-user-uuid-admin-b';

-- Can add member to Org B
INSERT INTO user_organizations (user_id, organization_id, role)
VALUES ('new-user-uuid', 'org-b-uuid', 'member'); -- Should succeed

-- Cannot promote to org_admin (only owner can)
UPDATE user_organizations
SET role = 'org_admin'
WHERE user_id = 'member-uuid' AND organization_id = 'org-b-uuid'; -- Should fail

-- 4. Reset
RESET request.jwt.claims.sub;
```

---

## Implementation Roadmap

### Phase 1: Database Schema (Week 1)

**Tasks:**
1. Add `auth_user_id` column to `users` table
2. Add invitation tracking columns to `user_organizations`
3. Create `user_invitations` table
4. Create helper functions (`user_has_permission`, etc.)
5. Create audit logging table and triggers
6. Update RLS policies to use `auth.uid()`
7. Test RLS policies with mock auth.uid() values

**Deliverables:**
- Migration script: `006_add_authentication.sql`
- Test script: `tests/rls_auth_tests.sql`

**Memory Storage:**
```bash
npx claude-flow@alpha hooks post-edit --file "database/migrations/006_add_authentication.sql" --memory-key "auth/migrations/phase1"
```

### Phase 2: Authentication Routes (Week 2)

**Tasks:**
1. Create `/src/routes/auth.js` with all auth endpoints
2. Create `/src/middleware/auth.js` with auth middleware
3. Implement login/logout/register handlers
4. Implement JWT refresh logic
5. Add rate limiting to auth routes
6. Create EJS templates for login/register/org-selector
7. Add CSRF protection

**Deliverables:**
- `/src/routes/auth.js`
- `/src/middleware/auth.js`
- `/views/auth/login.ejs`
- `/views/auth/register.ejs`
- `/views/auth/select-org.ejs`

**Memory Storage:**
```bash
npx claude-flow@alpha hooks post-edit --file "src/routes/auth.js" --memory-key "auth/routes/implementation"
```

### Phase 3: User Management (Week 3)

**Tasks:**
1. Create `/src/routes/admin.js` with user management endpoints
2. Implement user invitation flow
3. Create email templates for invitations
4. Build user management UI (`/views/admin/users.ejs`)
5. Add role/permission management endpoints
6. Implement audit logging for user actions

**Deliverables:**
- `/src/routes/admin.js`
- `/views/admin/users.ejs`
- `/views/admin/invite-user.ejs`
- Email templates

**Memory Storage:**
```bash
npx claude-flow@alpha hooks post-edit --file "src/routes/admin.js" --memory-key "auth/admin/implementation"
```

### Phase 4: Session Integration (Week 4)

**Tasks:**
1. Update `server.js` to include auth middleware
2. Update existing routes to use `req.userId`, `req.organizationId`
3. Replace `req.supabase` with `req.supabaseAuth` (authenticated client)
4. Update dashboard to show user info and logout button
5. Add organization switcher to header
6. Test all existing features with authentication

**Deliverables:**
- Updated `server.js`
- Updated dashboard with auth UI
- Integration tests

**Memory Storage:**
```bash
npx claude-flow@alpha hooks post-edit --file "server.js" --memory-key "auth/integration/complete"
```

### Phase 5: Setup Wizard Integration (Week 5)

**Tasks:**
1. Add superuser creation step to setup wizard
2. Update `/setup/success` to create first user account
3. Link organization owner to Supabase Auth user
4. Test complete setup flow with authentication
5. Add migration path for existing installations

**Deliverables:**
- Updated setup wizard
- Superuser creation flow
- Migration guide for existing users

**Memory Storage:**
```bash
npx claude-flow@alpha hooks post-edit --file "src/routes/setup.js" --memory-key "auth/setup/integration"
```

### Phase 6: Testing & Documentation (Week 6)

**Tasks:**
1. Write unit tests for auth routes
2. Write integration tests for multi-tenant isolation
3. Write security tests (XSS, CSRF, SQL injection)
4. Load testing (session handling under load)
5. Update developer documentation
6. Create user documentation (login, user management)
7. Security audit and penetration testing

**Deliverables:**
- Test suite (90%+ coverage)
- Security audit report
- User documentation
- Developer documentation

**Memory Storage:**
```bash
npx claude-flow@alpha hooks post-task --task-id "auth-testing-complete"
```

---

## Migration Path for Existing Installations

### For New Installations
1. Run setup wizard → Creates organization
2. After setup → Prompt to create superuser account
3. Superuser registers with Supabase Auth
4. Superuser can now manage users

### For Existing Installations (No Auth)
1. Run migration script `006_add_authentication.sql`
2. System prompts admin to create superuser account
3. Superuser email must be provided
4. Superuser registers through special `/auth/initialize` route
5. Link superuser to existing organization as owner
6. Superuser can now add additional users

```sql
-- Migration helper: Link existing organization to first user
CREATE OR REPLACE FUNCTION initialize_superuser(
  p_email VARCHAR,
  p_organization_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Create user record (will be linked to auth.users after registration)
  INSERT INTO users (email, name)
  VALUES (p_email, 'Superuser')
  RETURNING id INTO v_user_id;

  -- Link to organization as owner
  INSERT INTO user_organizations (user_id, organization_id, role, invitation_status)
  VALUES (v_user_id, p_organization_id, 'owner', 'accepted');

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Success Metrics

### Technical Metrics
- **Authentication Success Rate**: > 99%
- **Session Persistence**: 24 hours without issues
- **JWT Refresh Success**: > 99.5%
- **RLS Performance**: < 50ms query overhead
- **API Response Time**: < 200ms (p95)

### Security Metrics
- **Zero Password Breaches**: Bcrypt hashing, no plaintext storage
- **Zero Cross-Org Data Leaks**: RLS enforcement working
- **Rate Limiting Effective**: Block brute force attacks
- **Audit Log Coverage**: 100% of auth events logged

### User Experience Metrics
- **Login Time**: < 2 seconds (p95)
- **Invitation Acceptance Rate**: > 80%
- **User Management Actions**: < 5 clicks to add user
- **Session Stability**: < 1% unexpected logouts

---

## Appendix

### Environment Variables

```bash
# .env (add these new variables)

# Existing Supabase vars
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Session management
SESSION_SECRET=your-session-secret-at-least-32-chars
SESSION_STORE=memory  # or 'redis' for production

# Redis (if using Redis session store)
REDIS_URL=redis://localhost:6379

# Email (for invitations and password reset)
EMAIL_PROVIDER=sendgrid  # or 'mailgun', 'ses'
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM=noreply@yourdomain.com

# App URL
APP_URL=https://yourdomain.com

# Rate limiting
RATE_LIMIT_LOGIN=5  # attempts per 15 minutes
RATE_LIMIT_REGISTER=3  # attempts per hour
RATE_LIMIT_API=100  # requests per minute

# Security
BCRYPT_ROUNDS=10
JWT_EXPIRY=3600  # 1 hour in seconds
REFRESH_TOKEN_EXPIRY=604800  # 7 days in seconds
```

### Supabase Dashboard Configuration

1. **Enable Email Auth**:
   - Go to Authentication → Providers
   - Enable Email provider
   - Configure email templates

2. **Configure JWT Settings**:
   - Go to Settings → API
   - Note JWT Secret (auto-generated)
   - Set JWT expiry (3600 seconds recommended)

3. **Enable RLS**:
   - Already enabled in schema
   - Verify in Database → Tables → Check RLS column

4. **Configure Email Templates**:
   - Authentication → Email Templates
   - Customize: Confirm Signup, Reset Password, Magic Link

### Supabase Client Configuration

```javascript
// src/config/supabase.js

const { createClient } = require('@supabase/supabase-js');

// Anon client (for public operations)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Service client (for admin operations, bypass RLS)
const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Authenticated client factory (creates client with user JWT)
function createAuthenticatedClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
}

module.exports = {
  supabaseAnon,
  supabaseService,
  createAuthenticatedClient
};
```

---

## Conclusion

This authentication architecture provides:

1. **Secure Authentication**: Supabase Auth with bcrypt hashing, JWT tokens, and session management
2. **Multi-Tenant Isolation**: RLS policies with `auth.uid()` ensure data separation
3. **Flexible User Management**: Superuser, org admins, members, and viewers with RBAC
4. **Backward Compatibility**: Works with existing Express session flow and setup wizard
5. **Scalability**: Supports up to 50 users per organization across 99+ organizations
6. **Audit Trail**: Complete logging of authentication events and user actions

The design balances security, usability, and maintainability while providing a solid foundation for future enhancements like OAuth, 2FA, and SSO integration.

---

**Next Steps**: Proceed with Phase 1 implementation (Database Schema) upon approval.
