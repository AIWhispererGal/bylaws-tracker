# Role Management and Approval Workflow System

## Overview

This document describes the newly implemented organization-level user management and approval workflow system for the Bylaws Amendment Tracker.

**Date:** 2025-10-13
**Version:** 1.0.0
**Status:** Completed

## Features Implemented

### 1. Enhanced User Role Management

#### Database Schema Enhancements

**New columns added to `user_organizations` table:**
- `is_active` - Boolean flag for active/inactive membership
- `invited_at` - Timestamp when user was invited
- `invited_by` - Reference to inviting user
- `last_active` - Last activity timestamp
- `is_global_admin` - Platform-wide admin flag

#### Role Hierarchy

The system implements a 4-tier role hierarchy:

1. **Owner** (Level 4)
   - Full control over organization
   - Can manage all users and workflows
   - Can assign/revoke owner role
   - Can delete organization

2. **Admin** (Level 3)
   - Can manage users (except owners)
   - Can approve workflow stages
   - Can create and edit documents
   - Can manage workflows

3. **Member** (Level 2)
   - Can create suggestions
   - Can vote on suggestions
   - Can view all content
   - Can edit sections (if permitted)

4. **Viewer** (Level 1)
   - Read-only access
   - Can view documents and suggestions
   - Cannot create or edit content

### 2. User Management API

**Base URL:** `/api/users`

#### Endpoints

**GET /api/users**
- List all users in current organization
- Returns user details, roles, and activity
- Requires: Admin role
- Response includes user limit information

**GET /api/users/:userId**
- Get detailed information for specific user
- Includes recent activity log
- Requires: Admin role

**POST /api/users/invite**
- Invite new user to organization
- Sends invitation email via Supabase Auth
- Enforces organization user limits
- Requires: Admin role
- Body:
  ```json
  {
    "email": "user@example.com",
    "name": "John Doe",
    "role": "member"
  }
  ```

**PUT /api/users/:userId/role**
- Update user's role
- Cannot change own role
- Only owners can assign owner role
- Requires: Admin role
- Body:
  ```json
  {
    "role": "admin"
  }
  ```

**PUT /api/users/:userId/permissions**
- Update user's custom permissions
- Granular permission control
- Requires: Admin role
- Body:
  ```json
  {
    "permissions": {
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["stage-uuid-1", "stage-uuid-2"],
      "can_manage_users": false,
      "can_manage_workflows": false
    }
  }
  ```

**DELETE /api/users/:userId**
- Remove user from organization (deactivate)
- Cannot remove self
- Soft delete (sets is_active = false)
- Requires: Admin role

**GET /api/users/activity/log**
- Get organization activity log
- Paginated results
- Requires: Admin role

### 3. Approval Workflow System

**Base URL:** `/api/approval`

#### Workflow Stages

The system supports configurable multi-stage approval workflows. A default 2-stage workflow is created for all organizations:

**Stage 1: Committee Review**
- Can lock sections
- Can select preferred suggestions
- Requires: Admin or Owner role

**Stage 2: Board Approval**
- Final approval stage
- Can lock sections
- Requires: Owner role

#### Endpoints

**GET /api/approval/workflow/:documentId**
- Get workflow configuration and progress
- Shows all stages and section states
- Calculates overall progress percentage
- Requires: Member role

**GET /api/approval/section/:sectionId/state**
- Get current workflow state for section
- Shows all stage approvals
- Indicates which stages user can approve
- Requires: Member role

**POST /api/approval/lock**
- Lock section at specific workflow stage
- Select preferred suggestion
- Add review notes
- Requires: Permission to approve at stage
- Body:
  ```json
  {
    "section_id": "uuid",
    "workflow_stage_id": "uuid",
    "selected_suggestion_id": "uuid",
    "notes": "Committee notes..."
  }
  ```

**POST /api/approval/approve**
- Approve/reject section at workflow stage
- Updates workflow state
- Logs action in audit trail
- Requires: Permission to approve at stage
- Body:
  ```json
  {
    "section_id": "uuid",
    "workflow_stage_id": "uuid",
    "status": "approved",
    "notes": "Approval notes..."
  }
  ```

