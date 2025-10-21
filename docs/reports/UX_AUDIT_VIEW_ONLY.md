# UX Audit: View-Only User Journey

**Date:** 2025-10-15
**Auditor:** QA Testing Agent
**Scope:** Complete user experience for users with view-only/viewer role
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

This audit reveals **significant UX deficiencies** that make the view-only user experience confusing, frustrating, and potentially misleading. While some access controls are properly implemented in the backend, the frontend provides insufficient visual feedback and fails to set appropriate expectations.

### Critical Findings
- ❌ **No role-specific onboarding or welcome messaging**
- ❌ **Limited visual indicators distinguishing viewer from member role**
- ⚠️ **Disabled buttons without explanatory tooltips in multiple locations**
- ⚠️ **Inconsistent permission enforcement messaging**
- ❌ **Missing "upgrade path" information**
- ✅ **Backend permission enforcement is solid (role hierarchy working)**

---

## 1. Login & Onboarding Experience

### Current State

**Login Flow:**
- ✅ Authentication works correctly (`/auth/login`)
- ✅ Organization selection works (`/auth/select-organization`)
- ❌ **NO role-specific welcome message after login**
- ❌ **NO explanation of viewer limitations**

**First-Time User Experience:**
```
User logs in → Selects organization → Lands on dashboard
                                     ↓
                           NO indication of role limitations
                           NO explanation of what "viewer" can do
                           NO guidance on how to upgrade access
```

### Issues Found

1. **Missing Role Explanation on First Login**
   - File: `views/auth/login.ejs`, `views/auth/select-organization.ejs`
   - Impact: HIGH
   - Users have no idea they're in a read-only role until they try to interact
   - No proactive messaging about role capabilities

2. **No Onboarding Guide**
   - File: Missing entirely
   - Impact: MEDIUM
   - First-time viewers don't know what they CAN do
   - No tutorial or feature highlight for read-only features

### Recommendations

```diff
+ Add role badge to organization selection screen
+ Display one-time modal on first login explaining viewer role:
  "Welcome! You have view-only access to [Organization Name].
   You can:
   • View all documents and sections
   • Read suggestions and comments
   • See workflow progress
   • Export documents (if permitted)

   To create or approve suggestions, contact your administrator."
```

---

## 2. Document Viewing Experience

### Current State

**Dashboard (`/dashboard`)**
- ✅ Shows role badge in header (lines 507-510 in `dashboard.ejs`)
- ✅ Displays viewer badge with tooltip
- ✅ "My Tasks" section loads (lines 586-636)
- ⚠️ May show tasks viewer cannot act on (confusing)

**Document Viewer (`/dashboard/document/:id`)**
- ✅ User can view all sections (lines 239-349 in `document-viewer.ejs`)
- ✅ User can expand sections and read content
- ✅ User can read suggestions (lines 516-638 in `document-viewer.ejs`)
- ❌ **"Add Suggestion" button still visible but likely non-functional**
- ⚠️ **"Track Changes" button works (good!)**

### Issues Found

1. **Suggestion Form Accessibility**
   - File: `views/dashboard/document-viewer.ejs` (lines 278-321)
   - Current: "Add Suggestion" button shown to all users
   - Impact: HIGH
   - **BROKEN EXPERIENCE**: Button appears clickable but may fail on submit
   - No pre-emptive check for viewer role before showing form

2. **Workflow Status Visibility**
   - File: `views/dashboard/document-viewer.ejs` (lines 250-268)
   - Current: ✅ Workflow badges load via JavaScript (good!)
   - Impact: LOW
   - Status badges work well for read-only viewing

3. **My Tasks Section**
   - File: `src/routes/dashboard.js` (lines 76-196)
   - Current: Shows approval tasks to ALL users
   - Impact: MEDIUM
   - Viewers see tasks like "Approve: Section X" that they cannot complete
   - **FRUSTRATING**: Tempts users with actions they cannot perform

### Recommendations

