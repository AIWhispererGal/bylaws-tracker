# ⚡ UX AUDIT QUICK REFERENCE
## Developer Cheat Sheet - Fix Critical Issues Fast

**Last Updated**: 2025-10-15
**Sprint**: Sprint 0 (Critical Fixes)
**Effort**: 8 hours total

---

## 🚨 CRITICAL PRIORITY (DO THESE FIRST)

### 1. Security Fix (5 minutes) - P0 🔴

**Issue**: Admin toggle vulnerable to unauthorized access

**Fix**:
```javascript
// File: src/routes/auth.js
// Line: 883-887

// ❌ BEFORE (VULNERABLE):
router.get('/auth/admin', (req, res) => {
  req.session.isAdmin = !req.session.isAdmin;
  res.redirect('/auth/select');
});

// ✅ AFTER (SECURE):
const { requireGlobalAdmin } = require('../middleware/roleAuth');

router.post('/auth/admin/toggle', requireGlobalAdmin, async (req, res) => {
  req.session.isAdmin = !req.session.isAdmin;
  await req.session.save();
  res.redirect('/auth/select');
});
```

**Test**:
```bash
# Should fail without global admin role
curl -X POST http://localhost:3000/auth/admin/toggle

# Should succeed with global admin session
# Test with authenticated global admin
```

---

### 2. Mobile Hamburger Menu (2 hours) - P0 🔴

**Issue**: Sidebar hidden on mobile, no navigation access

**Files to Change**:
1. `views/partials/topbar.ejs`
2. `public/css/style.css`
3. `public/js/mobile-menu.js` (new file)

**Fix**:

**Step 1**: Add hamburger button to topbar
```html
<!-- File: views/partials/topbar.ejs -->
<!-- Add after line 10 (before user menu) -->

<button class="btn btn-link d-md-none mobile-menu-toggle"
        id="mobileMenuToggle"
        aria-label="Toggle navigation menu">
  <i class="bi bi-list fs-4"></i>
</button>
```

**Step 2**: Update CSS
```css
/* File: public/css/style.css */
/* Add at end of file */

/* Mobile Menu Toggle Button */
.mobile-menu-toggle {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 9999;
  color: var(--text-primary);
  padding: 0.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.mobile-menu-toggle:hover {
  background: #f8f9fa;
}

/* Mobile Sidebar Overlay */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 9998;
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
    box-shadow: none;
  }

  .sidebar.open {
    transform: translateX(0);
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  }

  /* Backdrop overlay */
  .sidebar-backdrop {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9997;
  }

  .sidebar-backdrop.show {
    display: block;
  }

  .main-content {
    margin-left: 0 !important;
  }
}
```

**Step 3**: Create mobile menu script
```javascript
// File: public/js/mobile-menu.js (CREATE NEW)

(function() {
  'use strict';

  // Mobile menu toggle
  const toggleButton = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');

  if (!toggleButton || !sidebar) return;

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  // Toggle function
  function toggleMobileMenu() {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('show');

    // Update ARIA
    const isOpen = sidebar.classList.contains('open');
    toggleButton.setAttribute('aria-expanded', isOpen);
  }

  // Event listeners
  toggleButton.addEventListener('click', toggleMobileMenu);
  backdrop.addEventListener('click', toggleMobileMenu);

  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      toggleMobileMenu();
    }
  });

  // Close on navigation
  const navLinks = sidebar.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        toggleMobileMenu();
      }
    });
  });
})();
```

**Step 4**: Include script in layout
```html
<!-- File: views/layouts/main.ejs -->
<!-- Add before closing </body> tag -->

<script src="/js/mobile-menu.js"></script>
```

**Test**:
```
1. Resize browser to < 768px
2. Verify hamburger button visible
3. Click hamburger → sidebar slides in
4. Click backdrop → sidebar closes
5. Navigate to page → sidebar auto-closes
```

---

### 3. Fix Invitation Route (2 hours) - P0 🔴

**Issue**: `/auth/accept-invite` referenced but not implemented

**Fix**:

```javascript
// File: src/routes/auth.js
// Add after login route (around line 400)

/**
 * GET /auth/accept-invite
 * Display invitation acceptance form
 */
router.get('/accept-invite', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect('/auth/login?error=Invalid invitation link');
    }

    // Verify invitation token (implement based on your invitation system)
    const invitation = await verifyInvitationToken(token);

    if (!invitation) {
      return res.redirect('/auth/login?error=Invitation expired or invalid');
    }

    res.render('auth/accept-invite', {
      title: 'Accept Invitation',
      token,
      organizationName: invitation.organization_name,
      inviterName: invitation.inviter_name,
      error: null
    });

  } catch (error) {
    console.error('Accept invite error:', error);
    res.redirect('/auth/login?error=An error occurred');
  }
});

/**
 * POST /auth/accept-invite
 * Process invitation acceptance
 */
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, password, passwordConfirm } = req.body;

    // Validate password
    if (password !== passwordConfirm) {
      return res.render('auth/accept-invite', {
        error: 'Passwords do not match',
        token
      });
    }

    // Verify token and get invitation details
    const invitation = await verifyInvitationToken(token);

    if (!invitation) {
      return res.redirect('/auth/login?error=Invalid invitation');
    }

    // Create user account with Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true, // Auto-verify from invitation
      user_metadata: {
        full_name: invitation.full_name || '',
        invited_by: invitation.inviter_id
      }
    });

    if (authError) throw authError;

    // Add user to organization
    const { error: orgError } = await supabase
      .from('user_organizations')
      .insert({
        user_id: authData.user.id,
        organization_id: invitation.organization_id,
        role: invitation.role || 'member',
        is_active: true
      });

    if (orgError) throw orgError;

    // Mark invitation as accepted
    await markInvitationAccepted(token);

    // Auto-login user
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password: password
    });

    if (sessionError) throw sessionError;

    // Set session
    req.session.userId = authData.user.id;
    req.session.userEmail = invitation.email;
    req.session.organizationId = invitation.organization_id;
    req.session.userRole = invitation.role;
    req.session.isAdmin = ['admin', 'owner'].includes(invitation.role);

    await req.session.save();

    // Redirect to dashboard
    res.redirect('/dashboard?welcome=true');

  } catch (error) {
    console.error('Accept invite POST error:', error);
    res.render('auth/accept-invite', {
      error: 'Failed to accept invitation. Please try again.',
      token: req.body.token
    });
  }
});

// Helper function to verify invitation token
async function verifyInvitationToken(token) {
  const { data, error } = await supabase
    .from('user_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error) {
    console.error('Invitation verification error:', error);
    return null;
  }

  return data;
}

// Helper to mark invitation as accepted
async function markInvitationAccepted(token) {
  const { error } = await supabase
    .from('user_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('token', token);

  if (error) {
    console.error('Mark invitation accepted error:', error);
  }
}
```

**Create View**:
```html
<!-- File: views/auth/accept-invite.ejs (CREATE NEW) -->

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accept Invitation - Bylaws Tracker</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/auth.css">
</head>
<body class="auth-page">
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <h1>Accept Invitation</h1>
        <p class="text-muted">
          You've been invited to join <strong><%= organizationName %></strong>
          by <%= inviterName %>.
        </p>
      </div>

      <% if (error) { %>
        <div class="alert alert-danger" role="alert">
          <%= error %>
        </div>
      <% } %>

      <form method="POST" action="/auth/accept-invite" id="acceptInviteForm">
        <input type="hidden" name="token" value="<%= token %>">

        <div class="mb-3">
          <label for="password" class="form-label">Create Password</label>
          <input type="password" class="form-control" id="password"
                 name="password" required minlength="8"
                 placeholder="Enter a strong password">
          <div class="form-text">
            Password must be at least 8 characters long.
          </div>
        </div>

        <div class="mb-3">
          <label for="passwordConfirm" class="form-label">Confirm Password</label>
          <input type="password" class="form-control" id="passwordConfirm"
                 name="passwordConfirm" required
                 placeholder="Re-enter your password">
        </div>

        <div class="d-grid">
          <button type="submit" class="btn btn-primary btn-lg">
            Accept Invitation
          </button>
        </div>
      </form>

      <div class="auth-footer">
        <p class="text-muted small">
          By accepting, you agree to the Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Password confirmation validation
    document.getElementById('acceptInviteForm').addEventListener('submit', (e) => {
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('passwordConfirm').value;

      if (password !== confirm) {
        e.preventDefault();
        alert('Passwords do not match');
      }
    });
  </script>
</body>
</html>
```

**Test**:
```
1. Admin invites user via /users/invite
2. Check invitation email contains correct link
3. Click link → should show accept-invite form
4. Enter password and submit
5. Verify auto-login and redirect to dashboard
```

---

## ⚡ QUICK WINS (1 hour each)

### 4. Global Admin Badge (15 minutes)

```html
<!-- File: views/partials/topbar.ejs -->
<!-- Add after user email display -->

<% if (isGlobalAdmin) { %>
  <span class="badge bg-danger ms-2">
    <i class="bi bi-shield-lock"></i> GLOBAL ADMIN
  </span>
<% } %>
```

---

### 5. Current Organization Indicator (10 minutes)

```html
<!-- File: views/dashboard/dashboard.ejs -->
<!-- Update page title (around line 379) -->

<h1 class="h4 mb-0">
  Dashboard
  <% if (organizationName) { %>
    <span class="text-muted fs-6 fw-normal">- <%= organizationName %></span>
  <% } %>
</h1>
```

