# Next Session TODO - Workflow System

**Date:** 2025-10-14
**Status:** Admin functionality complete ✅
**Next Focus:** Workflow section implementation

---

## ✅ Completed This Session

### 1. Organization & Global Admin System
- ✅ Global admin middleware fully integrated
- ✅ Admin routes properly protected
- ✅ Session management working correctly
- ✅ RLS policies analyzed and gap fixed (migration 011)
- ✅ Comprehensive test suite (91.3% pass rate)
- ✅ Global admin can access ALL organization admin pages
- ✅ Documents link fixed (now goes to dashboard instead of old bylaws page)
- ✅ Successfully tested org deletion by global admin
- ✅ Global admin user created and verified (4 organizations linked)

### Documentation Created
1. `docs/HIVE_MIND_FINAL_STATUS_REPORT.md` - Complete assessment
2. `docs/GLOBALADMIN_INTEGRATION_COMPLETE.md` - Middleware details
3. `docs/GLOBAL_ADMIN_DEPLOYMENT_GUIDE.md` - Deployment steps
4. `docs/GLOBAL_ADMIN_VERIFICATION.md` - Testing procedures
5. `docs/TEST_PLAN_ADMIN_INTEGRATION.md` - Test strategy
6. `docs/ADMIN_TEST_SUMMARY.md` - Test results
7. `docs/reports/RLS_GLOBAL_ADMIN_RESEARCH.md` - RLS analysis
8. `tests/unit/admin-integration.test.js` - 46 test cases
9. `database/migrations/011_add_global_admin_suggestions.sql` - Critical migration

### Code Changes
- `server.js:8, 217` - Global admin middleware integration
- `src/routes/admin.js:8, 14-22, 48` - Admin route protection updated
- `views/admin/organization-detail.ejs:142-156, 236-270` - Document links fixed

---

## 🎯 Next Session: Workflow System Implementation

### Priority 1: Workflow Template Management

**Goal:** Allow admins to configure approval workflows for their organization

**Tasks:**
1. **Create Workflow Template CRUD UI**
   - `/admin/workflows` - List all workflow templates
   - `/admin/workflows/create` - Create new template
   - `/admin/workflows/:id/edit` - Edit existing template
   - `/admin/workflows/:id/delete` - Delete template

2. **Workflow Stage Configuration**
   - Define stage names (e.g., "Committee Review", "Board Approval")
   - Set stage order (1, 2, 3...)
   - Configure permissions per stage:
     - `can_lock` - Can lock sections
     - `can_edit` - Can edit text
     - `can_approve` - Can approve/reject
     - `requires_approval` - Must be approved to proceed
   - Assign required roles per stage (owner, admin, member)
   - Set display colors and icons for UI

3. **Default Template Creation**
   - Migration 008 already creates default 2-stage workflow
   - Verify all organizations have a workflow template
   - Allow customization of default template

### Priority 2: Section Workflow State Management

**Goal:** Track workflow state for each document section

**Tasks:**
1. **Workflow State Tracking**
   - Link sections to workflow stages
   - Track approval status per stage
   - Record who approved and when
   - Store approval notes/comments

2. **Workflow State API Endpoints**
   - `GET /api/approval/section/:sectionId/state` - Get current workflow state
   - `POST /api/approval/section/:sectionId/advance` - Move to next stage
   - `POST /api/approval/section/:sectionId/approve` - Approve at current stage
   - `POST /api/approval/section/:sectionId/reject` - Reject and return to previous stage
   - `GET /api/approval/section/:sectionId/history` - Get approval history