```javascript
// In document-viewer.ejs, conditionally hide suggestion form button
<% if (userPermissions && userPermissions.canSuggest) { %>
  <button class="btn btn-sm btn-primary" onclick="showSuggestionForm('<%= section.id %>')">
    <i class="bi bi-plus-circle me-1"></i>Add Suggestion
  </button>
<% } else { %>
  <div class="text-muted small">
    <i class="bi bi-info-circle me-1"></i>
    Viewing only - contact admin to suggest changes
  </div>
<% } %>
```

```javascript
// In dashboard.js, filter tasks by permissions
if (currentUser.role !== 'viewer') {
  // Show approval tasks
} else {
  // Only show "Review" tasks, not "Approve" tasks
}
```

---

## 3. Interaction Boundaries & Feedback

### Current State Analysis

**Action Buttons in Dashboard:**
```html
<!-- Lines 520-540 in dashboard.ejs -->
<button class="btn btn-outline-primary btn-sm"
  <% if (currentUser.role === 'viewer') { %>
    disabled
    data-bs-toggle="tooltip"
    title="Export feature requires member access..."
  <% } %>>
  <i class="bi bi-download me-1"></i> Export
</button>

<button class="btn btn-primary btn-sm"
  <% if (currentUser.role === 'viewer') { %>
    disabled
    data-bs-toggle="tooltip"
    title="Viewers cannot create documents..."
  <% } %>>
  <i class="bi bi-plus-lg me-1"></i> New Document
</button>
```

**Evaluation:**
- ✅ Buttons are disabled for viewers (correct)
- ✅ Tooltips explain WHY (excellent!)
- ⚠️ Tooltip mentions "upgrade your access" but no link to upgrade path
- ❌ No visual distinction beyond disabled state

### Issues Found

1. **Disabled Buttons Without Context**
   - File: Multiple locations
   - Impact: MEDIUM
   - While tooltips exist in dashboard, they're inconsistent elsewhere
   - Some disabled buttons have no explanation

2. **No "Upgrade Access" CTA**
   - File: All view templates
   - Impact: HIGH
   - Users told to "contact administrator" but no easy way to do so
   - No contact link, email, or request button

3. **Approval Action Buttons**
   - File: `views/dashboard/document-viewer.ejs` (lines 331-336)
   - Current: Hidden via JavaScript based on permissions
   - Impact: LOW
   - Good approach, but should also show WHY actions are unavailable

### Recommendations

```html
<!-- Better disabled button UX -->
<div class="action-button-group">
  <button class="btn btn-primary" disabled>
    <i class="bi bi-plus-lg me-1"></i> New Document
  </button>
  <div class="upgrade-hint">
    <i class="bi bi-lock-fill text-muted me-1"></i>
    <small class="text-muted">
      View-only access.
      <a href="#" onclick="requestUpgrade()">Request upgrade</a>
    </small>
  </div>
</div>
```

---

## 4. Information Access & Permissions

### Current State

**What Viewers CAN Access:**
- ✅ Dashboard overview statistics (`/api/dashboard/overview`)
- ✅ Document list (`/api/dashboard/documents`)
- ✅ Section content (`/api/dashboard/sections`)
- ✅ Suggestions (read-only) (`/api/dashboard/suggestions`)
- ✅ Activity feed (`/api/dashboard/activity`)
- ✅ Workflow status (`/api/workflow/sections/:id/workflow-state`)
- ✅ Approval history (`/api/workflow/sections/:id/approval-history`)

**What Viewers CANNOT Do:**
- ❌ Create suggestions (POST `/api/dashboard/suggestions`)
- ❌ Approve sections (POST `/api/workflow/sections/:id/approve`)
- ❌ Reject sections (POST `/api/workflow/sections/:id/reject`)
- ❌ Lock sections (POST `/api/workflow/sections/:id/lock`)
- ❌ Invite users (requires admin - `src/middleware/roleAuth.js`)

### Backend Permission Enforcement

**Role Hierarchy (from `roleAuth.js`):**
```javascript
const roleHierarchy = {
  'owner': 4,
  'admin': 3,
  'member': 2,
  'viewer': 1  // ← Lowest permission level
};
```

