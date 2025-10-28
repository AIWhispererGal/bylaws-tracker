# Express Middleware Execution Chain Research Report

**Research Agent**: Hive Researcher
**Task ID**: task-1761597709635-8goa48kx9
**Date**: 2025-10-27
**Objective**: Document Express.js middleware execution order and verify `attachGlobalAdminStatus` integration

---

## Executive Summary

**CRITICAL FINDING**: `attachGlobalAdminStatus` middleware **IS CORRECTLY POSITIONED** in the global middleware chain at line 234 of `server.js`, executing BEFORE all protected routes.

The middleware chain is properly configured and should provide `req.isGlobalAdmin` to all downstream routes including `/admin/*`.

---

## Middleware Execution Order (server.js)

### Phase 1: Pre-Route Setup (Lines 27-70)
1. **Session middleware** (line 27-36)
   - Initializes Express sessions
   - Session data available via `req.session`

2. **Body parsers** (lines 39-41)
   - `express.json()` - Parse JSON bodies
   - `express.urlencoded()` - Parse form data
   - `express.static()` - Serve static files

3. **CSRF protection** (lines 44-55)
   - Conditional CSRF middleware
   - Skips `/bylaws/api/`, `/api/`, `/auth/`, `/admin/`, `/setup/`

4. **CORS headers** (lines 58-63)
   - Sets Access-Control headers

### Phase 2: Supabase Authentication (Lines 77-177)
5. **Authenticated Supabase middleware**
   - Creates `req.supabase` (authenticated client with JWT from session)
   - Creates `req.supabaseService` (service role client, bypasses RLS)
   - Handles JWT refresh automatically

### Phase 3: Application Routes (Lines 224-261)

6. **Setup routes** (line 225-226)
   ```javascript
   app.use('/setup', setupRoutes);
   ```

7. **Auth routes** (line 229-230)
   ```javascript
   app.use('/auth', authRoutes);
   ```

8. **✅ GLOBAL ADMIN STATUS MIDDLEWARE** (line 234) **← CRITICAL**
   ```javascript
   app.use(attachGlobalAdminStatus);
   ```
   **Effect**: ALL routes after this line have access to:
   - `req.isGlobalAdmin` (boolean)
   - `req.accessibleOrganizations` (array)

9. **Organization context middleware** (line 238-239)
   ```javascript
   app.use(attachOrganizationContext);
   ```
   **Effect**: Sets `res.locals.currentOrganization` and `res.locals.currentUser`

10. **Admin routes** (line 242-243)
    ```javascript
    app.use('/admin', adminRoutes);
    ```
    ✅ Has access to `req.isGlobalAdmin`

11. **Dashboard routes** (line 246-248)
    ```javascript
    app.use('/dashboard', dashboardRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    ```

12. **User management routes** (line 251-252)
    ```javascript
    app.use('/api/users', usersRoutes);
    ```

13. **Approval workflow routes** (line 255-256)
    ```javascript
    app.use('/api/approval', approvalRoutes);
    ```

14. **Workflow management routes** (line 259-260)
    ```javascript
    app.use('/api/workflow', workflowRoutes);
    ```

### Phase 4: Setup Detection (Lines 263-292)
15. **Setup redirect middleware**
    - Redirects to `/setup` if organization not configured
    - Allows paths: `/setup`, `/auth`, `/admin`, `/dashboard`, `/api/`

---

## Middleware Files Analyzed

### 1. `/src/middleware/globalAdmin.js`
**Purpose**: Provides global admin functionality and status checking

**Exports**:
- `isGlobalAdmin(req)` - Async function, queries `users` table
- `getAccessibleOrganizations(req)` - Returns all orgs for global admins
- `attachGlobalAdminStatus(req, res, next)` - **THE CRITICAL MIDDLEWARE**
- `requireGlobalAdmin(req, res, next)` - Route guard middleware

**Key Implementation** (lines 101-110):
```javascript
async function attachGlobalAdminStatus(req, res, next) {
  if (req.session?.userId) {
    req.isGlobalAdmin = await isGlobalAdmin(req);
    req.accessibleOrganizations = await getAccessibleOrganizations(req);
  } else {
    req.isGlobalAdmin = false;
    req.accessibleOrganizations = [];
  }
  next();
}
```