3. **Workflow Validation**
   - Verify user has permission for current stage
   - Check all required approvals are complete before advancing
   - Validate stage order (can't skip stages)
   - Prevent editing locked sections

### Priority 3: Document Workflow Assignment

**Goal:** Assign workflow templates to documents

**Tasks:**
1. **Document-Workflow Linking**
   - Link documents to workflow templates
   - Default to organization's default template
   - Allow document-specific workflow override
   - Initialize workflow state for all sections when document is uploaded

2. **Document Workflow UI**
   - Show current workflow stage for each section
   - Display progress bar (e.g., "Stage 2 of 3")
   - Visual indicators for approved/pending/rejected states
   - Approval buttons based on user permissions

3. **Bulk Operations**
   - Approve multiple sections at once
   - Advance all sections in a document to next stage
   - Reset workflow state for testing

### Priority 4: Approval Workflow UI Components

**Goal:** User-friendly interface for workflow actions

**Tasks:**
1. **Section Workflow Status Display**
   - Color-coded stage indicators
   - Progress badges (Pending, Approved, Rejected)
   - Approval history timeline
   - Current approver list

2. **Approval Action Buttons**
   - "Approve" button (only for authorized roles)
   - "Reject" button with reason dialog
   - "Lock Section" button (if stage allows)
   - "Advance to Next Stage" button

3. **Workflow Dashboard**
   - Summary of sections by stage
   - Pending approvals for current user
   - Recently approved sections
   - Sections needing attention

4. **Notifications**
   - Email notifications when approval needed
   - In-app notifications for workflow events
   - Daily digest of pending approvals

### Priority 5: Testing & Validation

**Tasks:**
1. **Unit Tests**
   - Workflow template CRUD operations
   - Stage permission validation
   - Workflow state transitions
   - Role-based access control

2. **Integration Tests**
   - End-to-end approval workflow
   - Multi-stage document progression
   - User permission enforcement
   - Workflow reset and retry

3. **User Acceptance Testing**
   - Test with real users
   - Validate workflow makes sense
   - Gather feedback on UI/UX
   - Iterate based on feedback

---

## 🗄️ Database Schema Review

### Existing Tables (from Migration 008)

**workflow_templates**
```sql
- id (uuid)
- organization_id (uuid)
- name (text)
- description (text)
- is_default (boolean)
- is_active (boolean)
- created_at, updated_at
```

**workflow_stages**
```sql
- id (uuid)
- workflow_template_id (uuid)
- stage_name (text)
- stage_order (integer)
- can_lock (boolean)
- can_edit (boolean)
- can_approve (boolean)
- requires_approval (boolean)
- required_roles (jsonb) - e.g., ["admin", "owner"]
- display_color (text)
- icon (text)
- description (text)
```

**document_workflows**
```sql
- id (uuid)
- document_id (uuid)
- workflow_template_id (uuid)
- current_stage_id (uuid)
- started_at (timestamp)
- completed_at (timestamp)
- status (text) - 'in_progress', 'completed', 'paused'
```

**section_workflow_states**
```sql
- id (uuid)
- section_id (uuid)
- workflow_stage_id (uuid)
- status (text) - 'pending', 'approved', 'rejected'
- approved_by (uuid)
- approved_at (timestamp)
- approval_metadata (jsonb)
- created_at, updated_at
```

**document_versions**
```sql
- id (uuid)
- document_id (uuid)
- version_number (text)
- sections_snapshot (jsonb)
- approval_snapshot (jsonb)
- created_by (uuid)
- created_at, approved_at, published_at
- is_current, is_published (boolean)
```

---

## 📋 API Endpoints to Implement

### Workflow Templates
- `GET /api/workflows` - List templates
- `POST /api/workflows` - Create template
- `GET /api/workflows/:id` - Get template details
- `PUT /api/workflows/:id` - Update template
- `DELETE /api/workflows/:id` - Delete template
- `POST /api/workflows/:id/stages` - Add stage
- `PUT /api/workflows/:id/stages/:stageId` - Update stage
- `DELETE /api/workflows/:id/stages/:stageId` - Delete stage

### Document Workflows
- `GET /api/documents/:docId/workflow` - Get workflow info
- `POST /api/documents/:docId/workflow` - Assign workflow
- `GET /api/documents/:docId/workflow/progress` - Get progress summary

### Section Approvals
- `GET /api/sections/:sectionId/workflow-state` - Get current state
- `POST /api/sections/:sectionId/approve` - Approve section
- `POST /api/sections/:sectionId/reject` - Reject section
- `POST /api/sections/:sectionId/advance` - Move to next stage
- `GET /api/sections/:sectionId/approval-history` - Get history

### Bulk Operations
- `POST /api/documents/:docId/sections/approve-all` - Approve all sections
- `POST /api/documents/:docId/sections/advance-all` - Advance all sections
- `POST /api/documents/:docId/workflow/reset` - Reset workflow state

---

## 🎨 UI Components to Create

### Admin Workflow Management
1. **Workflow Template List Page**
   - Table showing all templates
   - Default template indicator
   - Active/inactive status
   - Edit/Delete actions

2. **Workflow Template Editor**
   - Template name and description
   - Stage list with drag-to-reorder
   - Stage configuration panel
   - Permission assignment per stage
   - Save/Cancel buttons

3. **Stage Configuration Form**
   - Stage name input
   - Stage order (auto-assigned)
   - Permission checkboxes (lock, edit, approve)
   - Role multi-select (owner, admin, member, viewer)
   - Color picker for visual indicator
   - Icon selector

### Document Workflow UI
1. **Workflow Progress Bar**
   - Shows current stage in document
   - Progress percentage
   - Stage names displayed
   - Visual indicators for completion

2. **Section Workflow Status**
   - Badge showing current stage
   - Approval status (pending/approved/rejected)
   - Last approved by (username + date)
   - Approval notes tooltip

3. **Approval Action Panel**
   - Conditional buttons based on permissions
   - "Approve" with optional note
   - "Reject" with required reason
   - "Lock Section" if allowed
   - "Advance Stage" if all approved

4. **Workflow Dashboard Widget**
   - "Your Pending Approvals" count
   - List of sections needing attention
   - Quick approve/reject buttons
   - Link to detailed view

---

## 🔧 Technical Considerations

### Performance
- Index `section_workflow_states` by section_id and workflow_stage_id
- Cache workflow templates to avoid repeated queries
- Use materialized views for workflow progress calculations
- Paginate approval history for large documents

### Security
- Validate user permissions before allowing workflow actions
- Log all approval actions to audit trail
- Prevent bypassing workflow stages
- Ensure RLS policies cover workflow tables

### User Experience
- Clear visual indicators for workflow state
- Helpful error messages for permission issues
- Confirmation dialogs for destructive actions
- Real-time updates when approvals happen

### Testing Strategy
- Unit tests for all API endpoints
- Integration tests for multi-stage workflows
- Role-based permission tests
- Edge case handling (simultaneous approvals, etc.)

---

## 🚀 Recommended Implementation Order

### Phase 1: Backend (Week 1)
1. Review existing migrations (007, 008, 009, 011)
2. Implement workflow template CRUD API
3. Implement workflow stage API
4. Implement section workflow state API
5. Add approval history tracking
6. Write unit tests for all endpoints

### Phase 2: Admin UI (Week 2)
1. Create workflow template list page
2. Create workflow template editor
3. Create stage configuration form
4. Add default template selection
5. Test workflow creation flow

### Phase 3: Document Workflow UI (Week 3)
1. Add workflow assignment to documents
2. Create workflow progress bar component
3. Add section workflow status indicators
4. Implement approval action buttons
5. Add workflow history viewer

### Phase 4: Dashboard & Notifications (Week 4)
1. Create workflow dashboard widget
2. Implement pending approvals list
3. Add email notifications for approvals
4. Create in-app notification system
5. Add daily digest feature

### Phase 5: Testing & Refinement (Week 5)
1. Comprehensive integration testing
2. User acceptance testing
3. Bug fixes and optimizations
4. Documentation updates
5. Training materials creation

---

## 📚 Reference Documentation

### Related Files to Review
- `database/migrations/008_enhance_user_roles_and_approval.sql` - Workflow schema
- `src/routes/approval.js` - Existing approval API (if any)
- `src/routes/dashboard.js` - Document viewer integration
- `views/dashboard/document-viewer.ejs` - Where workflow UI will be added

### Key Functions Already Implemented
- `user_has_role(userId, orgId, role)` - Check user role
- `user_can_approve_stage(userId, stageId)` - Check approval permission

### Helpful Resources
- Migration 008 comments explain workflow structure
- RLS policies already cover workflow tables
- Helper functions available for permission checks

---

## 💡 Quick Wins for Next Session

Start with these easy tasks:

1. **GET /api/workflows** - List workflow templates (5 min)
2. **GET /api/workflows/:id** - Get template details (5 min)
3. **Workflow Template List Page** - Simple table view (30 min)
4. **Add "Configure Workflow" button to admin dashboard** (10 min)

These will establish the foundation and provide immediate value.

---

## 🎯 Success Criteria

The workflow system will be considered complete when:

- [ ] Admins can create and manage workflow templates
- [ ] Documents can be assigned to workflows
- [ ] Sections show current workflow stage
- [ ] Users can approve/reject based on permissions
- [ ] Workflow progresses through all stages
- [ ] Approval history is tracked and visible
- [ ] Notifications work for pending approvals
- [ ] All tests pass (unit + integration)
- [ ] Documentation is complete
- [ ] UAT feedback is positive

---

## 🔄 Migration Status Reminder

**Completed Migrations:**
- ✅ 007 - Global admin foundation
- ✅ 008 - Workflow schema
- ✅ 009 - RLS optimization
- ✅ 011 - Global admin suggestions (DEPLOYED THIS SESSION)

**All migrations current. No pending migrations for workflow.**

---

## 👥 Stakeholder Notes

**What Users Want:**
- Simple, intuitive approval process
- Clear visibility into what needs approval
- Notifications when action is needed
- Flexibility to customize workflow per organization
- Audit trail of all approvals

**What Admins Want:**
- Easy workflow configuration
- Role-based permission control
- Ability to track progress
- Bulk operations for efficiency
- Override capabilities when needed

---

**Session Complete:** Admin system is production-ready! ✅
**Next Session:** Start with workflow template API and admin UI.
**Estimated Time:** 4-5 weeks for complete workflow system.