**Permission Checks:**
- ✅ `requireMember` middleware blocks viewers from member-only routes
- ✅ `requireAdmin` middleware blocks viewers from admin routes
- ✅ `hasRole()` properly checks viewer vs member vs admin

### Issues Found

1. **No Visual Feedback for Blocked API Calls**
   - File: Frontend JavaScript files
   - Impact: MEDIUM
   - When viewer tries restricted action, they get generic error
   - Should see role-specific error: "View-only users cannot perform this action"

2. **Inconsistent Error Messages**
   - File: `src/routes/workflow.js` (line 1052)
   - Current: "You do not have permission to approve at this stage"
   - Better: "Your view-only role cannot approve sections. Contact [Admin Name] to upgrade."

3. **Export Functionality Unclear**
   - File: `views/dashboard/dashboard.ejs` (line 526)
   - Current: Export button disabled for viewers
   - Question: Should viewers be able to export? (Read-only operation)
   - **RECOMMENDATION**: Allow export for viewers (helps with accessibility)

### Recommendations

```javascript
// Enhanced error handling in workflow-actions.js
async function approveSection(sectionId) {
  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes || null })
    });

    const data = await response.json();

    if (!data.success) {
      // Check if error is permission-related
      if (response.status === 403) {
        showToast('View-only users cannot approve sections. Contact your administrator to upgrade your access.', 'danger');
      } else {
        showToast('Error: ' + (data.error || 'Failed to approve section'), 'danger');
      }
    }
  } catch (error) {
    console.error('Error approving section:', error);
    showToast('An error occurred while approving the section', 'danger');
  }
}
```

---

## 5. Navigation & User Flow

### Current State

**Navigation Structure:**
```
Sidebar Menu:
├── Dashboard ✅ (accessible)
├── Documents ✅ (accessible)
├── Suggestions ❓ (likely accessible but confusing if can't create)
├── Approvals ❓ (confusing for viewers)
├── Organization Settings ⚠️ (may be accessible but read-only)
└── Users ❌ (hidden for viewers - correct!)
```

**Breadcrumbs:**
- ⚠️ No breadcrumb navigation found in templates
- Impact: MEDIUM
- Users may get lost navigating between documents

**Search:**
- ❌ No search functionality found
- Impact: LOW for viewers (fewer documents to search)

### Issues Found

1. **Confusing Menu Items**
   - File: `views/dashboard/dashboard.ejs` (lines 438-479)
   - Current: "Approvals" link shown to all users
   - Impact: MEDIUM
   - Viewers click "Approvals" expecting to see relevant content
   - May see empty state or error

2. **No Dead-End Pages**
   - Status: ✅ GOOD
   - All pages have "Back to Dashboard" link
   - Error pages exist (`views/error.ejs`)

3. **Session Persistence**
   - File: `src/routes/dashboard.js` (lines 13-58)
   - Current: ✅ Checks for organization in session
   - Redirects to org selection if missing

### Recommendations

```ejs
<!-- Conditionally show menu items based on role -->
<div class="nav-section">
  <div class="nav-section-title">Workflow</div>
  <a href="#" class="nav-link">
    <i class="bi bi-lightbulb"></i>
    <span>Suggestions</span>
  </a>
  <% if (currentUser.role !== 'viewer') { %>
    <a href="#" class="nav-link">
      <i class="bi bi-clipboard-check"></i>
      <span>Approvals</span>
    </a>
  <% } else { %>
    <a href="#" class="nav-link disabled" style="opacity: 0.5; cursor: not-allowed;">
      <i class="bi bi-clipboard-check"></i>
      <span>Approvals <small class="text-muted">(Members only)</small></span>
    </a>
  <% } %>
</div>
```

---

## 6. UX Considerations & Best Practices

### Design Philosophy Check

**Current Approach:**
- Strategy: Disable buttons + tooltips
- Pros: Clear visual indicator (grayed out)
- Cons: Feels "broken" rather than "limited by design"

**Alternative Approach:**
- Strategy: Hide unavailable actions, highlight what IS available
- Pros: Cleaner interface, less frustration
- Cons: May not understand full system capabilities

### Comparison to Industry Standards

**Best-in-Class Examples:**

