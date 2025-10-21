# Approval Workflow System Specification

**Document Version:** 1.0
**Date:** 2025-10-13
**Status:** Analysis Complete
**Author:** Analyst Agent (Hive Mind Collective)

---

## Executive Summary

This specification defines a comprehensive approval workflow system for the Bylaws Amendment Tracker that supports multi-stage approval processes, section locking, document versioning, and California Brown Act compliance. The system replaces the legacy two-stage (committee/board) hardcoded model with a flexible, configurable N-stage workflow engine.

---

## 1. Current State Analysis

### 1.1 Existing Workflow Tables

**Current Schema:**
```sql
-- Workflow Templates (organization-level)
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workflow Stages
CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY,
  workflow_template_id UUID REFERENCES workflow_templates(id),
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER NOT NULL,
  can_lock BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  required_roles JSONB DEFAULT '["admin"]'::jsonb,
  display_color VARCHAR(7),
  icon VARCHAR(50),
  description TEXT
);

-- Section Workflow States (per section, per stage)
CREATE TABLE section_workflow_states (
  id UUID PRIMARY KEY,
  section_id UUID REFERENCES document_sections(id),
  workflow_stage_id UUID REFERENCES workflow_stages(id),
  status VARCHAR(50) NOT NULL, -- pending, approved, rejected, locked, in_progress
  actioned_by UUID REFERENCES users(id),
  actioned_by_email VARCHAR(255),
  actioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  selected_suggestion_id UUID REFERENCES suggestions(id)
);
```

**Legacy Model (bylaw_sections):**
```sql
-- OLD MODEL (to be deprecated)
locked_by_committee BOOLEAN DEFAULT FALSE,
locked_at TIMESTAMP,
locked_by VARCHAR(255),
board_approved BOOLEAN DEFAULT FALSE,
board_approved_at TIMESTAMP
```

---

## 2. Workflow State Machine Design

### 2.1 State Diagram

```
                  AMENDMENT WORKFLOW STATE MACHINE

┌─────────────────────────────────────────────────────────────┐
│                     INITIAL STATE                           │
│                        [draft]                              │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Suggestions collected
               ▼
┌─────────────────────────────────────────────────────────────┐
│                 COMMITTEE REVIEW                            │
│           [stage_1: committee_review]                       │
│                                                             │
│  Actions:                                                   │
│  • Committee members review suggestions                     │
│  • Can lock section (select preferred suggestion)          │
│  • Can approve/reject                                       │
│  • IMPORTANT: No vote counting (Brown Act compliance)      │
└──┬──────────────────────────────────────────────────┬───────┘
   │                                                   │
   │ approve()                                         │ reject()
   ▼                                                   ▼
┌─────────────────────────────────┐          ┌────────────────┐
│        COMMITTEE APPROVED       │          │   REJECTED     │
│  [status: approved, locked]     │          │  [reopened]    │
│                                 │          │                │
│  Section locked with selected   │          │  Return to     │
│  suggestion. Ready for board.   │          │  draft state   │
└──┬──────────────────────────────┘          └────────────────┘
   │
   │ progress_to_next_stage()
   ▼
┌─────────────────────────────────────────────────────────────┐
│                    BOARD APPROVAL                           │
│             [stage_2: board_approval]                       │
│                                                             │
│  Actions:                                                   │
│  • Board reviews committee-approved amendments              │
│  • Can approve (finalize) or send back                      │
│  • Section remains locked                                   │
└──┬──────────────────────────────────────────────────┬───────┘
   │                                                   │
   │ approve()                                         │ send_back()
   ▼                                                   ▼
┌─────────────────────────────────┐          ┌─────────────────┐
│         FINAL/ADOPTED           │          │  BACK TO        │
│    [status: final_approved]     │          │  COMMITTEE      │
│                                 │          │  [unlocked]     │
│  Amendment officially adopted.  │          │                 │
│  current_text updated.          │          │  Reopen for     │
│  Document version incremented.  │          │  committee      │
└─────────────────────────────────┘          └─────────────────┘
```

### 2.2 State Transitions

