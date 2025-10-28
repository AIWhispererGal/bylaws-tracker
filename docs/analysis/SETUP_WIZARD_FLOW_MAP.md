# Setup Wizard Workflow - Complete Flow Analysis

**Research Date:** 2025-10-27
**Researcher:** Hive Research Agent
**Status:** ✅ Complete

---

## Executive Summary

The setup wizard is a **5-step progressive workflow** that creates organizations, configures document structure, sets up workflows, and imports initial documents. It uses **session-based state management** with critical locking mechanisms to prevent duplicate submissions.

### Critical Findings

1. ✅ **Session Lock Guards**: Two locks prevent duplicate operations
   - `req.session.organizationCreationInProgress` - Prevents duplicate org creation
   - `req.session.setupProcessingInProgress` - Prevents duplicate document processing

2. ⚠️ **Cleanup Mechanism**: Minimal - Only on success path
   - Session cleared on successful completion
   - **NO cleanup on abandonment/timeout**
   - **NO cleanup on partial failure**

3. 🔴 **Critical Gap**: Orphaned session data if user abandons mid-setup

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETUP WIZARD WORKFLOW                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: Welcome Screen
   GET /setup
   ├─ Checks: req.app.locals.isConfigured
   └─ Redirects to /dashboard if already configured

Step 2: Organization Information
   GET /setup/organization
   POST /setup/organization
   ├─ 🔒 Lock: req.session.organizationCreationInProgress
   ├─ Creates: Supabase auth user
   ├─ Creates: users table record (with user_type_id)
   ├─ Creates: organizations record
   ├─ Creates: user_organizations link (with org_role_id = owner)
   ├─ Creates: default workflow_templates
   ├─ Creates: workflow_stages (Committee Review, Board Approval)
   ├─ Session Data Stored:
   │  ├─ req.session.setupData.organization = organizationData
   │  ├─ req.session.setupData.adminUser = { user_id, email, is_first_org }
   │  ├─ req.session.setupData.completedSteps = ['organization']
   │  ├─ req.session.setupData.organizationId = data.id
   │  ├─ req.session.setupData.userRole = 'owner'
   │  └─ req.session.adminPassword = password (temporary)
   ├─ 🔓 Unlocks on success/error
   └─ Redirects to: /setup/document-type

Step 3: Document Structure Configuration
   GET /setup/document-type
   POST /setup/document-type
   ├─ Stores: Document structure preferences
   ├─ Session Data Stored:
   │  ├─ req.session.setupData.documentType = {
   │  │    structure_type,
   │  │    level1_name (default: 'Article'),
   │  │    level2_name (default: 'Section'),
   │  │    numbering_style (default: 'roman')
   │  │  }
   │  └─ req.session.setupData.completedSteps.push('document')
   └─ Redirects to: /setup/workflow

Step 4: Workflow Configuration
   GET /setup/workflow
   POST /setup/workflow
   ├─ Stores: Approval workflow settings
   ├─ Session Data Stored:
   │  ├─ req.session.setupData.workflow = { template, stages, notifications }
   │  └─ req.session.setupData.completedSteps.push('workflow')
   └─ Redirects to: /setup/import

Step 5: Document Import
   GET /setup/import
   POST /setup/import
   ├─ 🔒 Lock: req.session.setupProcessingInProgress
   ├─ Handles: File upload OR Google Docs URL OR skip
   ├─ Session Data Stored:
   │  ├─ req.session.setupData.import = {
   │  │    source: 'file_upload' | 'google_docs' | 'skipped',
   │  │    file_path, auto_detect_structure, etc.
   │  │  }
   │  └─ req.session.setupData.completedSteps.push('import')
   ├─ Triggers: setImmediate(() => processSetupData(...))
   │  ├─ Async background processing
   │  ├─ Updates: req.session.setupData.status = 'complete' | 'error'
   │  └─ 🔓 Unlocks on completion
   └─ Redirects to: /setup/processing

Step 6: Processing Screen (Polling)
   GET /setup/processing (shows UI)
   GET /setup/status (polling endpoint)
   ├─ Returns: { status, completedSteps, currentStep, progressPercentage }
   ├─ Client polls every 1-2 seconds
   └─ Redirects to: /setup/success when status = 'complete'