1. **Google Docs (Viewer Role):**
   - ✅ Clean read-only interface
   - ✅ Prominent "Request edit access" button
   - ✅ No disabled/grayed buttons
   - ✅ Clear badge: "Viewing"

2. **GitHub (Read Access):**
   - ✅ Can view all content
   - ✅ Clear message: "You're viewing a read-only version"
   - ✅ Fork/clone options still available
   - ✅ No confusing disabled buttons

3. **Notion (Read-Only):**
   - ✅ Export functionality available
   - ✅ Comment viewing enabled
   - ✅ Clean UI without disabled actions
   - ✅ Upgrade prompt in settings

**Our Implementation vs Best Practices:**

| Feature | Google Docs | GitHub | Notion | **Our App** |
|---------|-------------|--------|--------|-------------|
| Role Badge | ✅ | ✅ | ✅ | ✅ (partial) |
| Request Upgrade | ✅ | ✅ | ✅ | ❌ |
| Export for Viewers | ✅ | ✅ | ✅ | ❌ |
| Clean UI (no disabled) | ✅ | ✅ | ✅ | ❌ |
| Helpful Tooltips | ✅ | ✅ | ✅ | ⚠️ (inconsistent) |
| Share Links | ✅ | ✅ | ✅ | ❓ (unknown) |

### Accessibility Concerns

1. **Screen Reader Experience:**
   - ⚠️ Disabled buttons announce as "unavailable" but context unclear
   - ❌ No ARIA labels explaining WHY button is disabled
   - ❌ No screen-reader-friendly alternative text

2. **Keyboard Navigation:**
   - ⚠️ Tab order includes disabled buttons (confusing)
   - ✅ All clickable elements appear to be keyboard accessible

3. **Color Contrast:**
   - ✅ Role badges have good contrast
   - ⚠️ Disabled button text may have insufficient contrast (needs testing)

### Recommendations

```html
<!-- Accessibility improvements -->
<button
  class="btn btn-primary"
  disabled
  aria-label="Create new document - requires member access"
  aria-describedby="upgrade-hint">
  <i class="bi bi-plus-lg me-1"></i> New Document
</button>
<div id="upgrade-hint" class="sr-only">
  This feature requires member-level access. Contact your organization administrator to upgrade from view-only access.
</div>
```

---

## 7. Missing Features & Enhancement Opportunities

### Features That SHOULD Be Available to Viewers

1. **✅ Export Documents**
   - Current: Disabled
   - Should: Enabled (read-only operation, helps accessibility)
   - Files: `views/dashboard/dashboard.ejs`, `public/js/dashboard.js`

2. **✅ Print-Friendly Views**
   - Current: Not implemented
   - Should: Print CSS for clean document printing
   - Impact: HIGH for read-only users

3. **✅ Share Links**
   - Current: Not found
   - Should: Generate shareable read-only links
   - Impact: MEDIUM

4. **✅ Bookmark/Favorites**
   - Current: Not implemented
   - Should: Allow viewers to bookmark important sections
   - Impact: LOW

5. **✅ Search Functionality**
   - Current: Not found
   - Should: Search across documents and sections
   - Impact: MEDIUM

### Features That Should Remain Restricted

1. ❌ Create/Edit Suggestions
2. ❌ Approve/Reject Workflow Actions
3. ❌ Invite Users
4. ❌ Modify Organization Settings
5. ❌ Delete Content

---

## 8. Specific Test Scenarios & Results

### Scenario 1: First-Time Viewer Login

**Steps:**
1. User receives invitation as "viewer"
2. Clicks invitation link
3. Sets password
4. Logs in
5. Selects organization

**Expected:**
- Welcome message explaining viewer role
- Tour of available features
- Clear CTA to request upgrade

**Actual:**
- ❌ No role-specific messaging
- ❌ No onboarding
- ❌ Lands on generic dashboard

**Grade:** 🔴 **F - Fails to set expectations**

---

### Scenario 2: Attempting to Create Suggestion

**Steps:**
1. Navigate to document
2. Expand section
3. Click "Add Suggestion" button
4. Fill out form
5. Submit