**POST /api/approval/progress**
- Progress section to next workflow stage
- Automatically determines next stage
- Creates new workflow state
- Requires: Permission for next stage
- Body:
  ```json
  {
    "section_id": "uuid",
    "notes": "Moving to next stage..."
  }
  ```

**POST /api/approval/version**
- Create version snapshot of document
- Captures all sections and approval states
- Auto-increments version number
- Requires: Member role
- Body:
  ```json
  {
    "document_id": "uuid",
    "version_name": "Pre-Board Approval",
    "description": "Snapshot before board meeting",
    "approval_stage": "Committee Review"
  }
  ```

**GET /api/approval/versions/:documentId**
- List all versions for document
- Shows version history
- Requires: Member role

### 4. Role-Based Authorization Middleware

**Location:** `/src/middleware/roleAuth.js`

#### Functions

**hasRole(req, requiredRole)**
- Check if user has required role level
- Returns boolean

**requireOwner(req, res, next)**
- Middleware requiring owner role
- Returns 403 if not authorized

**requireAdmin(req, res, next)**
- Middleware requiring admin or owner role
- Returns 403 if not authorized

**requireMember(req, res, next)**
- Middleware requiring member+ role
- Returns 403 if not authorized

**requirePermission(permission)**
- Middleware requiring specific permission
- Checks custom permissions object
- Returns 403 if not authorized

**canApproveStage(req, stageId)**
- Check if user can approve at workflow stage
- Checks stage's required_roles against user role
- Returns boolean

**requireStageApproval(stageIdParam)**
- Middleware requiring stage approval permission
- Returns 403 if not authorized

**getUserRole(req)**
- Get user's role in current organization
- Returns role and permissions object

**attachUserRole(req, res, next)**
- Middleware to attach role to request
- Sets req.userRole

### 5. Document Versioning

**New table:** `document_versions`

**Features:**
- Snapshot of all sections at time of creation
- Snapshot of all approval workflow states
- Version numbering (auto-increment)
- Created by user tracking
- Approval stage metadata
- Published version tracking

**Fields:**
- `version_number` - Semantic version (1.0, 1.1, etc.)
- `version_name` - Human-readable name
- `description` - Version description
- `sections_snapshot` - Complete JSON snapshot
- `approval_snapshot` - Workflow states snapshot
- `created_by` - User who created version
- `approved_at` - When approved
- `is_current` - Flag for current version
- `is_published` - Flag for published version

### 6. Activity Audit Log

**New table:** `user_activity_log`

**Logged Actions:**
- user.invited
- user.role_changed
- user.permissions_changed
- user.removed
- user.reactivated
- section.locked
- section.approved
- section.rejected
- section.progressed
- document.version_created

**Fields:**
- `action_type` - Type of action
- `entity_type` - Type of entity (user, document, section)
- `entity_id` - UUID of entity
- `action_data` - JSON metadata
- `ip_address` - User IP (optional)
- `user_agent` - Browser info (optional)

### 7. User Management UI

**Location:** `/views/admin/user-management.ejs`

**Features:**
- List all organization users
- Display user roles with color-coded badges
- Show active/inactive status
- Display user limit progress bar
- Invite new users (modal dialog)
- Edit user roles (modal dialog)
- Remove users (with confirmation)
- Real-time activity indicators

**Access:** Navigate to `/admin/users`

## Database Migration

**File:** `/database/migrations/008_enhance_user_roles_and_approval.sql`

### What the Migration Does

1. Adds new columns to `user_organizations` table
2. Creates `document_versions` table
3. Creates `user_activity_log` table
4. Adds approval metadata column to `section_workflow_states`
5. Creates helper functions:
   - `user_has_role(user_id, org_id, role)`
   - `user_can_approve_stage(user_id, stage_id)`
6. Updates RLS policies for new tables
7. Creates default 2-stage workflow for existing organizations

### Running the Migration

```sql
-- Run in Supabase SQL Editor
\i database/migrations/008_enhance_user_roles_and_approval.sql
```

Or execute the SQL file contents directly in the Supabase dashboard.

## Integration with Existing System

### Server.js Updates