| Current Status | Action | New Status | Required Role | Side Effects |
|----------------|--------|------------|---------------|--------------|
| draft | `start_review()` | in_progress | committee_member | Create workflow state record |
| in_progress | `lock_section()` | locked | committee_member | Set selected_suggestion_id, prevent edits |
| in_progress | `approve()` | approved | committee_member | Mark stage complete, can progress |
| in_progress | `reject()` | rejected | committee_member | Return to draft, clear suggestions |
| locked | `unlock_section()` | in_progress | committee_member | Clear selected_suggestion_id, allow edits |
| approved (stage 1) | `progress()` | in_progress (stage 2) | system | Move to next workflow stage |
| approved (stage 2) | `finalize()` | final_approved | admin/board | Apply amendment, update current_text, version++ |
| approved (stage 2) | `send_back()` | in_progress (stage 1) | admin/board | Unlock, return to committee |
| rejected | `reopen()` | draft | admin | Reset workflow, clear states |

### 2.3 Workflow Configuration Examples

**Example 1: Simple Two-Stage (Committee → Board)**
```json
{
  "workflow_name": "Standard Neighborhood Council",
  "stages": [
    {
      "stage_order": 1,
      "stage_name": "Committee Review",
      "required_roles": ["committee_member", "admin"],
      "can_lock": true,
      "can_approve": true,
      "requires_approval": true
    },
    {
      "stage_order": 2,
      "stage_name": "Board Approval",
      "required_roles": ["admin", "owner"],
      "can_lock": false,
      "can_approve": true,
      "requires_approval": true
    }
  ]
}
```

**Example 2: Three-Stage (Committee → Legal → Board)**
```json
{
  "workflow_name": "Enterprise Workflow",
  "stages": [
    {
      "stage_order": 1,
      "stage_name": "Committee Review",
      "required_roles": ["committee_member", "admin"],
      "can_lock": true,
      "can_approve": true,
      "requires_approval": true
    },
    {
      "stage_order": 2,
      "stage_name": "Legal Review",
      "required_roles": ["legal", "admin"],
      "can_lock": false,
      "can_approve": true,
      "requires_approval": true
    },
    {
      "stage_order": 3,
      "stage_name": "Board Approval",
      "required_roles": ["admin", "owner"],
      "can_lock": false,
      "can_approve": true,
      "requires_approval": true
    }
  ]
}
```

---

## 3. Section Locking Mechanism

### 3.1 Locking Requirements

**Purpose:** Prevent concurrent editing during approval process

**Locking Rules:**
1. Only committee members (or higher) can lock sections
2. Locking requires selecting a preferred suggestion
3. Locked sections cannot be edited by anyone except admins
4. Lock persists across workflow stages until final approval
5. Locks can be manually removed by the locker or admins

### 3.2 Lock Implementation

**Add to `document_sections` table:**
```sql
ALTER TABLE document_sections ADD COLUMN is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE document_sections ADD COLUMN locked_at TIMESTAMP;
ALTER TABLE document_sections ADD COLUMN locked_by UUID REFERENCES users(id);
ALTER TABLE document_sections ADD COLUMN locked_by_email VARCHAR(255);
ALTER TABLE document_sections ADD COLUMN lock_reason TEXT;
```

**Lock/Unlock API:**
```javascript
// Lock section with selected suggestion
async function lockSection(sectionId, userId, suggestionId, reason) {
  // 1. Verify user has permission
  const canLock = await userCanLockSection(userId, sectionId);
  if (!canLock) throw new Error('Insufficient permissions');

  // 2. Verify suggestion exists and belongs to this section
  const suggestion = await getSuggestion(suggestionId);
  if (!suggestion || !suggestion.section_ids.includes(sectionId)) {
    throw new Error('Invalid suggestion for this section');
  }

  // 3. Lock section
  await supabase
    .from('document_sections')
    .update({
      is_locked: true,
      locked_at: new Date(),
      locked_by: userId,
      lock_reason: reason || 'Selected for committee approval'
    })
    .eq('id', sectionId);

  // 4. Update workflow state
  await supabase
    .from('section_workflow_states')
    .update({
      status: 'locked',
      selected_suggestion_id: suggestionId,
      actioned_by: userId,
      actioned_at: new Date()
    })
    .eq('section_id', sectionId)
    .eq('status', 'in_progress');

  // 5. Notify stakeholders
  await sendLockNotification(sectionId, userId, suggestionId);
}

// Unlock section
async function unlockSection(sectionId, userId, reason) {
  // 1. Verify user is the locker or an admin
  const section = await getSection(sectionId);
  const canUnlock = section.locked_by === userId || await isAdmin(userId);
  if (!canUnlock) throw new Error('Only the locker or admins can unlock');

  // 2. Unlock section
  await supabase
    .from('document_sections')
    .update({
      is_locked: false,
      locked_at: null,
      locked_by: null,
      lock_reason: null
    })
    .eq('id', sectionId);

  // 3. Update workflow state
  await supabase
    .from('section_workflow_states')
    .update({
      status: 'in_progress',
      selected_suggestion_id: null,
      notes: `Unlocked: ${reason}`
    })
    .eq('section_id', sectionId)
    .eq('status', 'locked');
}
```