**Expected:**
- Button should be hidden OR
- Form submit blocked with helpful error

**Actual:**
- ⚠️ Button MAY be visible (template shows it to all)
- ❌ No pre-check before showing form
- ❓ Likely fails on submit with generic error

**Grade:** 🟡 **D - Confusing UX, late failure**

---

### Scenario 3: Viewing Workflow Progress

**Steps:**
1. Navigate to document
2. View workflow status badges
3. Click approval history

**Expected:**
- ✅ Can see all workflow states
- ✅ Can view approval history
- ✅ Understands cannot approve

**Actual:**
- ✅ Workflow badges load correctly
- ✅ Approval history modal works
- ⚠️ No explanation of why actions are unavailable

**Grade:** 🟢 **B - Works well, minor improvements needed**

---

### Scenario 4: Attempting to Export Document

**Steps:**
1. Navigate to dashboard
2. Hover over "Export" button
3. Read tooltip

**Expected:**
- Export should work (read-only operation)
- Clear instructions if restricted

**Actual:**
- ❌ Button disabled
- ✅ Tooltip explains why
- ❓ Unclear if this restriction is necessary

**Grade:** 🟡 **C - May be over-restricted**

---

### Scenario 5: Requesting Access Upgrade

**Steps:**
1. Realize limitations of viewer role
2. Look for upgrade option
3. Contact administrator

**Expected:**
- "Request Upgrade" button in settings
- Pre-filled email to admin
- Explanation of upgrade process

**Actual:**
- ❌ No upgrade request feature
- ❌ No easy way to contact admin
- ❌ Tooltips say "contact admin" but provide no mechanism

**Grade:** 🔴 **F - No upgrade path provided**

---

## 9. Prioritized Recommendations

### 🔴 P0 - Critical (Must Fix)

1. **Add Role Onboarding**
   - Where: `views/auth/select-organization.ejs`
   - What: Show modal on first viewer login explaining capabilities
   - Why: Sets expectations, prevents confusion
   - Effort: 2-3 hours

2. **Hide Inaccessible Action Buttons**
   - Where: `views/dashboard/document-viewer.ejs`
   - What: Use `userPermissions` to conditionally show/hide
   - Why: Prevents frustration from disabled buttons
   - Effort: 3-4 hours

3. **Add "Request Upgrade" Feature**
   - Where: New component in user menu
   - What: Button that sends email to admin with upgrade request
   - Why: Provides clear path to more access
   - Effort: 4-6 hours

### 🟡 P1 - High Priority (Should Fix)

4. **Filter "My Tasks" by Role**
   - Where: `src/routes/dashboard.js` (lines 76-196)
   - What: Don't show approval tasks to viewers
   - Why: Reduces confusion about capabilities
   - Effort: 1-2 hours

5. **Enable Export for Viewers**
   - Where: `views/dashboard/dashboard.ejs`, API routes
   - What: Allow document export (read-only operation)
   - Why: Improves accessibility, standard practice
   - Effort: 2-3 hours

6. **Improve Error Messages**
   - Where: `public/js/workflow-actions.js`, API responses
   - What: Role-specific error messages with upgrade instructions
   - Why: Better UX when permission denied
   - Effort: 2-3 hours

### 🟢 P2 - Medium Priority (Nice to Have)

7. **Add Print-Friendly CSS**
   - Where: New print stylesheet
   - What: Clean print layout for documents
   - Why: Common viewer use case
   - Effort: 3-4 hours

8. **Implement Search**
   - Where: New search component
   - What: Search documents and sections
   - Why: Helps viewers find content
   - Effort: 8-12 hours

9. **Add Breadcrumb Navigation**
   - Where: All document pages
   - What: Show navigation path
   - Why: Prevents getting lost
   - Effort: 2-3 hours

### 🔵 P3 - Low Priority (Future Enhancement)

10. **Share Links Feature**
    - Effort: 6-8 hours

11. **Bookmark/Favorites**
    - Effort: 8-10 hours

12. **Accessibility Audit & Fixes**
    - Effort: 4-6 hours

---

## 10. Code Fixes & Implementation Guide