Step 7: Success & Auto-Login
   GET /setup/success
   ├─ Auto-login with JWT:
   │  ├─ Signs in with stored password
   │  ├─ Stores: req.session.supabaseJWT
   │  ├─ Stores: req.session.supabaseRefreshToken
   │  └─ Deletes: req.session.adminPassword
   ├─ Session Setup:
   │  ├─ req.session.userId = adminUser.user_id
   │  ├─ req.session.userEmail = adminUser.email
   │  ├─ req.session.organizationId = organizationId
   │  ├─ req.session.userRole = 'owner'
   │  ├─ req.session.isAdmin = true
   │  └─ req.session.isAuthenticated = true
   ├─ Cleanup:
   │  ├─ delete req.session.setupData
   │  └─ req.session.isConfigured = true
   └─ Redirects to: /dashboard

Utility Endpoint:
   POST /setup/clear-session
   ├─ Clears: req.session.setupData
   ├─ Sets: req.session.isConfigured = true
   └─ Preserves: organizationId for dashboard access
```

---

## Background Processing Flow (processSetupData)

```javascript
// Triggered via setImmediate() in POST /setup/import
async function processSetupData(setupData, supabaseService) {
  steps = ['organization', 'document', 'workflow', 'import', 'database', 'finalize'];

  for (step of steps) {
    await delay(1000); // Simulate work

    switch(step) {
      case 'organization':
        // ✅ IDEMPOTENT: Checks setupData.organizationId
        // - Skip if org already created
        // - Check for existing org with same slug
        // - Create org with 10-level hierarchy_config
        // - Link user with owner role
        // - Create default workflow template
        break;

      case 'document':
        // NO-OP: Config stored in organization record
        break;

      case 'workflow':
        // NO-OP: Already created in organization step
        break;

      case 'import':
        // ✅ IDEMPOTENT: Checks setupData.sectionsImported
        // - Skip if sections already imported
        // - Parse file with wordParser or textParser
        // - Create document record
        // - Store sections via sectionStorage.storeSections()
        // - Validate stored sections
        // - Clean up uploaded file
        break;

      case 'database':
        // NO-OP: Tables already exist in Supabase
        break;

      case 'finalize':
        // Set sectionsCount = 0
        break;
    }

    setupData.completedSteps.push(step);
  }

  setupData.status = 'complete';
  return true;
}
```

---

## Session Variables - Complete Reference

### Main Session Object: `req.session.setupData`

```javascript
req.session.setupData = {
  // Step 2: Organization
  organization: {
    organization_name: string,
    organization_type: string,
    state: string,
    country: string,
    contact_email: string,
    logo_path: string | null
  },

  adminUser: {
    user_id: uuid,              // Supabase auth user ID
    email: string,
    is_first_org: boolean       // true if global_admin
  },

  organizationId: uuid,         // Created org ID
  userRole: 'owner',            // Always 'owner' for creator
  workflowTemplateId: uuid,     // Default workflow ID

  // Step 3: Document Type
  documentType: {
    structure_type: string,
    level1_name: 'Article',
    level2_name: 'Section',
    numbering_style: 'roman'
  },

  // Step 4: Workflow
  workflow: {
    template: string,
    stages: Array<{
      name: string,
      approvalType: string
    }>,
    notifications: object
  },

  // Step 5: Import
  import: {
    source: 'file_upload' | 'google_docs' | 'skipped',
    file_path?: string,
    file_name?: string,
    url?: string,
    auto_detect_structure: boolean,
    preserve_formatting: boolean,
    create_initial_version: boolean,
    skipped?: boolean
  },

  // Processing State
  completedSteps: ['organization', 'document', 'workflow', 'import', 'database', 'finalize'],
  status: 'processing' | 'complete' | 'error',
  error?: string,
  errorDetails?: string,

  // Import Results
  sectionsImported?: boolean,
  sectionsCount?: number,
  documentId?: uuid
};
```

### Session Lock Flags

```javascript
// Prevent duplicate org creation from same session
req.session.organizationCreationInProgress = true;

// Prevent duplicate document processing from same session
req.session.setupProcessingInProgress = true;
```

### Temporary Session Data

```javascript
// Stored temporarily for auto-login, cleared after /setup/success
req.session.adminPassword = string;
```

### Final Session State (After /setup/success)

```javascript
// Auth tokens
req.session.supabaseJWT = string;
req.session.supabaseRefreshToken = string;
req.session.supabaseUser = object;