Added route imports:
```javascript
const usersRoutes = require('./src/routes/users');
app.use('/api/users', usersRoutes);

const approvalRoutes = require('./src/routes/approval');
app.use('/api/approval', approvalRoutes);
```

### Backward Compatibility

The system maintains backward compatibility with existing features:
- Old `locked_by_committee` field still works
- Old `board_approved` field still works
- New workflow system runs alongside old system
- Gradual migration path available

## Security Considerations

### Row Level Security (RLS)

All new tables have RLS enabled:
- Users can only see data in their organizations
- Service role bypasses RLS for admin operations
- Authenticated users get organization-scoped access

### Authorization Checks

- All API endpoints require authentication
- Role-based middleware enforces permissions
- Workflow stage permissions checked per user
- Cannot modify own role/permissions
- Owner-only actions protected

### Audit Trail

- All user management actions logged
- All approval workflow actions logged
- Logs include user, timestamp, and metadata
- Immutable audit log (no updates/deletes)

## Testing Recommendations

### User Management Tests

1. **Invite User**
   - Test user limit enforcement
   - Test duplicate email handling
   - Test invitation email sending
   - Test role assignment

2. **Role Changes**
   - Test role hierarchy enforcement
   - Test cannot change own role
   - Test owner-only actions
   - Test permission inheritance

3. **User Removal**
   - Test soft delete (deactivation)
   - Test cannot remove self
   - Test audit log creation

### Approval Workflow Tests

1. **Workflow Progress**
   - Test stage progression
   - Test permission checks
   - Test section locking
   - Test suggestion selection

2. **Multi-Stage Approval**
   - Test 2-stage workflow
   - Test stage-specific permissions
   - Test approval status tracking
   - Test rejection handling

3. **Document Versioning**
   - Test version creation
   - Test snapshot accuracy
   - Test version numbering
   - Test version listing

## API Usage Examples

### Invite a User

```javascript
fetch('/api/users/invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    name: 'John Doe',
    role: 'member'
  })
})
.then(res => res.json())
.then(data => console.log(data.message));
```

### Lock Section with Suggestion

```javascript
fetch('/api/approval/lock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    section_id: 'section-uuid',
    workflow_stage_id: 'stage-uuid',
    selected_suggestion_id: 'suggestion-uuid',
    notes: 'Committee selected this version'
  })
})
.then(res => res.json())
.then(data => console.log('Locked:', data.message));
```

### Create Document Version

```javascript
fetch('/api/approval/version', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    document_id: 'doc-uuid',
    version_name: 'Pre-Board Meeting',
    description: 'Version before board approval',
    approval_stage: 'Committee Review'
  })
})
.then(res => res.json())
.then(data => console.log('Version:', data.version.version_number));
```

## Future Enhancements

### Potential Improvements

1. **Email Notifications**
   - Send notifications on role changes
   - Alert users of approval progress
   - Notify on invitation acceptance

2. **Advanced Permissions**
   - Document-level permissions
   - Section-level permissions
   - Custom permission templates

3. **Workflow Templates**
   - Pre-built workflow templates
   - Custom workflow builder UI
   - Conditional workflow branching

4. **Reporting**
   - User activity reports
   - Approval workflow analytics
   - Performance metrics dashboard

5. **Bulk Operations**
   - Bulk user imports
   - Bulk role assignments
   - Bulk section approvals

## Support and Troubleshooting

### Common Issues

**Issue:** User limit reached
- **Solution:** Upgrade organization plan or remove inactive users

**Issue:** Cannot approve at stage
- **Solution:** Check user role and stage required_roles

**Issue:** Invitation not received
- **Solution:** Check email address, spam folder, Supabase Auth logs

**Issue:** Cannot change user role
- **Solution:** Ensure you're not changing your own role, check permission level

### Debug Mode

Enable detailed logging:
```javascript
// In server.js or route files
process.env.DEBUG_MODE = 'true';
```

## Contact and Support

For questions or issues with the role management and approval workflow system:
- Check documentation in `/docs` directory
- Review code comments in implementation files
- Check Supabase logs for database errors
- Review browser console for client-side errors

---

**Implementation Status:** ✅ Complete
**Testing Status:** ⏳ Pending
**Documentation Status:** ✅ Complete