### Fix 1: Add Role Onboarding Modal

**File:** `views/dashboard/dashboard.ejs` (add after line 736)

```html
<!-- Role Onboarding Modal (show once for first-time viewers) -->
<div class="modal fade" id="viewerOnboardingModal" tabindex="-1" data-bs-backdrop="static">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header bg-info text-white">
        <h5 class="modal-title">
          <i class="bi bi-eye me-2"></i>Welcome to View-Only Access
        </h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <p class="lead">You have read-only access to <strong><%= currentOrganization.name %></strong>.</p>

        <h6 class="mt-3">What you can do:</h6>
        <ul class="list-unstyled">
          <li><i class="bi bi-check-circle text-success me-2"></i>View all documents and sections</li>
          <li><i class="bi bi-check-circle text-success me-2"></i>Read suggestions and comments</li>
          <li><i class="bi bi-check-circle text-success me-2"></i>See workflow progress and approval history</li>
          <li><i class="bi bi-check-circle text-success me-2"></i>Export documents for offline viewing</li>
        </ul>

        <h6 class="mt-3">What you cannot do:</h6>
        <ul class="list-unstyled">
          <li><i class="bi bi-x-circle text-danger me-2"></i>Create or edit suggestions</li>
          <li><i class="bi bi-x-circle text-danger me-2"></i>Approve or reject changes</li>
          <li><i class="bi bi-x-circle text-danger me-2"></i>Invite new users</li>
        </ul>

        <div class="alert alert-info mt-3">
          <i class="bi bi-info-circle me-2"></i>
          Need more access? <a href="#" onclick="requestUpgrade(); return false;"><strong>Request an upgrade</strong></a> from your administrator.
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Got it!</button>
      </div>
    </div>
  </div>
</div>

<script>
// Show modal on first login
<% if (currentUser && currentUser.role === 'viewer' && !currentUser.hasSeenOnboarding) { %>
  document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('viewerOnboardingModal'));
    modal.show();

    // Mark as seen (you'll need to implement this API endpoint)
    fetch('/api/users/mark-onboarding-seen', { method: 'POST' }).catch(console.error);
  });
<% } %>
</script>
```

---

### Fix 2: Conditional Action Button Display

**File:** `views/dashboard/document-viewer.ejs` (lines 278-282)

```html
<!-- Before (shows to all users) -->
<button class="btn btn-sm btn-primary" onclick="showSuggestionForm('<%= section.id %>')">
  <i class="bi bi-plus-circle me-1"></i>Add Suggestion
</button>

<!-- After (conditional based on permissions) -->
<% if (userPermissions && userPermissions.canSuggest) { %>
  <button class="btn btn-sm btn-primary" onclick="showSuggestionForm('<%= section.id %>')">
    <i class="bi bi-plus-circle me-1"></i>Add Suggestion
  </button>
<% } else { %>
  <div class="text-muted small fst-italic">
    <i class="bi bi-lock-fill me-1"></i>
    View-only mode -
    <a href="#" onclick="requestUpgrade(); return false;" class="text-primary">request edit access</a>
  </div>
<% } %>
```

---

### Fix 3: Request Upgrade Function

**File:** `public/js/dashboard.js` (add at end)

```javascript
/**
 * Request access upgrade from administrator
 */
async function requestUpgrade() {
  const reason = prompt('Why do you need edit access? (Optional)');

  try {
    const response = await fetch('/api/users/request-upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'General editing capabilities' })
    });

    const data = await response.json();

    if (data.success) {
      alert('Your upgrade request has been sent to the administrator. You will be notified once your access is updated.');
    } else {
      alert('Error sending upgrade request: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error requesting upgrade:', error);
    alert('An error occurred while sending your request. Please contact your administrator directly at: ' + (data.adminEmail || 'your organization administrator'));
  }
}

// Make globally available
window.requestUpgrade = requestUpgrade;
```

**Backend Route:** `src/routes/users.js` (add new endpoint)