---

### 6. View-Only Role Badge (15 minutes)

```html
<!-- File: views/dashboard/dashboard.ejs -->
<!-- Add after dashboard header -->

<% if (userRole === 'viewer') { %>
  <div class="alert alert-info mb-4">
    <div class="d-flex align-items-center">
      <i class="bi bi-eye-fill fs-4 me-3"></i>
      <div class="flex-grow-1">
        <h6 class="mb-1">Observer Mode</h6>
        <small>You have view-only access.
          <a href="#" data-bs-toggle="modal" data-bs-target="#permissionsModal">
            View permissions
          </a>
        </small>
      </div>
      <button class="btn btn-sm btn-outline-primary">
        <i class="bi bi-download me-1"></i>Export Report
      </button>
    </div>
  </div>
<% } %>
```

---

### 7. Disabled Feature Tooltips (30 minutes)

```javascript
// File: public/js/dashboard.js
// Add at end of file

document.addEventListener('DOMContentLoaded', () => {
  // Add tooltips to disabled buttons
  const disabledButtons = document.querySelectorAll('button[disabled]');

  disabledButtons.forEach(button => {
    button.setAttribute('data-bs-toggle', 'tooltip');
    button.setAttribute('data-bs-placement', 'top');
    button.setAttribute('title', 'This feature requires member access');
    button.style.cursor = 'not-allowed';
  });

  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
});
```

---

### 8. "My Tasks" Dashboard Section (2 hours)

```html
<!-- File: views/dashboard/dashboard.ejs -->
<!-- Add before "Recent Documents" section -->

<div class="content-section mb-4">
  <h2 class="section-title">
    <i class="bi bi-clipboard-check me-2"></i>
    My Tasks
    <span class="badge bg-danger" id="taskCount">0</span>
  </h2>

  <div id="myTasks" class="task-list">
    <div class="text-center py-4 text-muted">
      <i class="bi bi-check-circle fs-1"></i>
      <p class="mt-2">No pending tasks</p>
    </div>
  </div>
</div>

<script>
// Load user's pending tasks
async function loadMyTasks() {
  try {
    const response = await fetch('/api/dashboard/my-tasks');
    const tasks = await response.json();

    const taskContainer = document.getElementById('myTasks');
    const taskCount = document.getElementById('taskCount');

    if (tasks.length === 0) {
      taskCount.textContent = '0';
      taskCount.classList.remove('bg-danger');
      taskCount.classList.add('bg-secondary');
      return;
    }

    taskCount.textContent = tasks.length;
    taskCount.classList.add('bg-danger');

    taskContainer.innerHTML = tasks.map(task => `
      <div class="task-item ${task.priority === 'high' ? 'urgent' : ''}">
        <span class="task-icon">
          <i class="bi bi-${task.icon || 'clipboard'}"></i>
        </span>
        <div class="task-content">
          <strong>${task.title}</strong>
          <small class="text-muted d-block">${task.description}</small>
          <small class="text-muted">Due: ${task.dueDate}</small>
        </div>
        <a href="${task.url}" class="btn btn-sm btn-primary">
          ${task.action || 'View'}
        </a>
      </div>
    `).join('');

  } catch (error) {
    console.error('Failed to load tasks:', error);
  }
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadMyTasks);
</script>

<style>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border-left: 4px solid var(--primary);
}

.task-item.urgent {
  border-left-color: #dc3545;
  background: #fff5f5;
}

.task-icon {
  font-size: 1.5rem;
  color: var(--primary);
}

.task-content {
  flex-grow: 1;
}
</style>
```

**Backend API**:
```javascript
// File: src/routes/dashboard.js
// Add new route

router.get('/my-tasks', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const orgId = req.session.organizationId;

    // Get pending suggestions assigned to user
    const { data: suggestions, error: sugError } = await supabase
      .from('suggestions')
      .select(`
        id,
        suggested_text,
        document_sections!inner(section_number, documents!inner(title))
      `)
      .eq('status', 'open')
      .eq('document_sections.documents.organization_id', orgId)
      .limit(10);

    // Get workflow tasks needing user's approval
    const { data: approvals, error: appError } = await supabase
      .from('section_workflow_states')
      .select(`
        section_id,
        workflow_stage_id,
        document_sections!inner(section_number, documents!inner(title)),
        workflow_stages!inner(stage_name, required_roles)
      `)
      .eq('status', 'pending')
      .contains('workflow_stages.required_roles', [req.session.userRole])
      .limit(10);

    const tasks = [];

    // Format suggestions as tasks
    if (suggestions) {
      suggestions.forEach(s => {
        tasks.push({
          title: `Review Suggestion`,
          description: `Section ${s.document_sections.section_number} - ${s.document_sections.documents.title}`,
          url: `/dashboard/document/${s.document_sections.document_id}#section-${s.section_id}`,
          icon: 'lightbulb',
          action: 'Review',
          priority: 'medium',
          dueDate: 'Pending review'
        });
      });
    }

    // Format approvals as tasks
    if (approvals) {
      approvals.forEach(a => {
        tasks.push({
          title: `Approval Needed`,
          description: `${a.workflow_stages.stage_name}: Section ${a.document_sections.section_number}`,
          url: `/dashboard/document/${a.document_sections.document_id}#section-${a.section_id}`,
          icon: 'check-circle',
          action: 'Approve',
          priority: 'high',
          dueDate: 'Awaiting approval'
        });
      });
    }

    res.json(tasks);

  } catch (error) {
    console.error('My tasks error:', error);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});