### 3.3 Lock Display UI

**Visual Indicators:**
```html
<!-- Locked Section Badge -->
<div class="section-card locked">
  <div class="lock-indicator">
    <i class="bi bi-lock-fill"></i> Locked
    <span class="lock-info">by John Doe on Oct 10, 2025</span>
  </div>
  <div class="selected-suggestion">
    <span class="badge bg-success">Selected for Approval</span>
    Suggestion by Jane Smith
  </div>
</div>
```

---

## 4. Document Versioning Strategy

### 4.1 Version Control Model

**Versioning Approach:** Semantic versioning (major.minor.patch)

- **Major version:** Full document revision (e.g., 1.0 → 2.0)
- **Minor version:** Section-level amendments approved (e.g., 1.1 → 1.2)
- **Patch version:** Typo fixes, non-substantive changes (e.g., 1.1.1 → 1.1.2)

### 4.2 Version Tracking Schema

**Enhance `documents` table:**
```sql
ALTER TABLE documents ADD COLUMN version_number VARCHAR(20) DEFAULT '1.0.0';
ALTER TABLE documents ADD COLUMN previous_version_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN version_type VARCHAR(20) DEFAULT 'major'; -- major, minor, patch
ALTER TABLE documents ADD COLUMN version_date TIMESTAMP;
ALTER TABLE documents ADD COLUMN version_notes TEXT;
```

**Create `document_versions` table:**
```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  version_number VARCHAR(20) NOT NULL,
  version_type VARCHAR(20) NOT NULL,

  -- Snapshot of document at this version
  title VARCHAR(500),
  sections_snapshot JSONB, -- Full section tree
  metadata JSONB,

  -- Change tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  changes_summary TEXT,
  affected_sections UUID[], -- Array of section IDs

  -- Links to workflow states
  workflow_completion_id UUID,

  INDEX idx_doc_versions_doc (document_id, version_number),
  INDEX idx_doc_versions_date (created_at)
);
```

### 4.3 Version Creation Workflow

```javascript
// Create new version when amendments are finalized
async function finalizeAmendments(documentId, userId, amendedSectionIds) {
  const doc = await getDocument(documentId);

  // 1. Calculate new version number
  const currentVersion = doc.version_number || '1.0.0';
  const newVersion = incrementVersion(currentVersion, 'minor');

  // 2. Take snapshot of current state
  const sections = await getAllSections(documentId);
  const sectionsSnapshot = sections.map(s => ({
    id: s.id,
    section_number: s.section_number,
    section_title: s.section_title,
    current_text: s.current_text,
    path_ordinals: s.path_ordinals
  }));

  // 3. Create version record
  await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: newVersion,
      version_type: 'minor',
      title: doc.title,
      sections_snapshot: sectionsSnapshot,
      created_by: userId,
      changes_summary: await generateChangesSummary(amendedSectionIds),
      affected_sections: amendedSectionIds
    });

  // 4. Update document version
  await supabase
    .from('documents')
    .update({
      version_number: newVersion,
      version_date: new Date(),
      updated_at: new Date()
    })
    .eq('id', documentId);

  // 5. Apply amendments to sections (update current_text)
  await applyAmendments(amendedSectionIds);

  // 6. Unlock all sections
  await unlockAllSections(documentId);

  // 7. Clear workflow states
  await resetWorkflowStates(documentId);

  return newVersion;
}

function incrementVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch(type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: return currentVersion;
  }
}
```

### 4.4 Version Comparison & Diff