```javascript
/**
 * POST /api/users/request-upgrade
 * Request role upgrade from viewer to member
 */
router.post('/request-upgrade', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;
    const orgId = req.session.organizationId;
    const { supabase } = req;

    // Get organization admins
    const { data: admins, error: adminError } = await supabase
      .from('user_organizations')
      .select(`
        user_id,
        users:user_id (
          id,
          email,
          full_name
        )
      `)
      .eq('organization_id', orgId)
      .in('role', ['admin', 'owner'])
      .eq('is_active', true);

    if (adminError || !admins || admins.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No administrators found for this organization'
      });
    }

    // In production, send email notification to admins
    // For now, just log the request
    console.log(`Upgrade request from ${userEmail}: ${reason}`);

    res.json({
      success: true,
      message: 'Upgrade request sent to administrators',
      adminEmail: admins[0].users.email
    });
  } catch (error) {
    console.error('Request upgrade error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### Fix 4: Filter My Tasks by Role

**File:** `src/routes/dashboard.js` (lines 115-129)

```javascript
// Before - shows all approval tasks
pendingStates?.forEach(state => {
  const section = sectionsData.find(s => s.id === state.section_id);
  if (section && section.documents) {
    myTasks.push({
      title: `Approve: ${section.section_title || section.section_number}`,
      description: `Pending in ${section.documents.title}`,
      url: `/dashboard/document/${section.document_id}#section-${section.id}`,
      type: 'Approval',
      priority: 'warning',
      icon: 'bi-clipboard-check'
    });
  }
});

// After - only show to members/admins
const userRole = req.session.userRole || 'viewer';
const isViewer = userRole === 'viewer';

pendingStates?.forEach(state => {
  const section = sectionsData.find(s => s.id === state.section_id);
  if (section && section.documents) {
    // Viewers see "Review" instead of "Approve"
    const taskType = isViewer ? 'Review' : 'Approval';
    const taskTitle = isViewer
      ? `Review: ${section.section_title || section.section_number}`
      : `Approve: ${section.section_title || section.section_number}`;

    myTasks.push({
      title: taskTitle,
      description: `${isViewer ? 'In review at' : 'Pending in'} ${section.documents.title}`,
      url: `/dashboard/document/${section.document_id}#section-${section.id}`,
      type: taskType,
      priority: isViewer ? 'info' : 'warning',
      icon: isViewer ? 'bi-eye' : 'bi-clipboard-check'
    });
  }
});
```

---

### Fix 5: Enable Export for Viewers

**File:** `views/dashboard/dashboard.ejs` (lines 522-528)

```html
<!-- Before - disabled for viewers -->
<button
  class="btn btn-outline-primary btn-sm"
  <% if (currentUser.role === 'viewer') { %>
    disabled
    data-bs-toggle="tooltip"
    title="Export feature requires member access..."
  <% } %>
>
  <i class="bi bi-download me-1"></i> Export
</button>

<!-- After - enabled for all (read-only operation) -->
<button
  class="btn btn-outline-primary btn-sm"
  onclick="exportCurrentView()"
  data-bs-toggle="tooltip"
  title="Export current view to PDF or Word"
>
  <i class="bi bi-download me-1"></i> Export
</button>
```

---

## 11. Testing Checklist

### Manual Testing Steps

**Test 1: First-Time Viewer Login**
- [ ] Create new viewer account via invitation
- [ ] Verify onboarding modal appears
- [ ] Check modal content is clear and helpful
- [ ] Verify modal dismisses and doesn't reappear

**Test 2: Dashboard Navigation**
- [ ] Verify role badge displays in header
- [ ] Check "My Tasks" section shows appropriate tasks
- [ ] Verify disabled buttons have tooltips
- [ ] Test "Request Upgrade" button functionality

**Test 3: Document Viewing**
- [ ] Navigate to document
- [ ] Expand sections (should work)
- [ ] Verify "Add Suggestion" button is hidden
- [ ] Check workflow badges load correctly
- [ ] Test approval history modal

**Test 4: Permission Boundaries**
- [ ] Try to submit suggestion (should be prevented)
- [ ] Try to approve section (should show role-specific error)
- [ ] Try to access admin routes (should be blocked)

**Test 5: Accessibility**
- [ ] Tab through interface with keyboard only
- [ ] Test with screen reader (NVDA or JAWS)
- [ ] Verify color contrast ratios (WCAG AA)
- [ ] Check focus indicators are visible

### Automated Test Cases

```javascript
// Test: Viewer cannot create suggestions
describe('Viewer Role - Suggestion Creation', () => {
  it('should hide "Add Suggestion" button for viewers', async () => {
    const viewer = createViewer();
    const page = await viewer.navigateToDocument('doc-123');
    const addButton = await page.$('button:contains("Add Suggestion")');
    expect(addButton).toBeNull();
  });

  it('should block API call if viewer attempts to create suggestion', async () => {
    const viewer = createViewer();
    const response = await viewer.fetch('/api/dashboard/suggestions', {
      method: 'POST',
      body: { document_id: 'doc-123', section_id: 'sec-456', suggested_text: 'Test' }
    });
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('view-only');
  });
});