**Database Query** (lines 17-32):
- Queries `users` table directly (NOT `user_organizations`)
- Checks `is_global_admin = true` flag
- Uses `req.supabase` client (RLS-enabled)

### 2. `/src/middleware/permissions.js`
**Purpose**: New permissions architecture (migration 024)

**Key Middleware**:
- `attachPermissions(req, res, next)` - Attaches effective permissions to request
- `requirePermission(permission, orgLevel)` - Permission-based route guard
- `requireMinRoleLevel(minLevel)` - Role level route guard
- `requireGlobalAdmin(req, res, next)` - Wrapper around `requirePermission('can_access_all_organizations')`

**Note**: This is a NEW permissions system. Some routes may still use old `globalAdmin.js` middleware.

### 3. `/src/middleware/roleAuth.js`
**Purpose**: Role-based authorization (hybrid old/new system)

**Key Features**:
- Uses BOTH new permissions system AND old `globalAdmin.isGlobalAdmin()`
- Provides role hierarchy checks: owner > admin > member > viewer
- Global admins **bypass all role checks** (line 32)

### 4. `/src/middleware/organization-context.js`
**Purpose**: Attach organization data to `res.locals` for templates

**Key Implementation** (lines 32-42):
```javascript
res.locals.currentUser = {
  id: req.session.userId,
  email: req.session.userEmail,
  name: req.session.userName || req.session.userEmail,
  role: req.session.userRole || 'viewer',
  is_global_admin: req.isGlobalAdmin || false  // ← Uses req.isGlobalAdmin!
};
```

**Dependency**: This middleware DEPENDS on `attachGlobalAdminStatus` running first to set `req.isGlobalAdmin`.

### 5. `/src/middleware/setup-required.js`
**Purpose**: Redirect to setup wizard if not configured

**Not relevant** to admin permissions - only checks if organizations exist.

---

## Admin Routes Middleware Chain

**File**: `/src/routes/admin.js`

### Route-Level Middleware Usage

1. **GET /admin/users** (line 38)
   ```javascript
   router.get('/users', requirePermission('can_manage_users', true), attachPermissions, ...)
   ```
   - Uses NEW permissions system
   - Requires `can_manage_users` permission at organization level

2. **GET /admin/dashboard** (line 154)
   ```javascript
   router.get('/dashboard', attachPermissions, ...)
   ```
   - Only attaches permissions (no guard)
   - Relies on global admin check elsewhere

3. **GET /admin/organization** (line 260)
   ```javascript
   router.get('/organization', requirePermission('can_configure_organization', true), attachPermissions, ...)
   ```
   - Uses NEW permissions system

4. **Local `requireAdmin` middleware** (lines 22-32)
   ```javascript
   function requireAdmin(req, res, next) {
     // Allow if user is org admin OR global admin
     if (!req.session.isAdmin && !req.isGlobalAdmin) {  // ← Uses req.isGlobalAdmin!
       return res.status(403).render('error', ...);
     }
     next();
   }
   ```
   **Usage**: Lines 308, 406, 445, 496, 511, 547, 629, 798, etc.

---

## Global Admin Visibility Analysis

### How Global Admin Status is Set

**Flow**:
1. User logs in → JWT stored in `req.session.supabaseJWT`
2. Supabase middleware creates authenticated client
3. `attachGlobalAdminStatus` middleware runs:
   - Queries `users` table with `req.supabase`
   - Checks `users.is_global_admin = true`
   - Sets `req.isGlobalAdmin = true/false`
4. `attachOrganizationContext` middleware runs:
   - Reads `req.isGlobalAdmin`
   - Sets `res.locals.currentUser.is_global_admin`

### Where Global Admin Status is Used

**Admin Routes** (`/src/routes/admin.js`):
- Line 24: `requireAdmin` local middleware checks `req.isGlobalAdmin`
- Line 704: Upload document - checks `!req.isGlobalAdmin` to bypass org check
- Line 1032: Hierarchy editor - checks `!req.isGlobalAdmin` to skip org verification

**Other Routes**:
- `/src/routes/dashboard.js` - May check `req.isGlobalAdmin`
- `/src/routes/users.js` - May check `req.isGlobalAdmin`

