# 🚨 SPRINT 0: CRITICAL FIXES
## Immediate Actions Required (8 Hours)

**Goal**: Fix blocking security and UX issues TODAY

**Total Time**: 8 hours (1 developer day)
**Priority**: 🔴 CRITICAL
**Impact**: Unblocks mobile, fixes security, improves clarity

---

## 📋 TASK CHECKLIST

### Task 1: Fix Admin Toggle Security (5 minutes) 🔒

**SECURITY VULNERABILITY**: Anyone can enable admin mode

**File**: `src/routes/auth.js`

**Current Code** (VULNERABLE):
```javascript
router.post('/admin/toggle', async (req, res) => {
  req.session.adminMode = !req.session.adminMode;
  res.json({ success: true, adminMode: req.session.adminMode });
});
```

**Fixed Code**:
```javascript
router.post('/admin/toggle', requireGlobalAdmin, async (req, res) => {
  // Only global admins can toggle admin mode
  req.session.adminMode = !req.session.adminMode;
  res.json({ success: true, adminMode: req.session.adminMode });
});
```

**Testing**:
```bash
# Test as regular user (should fail)
curl -X POST http://localhost:3000/auth/admin/toggle
# Expected: 403 Forbidden

# Test as global admin (should succeed)
curl -X POST http://localhost:3000/auth/admin/toggle -H "Authorization: Bearer <global-admin-token>"
# Expected: 200 OK
```

---

### Task 2: Mobile Hamburger Menu (2 hours) 📱

**Issue**: Sidebar hidden on mobile, no way to navigate

**Files**:
- `views/partials/topbar.ejs`
- `public/css/style.css`
- `public/js/mobile-menu.js` (new)

**Implementation**:

**Step 1**: Add hamburger button to topbar (15 min)
```html
<!-- views/partials/topbar.ejs -->
<nav class="topbar">
  <!-- Add hamburger menu button (mobile only) -->
  <button id="mobile-menu-toggle" class="mobile-menu-btn d-md-none">
    <i class="fas fa-bars"></i>
  </button>

  <div class="topbar-left">
    <!-- existing content -->
  </div>
</nav>
```

**Step 2**: Add CSS for responsive menu (30 min)
```css
/* public/css/style.css */

/* Mobile menu button */
.mobile-menu-btn {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 1100;
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 5px;
  cursor: pointer;
}

/* Mobile sidebar overlay */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -250px;
    top: 0;
    height: 100vh;
    z-index: 1050;
    transition: left 0.3s ease;
  }

  .sidebar.show {
    left: 0;
  }

  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1040;
    display: none;
  }

  .sidebar-overlay.show {
    display: block;
  }
}
```

**Step 3**: Add JavaScript for menu toggle (30 min)
```javascript
// public/js/mobile-menu.js
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  // Toggle menu
  menuToggle.addEventListener('click', function() {
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
  });

  // Close on overlay click
  overlay.addEventListener('click', function() {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
  });

  // Close on navigation
  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', function() {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
    });
  });
});
```

**Step 4**: Include script in layout (15 min)
```html
<!-- views/partials/layout.ejs -->
<script src="/js/mobile-menu.js"></script>
```

**Testing**:
1. Open app on mobile device (or Chrome DevTools mobile emulation)
2. Verify hamburger button visible in top-left
3. Tap hamburger → sidebar slides in
4. Tap overlay → sidebar closes
5. Tap navigation link → sidebar closes

---

### Task 3: Global Admin Badge (15 minutes) 👑

**Issue**: Users don't know they're global admins

**File**: `views/partials/topbar.ejs`

**Implementation**:
```html
<!-- views/partials/topbar.ejs -->
<div class="topbar-right">
  <% if (user && user.is_global_admin) { %>
    <span class="badge badge-danger mr-2">
      <i class="fas fa-crown"></i> Global Admin
    </span>
  <% } %>

  <span class="user-info">
    <!-- existing user info -->
  </span>
</div>
```

**CSS**:
```css
.badge.badge-danger {
  background-color: #dc3545;
  color: white;
  padding: 5px 10px;
  border-radius: 3px;
  font-size: 12px;
}
```

**Testing**:
1. Login as global admin → badge visible
2. Login as org admin → no badge
3. Verify badge persists across pages

---

### Task 4: Current Organization Indicator (10 minutes) 🏢

**Issue**: Users don't know which org context they're in

**File**: `views/partials/topbar.ejs`

**Implementation**:
```html
<!-- views/partials/topbar.ejs -->
<div class="topbar-center">
  <% if (currentOrganization) { %>
    <span class="current-org-badge">
      <i class="fas fa-building"></i>
      <%= currentOrganization.name %>
    </span>
  <% } %>
</div>
```