```javascript
// Compare two document versions
async function compareVersions(documentId, fromVersion, toVersion) {
  const v1 = await getDocumentVersion(documentId, fromVersion);
  const v2 = await getDocumentVersion(documentId, toVersion);

  const changes = [];

  // Compare each section
  v1.sections_snapshot.forEach(oldSection => {
    const newSection = v2.sections_snapshot.find(s => s.id === oldSection.id);

    if (!newSection) {
      changes.push({
        type: 'deleted',
        section: oldSection.section_number,
        old_text: oldSection.current_text
      });
    } else if (oldSection.current_text !== newSection.current_text) {
      changes.push({
        type: 'modified',
        section: oldSection.section_number,
        old_text: oldSection.current_text,
        new_text: newSection.current_text,
        diff: computeDiff(oldSection.current_text, newSection.current_text)
      });
    }
  });

  // Find new sections
  v2.sections_snapshot.forEach(newSection => {
    const oldSection = v1.sections_snapshot.find(s => s.id === newSection.id);
    if (!oldSection) {
      changes.push({
        type: 'added',
        section: newSection.section_number,
        new_text: newSection.current_text
      });
    }
  });

  return {
    from_version: fromVersion,
    to_version: toVersion,
    changes: changes,
    total_changes: changes.length
  };
}
```

---

## 5. California Brown Act Compliance

### 5.1 Legal Requirements

**Brown Act Key Points:**
1. **No Serial Meetings:** Individual committee members cannot discuss amendments to reach consensus
2. **No Vote Counting:** System must NOT display running vote counts or tallies
3. **Public Transparency:** All suggestions and discussions must be publicly visible
4. **No Pre-Commitment:** Members cannot be bound to vote a certain way

### 5.2 Compliance Implementation

**What the System CAN Show:**
✅ List of suggestions submitted
✅ Individual member's selected preference (locked section)
✅ Final committee decision (after meeting)
✅ Suggestion text and rationale
✅ Support count as "number of community members who support this"

**What the System CANNOT Show:**
❌ Running tally of committee member votes
❌ "X out of Y committee members approve"
❌ Real-time vote tracking
❌ Which committee members voted for/against

### 5.3 Database Schema for Compliance

```sql
-- Do NOT add vote tracking for committee members
-- Suggestions table should track PUBLIC support only

CREATE TABLE suggestion_votes (
  id UUID PRIMARY KEY,
  suggestion_id UUID REFERENCES suggestions(id),
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  vote_type VARCHAR(20) DEFAULT 'support',
  is_preferred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Add flag to distinguish public vs. committee votes
  is_committee_member BOOLEAN DEFAULT FALSE,

  UNIQUE(suggestion_id, user_id)
);

-- ❌ DO NOT implement:
-- CREATE TABLE committee_votes ...
-- CREATE VIEW committee_vote_counts ...
```

### 5.4 UI Implementation for Compliance

```javascript
// ✅ CORRECT: Show total public support
<div class="suggestion-support">
  <i class="bi bi-people"></i>
  {suggestion.support_count} community members support this
</div>

// ❌ INCORRECT: Do not show committee vote counts
<div class="committee-votes">
  5 of 7 committee members prefer this  <!-- ILLEGAL -->
</div>

// ✅ CORRECT: Show only final decision
<div class="committee-decision">
  <span class="badge bg-success">Committee Approved</span>
  Approved at meeting on Oct 10, 2025
</div>
```

---

## 6. Workflow API Endpoints

### 6.1 Core Workflow Actions

**Start Section Review:**
```
POST /api/workflow/sections/:sectionId/start
Body: {
  workflowStageId: "uuid",
  notes: "Starting committee review"
}
Response: {
  success: true,
  workflowState: { status: "in_progress", ... }
}
```

**Lock Section:**
```
POST /api/workflow/sections/:sectionId/lock
Body: {
  selectedSuggestionId: "uuid",
  reason: "Committee preferred suggestion"
}
Response: {
  success: true,
  section: { is_locked: true, ... },
  workflowState: { status: "locked", ... }
}
```

**Approve Stage:**
```
POST /api/workflow/sections/:sectionId/approve
Body: {
  workflowStageId: "uuid",
  notes: "Committee approves this amendment"
}
Response: {
  success: true,
  workflowState: { status: "approved", ... },
  canProgressToNextStage: true
}
```