// User identity
req.session.userId = uuid;
req.session.userEmail = string;
req.session.isAuthenticated = true;

// Organization context
req.session.organizationId = uuid;
req.session.userRole = 'owner';
req.session.isAdmin = true;

// Setup complete flag
req.session.isConfigured = true;

// Cleanup
delete req.session.setupData;
delete req.session.adminPassword;
```

---

## Failure Points & Cleanup Analysis

### 🟢 Success Path Cleanup

```
POST /setup/import → processSetupData() succeeds
  → req.session.setupData.status = 'complete'
  → GET /setup/success
    → Auto-login
    → delete req.session.setupData
    → delete req.session.adminPassword
    → req.session.isConfigured = true
  → Redirect to /dashboard
```

**Cleanup Status:** ✅ Complete

---

### 🟡 Error Path Cleanup

```
POST /setup/import → processSetupData() fails
  → req.session.setupData.status = 'error'
  → req.session.setupData.error = message
  → GET /setup/processing shows error
  → User may retry or abandon
```

**Cleanup Status:** ⚠️ Partial
- Session lock cleared
- setupData remains in session
- Organization may be partially created

---

### 🔴 Abandonment Path (CRITICAL GAP)

```
User starts setup
  → POST /setup/organization creates org ✅
  → Navigates away / closes browser
  → Session data persists
  → Organization exists but is_configured = true
  → User cannot re-enter setup (redirected to /dashboard)
  → Dashboard may fail (incomplete setup)
```

**Cleanup Status:** ❌ None
- **setupData remains in session indefinitely**
- **Organization record created but incomplete**
- **User account created but not fully linked**
- **NO automatic cleanup mechanism**

**Example Scenarios:**
1. User creates org → closes browser → returns → can't finish setup
2. User uploads document → processing fails → session expires → orphaned document
3. Network error during processing → session has partial data → no cleanup

---

### 🔴 Timeout Path (CRITICAL GAP)

```
Session expires during setup
  → setupData lost
  → User may be partially created
  → Organization may be partially created
  → No way to resume or clean up
```

**Cleanup Status:** ❌ None

---

## Cleanup Mechanisms Needed

### 1. Session Expiration Handler
```javascript
// MISSING: Cleanup on session expire
app.use(session({
  // Add cleanup hook
  onExpire: async (sessionId, sessionData) => {
    if (sessionData.setupData && sessionData.setupData.organizationId) {
      await cleanupIncompleteSetup(sessionData.setupData);
    }
  }
}));
```

### 2. Abandoned Setup Detector
```javascript
// MISSING: Periodic cleanup of old incomplete setups
async function cleanupAbandonedSetups() {
  // Find organizations created > 24h ago with is_configured = true but no documents
  // Delete or mark for manual review
}
```

### 3. Error Recovery Endpoint
```javascript
// MISSING: Resume or reset incomplete setup
GET /setup/resume
  // Check for partial setup
  // Resume from last completed step
  // OR offer to reset and start over
```

### 4. Manual Reset Option
```javascript
// MISSING: Admin can reset incomplete setup
POST /setup/reset
  // Delete partial organization
  // Clear session
  // Start fresh
```

---

## Idempotency Analysis

### ✅ Strong Idempotency

**Organization Creation (Step 2):**
- Checks `setupData.organizationId` before creating
- Checks for existing org with same slug
- Checks for existing user_organizations link
- **Result:** Safe to retry

**Document Import (Step 5):**
- Checks `setupData.sectionsImported` before importing
- **Result:** Safe to retry

### ⚠️ Weak Idempotency

**Workflow Creation:**
- No idempotency check
- May create duplicate workflow templates on retry
- **Risk:** Multiple "Default Workflow" templates

**User Creation:**
- Checks if auth user exists
- Re-uses existing auth user
- **Risk:** Password mismatch error if user exists with different password

---

## Security Considerations

### 🔒 Locks & Race Conditions

**Protection Against:**
- Double-click submissions (debounce middleware)
- Multiple browser tabs (session-based locks)
- Concurrent requests (lock flags)

**Not Protected Against:**
- Multiple devices with same session ID
- Session replay attacks
- Distributed race conditions

### 🔑 Password Handling

**Security Issues:**
1. ⚠️ Password stored in session temporarily (`req.session.adminPassword`)
2. ✅ Cleared after successful auto-login
3. 🔴 **NOT cleared on error or abandonment**
4. 🔴 **Persists in session storage until expiration**

**Recommendation:** Use one-time tokens instead of storing passwords

### 🔐 CSRF Protection

**Status:** ✅ Intentionally disabled for setup routes
```javascript
csrfToken: '' // CSRF disabled for setup routes
```
**Rationale:** Setup happens before organization exists, CSRF may interfere

---

## Database State Transitions

### Complete Successful Setup

```
1. auth.users (Supabase Auth)
   └─ email, password, confirmed