// Test: Viewer can view but not act
describe('Viewer Role - Document Access', () => {
  it('should allow viewing documents', async () => {
    const viewer = createViewer();
    const response = await viewer.fetch('/api/dashboard/documents');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should allow viewing sections', async () => {
    const viewer = createViewer();
    const response = await viewer.fetch('/api/dashboard/sections?documentId=doc-123');
    expect(response.status).toBe(200);
  });

  it('should allow viewing suggestions', async () => {
    const viewer = createViewer();
    const response = await viewer.fetch('/api/dashboard/suggestions?section_id=sec-456');
    expect(response.status).toBe(200);
  });
});

// Test: Onboarding appears once
describe('Viewer Role - Onboarding', () => {
  it('should show onboarding modal on first login', async () => {
    const newViewer = createNewViewer();
    const page = await newViewer.login();
    const modal = await page.$('#viewerOnboardingModal');
    expect(modal).not.toBeNull();
    expect(await modal.isVisible()).toBe(true);
  });

  it('should not show onboarding on subsequent logins', async () => {
    const returningViewer = createReturningViewer();
    const page = await returningViewer.login();
    const modal = await page.$('#viewerOnboardingModal');
    expect(await modal?.isVisible()).toBe(false);
  });
});
```

---

## 12. Conclusion & Overall Grade

### Summary of Findings

**Strengths:**
- ✅ Backend permission enforcement is solid
- ✅ Role hierarchy correctly implemented
- ✅ Workflow status viewing works well
- ✅ Some tooltips provide helpful context

**Weaknesses:**
- ❌ No viewer-specific onboarding
- ❌ Confusing disabled buttons throughout UI
- ❌ No upgrade request mechanism
- ❌ Tasks shown that viewers cannot complete
- ❌ Export unnecessarily disabled

### Overall UX Grade: 🟡 **C-**

**Breakdown:**
- Backend Security: A+ (excellent)
- Frontend Clarity: D (poor)
- User Guidance: F (missing)
- Feature Access: C (some confusion)
- Accessibility: C- (needs work)

### Impact Assessment

**If Not Fixed:**
- 😟 High user frustration
- 📧 Increased support requests
- 🔄 Users repeatedly asking for permissions
- ⚠️ Potential confusion about application purpose
- 📉 Poor first impressions for read-only users

**If Fixed:**
- 😊 Clear expectations from start
- ✅ Reduced support burden
- 🚀 Better user satisfaction
- 📈 Professional, polished experience
- ♿ Improved accessibility

---

## 13. Next Steps

### Immediate Actions (This Sprint)
1. Implement onboarding modal (Fix 1)
2. Hide inaccessible action buttons (Fix 2)
3. Add request upgrade feature (Fix 3)

### Short-Term (Next Sprint)
4. Filter tasks by role (Fix 4)
5. Enable export for viewers (Fix 5)
6. Improve error messages

### Long-Term (Future Sprints)
7. Add print-friendly CSS
8. Implement search functionality
9. Conduct full accessibility audit

---

**Report Prepared By:** Testing & Quality Assurance Agent
**Review Date:** 2025-10-15
**Version:** 1.0
**Status:** 🔴 Action Required
