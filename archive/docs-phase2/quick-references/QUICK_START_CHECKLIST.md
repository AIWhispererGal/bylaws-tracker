# Quick Start Checklist - Setup Wizard Development

**Purpose:** Actionable checklist for developers building the graphical setup wizard
**Estimated Time:** 4 weeks (160 hours)
**Team:** 1-2 developers

---

## Pre-Development Setup (Day 0)

### Environment Preparation
- [ ] Clone repository: `git clone [repo-url]`
- [ ] Install dependencies: `npm install`
- [ ] Set up local environment:
  - [ ] Copy `.env.example` to `.env`
  - [ ] Add Supabase credentials
  - [ ] Test local server: `npm run dev`
- [ ] Verify Render.com account access
- [ ] Review existing codebase:
  - [ ] Read `/docs/IMPLEMENTATION_ROADMAP.md`
  - [ ] Review `/database/ARCHITECTURE_DESIGN.md`
  - [ ] Understand current routing in `server.js`

### Design Resources
- [ ] Set up Figma/Sketch account
- [ ] Install design tools (if doing design work)
- [ ] Review existing UI: `/views/bylaws-improved.ejs`
- [ ] Choose CSS framework: Tailwind CSS or Bootstrap

---

## Week 1: Foundation

### Day 1-2: UX Design
**Goal:** Complete user flow and wireframes

- [ ] **User Flow Diagram**
  - [ ] Map all 7 wizard steps
  - [ ] Define decision points
  - [ ] Identify error paths
  - [ ] Document in `/docs/ux/USER_FLOW.md`

- [ ] **Wireframes** (7 screens)
  - [ ] Screen 1: Welcome
  - [ ] Screen 2: Organization Info
  - [ ] Screen 3: Document Type
  - [ ] Screen 4: Workflow Configuration
  - [ ] Screen 5: Document Import
  - [ ] Screen 6: Processing
  - [ ] Screen 7: Success
  - [ ] Export to `/docs/ux/WIREFRAMES.pdf`

- [ ] **Design System**
  - [ ] Define color palette (primary, secondary, success, error)
  - [ ] Choose typography (headings, body, labels)
  - [ ] Define spacing scale (4px, 8px, 16px, 24px, 32px)
  - [ ] Document in `/docs/ux/DESIGN_SYSTEM.md`

**Deliverable:** User flow diagram, wireframes, design system documented

---

### Day 3: First-Run Detection and Routing
**Goal:** Detect setup status and route to wizard

- [ ] **Update `server.js`**
  ```javascript
  // Add at top of file
  const setupDetection = require('./src/middleware/setupDetection');

  // Add before other routes
  app.use(setupDetection);
  ```

- [ ] **Create `/src/middleware/setupDetection.js`**
  ```javascript
  async function setupDetection(req, res, next) {
    // Skip for static files and API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/public')) {
      return next();
    }

    // Skip if already on setup page
    if (req.path.startsWith('/setup')) {
      return next();
    }

    // Check if setup is complete
    const isComplete = await checkSetupComplete(req.supabase);

    if (!isComplete && !req.query.skip_setup) {
      return res.redirect('/setup/welcome');
    }

    next();
  }

  async function checkSetupComplete(supabase) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    return data && data.length > 0;
  }

  module.exports = setupDetection;
  ```

- [ ] **Add setup routes to `server.js`**
  ```javascript
  app.get('/setup/welcome', (req, res) => {
    res.render('setup/welcome');
  });

  app.get('/setup/organization', (req, res) => {
    res.render('setup/organization');
  });

  // ... other setup routes
  ```

- [ ] **Test first-run detection**
  - [ ] Fresh database → redirects to `/setup/welcome`
  - [ ] With organization → allows access to main app
  - [ ] `/?skip_setup=1` → bypasses setup

**Deliverable:** First-run detection working, setup routing functional

---

### Day 4: Wizard Layout Shell
**Goal:** Create reusable wizard layout