2. users table
   └─ id (same as auth.users.id), email, user_type_id

3. organizations
   └─ name, slug, hierarchy_config, is_configured=true

4. user_organizations
   └─ user_id, organization_id, role='owner', org_role_id

5. workflow_templates
   └─ organization_id, name='Default Approval Workflow', is_default=true

6. workflow_stages
   └─ workflow_template_id, stage_name='Committee Review', stage_order=1
   └─ workflow_template_id, stage_name='Board Approval', stage_order=2

7. documents (if file uploaded)
   └─ organization_id, title, document_type='bylaws', status='draft'

8. document_sections (if file uploaded)
   └─ document_id, section_number, content, depth, parent_section_id
```

### Partial/Failed Setup States

```
Scenario 1: Abandoned after Step 2
  ✅ auth.users created
  ✅ users record created
  ✅ organizations created
  ✅ user_organizations link created
  ✅ workflow_templates created
  ✅ workflow_stages created
  ❌ hierarchy_config incomplete (missing custom levels)
  ❌ documents not created
  ❌ is_configured = true (SHOULD BE FALSE)

Scenario 2: Abandoned after Step 5 (import fails)
  ✅ All above
  ✅ documents record created
  ❌ document_sections may be partial or empty
  ❌ Uploaded file deleted (cleanup happened)
  ❌ setupData.status = 'error'
```

---

## API Endpoint Reference

| Method | Endpoint | Purpose | Session Changes |
|--------|----------|---------|-----------------|
| GET | /setup | Welcome screen | None |
| GET | /setup/organization | Org form | None |
| POST | /setup/organization | Create org + user | setupData.organization, adminUser, organizationId |
| GET | /setup/document-type | Document config form | None |
| POST | /setup/document-type | Save doc config | setupData.documentType |
| GET | /setup/workflow | Workflow form | None |
| POST | /setup/workflow | Save workflow | setupData.workflow |
| GET | /setup/import | Import form | None |
| POST | /setup/import | Upload & process | setupData.import, triggers processSetupData |
| GET | /setup/processing | Processing UI | None |
| GET | /setup/status | Poll progress | None (reads setupData) |
| GET | /setup/success | Complete & login | Clears setupData, sets auth session |
| POST | /setup/clear-session | Emergency clear | Clears setupData |

---

## Recommendations

### High Priority

1. **Add abandonment cleanup**
   - Detect incomplete setups older than 1 hour
   - Mark organizations with is_configured=false if incomplete
   - Add /setup/resume endpoint to continue

2. **Fix password storage security**
   - Replace `req.session.adminPassword` with one-time token
   - Or use JWT-based auto-login link

3. **Add error recovery**
   - POST /setup/reset endpoint to wipe partial setup
   - Better error messages with recovery options

### Medium Priority

4. **Add workflow idempotency**
   - Check for existing workflow before creating
   - Prevent duplicate default workflows

5. **Add session timeout handling**
   - Cleanup hook when session expires
   - Warn user before session expires during setup

### Low Priority

6. **Add progress persistence**
   - Store progress in database, not just session
   - Allow resume from any device

7. **Add setup audit log**
   - Track all setup steps for debugging
   - Store in database for post-mortem analysis

---

## Testing Checklist

- [ ] Happy path: Complete all 5 steps
- [ ] Abandon at each step (1-5) and verify cleanup
- [ ] Retry after network error
- [ ] Multiple tabs open during setup
- [ ] Session expiration during setup
- [ ] Browser close during processing
- [ ] Duplicate organization name
- [ ] Invalid file upload
- [ ] Database constraint violations
- [ ] Password stored in session is cleared
- [ ] User can re-login after setup
- [ ] Organization is_configured flag correct

---

## Files Analyzed

- `/src/routes/setup.js` - Main setup routes
- `/src/services/setupService.js` - Business logic
- Session management patterns in setup routes

**Analysis Complete** ✅