```

---

## 📋 TESTING CHECKLIST

### Sprint 0 Acceptance Criteria

- [ ] **Security**: Admin toggle requires global admin auth
- [ ] **Mobile**: Hamburger menu works on iOS/Android
- [ ] **Mobile**: Sidebar slides in/out smoothly
- [ ] **Mobile**: Backdrop closes menu on click
- [ ] **Invitation**: Accept-invite route loads without 404
- [ ] **Invitation**: Password creation works
- [ ] **Invitation**: Auto-login after acceptance
- [ ] **UI**: Global admin badge visible
- [ ] **UI**: Organization name shown in dashboard
- [ ] **UI**: View-only badge visible for viewers
- [ ] **UI**: Disabled buttons have tooltips
- [ ] **Tasks**: "My Tasks" section loads
- [ ] **Tasks**: Task count badge updates

### Browser Testing

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (iOS)

### Role Testing

- [ ] Global Admin sees badge
- [ ] Org Admin can invite users
- [ ] Regular User sees tasks
- [ ] View-Only sees observer mode banner

---

## 🚀 DEPLOYMENT STEPS

### 1. Pre-Deployment

```bash
# Run tests
npm test

# Lint code
npm run lint

# Build assets
npm run build
```

### 2. Deploy to Staging

```bash
# Commit changes
git add .
git commit -m "Sprint 0: Critical UX fixes - security, mobile, invitations"

# Push to staging
git push origin staging

# Deploy
npm run deploy:staging
```

### 3. Smoke Test Staging

```
✓ Security: Try /auth/admin without auth → should fail
✓ Mobile: Open on phone → hamburger menu works
✓ Invitation: Accept invite flow completes
✓ UI: Badges and tooltips visible
✓ Tasks: My Tasks section loads
```

### 4. Deploy to Production

```bash
# Merge to main
git checkout main
git merge staging

# Tag release
git tag v1.1.0-sprint0

# Deploy
npm run deploy:production

# Monitor
npm run logs:production
```

---

## 📊 METRICS TO TRACK

### Immediate (Day 1)

- [ ] Security scan passes
- [ ] Zero 404 errors on /auth/accept-invite
- [ ] Mobile bounce rate < 20%
- [ ] Hamburger menu click rate > 80%

### Short-term (Week 1)

- [ ] User role confusion tickets < 2
- [ ] Mobile session duration +50%
- [ ] Invitation acceptance rate > 90%
- [ ] "My Tasks" engagement > 60%

---

## 🆘 TROUBLESHOOTING

### Mobile menu not appearing

```javascript
// Check if script loaded
console.log('Mobile menu script loaded:', typeof toggleMobileMenu);

// Check if elements exist
console.log('Toggle button:', document.getElementById('mobileMenuToggle'));
console.log('Sidebar:', document.querySelector('.sidebar'));
```

### Invitation route 404

```javascript
// Verify route registered
console.log('Routes:', app._router.stack.map(r => r.route?.path));

// Check Supabase user_invitations table exists
// Run migration if needed
```

### Tasks not loading

```javascript
// Check API response
fetch('/api/dashboard/my-tasks')
  .then(r => r.json())
  .then(console.log);

// Verify user session
console.log('User ID:', req.session.userId);
console.log('Org ID:', req.session.organizationId);
```

---

## 📞 SUPPORT

**Questions?** Contact:
- Tech Lead: [Your Name]
- UX Lead: [UX Lead Name]
- Slack: #bylaws-tracker-dev

**Documentation**:
- Full UX Audit: `docs/UX_AUDIT_MASTER_REPORT.md`
- API Docs: `docs/API_DOCUMENTATION.md`
- Architecture: `docs/ARCHITECTURE.md`

---

**Last Updated**: 2025-10-15
**Sprint**: Sprint 0 (Critical Fixes)
**Est. Completion**: 1 development day