- [ ] **Create `/views/setup/layout.ejs`**
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup Wizard - <%= title %></title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/css/setup-wizard.css">
  </head>
  <body class="bg-gray-50">
    <div class="min-h-screen flex flex-col">
      <!-- Header -->
      <header class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 py-6">
          <h1 class="text-3xl font-bold text-gray-900">
            Bylaws Amendment Tracker Setup
          </h1>
        </div>
      </header>

      <!-- Progress Steps -->
      <div class="bg-white border-b">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <%- include('components/progress-steps', { currentStep }) %>
        </div>
      </div>

      <!-- Content -->
      <main class="flex-grow">
        <div class="max-w-4xl mx-auto px-4 py-8">
          <%- body %>
        </div>
      </main>

      <!-- Footer with navigation -->
      <footer class="bg-white border-t">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between">
          <% if (showBack) { %>
            <button onclick="navigateBack()" class="btn-secondary">
              ← Back
            </button>
          <% } else { %>
            <div></div>
          <% } %>

          <% if (showNext) { %>
            <button onclick="navigateNext()" class="btn-primary" id="nextBtn">
              Next →
            </button>
          <% } %>
        </div>
      </footer>
    </div>

    <script src="/js/setup-wizard.js"></script>
  </body>
  </html>
  ```

- [ ] **Create `/views/setup/components/progress-steps.ejs`**
  ```html
  <nav aria-label="Progress">
    <ol class="flex items-center justify-between">
      <% const steps = [
        { num: 1, name: 'Welcome' },
        { num: 2, name: 'Organization' },
        { num: 3, name: 'Document Type' },
        { num: 4, name: 'Workflow' },
        { num: 5, name: 'Import' },
        { num: 6, name: 'Processing' },
        { num: 7, name: 'Success' }
      ]; %>

      <% steps.forEach((step, idx) => { %>
        <li class="<%= idx < steps.length - 1 ? 'flex-1' : '' %>">
          <div class="flex items-center">
            <div class="relative flex items-center justify-center">
              <div class="h-10 w-10 rounded-full border-2
                <%= currentStep === step.num ? 'border-blue-600 bg-blue-600 text-white' :
                   currentStep > step.num ? 'border-green-600 bg-green-600 text-white' :
                   'border-gray-300 bg-white text-gray-500' %>
                flex items-center justify-center">
                <% if (currentStep > step.num) { %>
                  ✓
                <% } else { %>
                  <%= step.num %>
                <% } %>
              </div>
            </div>
            <span class="ml-2 text-sm font-medium
              <%= currentStep === step.num ? 'text-blue-600' : 'text-gray-500' %>">
              <%= step.name %>
            </span>
          </div>
        </li>
        <% if (idx < steps.length - 1) { %>
          <div class="flex-1 border-t-2
            <%= currentStep > step.num ? 'border-green-600' : 'border-gray-300' %>">
          </div>
        <% } %>
      <% }); %>
    </ol>
  </nav>
  ```

- [ ] **Create `/public/css/setup-wizard.css`**
  ```css
  .btn-primary {
    @apply bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700
           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed transition;
  }

  .btn-secondary {
    @apply bg-white text-gray-700 px-6 py-2 rounded-lg border border-gray-300
           hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
           focus:ring-offset-2 transition;
  }

  .form-input {
    @apply block w-full px-3 py-2 border border-gray-300 rounded-md
           shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500;
  }

  .form-label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }

  .card {
    @apply bg-white rounded-lg shadow p-6;
  }
  ```

- [ ] **Create `/public/js/setup-wizard.js`**
  ```javascript
  // Navigation
  function navigateBack() {
    window.history.back();
  }

  function navigateNext() {
    const form = document.querySelector('form');
    if (form && form.checkValidity()) {
      form.submit();
    } else {
      form.reportValidity();
    }
  }

  // Form state persistence
  function saveFormState() {
    const form = document.querySelector('form');
    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    localStorage.setItem('setup-wizard-state', JSON.stringify(data));
  }

  function restoreFormState() {
    const saved = localStorage.getItem('setup-wizard-state');
    if (!saved) return;

    const data = JSON.parse(saved);
    const form = document.querySelector('form');
    if (!form) return;

    Object.entries(data).forEach(([key, value]) => {
      const input = form.elements[key];
      if (input) input.value = value;
    });
  }

  // Auto-save on input change
  document.addEventListener('DOMContentLoaded', () => {
    restoreFormState();

    const form = document.querySelector('form');
    if (form) {
      form.addEventListener('input', saveFormState);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      navigateNext();
    }
  });
  ```

- [ ] **Test layout**
  - [ ] Renders on desktop (1920px, 1366px)
  - [ ] Renders on tablet (768px)
  - [ ] Renders on mobile (375px)
  - [ ] Progress steps highlight correctly
  - [ ] Back/Next buttons work

**Deliverable:** Reusable wizard layout with progress indicator

---

### Day 5: Welcome and Organization Screens
**Goal:** First two wizard screens functional

- [ ] **Create `/views/setup/welcome.ejs`**
  ```html
  <%- include('layout', {
    title: 'Welcome',
    currentStep: 1,
    showBack: false,
    showNext: true,
    body: `
      <div class="text-center mb-8">
        <h2 class="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Bylaws Amendment Tracker
        </h2>
        <p class="text-xl text-gray-600">
          Let's get your organization set up in just a few minutes!
        </p>
      </div>

      <div class="card max-w-2xl mx-auto">
        <h3 class="text-2xl font-semibold mb-4">What you'll need:</h3>
        <ul class="space-y-3">
          <li class="flex items-start">
            <svg class="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span>Your organization name (e.g., "Reseda Neighborhood Council")</span>
          </li>
          <li class="flex items-start">
            <svg class="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span>Your bylaws or governing document (.docx file or Google Doc link)</span>
          </li>
          <li class="flex items-start">
            <svg class="h-6 w-6 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span>About 10-15 minutes of your time</span>
          </li>
        </ul>

        <div class="mt-6 p-4 bg-blue-50 rounded-lg">
          <p class="text-sm text-blue-800">
            <strong>Don't worry!</strong> You can save your progress and come back later at any time.
          </p>
        </div>
      </div>

      <form action="/setup/organization" method="GET" class="hidden">
        <!-- Hidden form to trigger navigation -->
      </form>
    `
  }) %>
  ```

- [ ] **Create `/views/setup/organization.ejs`**
  ```html
  <%- include('layout', {
    title: 'Organization Info',
    currentStep: 2,
    showBack: true,
    showNext: true,
    body: `
      <h2 class="text-3xl font-bold text-gray-900 mb-6">
        Tell us about your organization
      </h2>

      <form action="/api/setup/organization" method="POST" class="space-y-6">
        <div>
          <label for="org_name" class="form-label">
            Organization Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="org_name"
            name="org_name"
            class="form-input"
            required
            minlength="3"
            maxlength="255"
            placeholder="e.g., Reseda Neighborhood Council"
          />
          <p class="mt-1 text-sm text-gray-500">
            The official name of your city council, neighborhood council, or organization.
          </p>
        </div>

        <div>
          <label for="org_slug" class="form-label">
            URL Slug <span class="text-red-500">*</span>
          </label>
          <div class="flex items-center">
            <span class="text-gray-500 text-sm mr-2">yourapp.com/</span>
            <input
              type="text"
              id="org_slug"
              name="org_slug"
              class="form-input flex-grow"
              required
              pattern="[a-z0-9-]+"
              minlength="3"
              maxlength="100"
              placeholder="reseda-neighborhood-council"
            />
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Auto-generated from your organization name. Lowercase letters, numbers, and hyphens only.
          </p>
          <p id="slug-availability" class="mt-1 text-sm"></p>
        </div>

        <div>
          <label for="org_description" class="form-label">
            Description (Optional)
          </label>
          <textarea
            id="org_description"
            name="org_description"
            class="form-input"
            rows="3"
            placeholder="A brief description of your organization..."
          ></textarea>
        </div>

        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="font-semibold text-gray-900 mb-2">Preview</h4>
          <p class="text-sm text-gray-600">
            Your organization will be created as:
          </p>
          <p id="preview-name" class="text-lg font-medium text-gray-900 mt-2">
            Reseda Neighborhood Council
          </p>
          <p id="preview-slug" class="text-sm text-gray-500">
            URL: yourapp.com/reseda-neighborhood-council
          </p>
        </div>
      </form>

      <script>
        // Auto-generate slug from name
        const nameInput = document.getElementById('org_name');
        const slugInput = document.getElementById('org_slug');

        nameInput.addEventListener('input', () => {
          const slug = nameInput.value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          slugInput.value = slug;
          updatePreview();
          checkSlugAvailability(slug);
        });

        slugInput.addEventListener('input', () => {
          updatePreview();
          checkSlugAvailability(slugInput.value);
        });

        function updatePreview() {
          document.getElementById('preview-name').textContent = nameInput.value || 'Your Organization';
          document.getElementById('preview-slug').textContent =
            'URL: yourapp.com/' + (slugInput.value || 'your-org');
        }

        async function checkSlugAvailability(slug) {
          if (slug.length < 3) return;

          const response = await fetch(\`/api/organizations/\${slug}/available\`);
          const { available } = await response.json();

          const el = document.getElementById('slug-availability');
          if (available) {
            el.textContent = '✓ This URL is available';
            el.className = 'mt-1 text-sm text-green-600';
          } else {
            el.textContent = '✗ This URL is already taken';
            el.className = 'mt-1 text-sm text-red-600';
          }
        }
      </script>
    `
  }) %>
  ```

- [ ] **Create API endpoint: `POST /api/setup/organization`**
  - [ ] Validate input
  - [ ] Save to session/localStorage (not database yet)
  - [ ] Redirect to `/setup/document-type`

- [ ] **Test screens**
  - [ ] Welcome screen displays correctly
  - [ ] Can navigate to organization screen
  - [ ] Slug auto-generates from name
  - [ ] Form validation works
  - [ ] Preview updates in real-time

**Deliverable:** Welcome and Organization screens functional

**Week 1 Complete:** Foundation ready for wizard screens

---

## Week 2: Core Wizard Screens

### Day 6-10: Remaining Wizard Screens
**Follow detailed tasks in IMPLEMENTATION_ROADMAP.md Days 6-10**

**Checklist Summary:**
- [ ] Document Type screen with templates
- [ ] Workflow Configuration screen
- [ ] Document Import screen (upload + parsing)
- [ ] Processing screen with progress bar
- [ ] Success screen with celebration

---

## Week 3: Backend Integration

### Day 11-15: APIs and Database
**Follow detailed tasks in IMPLEMENTATION_ROADMAP.md Days 11-15**

**Checklist Summary:**
- [ ] Organization creation API
- [ ] Document parser integration
- [ ] Workflow configuration API
- [ ] Database setup automation
- [ ] End-to-end testing

---

## Week 4: Polish and Launch

### Day 16-20: Refinement and Deployment
**Follow detailed tasks in IMPLEMENTATION_ROADMAP.md Days 16-20**

**Checklist Summary:**
- [ ] Visual polish and animations
- [ ] User testing with 3 non-technical users
- [ ] Bug fixes from testing
- [ ] Documentation complete
- [ ] Production deployment

---

## Daily Standup Checklist

**Ask yourself each day:**
- [ ] What did I complete yesterday?
- [ ] What am I working on today?
- [ ] Any blockers or questions?
- [ ] Am I on track with the roadmap?

---

## Code Quality Checklist

**Before committing:**
- [ ] Code is properly formatted
- [ ] No console.log() statements in production code
- [ ] Error handling is comprehensive
- [ ] Comments explain complex logic
- [ ] Variables have meaningful names
- [ ] No hardcoded values (use environment variables)

---

## Testing Checklist

**Before marking a feature "done":**
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested on mobile (375px width)
- [ ] Tested on tablet (768px width)
- [ ] Tested on desktop (1920px width)
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly (NVDA/JAWS)
- [ ] Form validation prevents bad data
- [ ] Error states display helpful messages
- [ ] Loading states show progress
- [ ] Success states celebrate completion

---

## Deployment Checklist

**Before deploying to production:**
- [ ] Environment variables set in Render
- [ ] Database migrations run successfully
- [ ] Smoke test on staging environment
- [ ] Rollback plan documented
- [ ] Error logging configured
- [ ] Analytics/monitoring set up (optional)
- [ ] User documentation published
- [ ] Support email configured

---

## Emergency Rollback Plan

**If setup wizard breaks in production:**

1. **Immediate Action:**
   - [ ] Set environment variable: `SKIP_SETUP=true`
   - [ ] Redeploy to bypass wizard
   - [ ] Notify users of temporary workaround

2. **Investigation:**
   - [ ] Check Render logs for errors
   - [ ] Test in local environment
   - [ ] Identify root cause

3. **Fix:**
   - [ ] Deploy hotfix to fix-wizard branch
   - [ ] Test thoroughly in staging
   - [ ] Deploy to production
   - [ ] Remove `SKIP_SETUP=true`

4. **Post-Mortem:**
   - [ ] Document what went wrong
   - [ ] Add test to prevent recurrence
   - [ ] Update deployment checklist

---

## Getting Help

**Stuck on something? Here's what to do:**

1. **Check Documentation:**
   - [ ] Read `/docs/IMPLEMENTATION_ROADMAP.md`
   - [ ] Review `/docs/ARCHITECTURE_DESIGN.md`
   - [ ] Search existing issues on GitHub

2. **Debug:**
   - [ ] Check browser console for errors
   - [ ] Check server logs in Render
   - [ ] Verify environment variables
   - [ ] Test with fresh database

3. **Ask for Help:**
   - [ ] Post in team chat with:
     - What you're trying to do
     - What you've tried
     - Error messages/screenshots
     - Relevant code snippets

---

## Progress Tracking

**Update this weekly:**

### Week 1 Status
- [ ] UX Design complete
- [ ] Routing and layout done
- [ ] Welcome and Org screens working
- **Blockers:** _List any issues_

### Week 2 Status
- [ ] All wizard screens complete
- [ ] Navigation works end-to-end
- [ ] Processing screen functional
- **Blockers:** _List any issues_

### Week 3 Status
- [ ] All APIs implemented
- [ ] Database setup works
- [ ] End-to-end test passes
- **Blockers:** _List any issues_

### Week 4 Status
- [ ] User testing complete
- [ ] Bugs fixed
- [ ] Deployed to production
- **Blockers:** _List any issues_

---

## Definition of Done

**The setup wizard is DONE when:**
- [ ] A non-technical user can complete setup in <15 minutes
- [ ] Works on mobile, tablet, and desktop
- [ ] No critical bugs (P0/P1 all fixed)
- [ ] Documentation complete with screenshots
- [ ] Deployed to production Render
- [ ] 3 real users have tested successfully
- [ ] Error handling covers all edge cases
- [ ] Performance is acceptable (<3s page loads)
- [ ] Accessibility passes WAVE audit
- [ ] Code is reviewed and merged to main branch

---

**Ready to start? Pick up Day 1 tasks and let's build this!**

**Questions? Review `/docs/IMPLEMENTATION_ROADMAP.md` for detailed guidance on each day.**