**Templates** (via `res.locals.currentUser.is_global_admin`):
- All EJS templates have access to `currentUser.is_global_admin`

---

## Permission Checking Pipeline

### Admin Route Access Flow

```
Request → Session → Supabase Auth → attachGlobalAdminStatus → attachOrganizationContext → Admin Router
                                            ↓                           ↓
                                      req.isGlobalAdmin         res.locals.currentUser.is_global_admin
                                            ↓
                                    requireAdmin middleware
                                            ↓
                              Check: req.session.isAdmin OR req.isGlobalAdmin
```

### Two Permission Systems

**Old System** (via `globalAdmin.js`):
- `req.isGlobalAdmin` - Set globally by `attachGlobalAdminStatus`
- Used by local `requireAdmin` in `admin.js`

**New System** (via `permissions.js`):
- `req.permissions` - Effective permissions object
- `req.userType` - User type from `user_types` table
- `requirePermission()` - Permission-based guards

**Hybrid Routes**: Some routes use BOTH systems for backward compatibility.

---

## Gaps and Potential Issues

### 1. ✅ NO GAP: Global Admin Middleware is Present
- `attachGlobalAdminStatus` is correctly positioned at line 234
- All admin routes have access to `req.isGlobalAdmin`

### 2. ⚠️ POTENTIAL ISSUE: Session vs Request Object
- Some routes check `req.session.isAdmin` (line 24)
- Others check `req.isGlobalAdmin` (line 24)
- **Question**: When is `req.session.isAdmin` set? Not found in middleware chain.

### 3. ⚠️ POTENTIAL ISSUE: Dual Permission Systems
- Old system: `requireAdmin` checks `req.isGlobalAdmin`
- New system: `requirePermission('can_manage_users')`
- Some routes use old system, some use new
- **Risk**: Inconsistent permission enforcement

### 4. ⚠️ CLARIFICATION NEEDED: RLS and Global Admin
- `isGlobalAdmin()` uses `req.supabase` (RLS-enabled client)
- Query: `SELECT * FROM users WHERE id = ? AND is_global_admin = true`
- **Question**: Does RLS allow users to query their own row in `users` table?
- If RLS blocks this, global admin check will always fail!

---

## Recommendations

### 1. Verify RLS Policies on `users` Table
```sql
-- Check if users can read their own row
SELECT * FROM users WHERE id = auth.uid();
```
If this fails, RLS is blocking the global admin check.

### 2. Consolidate Permission Systems
- Migrate all routes to use NEW permissions system (`requirePermission`)
- Remove old `requireAdmin` local middleware
- Standardize on `req.permissions` and `req.userType`

### 3. Add Session Logging
- Log when `req.session.isAdmin` is set (not found in current code)
- Verify session state during login

### 4. Add Debugging for Global Admin Status
```javascript
// In attachGlobalAdminStatus middleware
console.log('[GlobalAdmin] User:', req.session.userId);
console.log('[GlobalAdmin] Status:', req.isGlobalAdmin);
console.log('[GlobalAdmin] Query result:', data);
```

---

## Conclusion

**MIDDLEWARE CHAIN IS CORRECT**: The `attachGlobalAdminStatus` middleware is properly positioned in the global chain and executes before all admin routes.

**NO GAPS DETECTED** in middleware execution order.

**POTENTIAL ISSUES**:
1. RLS policies on `users` table may block global admin queries
2. Dual permission systems (old vs new) may cause inconsistencies
3. `req.session.isAdmin` source is unclear

**NEXT STEPS FOR DEBUGGING**:
1. Check RLS policies on `users` table
2. Add logging to `attachGlobalAdminStatus` to verify execution
3. Test with a known global admin user and log `req.isGlobalAdmin` value
4. Verify JWT authentication is working correctly

---

## File References

- **Server.js**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/server.js`
- **Global Admin Middleware**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/middleware/globalAdmin.js`
- **Admin Routes**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/admin.js`
- **Permissions Middleware**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/middleware/permissions.js`
- **Role Auth Middleware**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/middleware/roleAuth.js`
- **Organization Context**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/middleware/organization-context.js`

---

**Research Complete** ✅
**Memory Key**: `hive/researcher/middleware-analysis`