**CSS**:
```css
.current-org-badge {
  background: #f8f9fa;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
}
```

**Backend** (if needed):
```javascript
// src/middleware/organization-context.js
module.exports = async (req, res, next) => {
  if (req.session.currentOrganizationId) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', req.session.currentOrganizationId)
      .single();

    res.locals.currentOrganization = data;
  }
  next();
};
```

---

### Task 5: View-Only Role Badge (15 minutes) 👁️

**Issue**: View-only users don't know their role

**File**: `views/partials/topbar.ejs`

**Implementation**:
```html
<!-- views/partials/topbar.ejs -->
<div class="topbar-right">
  <% if (user && user.role === 'viewer') { %>
    <span class="badge badge-info mr-2">
      <i class="fas fa-eye"></i> Viewer
    </span>
  <% } %>
</div>
```

**Testing**:
1. Login as viewer → badge visible
2. Hover disabled features → tooltip appears
3. Verify clarity improves

---

### Task 6: Disabled Feature Tooltips (30 minutes) ℹ️

**Issue**: Disabled features look broken, not restricted

**Files**:
- `views/dashboard/dashboard.ejs`
- `public/js/tooltips.js` (new)

**Implementation**:
```html
<!-- Example: Disabled button -->
<button
  class="btn btn-primary"
  <% if (user.role === 'viewer') { %>
    disabled
    data-toggle="tooltip"
    data-placement="top"
    title="Viewers cannot create suggestions. Contact your admin for access."
  <% } %>
>
  New Suggestion
</button>
```

**JavaScript**:
```javascript
// public/js/tooltips.js
$(document).ready(function() {
  $('[data-toggle="tooltip"]').tooltip();
});
```

**Include Bootstrap tooltips**:
```html
<!-- views/partials/layout.ejs -->
<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>
<script src="/js/tooltips.js"></script>
```

---

### Task 7: Fix Invitation Route (2 hours) 📧

**Issue**: `/auth/accept-invite` doesn't exist

**File**: `src/routes/auth.js`

**Implementation**:
```javascript
// src/routes/auth.js

// Accept invitation route
router.get('/accept-invite', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).render('error', {
        message: 'Invalid invitation link'
      });
    }

    // Verify invitation token
    const { data: invitation, error } = await supabase
      .from('user_invitations')
      .select('*, organization:organizations(name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (error || !invitation) {
      return res.status(404).render('error', {
        message: 'Invitation not found or expired'
      });
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).render('error', {
        message: 'This invitation has expired'
      });
    }

    // Render registration form with pre-filled data
    res.render('auth/accept-invite', {
      invitation,
      email: invitation.email
    });

  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).render('error', {
      message: 'Failed to process invitation'
    });
  }
});

// Process invitation acceptance
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, password, full_name } = req.body;

    // Get invitation
    const { data: invitation } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .single();

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) throw authError;

    // Create user_organizations record
    await supabase
      .from('user_organizations')
      .insert({
        user_id: authUser.user.id,
        organization_id: invitation.organization_id,
        role: invitation.role,
        created_at: new Date().toISOString()
      });

    // Mark invitation as accepted
    await supabase
      .from('user_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('token', token);

    // Auto-login
    const { data: session } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password: password
    });

    req.session.supabaseJWT = session.session.access_token;
    req.session.supabaseUser = session.user;

    res.redirect('/dashboard');

  } catch (error) {
    console.error('Accept invite process error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});
```

**Create view**: `views/auth/accept-invite.ejs`

**Database schema** (if missing):
```sql
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Task 8: "My Tasks" Section (2 hours) ✅

**Issue**: Users don't know what to work on

**File**: `views/dashboard/dashboard.ejs`

**Implementation**:
```html
<!-- Add at top of dashboard -->
<div class="row mb-4">
  <div class="col-12">
    <div class="card">
      <div class="card-header">
        <h5 class="mb-0">
          <i class="fas fa-tasks"></i> My Tasks
          <span class="badge badge-primary ml-2"><%= myTasks.length %></span>
        </h5>
      </div>
      <div class="card-body">
        <% if (myTasks.length === 0) { %>
          <p class="text-muted mb-0">
            <i class="fas fa-check-circle text-success"></i>
            All caught up! No pending tasks.
          </p>
        <% } else { %>
          <div class="list-group">
            <% myTasks.forEach(task => { %>
              <a href="<%= task.url %>" class="list-group-item list-group-item-action">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 class="mb-1"><%= task.title %></h6>
                    <small class="text-muted"><%= task.description %></small>
                  </div>
                  <span class="badge badge-<%= task.priority %>"><%= task.type %></span>
                </div>
              </a>
            <% }) %>
          </div>
        <% } %>
      </div>
    </div>
  </div>
