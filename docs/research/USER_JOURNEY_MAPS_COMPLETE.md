# Complete User Journey Maps - Bylaws Amendment Tracker

**Research Date:** 2025-10-27
**Researcher:** Hive Mind Research Agent
**Purpose:** Comprehensive user journey documentation for all user types

---

## Table of Contents

1. [Global Admin User Journey](#global-admin-user-journey)
2. [Organization Owner User Journey](#organization-owner-user-journey)
3. [Organization Member User Journey](#organization-member-user-journey)
4. [Organization Viewer User Journey](#organization-viewer-user-journey)
5. [Navigation Audit](#navigation-audit)
6. [UX Improvement Recommendations](#ux-improvement-recommendations)

---

## Global Admin User Journey

### User Profile
- **Role:** Global Administrator (system-wide access)
- **Permissions:** Full system access across ALL organizations
- **Badge:** 🛡️ "Global Admin" (red badge)
- **Database:** `users.is_global_admin = true`

### Entry Points
1. **Login:** `/auth/login` → Authentication
2. **Auto-redirect:** → `/auth/select` (organization selection)

### Primary Navigation Flow

#### 1. Organization Selection (`/auth/select`)
```
/auth/select
├─ View: ALL organizations in system (not just joined ones)
├─ Actions:
│  ├─ Select any organization → Sets session.organizationId
│  ├─ Create new organization (if enabled)
│  └─ Switch between organizations at will
└─ Destination: /dashboard (with selected org context)
```

#### 2. Dashboard (`/dashboard`)
```
/dashboard
├─ Stats Cards (4):
│  ├─ Total Documents
│  ├─ Active Sections
│  ├─ Pending Suggestions
│  └─ Approval Progress
├─ Recent Documents Table
│  └─ Click → /dashboard/documents/:id (document viewer)
├─ Recent Suggestions Feed
│  └─ Filter: All | Open | Rejected
└─ Top Bar:
   ├─ "Global Admin" badge (visible)
   ├─ Organization name badge
   ├─ Export button (enabled)
   ├─ New Document button (enabled)
   └─ User dropdown:
      ├─ Profile → /auth/profile
      ├─ Switch Organization → /auth/select
      └─ Logout → /auth/logout
```

#### 3. Sidebar Navigation
```
Sidebar (always visible on desktop)
├─ Management Section:
│  ├─ Organization Settings → /admin/organization
│  └─ Users → /admin/users
└─ Resources Section:
   ├─ Reports (disabled, "Coming soon")
   ├─ Analytics (disabled, "Coming soon")
   └─ Help → #help
```

#### 4. Admin Routes (Full Access)

**A. Organization Settings (`/admin/organization`)**
```
/admin/organization
├─ View: ALL organizations user has admin access to
├─ For each organization:
│  ├─ View details → /admin/organization/:id
│  ├─ Edit settings
│  └─ Configure hierarchy
└─ Actions:
   ├─ Update organization details
   ├─ Manage hierarchy configuration
   └─ Delete organization (with confirmation)
```

**B. User Management (`/admin/users`)**
```
/admin/users
├─ View: All users in current organization
├─ User Table:
│  ├─ Email
│  ├─ Full Name
│  ├─ Role (owner, admin, member, viewer)
│  ├─ Status (active/inactive)
│  └─ Last Active
└─ Actions:
   ├─ Invite new users
   ├─ Change user roles
   ├─ Deactivate users
   └─ Remove users from organization
```

**C. Document Upload (`/admin/documents/upload`)**
```
POST /admin/documents/upload
├─ Upload .docx, .doc, .txt, .md files
├─ Max size: 10MB
├─ Process:
│  ├─ Parse document structure
│  ├─ Detect hierarchy
│  ├─ Create sections
│  └─ Auto-complete setup
└─ Success → Redirect to dashboard with new document
```

**D. Hierarchy Editor (`/admin/documents/:docId/hierarchy-editor`)**
```
/admin/documents/:docId/hierarchy-editor
├─ View current hierarchy (document or org default)
├─ Templates available:
│  ├─ Standard Bylaws (Article > Section > Subsection...)
│  ├─ Legal Document (Chapter > Section > Clause...)
│  ├─ Policy Manual (Part > Section > Paragraph...)
│  └─ Technical Standard (Numeric: 1.1.1.1...)
├─ Actions:
│  ├─ Edit 10-level hierarchy
│  ├─ Apply template
│  ├─ Save document-specific override
│  └─ Reset to organization default
└─ API Endpoints:
   ├─ GET /admin/documents/:docId/hierarchy
   ├─ PUT /admin/documents/:docId/hierarchy
   └─ DELETE /admin/documents/:docId/hierarchy (reset)
```

**E. Section Management (`/admin/sections/...`)**
```
Admin Section Operations:
├─ GET /admin/documents/:docId/sections/tree
│  └─ Returns hierarchical section tree
├─ PUT /admin/sections/:id/retitle
│  └─ Change section title and/or number
├─ DELETE /admin/sections/:id
│  ├─ RESTRICTION: Admins CANNOT delete sections (403)
│  └─ Only edit/move operations allowed
├─ PUT /admin/sections/:id/move
│  └─ Move section to different parent or reorder
├─ POST /admin/sections/:id/split
│  └─ Split section into two at character position
├─ POST /admin/sections/join
│  └─ Join multiple adjacent sections
├─ POST /admin/sections/:id/indent
│  └─ Make section child of previous sibling
├─ POST /admin/sections/:id/dedent
│  └─ Make section sibling of current parent
├─ POST /admin/sections/:id/move-up
│  └─ Swap with previous sibling
└─ POST /admin/sections/:id/move-down
   └─ Swap with next sibling
```

**F. Workflow Management (`/admin/workflows`)**
```
/admin/workflows
├─ View workflow templates
├─ Create new workflow → /admin/workflows/create
├─ Edit workflow → /admin/workflows/:id/edit
└─ Assign to document → /admin/documents/:docId/assign-workflow
```

#### 5. Document Viewer (`/dashboard/documents/:documentId`)
```
/dashboard/documents/:documentId
├─ Document metadata (title, type, dates)
├─ Table of Contents (hierarchical, collapsible)
├─ Section list with:
│  ├─ Section number
│  ├─ Section title
│  ├─ Lock status (🔒 if locked)
│  ├─ Suggestion count badge
│  └─ Current text vs Original text toggle
├─ Expand section → Shows:
│  ├─ Original text (read-only)
│  ├─ Current text (editable by admins)
│  ├─ Suggestions (lazy-loaded via AJAX)
│  └─ Action buttons:
│     ├─ Lock to Original Text (admin)
│     ├─ Edit Section (admin)
│     ├─ Create Suggestion (enabled)
│     └─ Approve/Reject Suggestions (admin)
└─ Top Bar:
   ├─ Back to Dashboard
   ├─ Export PDF/DOCX
   └─ Edit Structure (admin) → Hierarchy Editor
```

### Unique Global Admin Capabilities
1. **Cross-Organization Access:** Can view and manage ANY organization
2. **No User Organization Required:** Bypasses `user_organizations` table checks
3. **All Routes Accessible:** Can access any `/admin/*` route regardless of organization membership
4. **Upload Documents:** Can upload documents to any organization
5. **No Delete Restrictions:** Cannot delete sections (same restriction as org admins)

### Dead Ends / Missing Links
1. **No Dashboard Return:** Document viewer needs "Back to Dashboard" breadcrumb
2. **No Admin Dashboard:** `/admin/dashboard` exists but not linked in sidebar
3. **Profile Page:** `/auth/profile` exists but functionality unclear

---

## Organization Owner User Journey

### User Profile
- **Role:** Organization Owner (highest org-level access)
- **Permissions:** Full control over their organization
- **Badge:** ⭐ "Owner" (yellow badge)
- **Database:** `user_organizations.role_id` → `organization_roles.role_code = 'owner'`

### Entry Points
1. **Login:** `/auth/login` → Authentication
2. **Auto-redirect:**
   - If user belongs to 1 organization → `/dashboard` (auto-select)
   - If user belongs to multiple orgs → `/auth/select`

### Navigation Flow

#### 1. Organization Selection (if multiple orgs)
```
/auth/select
├─ View: Only organizations user is member of
├─ Filter by role:
│  ├─ Owner
│  ├─ Admin
│  ├─ Member
│  └─ Viewer
└─ Select organization → /dashboard
```

#### 2. Dashboard (Same as Global Admin)
```
/dashboard
├─ "Owner" badge visible (⭐)
├─ Organization context badge
├─ All admin features enabled:
│  ├─ Export (enabled)
│  ├─ New Document (enabled)
│  └─ Full sidebar access
└─ Same functionality as Global Admin WITHIN their organization
```

#### 3. Admin Capabilities (Organization-Scoped)

**Identical to Global Admin but limited to their organization:**
- ✅ Organization Settings (`/admin/organization`)
- ✅ User Management (`/admin/users`)
- ✅ Document Upload (`/admin/documents/upload`)
- ✅ Hierarchy Editor (for org documents)
- ✅ Section Management (all operations)
- ✅ Workflow Management
- ❌ Cannot delete sections (same restriction)

### Permissions Breakdown (from `organization_roles`)
```sql
Role: owner (hierarchy_level: 4)
Permissions:
├─ can_create_suggestions: ✅
├─ can_edit_sections: ✅
├─ can_approve_suggestions: ✅
├─ can_reject_suggestions: ✅
├─ can_lock_sections: ✅
├─ can_manage_users: ✅
├─ can_configure_organization: ✅
├─ can_manage_workflows: ✅
└─ can_vote: ✅
```

### Key Differences from Global Admin
1. **Organization-Scoped:** Can only manage their assigned organization(s)
2. **User Organization Required:** Must have `user_organizations` record
3. **Multiple Orgs Possible:** Can be owner of multiple organizations
4. **Same UI/UX:** Identical interface to Global Admin within scope

---

## Organization Member User Journey

### User Profile
- **Role:** Organization Member (standard user)
- **Permissions:** Can view, suggest, and vote
- **Badge:** None (default user)
- **Database:** `user_organizations.role_id` → `organization_roles.role_code = 'member'`

### Entry Points
Same as Organization Owner

### Navigation Flow

#### 1. Dashboard
```
/dashboard
├─ No "Owner" or "Admin" badge
├─ Organization context badge visible
├─ Limited sidebar:
│  ├─ ❌ Organization Settings (hidden)
│  ├─ ❌ Users (hidden)
│  └─ Resources section (Help only)
├─ Buttons:
│  ├─ Export (enabled)
│  └─ New Document (enabled if member can upload)
└─ Stats cards visible
```

#### 2. Document Viewer
```
/dashboard/documents/:documentId
├─ Can view all sections
├─ Can expand sections
├─ Section actions:
│  ├─ ✅ Create Suggestion
│  ├─ ✅ Vote on Suggestions
│  ├─ ❌ Lock to Original Text (admin only)
│  ├─ ❌ Edit Section (admin only)
│  ├─ ❌ Approve Suggestions (admin only)
│  └─ ❌ Reject Suggestions (admin only)
└─ Cannot access:
   ├─ ❌ Hierarchy Editor
   ├─ ❌ Section Management API
   └─ ❌ Workflow Assignment
```

### Permissions Breakdown
```sql
Role: member (hierarchy_level: 2)
Permissions:
├─ can_create_suggestions: ✅
├─ can_edit_sections: ❌
├─ can_approve_suggestions: ❌
├─ can_reject_suggestions: ❌
├─ can_lock_sections: ❌
├─ can_manage_users: ❌
├─ can_configure_organization: ❌
├─ can_manage_workflows: ❌
└─ can_vote: ✅
```

### Member-Specific Features
1. **Suggestion Creation:** Full access to create suggestions
2. **Voting:** Can vote on suggestions (if enabled)
3. **Document Viewing:** Full read access to all documents
4. **No Admin Routes:** All `/admin/*` routes return 403

### UX Considerations
- **Reduced clutter:** Cleaner interface with no admin options
- **Clear capabilities:** Buttons disabled with tooltips explaining why
- **Guidance:** "Contact admin to upgrade" messages

---

## Organization Viewer User Journey

### User Profile
- **Role:** Organization Viewer (read-only)
- **Permissions:** View-only access
- **Badge:** 👁️ "Viewer" (blue badge)
- **Database:** `user_organizations.role_id` → `organization_roles.role_code = 'viewer'`

### Entry Points
Same as other org users

### Navigation Flow

#### 1. Dashboard
```
/dashboard
├─ "Viewer" badge visible (👁️)
├─ Alert banner: "View-Only Access"
│  └─ Message: "Contact administrator to upgrade access"
├─ Sidebar:
│  ├─ ❌ Organization Settings (hidden)
│  ├─ ❌ Users (hidden)
│  └─ Resources section (Help only)
├─ Buttons:
│  ├─ Export (DISABLED with tooltip)
│  └─ New Document (DISABLED with tooltip)
└─ Stats cards visible (read-only)
```

#### 2. Document Viewer
```
/dashboard/documents/:documentId
├─ Can view all sections
├─ Can expand sections (read-only)
├─ All action buttons DISABLED:
│  ├─ ❌ Create Suggestion (disabled, tooltip)
│  ├─ ❌ Vote on Suggestions (disabled)
│  ├─ ❌ Lock/Edit/Approve/Reject (all disabled)
│  └─ Tooltips explain: "Viewers cannot create suggestions"
└─ Can view suggestions (read-only)
```

### Permissions Breakdown
```sql
Role: viewer (hierarchy_level: 1)
Permissions:
├─ can_create_suggestions: ❌
├─ can_edit_sections: ❌
├─ can_approve_suggestions: ❌
├─ can_reject_suggestions: ❌
├─ can_lock_sections: ❌
├─ can_manage_users: ❌
├─ can_configure_organization: ❌
├─ can_manage_workflows: ❌
└─ can_vote: ❌
```

### Viewer-Specific UX
1. **Alert Banner:** Prominent "View-Only Access" message on dashboard
2. **Disabled UI:** All action buttons disabled with helpful tooltips
3. **Clear messaging:** "Contact admin to upgrade access"
4. **Read-only indicators:** Visual cues for non-interactive elements

---

## Navigation Audit

### Available Routes

#### Authentication Routes (`/auth`)
```
✅ /auth/login - Login page
✅ /auth/register - Registration page
✅ /auth/logout - Logout (clears session)
✅ /auth/select - Organization selection
✅ /auth/profile - User profile page
✅ /auth/forgot-password - Password reset request
✅ /auth/reset-password - Password reset form
✅ /auth/accept-invite - Accept organization invitation
```

#### Dashboard Routes (`/dashboard`)
```
✅ /dashboard - Main dashboard (home)
✅ /dashboard/overview - Statistics API (JSON)
✅ /dashboard/documents - Documents list API (JSON)
✅ /dashboard/documents/:documentId - Document viewer
✅ /dashboard/document/:documentId - Document viewer (alias)
✅ /dashboard/sections - Sections list API (JSON)
✅ /dashboard/sections/:sectionId - Section details API (JSON)
✅ /dashboard/sections/:sectionId/navigation - Navigation API (JSON)
✅ /dashboard/suggestions - Suggestions list API (JSON)
✅ /dashboard/suggestions/count - Suggestion count API (JSON)
✅ /dashboard/activity - Activity feed API (JSON)
✅ /dashboard/documents/:documentId/toc - Table of contents API (JSON)
```

#### Admin Routes (`/admin`)
```
✅ /admin/dashboard - Admin dashboard (organizations overview)
✅ /admin/organization - Organization settings page
✅ /admin/organization/:id - Organization detail page
✅ /admin/users - User management page
✅ /admin/workflows - Workflow templates list
✅ /admin/workflows/create - Create workflow template
✅ /admin/workflows/:id/edit - Edit workflow template
✅ /admin/documents/upload - Upload document (POST)
✅ /admin/documents/:docId/assign-workflow - Assign workflow page
✅ /admin/documents/:docId/hierarchy - Get hierarchy config (API)
✅ /admin/documents/:docId/hierarchy - Update hierarchy (PUT API)
✅ /admin/documents/:docId/hierarchy - Reset hierarchy (DELETE API)
✅ /admin/documents/:docId/hierarchy-editor - Hierarchy editor page
✅ /admin/hierarchy-templates - Pre-built templates (API)
✅ /admin/documents/:docId/sections/tree - Section tree (API)
✅ /admin/sections/:id/retitle - Rename section (PUT API)
✅ /admin/sections/:id - Delete section (DELETE API)
✅ /admin/sections/:id/move - Move section (PUT API)
✅ /admin/sections/:id/split - Split section (POST API)
✅ /admin/sections/join - Join sections (POST API)
✅ /admin/sections/:id/indent - Indent section (POST API)
✅ /admin/sections/:id/dedent - Dedent section (POST API)
✅ /admin/sections/:id/move-up - Move section up (POST API)
✅ /admin/sections/:id/move-down - Move section down (POST API)
```

### Navigation Issues Found

#### 1. Missing Breadcrumbs
- **Document Viewer:** No breadcrumb to return to dashboard
- **Admin Pages:** No breadcrumb trail for sub-pages
- **Section Management:** No context of parent document

#### 2. Broken Links
- **Reports:** Disabled with "Coming soon" (correct)
- **Analytics:** Disabled with "Coming soon" (correct)
- **Help:** Points to `#help` (anchor only, no page)

#### 3. Dead Ends
- **Profile Page:** `/auth/profile` exists but UI unclear
- **Admin Dashboard:** `/admin/dashboard` not linked in sidebar
- **Organization Detail:** `/admin/organization/:id` only accessible via click

#### 4. Inconsistent Navigation
- **Document Viewer:** Two routes for same page (`/document/:id` and `/documents/:id`)
- **API vs Pages:** Mix of HTML pages and JSON APIs on same routes
- **Sidebar:** Only shows subset of available admin features

#### 5. Mobile Navigation
- **Sidebar:** Transforms to hamburger menu on mobile (good)
- **Tables:** Responsive but may need horizontal scroll
- **Modals:** Work well on mobile

---

## UX Improvement Recommendations

### Priority 1: Critical Navigation Improvements

#### 1.1 Add Breadcrumb Navigation
```html
<!-- Document Viewer -->
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li class="breadcrumb-item"><a href="/dashboard">Dashboard</a></li>
    <li class="breadcrumb-item active">{{ document.title }}</li>
  </ol>
</nav>

<!-- Admin Pages -->
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li class="breadcrumb-item"><a href="/dashboard">Dashboard</a></li>
    <li class="breadcrumb-item"><a href="/admin/organization">Organizations</a></li>
    <li class="breadcrumb-item active">{{ org.name }}</li>
  </ol>
</nav>
```

#### 1.2 Implement Persistent Back Button
```javascript
// Add to all sub-pages
<button onclick="history.back()" class="btn btn-outline-secondary">
  <i class="bi bi-arrow-left"></i> Back
</button>
```

#### 1.3 Complete Help System
```
Create /dashboard/help page with:
├─ User guide sections
├─ FAQ
├─ Video tutorials
├─ Contact support
└─ Role-specific help content
```

### Priority 2: Document Navigation UX

#### 2.1 Collapsible Table of Contents Sidebar
```javascript
Implement persistent TOC sidebar:
├─ Fixed position on left (collapsible)
├─ Sticky scroll with current section highlight
├─ Click to jump to section
├─ Collapse/expand all buttons
└─ Search/filter sections
```

**Design Pattern Reference:**
- **VS Code Explorer:** Tree view with expand/collapse
- **GitHub File Tree:** Sticky navigation with collapse
- **Notion:** Nested page tree with smooth scroll

#### 2.2 Section Navigation Improvements
```javascript
Add to each section:
├─ Persistent section number anchor
├─ "Copy link to section" button
├─ Previous/Next section buttons
├─ "Jump to parent" button
└─ Mini-TOC showing siblings
```

#### 2.3 Lazy Loading with Progress Indicator
```javascript
Current: All sections loaded upfront
Proposed: Virtual scrolling with loading indicator

Implementation:
├─ Load first 10 sections
├─ Scroll triggers next batch
├─ Progress indicator at bottom
└─ "Load all" option for search/export
```

### Priority 3: Mobile-First Improvements

#### 3.1 Responsive Sidebar
```css
Mobile (<768px):
├─ Hamburger menu (existing)
├─ Slide-out drawer
├─ Swipe gesture to close
└─ Touch-friendly tap targets

Tablet (768px-1024px):
├─ Collapsible sidebar (icon only)
├─ Expand on hover
└─ Toggle button

Desktop (>1024px):
├─ Always visible
└─ Resizable width
```

#### 3.2 Mobile Document Viewer
```javascript
Optimizations:
├─ Single column layout
├─ Touch-friendly expand/collapse
├─ Bottom sheet for suggestion modal
├─ Swipe between sections
└─ Floating action button for new suggestion
```

### Priority 4: Accessibility Enhancements

#### 4.1 ARIA Labels and Keyboard Navigation
```html
<!-- All interactive elements -->
<button aria-label="Expand section" aria-expanded="false">
  <span aria-hidden="true">▶</span>
</button>

<!-- Keyboard shortcuts -->
<div role="region" aria-label="Document sections">
  <kbd>Tab</kbd> Navigate
  <kbd>Space</kbd> Expand/Collapse
  <kbd>Ctrl+F</kbd> Search
</div>
```

#### 4.2 Screen Reader Support
```javascript
Announce dynamic content changes:
├─ "Section expanded" when clicked
├─ "X suggestions loaded" after AJAX
├─ "Document saved" after actions
└─ Error messages in alert role
```

### Priority 5: Visual Feedback and Loading States

#### 5.1 Loading Skeletons
```css
Replace spinners with skeleton screens:
├─ Dashboard: Skeleton cards
├─ Document list: Skeleton rows
├─ Suggestions: Skeleton items
└─ Smooth fade-in when loaded
```

#### 5.2 Optimistic UI Updates
```javascript
Apply changes immediately, rollback on error:
├─ Section expand: Instant expand with loading content
├─ Vote: Instant count update
├─ Suggestion: Instant add to list
└─ Toast notification on save
```

### Priority 6: Search and Filter

#### 6.1 Global Search
```
Add search bar to top nav:
├─ Search documents by title
├─ Search sections by content
├─ Search suggestions by author/text
├─ Recent searches
└─ Keyboard shortcut (Ctrl+K)
```

#### 6.2 Advanced Filters
```
Document list filters:
├─ By document type
├─ By status (draft, approved, locked)
├─ By date range
├─ By author
└─ By suggestion count
```

### Priority 7: User Onboarding

#### 7.1 First-Time User Experience
```
Interactive tour for new users:
├─ Welcome modal
├─ Highlight key features (tooltips)
├─ Interactive walkthrough
├─ Role-specific guidance
└─ Skip/Dismiss option
```

#### 7.2 Contextual Help
```
In-page help tooltips:
├─ Hover for quick tip
├─ Click for detailed help
├─ Video tutorials inline
└─ "Learn more" links to docs
```

### Priority 8: Error Pages and States

#### 8.1 Custom Error Pages
```
Create branded error pages:
├─ 404: Not Found
│  ├─ Helpful message
│  ├─ Search box
│  └─ Links to common pages
├─ 403: Forbidden
│  ├─ Explain why access denied
│  ├─ Link to contact admin
│  └─ Link to upgrade request
└─ 500: Server Error
   ├─ Friendly apology
   ├─ Report error button
   └─ Link to status page
```

#### 8.2 Empty States
```
Improve empty state messages:
├─ Documents: "Upload your first document"
├─ Suggestions: "No suggestions yet. Be the first!"
├─ Users: "Invite team members to collaborate"
└─ Include clear CTA button
```

---

## Implementation Recommendations

### Phase 1: Critical Navigation (Week 1)
1. Add breadcrumbs to all pages
2. Fix Help link (create help page)
3. Add "Back to Dashboard" buttons
4. Fix document viewer route inconsistency

### Phase 2: Document Navigation (Week 2)
1. Implement collapsible TOC sidebar
2. Add section navigation controls
3. Optimize for mobile viewing
4. Add lazy loading for large documents

### Phase 3: Search and Filters (Week 3)
1. Global search functionality
2. Advanced document filters
3. Section content search
4. Suggestion search

### Phase 4: Polish and Accessibility (Week 4)
1. ARIA labels and keyboard nav
2. Loading skeletons
3. Error pages
4. User onboarding tour

---

## Research Methodology

### Data Sources
1. **Route Analysis:** Server.js + all route files
2. **Middleware Analysis:** Permissions + authentication
3. **View Files:** All EJS templates
4. **Database Schema:** Migration files + RPC functions
5. **Client Scripts:** Dashboard.js + interactive components

### Tools Used
- Code reading (Read tool)
- Pattern matching (Grep tool)
- File discovery (Glob tool)
- Cross-referencing routes to views

---

## Conclusion

The application has a solid foundation with clear user role separation and comprehensive admin capabilities. Key improvements needed:

1. **Navigation clarity:** Breadcrumbs and context
2. **Document UX:** Collapsible TOC and section navigation
3. **Mobile optimization:** Touch-friendly controls
4. **Accessibility:** ARIA labels and keyboard support
5. **Error handling:** Better error pages and empty states

All findings stored in coordination memory for Queen Seraphina and other agents.

---

**Report End**
Research complete. Awaiting Queen's review and architect's design decisions.
