# Graphical Setup Wizard - Implementation Roadmap

**Project:** Bylaws Amendment Tracker - First-Run Setup Experience
**Goal:** Create a beautiful, idiot-proof web-based setup wizard for Render deployment
**Target Audience:** Non-technical municipal staff and volunteers
**Timeline:** 4 weeks (20 working days)

---

## Executive Summary

Transform the current technical setup process into a guided, visual wizard that walks users through:
1. Organization configuration
2. Document type selection
3. Workflow customization
4. Document import
5. Database initialization
6. Verification and launch

**Success Criteria:**
- Non-technical user can complete setup in under 15 minutes
- Zero command-line interaction required
- Visual feedback at every step
- Graceful error handling with clear next steps
- Mobile-friendly responsive design

---

## Phase 1: Foundation (Week 1, Days 1-5)

### Day 1-2: UX Design and User Flow Mapping

**Deliverables:**
- Complete user flow diagram (Welcome → Launch)
- Wireframes for all 7 wizard screens
- Visual design system (colors, typography, spacing)
- Mobile/tablet responsive breakpoints

**Tasks:**
- [ ] Map complete user journey with decision points
- [ ] Design wireframes for each screen:
  - Welcome screen
  - Organization info screen
  - Document type selector
  - Workflow configuration
  - Document import
  - Processing/progress screen
  - Success/launch screen
- [ ] Create error state designs
- [ ] Define loading states and animations
- [ ] Document accessibility requirements (WCAG AA)

**Dependencies:** None

**Risk Mitigation:**
- Show wireframes to 2-3 potential users for feedback
- Test navigation flow with paper prototypes
- Validate terminology with non-technical reviewers

**Files Created:**
- `/docs/ux/USER_FLOW.md`
- `/docs/ux/WIREFRAMES.pdf`
- `/docs/ux/DESIGN_SYSTEM.md`

**Time Estimate:** 16 hours

---

### Day 3: Render Deployment and First-Run Detection

**Deliverables:**
- Render blueprint (`render.yaml`) configured
- First-run detection logic
- Setup wizard routing
- Environment variable strategy

**Tasks:**
- [ ] Update `render.yaml` with setup-friendly defaults
- [ ] Create setup state detection in `server.js`:
  ```javascript
  async function isFirstRun() {
    // Check if organizations table exists and is empty
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    return !data || data.length === 0;
  }
  ```