**Progress to Next Stage:**
```
POST /api/workflow/sections/:sectionId/progress
Body: {
  fromStageId: "uuid",
  toStageId: "uuid"
}
Response: {
  success: true,
  newStage: { stage_name: "Board Approval", ... },
  workflowState: { status: "in_progress", ... }
}
```

**Finalize Amendments:**
```
POST /api/workflow/documents/:documentId/finalize
Body: {
  sectionIds: ["uuid1", "uuid2"],
  versionType: "minor",
  notes: "October 2025 amendments"
}
Response: {
  success: true,
  newVersion: "1.2.0",
  affectedSections: 5,
  documentVersionId: "uuid"
}
```

### 6.2 Query Endpoints

**Get Section Workflow Status:**
```
GET /api/workflow/sections/:sectionId/status
Response: {
  section: { id, section_number, is_locked, ... },
  currentStage: { stage_name: "Committee Review", ... },
  workflowState: { status: "in_progress", ... },
  selectedSuggestion: { id, suggested_text, ... } | null,
  canLock: true,
  canApprove: false,
  canUnlock: false
}
```

**Get Document Workflow Progress:**
```
GET /api/workflow/documents/:documentId/progress
Response: {
  totalSections: 45,
  sectionsByStage: {
    "Committee Review": 12,
    "Board Approval": 8,
    "Finalized": 25
  },
  percentComplete: 55.6,
  stages: [
    {
      stage_name: "Committee Review",
      sections_in_progress: 12,
      sections_approved: 0,
      sections_locked: 5
    },
    ...
  ]
}
```

---

## 7. UI/UX Workflow Screens

### 7.1 Section Workflow Panel

**Location:** Document viewer, expanded section

```
┌────────────────────────────────────────────────────────────┐
│ Article III, Section 2: Board Composition                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Workflow Status: [Committee Review ▼]                     │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 🔒 Section Locked                                    │ │
│ │ Locked by John Doe on Oct 10, 2025                   │ │
│ │                                                      │ │
│ │ Selected Suggestion:                                 │ │
│ │ "Change board size from 15 to 17 members"           │ │
│ │ by Jane Smith                                        │ │
│ │                                                      │ │
│ │ [View Full Suggestion]  [🔓 Unlock Section]         │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ Workflow Timeline:                                         │
│ ✓ Oct 5: Review started                                   │
│ ✓ Oct 10: Section locked (John Doe)                       │
│ ○ Pending: Committee approval                             │
│                                                            │
│ Available Actions:                                         │
│ [✓ Approve for Committee]  [✗ Reject]  [💬 Add Note]     │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Workflow Progress Dashboard

**Location:** `/dashboard/documents/:id/workflow`

```
┌────────────────────────────────────────────────────────────┐
│ Bylaws Amendment Workflow Progress                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Document Version: 1.1.0                                    │
│ Last Updated: Oct 10, 2025                                 │
│                                                            │
│ Overall Progress: ██████████░░░░░ 56% (25/45 sections)    │
│                                                            │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Committee Review (Stage 1/2)                       │   │
│ │ ─────────────────────────────────────────────────  │   │
│ │ In Progress:  12 sections                          │   │
│ │ Locked:        5 sections                          │   │
│ │ Approved:      0 sections (ready for board)        │   │
│ │                                                    │   │
│ │ [View Sections in Committee Review]                │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Board Approval (Stage 2/2)                         │   │
│ │ ─────────────────────────────────────────────────  │   │
│ │ Pending:       8 sections                          │   │
│ │ Finalized:    25 sections                          │   │
│ │                                                    │   │
│ │ [View Sections in Board Review]                    │   │
│ │ [Finalize All Approved Sections]                   │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ Recent Activity:                                           │
│ • John Doe locked Article III, Section 2 (5 min ago)      │
│ • Jane Smith approved Article V, Section 1 (1 hr ago)     │
│ • Board finalized 5 sections (2 hrs ago)                   │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Finalize Amendments Modal