</div>
```

**Backend**:
```javascript
// src/routes/dashboard.js
router.get('/', requireAuth, async (req, res) => {
  // ... existing code ...

  // Get user's tasks
  const myTasks = [];

  // 1. Suggestions awaiting their approval
  const { data: pendingApprovals } = await supabase
    .rpc('get_user_pending_approvals', { user_id: req.user.id });

  pendingApprovals?.forEach(section => {
    myTasks.push({
      title: `Approve: ${section.section_title}`,
      description: `Pending in ${section.stage_name}`,
      url: `/dashboard/sections/${section.id}`,
      type: 'Approval',
      priority: 'warning'
    });
  });

  // 2. Suggestions they created that need action
  const { data: mySuggestions } = await supabase
    .from('suggestions')
    .select('*, section:document_sections(title)')
    .eq('created_by', req.user.id)
    .eq('status', 'pending');

  mySuggestions?.forEach(suggestion => {
    myTasks.push({
      title: `Your suggestion: ${suggestion.section.title}`,
      description: `Awaiting ${suggestion.workflow_stage}`,
      url: `/suggestions/${suggestion.id}`,
      type: 'Your Suggestion',
      priority: 'info'
    });
  });

  // 3. Documents assigned to them
  const { data: assignedDocs } = await supabase
    .from('document_assignments')
    .select('*, document:documents(title)')
    .eq('user_id', req.user.id)
    .eq('completed', false);

  assignedDocs?.forEach(assignment => {
    myTasks.push({
      title: `Review: ${assignment.document.title}`,
      description: `Due ${new Date(assignment.due_date).toLocaleDateString()}`,
      url: `/documents/${assignment.document_id}`,
      type: 'Review',
      priority: 'primary'
    });
  });

  res.render('dashboard/dashboard', {
    myTasks: myTasks.slice(0, 10), // Top 10 tasks
    // ... existing locals ...
  });
});
```

---

## ⚡ EXECUTION PLAN

### Morning (4 hours)
- ☕ 9:00-9:05: Task 1 - Security fix (5 min)
- 📱 9:05-11:05: Task 2 - Mobile menu (2 hours)
- 👑 11:05-11:20: Task 3 - Global admin badge (15 min)
- 🏢 11:20-11:30: Task 4 - Org indicator (10 min)

### Lunch Break

### Afternoon (4 hours)
- 👁️ 1:00-1:15: Task 5 - View-only badge (15 min)
- ℹ️ 1:15-1:45: Task 6 - Tooltips (30 min)
- 📧 1:45-3:45: Task 7 - Invitation route (2 hours)
- ✅ 3:45-5:45: Task 8 - My Tasks section (2 hours)

---

## ✅ TESTING CHECKLIST

### Security Testing
- [ ] Admin toggle requires global admin
- [ ] Regular users get 403 on admin routes
- [ ] Session data properly validated

### Mobile Testing
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on iPad (landscape/portrait)
- [ ] Hamburger menu opens/closes
- [ ] Overlay dismisses menu
- [ ] Navigation works on mobile

### Visual Testing
- [ ] Global admin badge visible
- [ ] Organization name displayed
- [ ] View-only badge clear
- [ ] Tooltips show on hover
- [ ] All badges responsive

### Functional Testing
- [ ] Invitation email works
- [ ] Accept invite flow complete
- [ ] My Tasks section loads
- [ ] Task counts accurate
- [ ] Links navigate correctly

---

## 📊 SUCCESS CRITERIA

After Sprint 0, users should experience:

1. ✅ **Security**: Admin toggle properly protected
2. ✅ **Mobile**: App fully functional on phones
3. ✅ **Clarity**: Know their role and organization
4. ✅ **Guidance**: See what needs their attention
5. ✅ **Onboarding**: Invitations work smoothly

**Expected Metrics**:
- Mobile bounce rate: 100% → 20%
- Security vulnerability: CRITICAL → NONE
- User confusion: 60% → 15%
- First-task completion: 40% → 75%

---

## 🚀 DEPLOYMENT

```bash
# 1. Test locally
npm run dev

# 2. Run tests
npm test

# 3. Commit changes
git add .
git commit -m "Sprint 0: Critical UX and security fixes

- Fix admin toggle security vulnerability
- Add mobile hamburger menu
- Add global admin badge
- Show current organization
- Add view-only role badge
- Add disabled feature tooltips
- Implement invitation flow
- Add My Tasks section"

# 4. Deploy to staging
git push staging main

# 5. Test in staging
# ... manual QA ...

# 6. Deploy to production
git push production main
```

---

**Status**: Ready to execute
**Time**: 8 hours (1 day)
**Impact**: MASSIVE (unblocks mobile, fixes security, improves UX)

🐝 **Execute immediately!** 🐝