- [ ] Add redirect logic: `/` → `/setup` if first run
- [ ] Document environment variable flow:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` required from Render
  - `SKIP_SETUP=true` to bypass wizard (for migrations)

**Dependencies:** Existing Render deployment knowledge

**Risk Mitigation:**
- Test Render deployment with minimal config
- Provide fallback if Supabase connection fails
- Allow manual skip with query param: `/?skip_setup=1`

**Files Modified:**
- `/render.yaml`
- `/server.js` (add setup routing)

**Files Created:**
- `/src/middleware/setupDetection.js`

**Time Estimate:** 8 hours

---

### Day 4: Setup Wizard Layout Shell

**Deliverables:**
- Base setup wizard layout template
- Progress indicator component
- Navigation (Back/Next/Skip) component
- Responsive CSS framework integration

**Tasks:**
- [ ] Create `/views/setup/layout.ejs`:
  - Header with logo/branding
  - Progress stepper (7 steps)
  - Content area
  - Footer with navigation buttons
- [ ] Implement CSS framework (Tailwind or Bootstrap):
  - Mobile-first responsive design
  - Accessible form controls
  - Loading spinners
  - Success/error alerts
- [ ] Create JavaScript for wizard navigation:
  - Step validation before "Next"
  - Form state persistence in localStorage
  - Keyboard navigation (Enter=Next, Esc=Cancel)

**Dependencies:** Day 3 routing completed

**Risk Mitigation:**
- Test on mobile devices early
- Support browser back button
- Auto-save progress to prevent data loss

**Files Created:**
- `/views/setup/layout.ejs`
- `/public/css/setup-wizard.css`
- `/public/js/setup-wizard.js`

**Time Estimate:** 8 hours

---

### Day 5: Welcome and Organization Info Screens

**Deliverables:**
- Welcome screen with overview
- Organization information form
- Form validation logic

**Tasks:**
- [ ] Create `/views/setup/welcome.ejs`:
  - Friendly introduction
  - "What you'll need" checklist
  - Estimated time: 10-15 minutes
  - "Get Started" button
- [ ] Create `/views/setup/organization.ejs`:
  - Organization name (required)
  - Organization slug (auto-generated, editable)
  - Description (optional)
  - Logo upload (optional, future feature placeholder)
  - Preview of what this creates
- [ ] Add client-side validation:
  - Name: 3-255 characters
  - Slug: lowercase, hyphens only, 3-100 chars
  - Real-time slug availability check
- [ ] Create API endpoint: `POST /api/setup/validate-org`

**Dependencies:** Day 4 layout completed

**Risk Mitigation:**
- Show examples of good organization names
- Prevent duplicate slugs with real-time checking
- Allow "Back" to edit welcome choices

**Files Created:**
- `/views/setup/welcome.ejs`
- `/views/setup/organization.ejs`
- `/src/routes/setup/organization.js`

**Time Estimate:** 8 hours

**Week 1 Total:** 40 hours

---

## Phase 2: Core Wizard Screens (Week 2, Days 6-10)

### Day 6: Document Type Selection Screen

**Deliverables:**
- Document type selector with templates
- Preview of hierarchy structure
- Custom type option

**Tasks:**
- [ ] Create `/views/setup/document-type.ejs`:
  - Radio button cards for common types:
    - Bylaws (Article > Section > Subsection)
    - Ordinances (Chapter > Section > Paragraph)
    - Constitution (Article > Section)
    - Custom (user-defined)
  - Visual preview of selected hierarchy
  - Example section numbering for each type
- [ ] Create template configuration:
  ```javascript
  const documentTemplates = {
    bylaws: {
      name: "Bylaws",
      hierarchy: [
        { name: "Article", numbering: "roman" },
        { name: "Section", numbering: "numeric" },
        { name: "Subsection", numbering: "letter" }
      ]
    },
    ordinances: { ... },
    constitution: { ... }
  };
  ```
- [ ] Add custom hierarchy builder (if "Custom" selected):
  - Add/remove hierarchy levels
  - Choose numbering scheme per level
  - Drag to reorder levels

**Dependencies:** Day 5 organization screen completed

**Risk Mitigation:**
- Default to "Bylaws" template for municipalities
- Show live preview of numbering: "Article I, Section 1(A)"
- Limit custom hierarchy to 5 levels max

**Files Created:**
- `/views/setup/document-type.ejs`
- `/src/config/documentTemplates.js`

**Time Estimate:** 8 hours

---

### Day 7: Workflow Configuration Screen

**Deliverables:**
- Workflow stage builder
- Pre-built workflow templates
- Visual workflow diagram

**Tasks:**
- [ ] Create `/views/setup/workflow.ejs`:
  - Template selector:
    - Simple (1-stage: Committee only)
    - Standard (2-stage: Committee → Board)
    - Legal Review (3-stage: Committee → Legal → Board)
    - Custom (user-defined)
  - Stage editor for custom workflows:
    - Stage name
    - Capabilities (can_lock, can_edit, can_approve)
    - Display color picker
    - Add/remove stages (max 10)
  - Visual flowchart preview
- [ ] Create workflow validation:
  - At least 1 stage required
  - Stage names must be unique
  - Stage order must be sequential
- [ ] Add help tooltips explaining each stage capability

**Dependencies:** Day 6 document type completed

**Risk Mitigation:**
- Default to "Standard" for most users
- Show examples of when to use 3+ stage workflows
- Explain stage capabilities in plain language

**Files Created:**
- `/views/setup/workflow.ejs`
- `/src/config/workflowTemplates.js`

**Time Estimate:** 8 hours

---

### Day 8: Document Import Screen (Part 1: Upload)

**Deliverables:**
- Document upload interface
- Google Docs URL integration
- Manual paste option

**Tasks:**
- [ ] Create `/views/setup/import.ejs`:
  - Three import methods (tabs):
    1. **Upload File:** Drag-drop .docx file
    2. **Google Docs:** Paste doc URL or ID
    3. **Manual Paste:** Paste text content
  - File validation (max 10MB, .docx only)
  - Google Docs permission check
  - Text preview (first 500 chars)
- [ ] Backend endpoint: `POST /api/setup/upload-document`:
  - Accept file upload (multer middleware)
  - Parse .docx with mammoth.js
  - Validate structure
  - Return section count estimate
- [ ] Add Google Docs integration:
  - Parse doc ID from URL
  - Test API access
  - Show preview of document title

**Dependencies:** Day 7 workflow completed

**Risk Mitigation:**
- Support Word (.docx) files only initially
- Provide sample bylaws file for testing
- Show clear error if document structure not recognized

**Files Created:**
- `/views/setup/import.ejs`
- `/src/routes/setup/upload.js`
- `/src/utils/documentParser.js`

**Time Estimate:** 8 hours

---

### Day 9: Document Import Screen (Part 2: Parsing Preview)

**Deliverables:**
- Section detection preview
- Manual section editing
- Hierarchy mapping

**Tasks:**
- [ ] Enhance import screen with parsing preview:
  - Show detected sections in table
  - Columns: Section Number, Title, Type, Text Preview
  - Highlight potential parsing errors in red
  - Allow inline editing of section metadata
- [ ] Add hierarchy mapping interface:
  - Auto-detect structure (Article I → maps to level 1)
  - Show confidence score per section
  - Allow manual override of section type
- [ ] Create section editor modal:
  - Edit section number
  - Edit section title
  - Choose parent section (for manual hierarchy)
  - Merge/split sections
- [ ] Validation before proceeding:
  - At least 5 sections detected
  - All sections have unique numbers
  - Hierarchy is valid (no orphans)

**Dependencies:** Day 8 upload completed

**Risk Mitigation:**
- Provide "Skip problematic sections" option
- Allow user to continue with warnings (not errors)
- Save draft state for later editing

**Files Modified:**
- `/views/setup/import.ejs`

**Files Created:**
- `/views/setup/components/section-editor-modal.ejs`
- `/public/js/import-preview.js`

**Time Estimate:** 8 hours

---

### Day 10: Processing and Success Screens

**Deliverables:**
- Animated processing screen
- Success screen with next steps
- Database initialization logic

**Tasks:**
- [ ] Create `/views/setup/processing.ejs`:
  - Progress bar with real-time updates
  - Step-by-step status messages:
    - "Creating organization..."
    - "Setting up workflow..."
    - "Importing 48 sections..."
    - "Initializing database..."
  - WebSocket or Server-Sent Events for live updates
  - Estimated time remaining
- [ ] Create `/views/setup/success.ejs`:
  - Celebration animation
  - Summary of what was created:
    - Organization name
    - Document title (48 sections)
    - Workflow stages (2)
  - Next steps:
    - "View your document" button → `/bylaws`
    - "Invite team members" link → user management
    - "Read getting started guide" → docs
  - Share link to the application
- [ ] Backend endpoint: `POST /api/setup/finalize`:
  - Create organization record
  - Create default document
  - Import sections with hierarchy
  - Create workflow template
  - Initialize workflow stages
  - Mark setup as complete (insert flag record)

**Dependencies:** Days 6-9 all completed

**Risk Mitigation:**
- If processing fails, show clear error message
- Provide "Retry" button
- Allow "Contact Support" with error details pre-filled
- Log all errors to server for debugging

**Files Created:**
- `/views/setup/processing.ejs`
- `/views/setup/success.ejs`
- `/src/routes/setup/finalize.js`
- `/src/services/setupService.js`

**Time Estimate:** 8 hours

**Week 2 Total:** 40 hours

---

## Phase 3: Backend Integration (Week 3, Days 11-15)

### Day 11: Organization Creation API

**Deliverables:**
- Organization CRUD endpoints
- Slug uniqueness validation
- Multi-tenant data isolation setup

**Tasks:**
- [ ] Create `/src/routes/api/organizations.js`:
  - `POST /api/organizations` - Create organization
  - `GET /api/organizations/:slug` - Check if slug available
  - `PATCH /api/organizations/:id` - Update organization
- [ ] Implement database operations:
  ```javascript
  async function createOrganization({ name, slug, hierarchyConfig }) {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        hierarchy_config: hierarchyConfig,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    return { data, error };
  }
  ```
- [ ] Add slug generation utility:
  - Convert "Reseda Neighborhood Council" → "reseda-neighborhood-council"
  - Handle special characters
  - Ensure uniqueness with suffix if needed (-2, -3, etc.)
- [ ] Set up Row-Level Security (RLS) policies:
  - Enable RLS on organizations table
  - Add policy: users can only see their own org

**Dependencies:** Database schema from `/database/migrations/001_generalized_schema.sql`

**Risk Mitigation:**
- Test with various organization name formats
- Handle unicode characters in slugs
- Prevent SQL injection with parameterized queries

**Files Created:**
- `/src/routes/api/organizations.js`
- `/src/services/organizationService.js`
- `/src/utils/slugGenerator.js`

**Time Estimate:** 8 hours

---

### Day 12: Document Parser Integration

**Deliverables:**
- Document parsing service
- Section hierarchy detection
- Text extraction from .docx

**Tasks:**
- [ ] Create `/src/services/documentParser.js`:
  - Parse .docx with mammoth.js
  - Extract text and formatting
  - Detect section headers using regex patterns
  - Build hierarchy tree structure
- [ ] Enhance existing `parse_bylaws.js` for general use:
  - Support configurable hierarchy levels
  - Detect numbering schemes (roman, numeric, letter)
  - Return JSON structure:
    ```json
    {
      "sections": [
        {
          "number": "I",
          "title": "Article Title",
          "type": "article",
          "depth": 0,
          "children": [...]
        }
      ]
    }
    ```
- [ ] Add section validation:
  - Check for duplicate section numbers
  - Validate parent-child relationships
  - Detect orphaned sections
- [ ] Create endpoint: `POST /api/setup/parse-document`:
  - Accept uploaded file or text
  - Return parsed sections
  - Include confidence scores

**Dependencies:** Day 8 upload endpoint

**Risk Mitigation:**
- Test with various document formats
- Provide fallback to manual section creation
- Handle edge cases (no headers, flat structure)

**Files Created:**
- `/src/services/documentParser.js`
- `/src/utils/hierarchyBuilder.js`

**Time Estimate:** 8 hours

---

### Day 13: Workflow Configuration API

**Deliverables:**
- Workflow template creation
- Workflow stage management
- Document-workflow association

**Tasks:**
- [ ] Create `/src/routes/api/workflows.js`:
  - `POST /api/workflows` - Create workflow template
  - `POST /api/workflows/:id/stages` - Add stage
  - `GET /api/workflows/templates` - List templates
  - `POST /api/documents/:id/workflow` - Assign workflow
- [ ] Implement workflow service:
  ```javascript
  async function createWorkflow({ orgId, name, stages }) {
    // Create workflow template
    const { data: workflow } = await supabase
      .from('workflow_templates')
      .insert({ organization_id: orgId, name })
      .select()
      .single();

    // Create stages
    const stagePromises = stages.map((stage, idx) =>
      supabase.from('workflow_stages').insert({
        workflow_template_id: workflow.id,
        stage_name: stage.name,
        stage_order: idx + 1,
        can_lock: stage.can_lock,
        display_color: stage.color
      })
    );
    await Promise.all(stagePromises);
  }
  ```
- [ ] Add workflow validation:
  - At least 1 stage required
  - Stage names unique within workflow
  - Stage order sequential

**Dependencies:** Day 11 organization API

**Risk Mitigation:**
- Validate workflow before document assignment
- Prevent deletion of workflows in use
- Provide migration path if workflow changes

**Files Created:**
- `/src/routes/api/workflows.js`
- `/src/services/workflowService.js`

**Time Estimate:** 8 hours

---

### Day 14: Database Setup Automation

**Deliverables:**
- Schema initialization script
- Sample data seeding
- Setup completion flag

**Tasks:**
- [ ] Create `/src/services/databaseSetup.js`:
  - Run schema migrations if needed
  - Check table existence
  - Insert organization, document, workflow
  - Import parsed sections
  - Set setup_completed flag
- [ ] Add transaction support:
  ```javascript
  async function initializeDatabase(setupData) {
    const { organization, document, workflow, sections } = setupData;

    // All-or-nothing transaction
    const { data, error } = await supabase.rpc('initialize_setup', {
      org_data: organization,
      doc_data: document,
      workflow_data: workflow,
      sections_data: sections
    });

    if (error) {
      // Rollback handled by database
      throw new Error('Setup failed: ' + error.message);
    }

    return data;
  }
  ```
- [ ] Create database function for atomic setup:
  - PostgreSQL function wrapping all inserts
  - Automatic rollback on any error
- [ ] Add setup status tracking:
  - Create `setup_status` table
  - Track setup steps completed
  - Store error logs if setup fails

**Dependencies:** Days 11-13 completed

**Risk Mitigation:**
- Test rollback scenarios thoroughly
- Provide detailed error messages
- Allow retry from last successful step

**Files Created:**
- `/src/services/databaseSetup.js`
- `/database/migrations/003_setup_tracking.sql`

**Time Estimate:** 8 hours

---

### Day 15: End-to-End Testing and Error Handling

**Deliverables:**
- Complete setup flow tested
- Error states implemented
- Rollback procedures verified

**Tasks:**
- [ ] Test complete setup flow:
  - Fresh Render deployment
  - First run detection
  - All wizard steps
  - Database initialization
  - Redirect to main app
- [ ] Implement error handling for each step:
  - Organization creation failure
  - Document parsing errors
  - Workflow creation issues
  - Database connection failures
- [ ] Add user-friendly error messages:
  - "Unable to connect to database. Please check your Supabase credentials."
  - "Document format not recognized. Please try uploading a .docx file."
  - "Organization name is already taken. Please choose another."
- [ ] Create error recovery flows:
  - Retry button for transient errors
  - "Start over" option for setup
  - Contact support with error details
- [ ] Test edge cases:
  - Network interruptions
  - Invalid file uploads
  - Missing environment variables
  - Browser back button during setup

**Dependencies:** All Phase 3 days completed

**Risk Mitigation:**
- Use staging environment for testing
- Get 3 non-technical users to test setup
- Document all error scenarios

**Files Created:**
- `/tests/setup-integration.test.js`
- `/docs/ERROR_RECOVERY.md`

**Time Estimate:** 8 hours

**Week 3 Total:** 40 hours

---

## Phase 4: Polish and User Testing (Week 4, Days 16-20)

### Day 16-17: Visual Polish and Animations

**Deliverables:**
- Smooth transitions between wizard steps
- Loading states and progress indicators
- Success celebrations and micro-interactions
- Mobile responsiveness refined

**Tasks:**
- [ ] Add CSS animations:
  - Fade in/out between steps
  - Progress bar smooth transitions
  - Success confetti animation
  - Error shake animation
- [ ] Implement loading states:
  - Skeleton screens for slow operations
  - Spinner for async operations
  - Disable buttons during processing
- [ ] Enhance visual feedback:
  - Checkmarks for completed steps
  - Validation icons (✓ or ✗) on form fields
  - Hover states on interactive elements
  - Focus indicators for keyboard navigation
- [ ] Refine mobile experience:
  - Test on iPhone, Android
  - Adjust touch target sizes
  - Optimize layouts for small screens
  - Test landscape orientation
- [ ] Add accessibility features:
  - ARIA labels for screen readers
  - Keyboard shortcuts documented
  - High contrast mode support
  - Skip navigation links

**Dependencies:** All core functionality completed

**Risk Mitigation:**
- Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- Validate accessibility with WAVE tool
- Get feedback from users with disabilities

**Files Modified:**
- `/public/css/setup-wizard.css`
- `/public/js/setup-wizard.js`
- All `/views/setup/*.ejs` files

**Time Estimate:** 16 hours

---

### Day 18: User Testing with Non-Technical Users

**Deliverables:**
- User testing sessions conducted (3 participants)
- Issues and feedback documented
- Priority fixes identified

**Tasks:**
- [ ] Recruit 3 non-technical testers:
  - Municipal staff
  - Neighborhood council volunteers
  - No prior experience with the tool
- [ ] Conduct moderated testing sessions:
  - Give task: "Set up a bylaws tracker for your organization"
  - Observe without helping
  - Note confusion points, errors, hesitations
  - Record time to completion
  - Ask post-test questions
- [ ] Document findings:
  - What worked well
  - What caused confusion
  - Terminology that needs clarification
  - Missing features or help text
  - Mobile vs desktop differences
- [ ] Prioritize issues:
  - Critical: Blocks completion (fix immediately)
  - High: Causes significant confusion (fix before launch)
  - Medium: Minor UX improvements (fix if time allows)
  - Low: Nice-to-haves (backlog)

**Dependencies:** Days 16-17 polish completed

**Risk Mitigation:**
- Have backup testers in case of no-shows
- Test in fresh environment (not your computer)
- Record sessions for later review

**Files Created:**
- `/docs/USER_TESTING_RESULTS.md`
- `/docs/PRIORITY_FIXES.md`

**Time Estimate:** 8 hours (plus tester coordination time)

---

### Day 19: Bug Fixes and Refinements

**Deliverables:**
- All critical issues from testing fixed
- High-priority improvements implemented
- Documentation updated

**Tasks:**
- [ ] Fix critical issues identified in testing
- [ ] Implement high-priority improvements:
  - Clarify confusing terminology
  - Add missing help text
  - Improve error messages
  - Simplify complex steps
- [ ] Add contextual help:
  - Tooltips on form fields
  - "What's this?" links to docs
  - Inline examples
  - Video tutorial embeds (if available)
- [ ] Update documentation:
  - Screenshot each wizard step
  - Document expected inputs
  - Explain each decision point
  - Troubleshooting guide

**Dependencies:** Day 18 testing completed

**Risk Mitigation:**
- Re-test fixes with original testers
- Get sign-off that issues are resolved
- Don't introduce new bugs with fixes

**Files Modified:**
- Various based on test findings

**Files Created:**
- `/docs/SETUP_WIZARD_GUIDE.md` (user-facing)
- `/docs/images/setup-*.png` (screenshots)

**Time Estimate:** 8 hours

---

### Day 20: Documentation and Deployment

**Deliverables:**
- Complete setup wizard documentation
- Deployment guide for Render
- Developer handoff documentation
- Production deployment

**Tasks:**
- [ ] Create user-facing documentation:
  - `/docs/SETUP_WIZARD_GUIDE.md`:
    - Step-by-step walkthrough with screenshots
    - FAQ section
    - Troubleshooting common issues
  - Video tutorial (optional, 5-10 min)
- [ ] Create developer documentation:
  - `/docs/SETUP_WIZARD_TECHNICAL.md`:
    - Architecture overview
    - API endpoints
    - Database schema for setup
    - Adding new wizard steps
    - Customization guide
- [ ] Update Render deployment:
  - Ensure `render.yaml` is production-ready
  - Set environment variables
  - Test deploy to staging
  - Deploy to production
- [ ] Create rollback plan:
  - If setup wizard breaks, how to bypass
  - Environment variable: `SKIP_SETUP=true`
  - Manual database initialization script
- [ ] Final smoke test:
  - Fresh Render deployment
  - Complete setup as new user
  - Verify app functions correctly

**Dependencies:** All previous days completed

**Risk Mitigation:**
- Keep old setup process documented as fallback
- Monitor error logs post-deployment
- Have hotfix process ready

**Files Created:**
- `/docs/SETUP_WIZARD_GUIDE.md`
- `/docs/SETUP_WIZARD_TECHNICAL.md`
- `/docs/SETUP_WIZARD_FAQ.md`
- `/docs/videos/setup-tutorial.mp4` (optional)

**Time Estimate:** 8 hours

**Week 4 Total:** 40 hours

---

## Total Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Foundation** | Week 1 (40h) | UX design, routing, layout, initial screens |
| **Phase 2: Core Screens** | Week 2 (40h) | All wizard screens, processing, success |
| **Phase 3: Backend Integration** | Week 3 (40h) | APIs, database setup, testing |
| **Phase 4: Polish & Testing** | Week 4 (40h) | Visual polish, user testing, deployment |
| **TOTAL** | **4 weeks (160 hours)** | Complete graphical setup wizard |

---

## Definition of "Done" for Each Phase

### Phase 1 Done When:
- [ ] User flow diagram approved by stakeholders
- [ ] Wireframes validated by 2 non-technical reviewers
- [ ] Render deployment works with first-run detection
- [ ] Wizard layout renders on mobile and desktop
- [ ] Welcome and organization screens functional

### Phase 2 Done When:
- [ ] All 7 wizard screens render correctly
- [ ] Navigation (Back/Next) works between all steps
- [ ] Form validation prevents invalid data
- [ ] Success screen celebrates completion
- [ ] Processing screen shows real-time progress

### Phase 3 Done When:
- [ ] Organization can be created via API
- [ ] Document can be parsed and imported
- [ ] Workflow is configured in database
- [ ] All data persists correctly
- [ ] End-to-end test passes from setup → main app

### Phase 4 Done When:
- [ ] 3 non-technical users complete setup successfully
- [ ] All critical bugs fixed
- [ ] Documentation complete with screenshots
- [ ] Deployed to production Render
- [ ] Smoke test passes on live site

---

## Dependencies Map

```
Day 1-2 (UX Design)
    ↓
Day 3 (Routing) → Day 4 (Layout)
    ↓                 ↓
Day 5 (Welcome/Org)   ↓
    ↓                 ↓
Day 6 (Doc Type) ←────┘
    ↓
Day 7 (Workflow)
    ↓
Day 8 (Upload) → Day 9 (Parsing Preview)
    ↓                 ↓
Day 10 (Processing/Success)
    ↓
Day 11 (Org API) → Day 12 (Parser API) → Day 13 (Workflow API)
    ↓                 ↓                      ↓
    └─────────────────┴──────────────────────┴→ Day 14 (DB Setup)
                                                      ↓
                                                Day 15 (E2E Test)
                                                      ↓
                                        Day 16-17 (Polish)
                                                      ↓
                                        Day 18 (User Testing)
                                                      ↓
                                        Day 19 (Bug Fixes)
                                                      ↓
                                        Day 20 (Deployment)
```

---

## Risks and Mitigation Strategies

### Risk 1: Supabase Auto-Provisioning Not Possible
**Probability:** Medium
**Impact:** High

**Mitigation:**
- **Plan A:** Provide "Paste your Supabase credentials" screen with tutorial
- **Plan B:** Offer managed setup service (we do it for them)
- **Plan C:** Template-based Supabase project creation guide

**Contingency:**
If auto-provisioning fails, show tutorial video:
1. Go to supabase.com
2. Create new project
3. Copy URL and anon key
4. Paste here

---

### Risk 2: Document Parsing Fails on Edge Cases
**Probability:** High
**Impact:** Medium

**Mitigation:**
- **Plan A:** Allow manual section editing in import screen
- **Plan B:** Provide "Skip and add manually later" option
- **Plan C:** Sample document library for testing

**Contingency:**
If parsing confidence is <70%, show warning:
- "We detected 12 sections, but some may be incorrect"
- "Review and edit below before continuing"
- "Or start with a blank document"

---

### Risk 3: Users Get Stuck Mid-Setup
**Probability:** Medium
**Impact:** High

**Mitigation:**
- **Plan A:** "Save and continue later" button on every step
- **Plan B:** Progress saved to localStorage
- **Plan C:** Email link to resume setup

**Contingency:**
- Store setup state in database with unique token
- Email user: "Resume your setup: [link]?token=abc123"
- Token expires in 7 days

---

### Risk 4: Mobile Experience Is Poor
**Probability:** Low
**Impact:** Medium

**Mitigation:**
- **Plan A:** Mobile-first design from Day 1
- **Plan B:** Test on actual devices (not just browser resize)
- **Plan C:** Simplified mobile layout if needed

**Contingency:**
- Show warning on small screens: "For best experience, use desktop"
- Provide "Continue anyway" option
- Ensure core functionality still works

---

### Risk 5: Non-Technical Users Still Confused
**Probability:** Medium
**Impact:** High

**Mitigation:**
- **Plan A:** Extensive user testing (Day 18)
- **Plan B:** Iterate based on feedback
- **Plan C:** Video tutorials and live chat support

**Contingency:**
- Add "Request Help" button on every screen
- Collect email and setup state
- Support team assists via email or Zoom

---

## Resource Requirements

### People
- **1 Full-Stack Developer:** All backend work (APIs, database)
- **1 Frontend Developer:** All UI/UX work (wizard screens, CSS)
- **1 UX Designer:** Days 1-2 (wireframes, design system)
- **3 User Testers:** Day 18 (non-technical participants)
- **1 Technical Writer:** Days 19-20 (documentation)

**Total Effort:** 160 developer hours + 24 hours support roles

### Tools
- **Figma/Sketch:** Wireframes and mockups
- **Tailwind CSS or Bootstrap:** Rapid UI development
- **Render.com:** Hosting (free tier)
- **Supabase:** Database (free tier)
- **Zoom:** User testing sessions
- **Loom:** Video tutorial recording

### Budget
- Free tier services: $0
- Paid Render (optional): $7/month
- Stock images/icons (optional): $50
- **Total:** $0-$57

---

## Testing Checkpoints

### After Phase 1 (Week 1)
- [ ] Wireframes approved by stakeholders
- [ ] Render deployment successful
- [ ] First-run detection works
- [ ] Layout renders on mobile

### After Phase 2 (Week 2)
- [ ] All screens accessible via navigation
- [ ] Forms validate correctly
- [ ] Processing screen shows progress
- [ ] Success screen displays

### After Phase 3 (Week 3)
- [ ] Organization created in database
- [ ] Document imported successfully
- [ ] Workflow configured
- [ ] End-to-end test passes

### After Phase 4 (Week 4)
- [ ] User testing sessions complete
- [ ] All critical bugs fixed
- [ ] Documentation complete
- [ ] Production deployment successful

---

## Post-Launch Support Plan

### Week 1 Post-Launch
- Monitor error logs daily
- Respond to user issues within 24 hours
- Collect feedback from early adopters
- Deploy hotfixes if needed

### Week 2-4 Post-Launch
- Analyze usage metrics (drop-off points)
- Prioritize UX improvements based on data
- Consider adding requested features
- Update documentation based on FAQs

### Month 2-3 Post-Launch
- Add analytics (optional): Mixpanel or PostHog
- A/B test wizard improvements
- Consider adding setup templates
- Explore advanced features (SSO, custom domains)

---

## Success Metrics

### Quantitative
- **Setup completion rate:** >80% of users who start finish
- **Time to complete setup:** <15 minutes average
- **Error rate:** <5% of setups fail
- **Support tickets:** <2 per week for setup issues
- **Mobile usage:** >30% complete setup on mobile

### Qualitative
- **User satisfaction:** "This was easy!" feedback
- **Recommendation:** Would users recommend to others?
- **Confidence:** Users feel ready to use the main app
- **Clarity:** Terminology and instructions are clear

---

## Handoff Checklist

### For Developers
- [ ] All code documented with JSDoc comments
- [ ] API endpoints documented in `/docs/API.md`
- [ ] Database schema changes documented
- [ ] Environment variables documented
- [ ] Setup wizard technical guide complete

### For Users
- [ ] Setup wizard guide with screenshots
- [ ] Video tutorial published
- [ ] FAQ page created
- [ ] Troubleshooting guide written
- [ ] Support email address provided

### For Stakeholders
- [ ] Demo video of complete setup flow
- [ ] Metrics dashboard for tracking usage
- [ ] User testing results summary
- [ ] Roadmap for future improvements

---

## Future Enhancements (Post-Launch)

### Phase 5: Advanced Features (Optional)
- [ ] Setup templates for common organization types
- [ ] Bulk user import (CSV upload)
- [ ] Custom branding (logo, colors)
- [ ] Email invitations to team members
- [ ] Setup wizard analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode

### Phase 6: Integration Enhancements
- [ ] One-click Supabase project creation (OAuth)
- [ ] Google Workspace integration
- [ ] Microsoft 365 integration
- [ ] Slack/Teams notifications
- [ ] Zapier webhooks for automation

---

**Document Version:** 1.0
**Author:** Project Manager Agent
**Date:** 2025-10-07
**Status:** Ready for Development

**Next Step:** Review this roadmap with the team, then proceed to `/docs/QUICK_START_CHECKLIST.md` for actionable tasks.
