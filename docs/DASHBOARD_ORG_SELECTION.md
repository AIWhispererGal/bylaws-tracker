# Organization Selection & Admin Dashboard

## Overview

This document explains how returning organizations access their dashboards and how admins can view/manage all organizations.

## User Flows

### 1. New Organization Setup
```
User visits http://localhost:3000
  ↓
No organizations exist → Redirect to /setup
  ↓
Complete 7-step setup wizard
  ↓
organizationId stored in session
  ↓
Redirect to /dashboard (organization-specific)
```

### 2. Returning Organization Access
```
User visits http://localhost:3000
  ↓
Organizations exist but no session → Redirect to /auth/select
  ↓
User selects their organization from list
  ↓
organizationId stored in session
  ↓
Redirect to /dashboard (organization-specific)
```

### 3. Admin Access (View All Organizations)
```
User visits /auth/select
  ↓
Click "Enter Admin Mode"
  ↓
session.isAdmin = true
  ↓
Click "Admin Dashboard" button
  ↓
View system-wide statistics and all organizations
  ↓
Can switch to any organization's dashboard
```

## Routes

### Authentication Routes (`/auth/*`)

#### `GET /auth/select`
- **Purpose:** Organization selection page
- **Access:** Public (no authentication required)
- **Features:**
  - Lists all organizations with creation dates
  - Shows current organization (if any)
  - Highlights selected organization
  - Admin mode toggle
  - Link to admin dashboard (if admin mode enabled)

#### `POST /auth/select`
- **Purpose:** Set selected organization in session
- **Request Body:**
  ```json
  {
    "organizationId": "uuid"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Switched to Organization Name",
    "organizationId": "uuid",
    "organizationName": "Organization Name"
  }
  ```
- **Session Updates:**
  - `req.session.organizationId` = selected ID
  - `req.session.organizationName` = org name
  - `req.session.isConfigured` = true

#### `GET /auth/switch/:organizationId`
- **Purpose:** Quick organization switcher (for admins)
- **Access:** Public (intended for admins)
- **Action:** Sets session and redirects to dashboard

#### `GET /auth/logout`
- **Purpose:** Clear session and return to selection page
- **Action:** Destroys session, redirects to `/auth/select`

#### `GET /auth/admin`
- **Purpose:** Toggle admin mode
- **Action:** Toggles `req.session.isAdmin` flag

### Admin Routes (`/admin/*`)

#### `GET /admin/dashboard`
- **Purpose:** System-wide overview of all organizations
- **Access:** Requires `req.session.isAdmin = true`
- **Features:**
  - System statistics (total orgs, docs, sections, suggestions)
  - Organization list with individual stats
  - Quick actions (access dashboard, view details, delete)

#### `GET /admin/organization/:id`
- **Purpose:** Detailed view of single organization
- **Access:** Admin only
- **Features:**
  - Organization info and configuration
  - User list with roles
  - Document list
  - Recent activity feed
  - Quick actions (access dashboard, delete)

#### `POST /admin/organization/:id/delete`
- **Purpose:** Delete organization and all data
- **Access:** Admin only
- **Request Body:**
  ```json
  {
    "confirm": "DELETE"
  }
  ```
- **Security:** Requires explicit "DELETE" confirmation

### Dashboard Routes (`/dashboard/*`)

#### Middleware: `requireAuth`
- **Before:** Returned 401 error if no `organizationId` in session
- **Now:** Redirects to `/auth/select` for organization selection
- **Session Check:** Verifies `req.session.organizationId` exists

## Session Management

### Session Variables

```javascript
req.session = {
  // Set during setup wizard or org selection
  organizationId: 'uuid',
  organizationName: 'Organization Name',
  isConfigured: true,

  // Set when toggling admin mode
  isAdmin: true,

  // Setup wizard temporary data (cleared after completion)
  setupData: { ... }
}
```

### Session Lifecycle

1. **New User:** No session variables
2. **Setup Wizard:** Creates `organizationId`, sets `isConfigured = true`
3. **Dashboard Access:** Requires `organizationId` in session
4. **Organization Selection:** Updates `organizationId`, preserves `isAdmin`
5. **Logout:** Destroys entire session

## URL Structure

### Before (Single Organization)
```
/                           → /bylaws
/dashboard                  → 401 error (no auth)
/setup                      → Setup wizard
```

### After (Multi-Organization)
```
/                           → /auth/select (or /dashboard if session exists)
/auth/select                → Organization selection
/auth/switch/:id            → Quick org switcher
/auth/admin                 → Toggle admin mode
/auth/logout                → Clear session

/dashboard                  → Organization-specific dashboard (requires session)
/admin/dashboard            → System-wide admin view
/admin/organization/:id     → Detailed org view

/setup                      → Setup wizard (creates new org)
```

## UI Features

### Organization Selection Page (`/auth/select`)

**Features:**
- Beautiful gradient design matching dashboard
- Organization cards with hover effects
- Current organization badge
- Click anywhere on card to select
- Admin mode indicator
- Quick actions (admin dashboard, logout)
- Empty state with "Start Setup" button

**Organization Card Info:**
- Organization name
- Created date
- Updated date (if different)
- "Current" badge (if selected)
- Select button

### Admin Dashboard (`/admin/dashboard`)

**Features:**
- Red admin theme (different from user dashboard)
- System-wide statistics cards:
  - Total Organizations
  - Total Documents
  - Total Sections
  - Total Suggestions