```
┌─────────────────────────────────────────────────┐
│ Finalize Approved Amendments             [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ You are about to finalize 8 board-approved     │
│ amendments and create a new document version.  │
│                                                 │
│ Current Version: 1.1.0                          │
│ New Version:     [1.2.0 ▼] (Minor)             │
│                                                 │
│ Affected Sections:                              │
│ ✓ Article III, Section 2: Board Composition    │
│ ✓ Article V, Section 1: Meeting Frequency      │
│ ✓ Article VI, Section 3: Quorum Requirements   │
│ ... and 5 more                                  │
│                                                 │
│ Version Notes:                                  │
│ [_________________________________________]     │
│ [_________________________________________]     │
│                                                 │
│ ⚠️ This action will:                            │
│ • Apply all approved amendments                 │
│ • Create document version 1.2.0                 │
│ • Unlock all affected sections                  │
│ • Reset workflow states                         │
│                                                 │
│ [Cancel]              [Finalize Amendments]    │
└─────────────────────────────────────────────────┘
```

---

## 8. Database Migrations Required

### 8.1 Migration Summary

**Add to `document_sections`:**
- `is_locked`, `locked_at`, `locked_by`, `lock_reason`

**Create new tables:**
- `document_versions` - Version history tracking
- `workflow_actions_log` - Audit trail for all workflow actions

**Update RLS policies:**
- Lock/unlock permissions based on role
- Workflow state transitions based on stage requirements

See `/docs/analysis/database-changes.md` for complete SQL migrations.

---

## 9. Performance Considerations

### 9.1 Optimization Strategies

**Query Optimization:**
```sql
-- Index for workflow state lookups
CREATE INDEX idx_section_workflow_current_stage
  ON section_workflow_states(section_id, workflow_stage_id)
  WHERE status IN ('in_progress', 'locked');

-- Index for locked sections
CREATE INDEX idx_sections_locked
  ON document_sections(document_id, is_locked)
  WHERE is_locked = true;

-- Materialized view for workflow progress
CREATE MATERIALIZED VIEW mv_document_workflow_progress AS
SELECT
  d.id as document_id,
  COUNT(ds.id) as total_sections,
  COUNT(CASE WHEN sws.status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN ds.is_locked THEN 1 END) as locked,
  COUNT(CASE WHEN sws.status = 'approved' THEN 1 END) as approved
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
GROUP BY d.id;
```

**Caching Strategy:**
- Cache workflow state for 5 minutes
- Invalidate cache on any workflow action
- Use Redis for workflow progress dashboard

---

## 10. Testing Requirements

### 10.1 Unit Tests

- [ ] Workflow state transitions follow state machine rules
- [ ] Lock/unlock permissions enforced correctly
- [ ] Version increment logic correct for major/minor/patch
- [ ] Brown Act compliance: no vote counting
- [ ] RLS policies prevent unauthorized workflow actions

### 10.2 Integration Tests

- [ ] Complete workflow from draft → finalized
- [ ] Multi-section amendment approval
- [ ] Version comparison and diff generation
- [ ] Notification system for workflow events
- [ ] Rollback scenario (board sends back to committee)

### 10.3 E2E Tests

- [ ] Committee member locks section
- [ ] Admin approves committee stage
- [ ] Board finalizes amendments
- [ ] Version history displayed correctly
- [ ] Locked sections prevent editing

---

## 11. Success Criteria

- ✅ Workflow state machine enforces proper transitions
- ✅ Sections can be locked with selected suggestions
- ✅ Document versions created on amendment finalization
- ✅ No vote counting displayed (Brown Act compliance)
- ✅ Workflow progress dashboard shows accurate statistics
- ✅ Admins can manage workflow at any stage
- ✅ Version comparison shows clear diffs
- ✅ Performance: Workflow status query < 100ms

---

## Appendix A: Workflow State Machine Pseudocode

```javascript
class WorkflowStateMachine {
  async transitionState(sectionId, action, userId) {
    const currentState = await this.getCurrentState(sectionId);
    const userRole = await this.getUserRole(userId);

    // Validate transition is allowed
    if (!this.isValidTransition(currentState, action)) {
      throw new WorkflowError('Invalid state transition');
    }

    // Check user has permission for this action
    if (!this.userCanPerformAction(userRole, action, currentState)) {
      throw new PermissionError('Insufficient permissions');
    }

    // Execute transition
    const newState = await this.executeTransition(
      sectionId,
      currentState,
      action,
      userId
    );

    // Log action
    await this.logWorkflowAction(sectionId, action, userId, currentState, newState);

    // Trigger side effects (notifications, etc.)
    await this.triggerSideEffects(action, sectionId, userId);

    return newState;
  }
}
```

---

**Document Status:** ✅ Complete
**Next Steps:** Review with researcher and architect agents, implement database migrations