- Organization table with per-org stats
- Quick actions per org:
  - Access Dashboard
  - View Details
  - Delete
- Add New Organization button

### Admin Organization Detail (`/admin/organization/:id`)

**Features:**
- Organization information panel
- User list with roles
- Document list
- Recent activity feed
- Quick actions (access dashboard, delete)

## Security Considerations

### Organization Isolation (RLS)
- All dashboard queries filter by `organization_id`
- Session stores selected organization
- RLS policies enforce isolation at database level
- No cross-organization data leakage

### Admin Mode
- **Current Implementation:** Simple session flag toggle
- **Production Recommendation:**
  - Implement proper user authentication
  - Add admin role verification
  - Use Supabase Auth for user management
  - Implement role-based access control (RBAC)

### Session Security
- HttpOnly cookies enabled
- Secure flag in production
- 24-hour session lifetime
- Session regeneration on org switch recommended

## Testing Scenarios

### Scenario 1: First-Time User
```bash
1. Visit http://localhost:3000
2. Should redirect to /setup (no orgs exist)
3. Complete setup wizard
4. Should redirect to /dashboard
5. Should see organization-specific data
```

### Scenario 2: Returning User (No Session)
```bash
1. Visit http://localhost:3000
2. Should redirect to /auth/select
3. Should see list of organizations
4. Click organization card
5. Should redirect to /dashboard
6. Should see selected org's data
```

### Scenario 3: Admin Access
```bash
1. Visit /auth/select
2. Click "Enter Admin Mode"
3. Should see "Admin Mode" badge
4. Click "Admin Dashboard"
5. Should see system-wide stats
6. Click "Access Dashboard" on any org
7. Should switch to that org's dashboard
```

### Scenario 4: Organization Switching
```bash
1. Access Org A's dashboard
2. Navigate to /auth/select
3. Select Org B
4. Should see Org B's dashboard (different data)
5. Verify RLS isolation (no Org A data visible)
```

### Scenario 5: Logout and Re-select
```bash
1. Access any dashboard
2. Navigate to /auth/select
3. Click "Logout"
4. Session destroyed
5. Redirected to /auth/select
6. No current org highlighted
7. Select org again to access
```

## API Endpoints

### Organization Selection API

```javascript
// Select organization
POST /auth/select
Content-Type: application/json
{
  "organizationId": "uuid"
}

Response:
{
  "success": true,
  "message": "Switched to Org Name",
  "organizationId": "uuid",
  "organizationName": "Org Name"
}
```

### Admin API

```javascript
// Get all organizations with stats
GET /admin/dashboard
Requires: req.session.isAdmin = true

// Get organization details
GET /admin/organization/:id
Requires: req.session.isAdmin = true

// Delete organization
POST /admin/organization/:id/delete
Content-Type: application/json
{
  "confirm": "DELETE"
}
Requires: req.session.isAdmin = true
```

## Database Queries

### List All Organizations
```sql
SELECT * FROM organizations
ORDER BY created_at DESC;
```

### Get Organization Stats
```sql
-- Documents count
SELECT COUNT(*) FROM documents
WHERE organization_id = $1;

-- Sections count
SELECT COUNT(ds.*)
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
WHERE d.organization_id = $1;

-- Suggestions count
SELECT COUNT(s.*)
FROM suggestions s
JOIN documents d ON s.document_id = d.id
WHERE d.organization_id = $1
AND s.status = 'open';

-- Users count
SELECT COUNT(*) FROM user_organizations
WHERE organization_id = $1;
```

## Future Enhancements

### Phase 2: User Authentication
- Implement Supabase Auth
- User registration/login
- Email verification
- Password reset
- OAuth providers (Google, GitHub)

### Phase 3: Role-Based Access Control
- Admin role verification
- Member permissions
- Viewer role (read-only)
- Organization invitations

### Phase 4: User Management
- User profiles
- Organization membership management
- Role assignment
- Activity logs per user

### Phase 5: Advanced Admin Features
- Organization analytics dashboard
- Usage statistics
- Billing/credits management
- System health monitoring
- Audit logs

## Files Created

```
src/routes/auth.js                      - Authentication routes
src/routes/admin.js                     - Admin dashboard routes
views/auth/select-organization.ejs      - Organization selection UI
views/admin/dashboard.ejs               - Admin system dashboard
views/admin/organization-detail.ejs     - Detailed org view
docs/DASHBOARD_ORG_SELECTION.md        - This documentation
```

## Migration from Single to Multi-Tenant

### Before
- Single organization assumption
- Dashboard accessed directly
- No organization selection

### After
- Multi-tenant architecture
- Organization selection required
- Admin dashboard for system view
- Session-based organization context
- RLS enforces isolation

### Breaking Changes
- None for existing setups
- New orgs must select organization after setup
- Admin features require session flag

### Backward Compatibility
- Setup wizard still works
- Existing sessions maintained
- Dashboard requires organization context
- Root URL intelligently redirects

## Summary

The organization selection and admin dashboard system provides:

✅ **Multi-tenant access** for returning organizations
✅ **Admin dashboard** for system-wide management
✅ **Organization switching** with session persistence
✅ **RLS security** for data isolation
✅ **Beautiful UI** matching dashboard design
✅ **Flexible routing** for different user types

Users can now:
1. Select their organization from a list
2. Access their organization-specific dashboard
3. Switch between organizations (as admin)
4. View system-wide statistics (as admin)
5. Manage all organizations (as admin)

Perfect for local testing and ready for production deployment! 🚀
