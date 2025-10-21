# Phase 2 Enhancements - Quick Reference Guide

**Version:** 1.0.0
**Date:** October 17, 2025

---

## 📌 Quick Links

- **Full Roadmap:** `docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`
- **P6 Section Editor:** `docs/reports/P6_IMPLEMENTATION_ROADMAP.md`
- **Phase 1 Summary:** `docs/NEXT_SESSION_WORKFLOW_FIXES.md`

---

## 🎯 Three New Features Overview

### 1. Per-Document Numbering Schema (5-7 days)

**What:** Customize 10-level hierarchy per document after upload

**User Action:**
```
Document Upload → "Configure Hierarchy" button → Edit 10 levels → Save
```

**Database:**
```sql
ALTER TABLE documents ADD COLUMN hierarchy_override JSONB;
```

**Key Files:**
- `views/admin/document-hierarchy-editor.ejs` (NEW)
- `src/config/hierarchyTemplates.js` (NEW - 4 pre-built templates)
- `src/routes/admin.js` (4 new endpoints)

### 2. Suggestion Rejection (2-3 days)

**What:** Reject suggestions at workflow stage, hide from lock/approve

**User Action:**
```
View Suggestion → "Reject" button → Suggestion hidden → "Rejected" tab
```

**Database:**
```sql
ALTER TABLE suggestions
ADD COLUMN rejected_at TIMESTAMP,
ADD COLUMN rejected_by UUID,
ADD COLUMN rejected_at_stage_id UUID;
```

**Key Files:**
- `src/routes/workflow.js` (3 new endpoints: reject, unreject, list)
- `views/dashboard/document-viewer.ejs` (add tabs)

### 3. Client-Side Section Refresh (1-2 days)

**What:** Auto-refresh section after lock WITHOUT page reload

**User Action:**
```
Lock Suggestion → Section refreshes → Shows locked badge → Can approve
```

**No Database Changes Required**

**Key Files:**
- `public/js/workflow-actions.js` (add `refreshSectionAfterLock()`)
- `src/routes/workflow.js` (enhance lock endpoint response)

---

## 📊 Implementation Order

### Day 1: Database
```bash
# Create migrations
database/migrations/018_add_per_document_hierarchy.sql
database/migrations/019_add_suggestion_rejection_tracking.sql

# Run in Supabase
```

### Day 2: Backend APIs
```javascript
// admin.js - 4 endpoints
GET /admin/documents/:docId/hierarchy
PUT /admin/documents/:docId/hierarchy
DELETE /admin/documents/:docId/hierarchy
GET /admin/hierarchy-templates

// workflow.js - 3 endpoints + 1 enhancement
POST /api/workflow/suggestions/:suggestionId/reject
POST /api/workflow/suggestions/:suggestionId/unreject
GET /api/workflow/documents/:docId/suggestions
// Enhance: POST /api/workflow/sections/:sectionId/lock
```

### Day 3-5: Frontend
```
1. Hierarchy Editor UI (views/admin/document-hierarchy-editor.ejs)
2. Suggestion Tabs (views/dashboard/document-viewer.ejs)
3. Section Refresh (public/js/workflow-actions.js)
```

### Day 6-7: Testing & Deployment
```
1. Integration tests
2. E2E tests
3. Staging deployment
4. Production deployment
```

---

## 🗂️ File Checklist

### ✅ NEW Files (10)

**Database:**
- [ ] `database/migrations/018_add_per_document_hierarchy.sql`
- [ ] `database/migrations/019_add_suggestion_rejection_tracking.sql`

**Frontend:**
- [ ] `views/admin/document-hierarchy-editor.ejs`
- [ ] `public/js/hierarchy-editor.js`
- [ ] `public/css/hierarchy-editor.css`

**Backend:**
- [ ] `src/config/hierarchyTemplates.js`

**Tests:**
- [ ] `tests/integration/document-hierarchy.test.js`
- [ ] `tests/integration/suggestion-rejection.test.js`

**Docs:**
- [ ] `docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`
- [ ] `docs/roadmap/PHASE_2_QUICK_REFERENCE.md`

### ✏️ MODIFIED Files (5)

- [ ] `src/routes/admin.js` (+4 endpoints)
- [ ] `src/routes/workflow.js` (+3 endpoints, enhance 1)
- [ ] `src/parsers/wordParser.js` (check hierarchy_override)
- [ ] `views/dashboard/document-viewer.ejs` (tabs, buttons)
- [ ] `public/js/workflow-actions.js` (refresh functions)

---

## 🧪 Testing Commands

```bash
# Run integration tests
npm test -- tests/integration/document-hierarchy.test.js
npm test -- tests/integration/suggestion-rejection.test.js

# Run all tests
npm test

# Manual testing checklist
# See full roadmap for detailed test scenarios
```

---

## 🚀 Quick Deploy

```bash
# 1. Database (Supabase SQL Editor)
-- Run migration 018
-- Run migration 019

# 2. Code
git add .
git commit -m "feat: Phase 2 enhancements - hierarchy config, suggestion rejection, section refresh"
git push origin main

# 3. Verify
# - Test hierarchy editor
# - Test suggestion rejection
# - Test section refresh
```

---

## 💡 Key Design Decisions

### 1. Hierarchy Override Strategy
- **Decision:** Per-document column (not separate table)
- **Reason:** Simple, fast, JSONB supports complex structure
- **Fallback:** NULL = use org default

### 2. Rejection Tracking
- **Decision:** Store workflow stage at rejection
- **Reason:** Provides context (rejected at which review stage)
- **Display:** "Rejected at Committee Review stage"

### 3. Section Refresh Approach
- **Decision:** Client-side only (no WebSocket)
- **Reason:** Simpler, faster to implement
- **Future:** Can add WebSocket for multi-user real-time later

---

## 📐 Database Schema Quick View

```sql
-- Feature 1: Per-Document Hierarchy
documents {
  ...existing columns...
  hierarchy_override JSONB DEFAULT NULL
}

-- Feature 2: Suggestion Rejection
suggestions {
  ...existing columns...
  rejected_at TIMESTAMP
  rejected_by UUID → users(id)
  rejected_at_stage_id UUID → workflow_stages(id)
  rejection_notes TEXT
}

-- Feature 3: No schema changes
```

---

## 🎨 UI/UX Flow Diagrams

### Hierarchy Configuration Flow

```
Document Upload
    ↓
Admin Dashboard
    ↓
"Configure Hierarchy" button
    ↓
Hierarchy Editor Modal
    ├─ Load Current Config (doc override OR org default)
    ├─ Load Template (optional)
    ├─ Detect from Document (optional)
    ├─ Edit 10 Levels (drag-drop, dropdowns)
    ├─ Live Preview
    └─ Save → documents.hierarchy_override updated
    ↓
Re-parse Document (optional)
    ↓
New sections use custom hierarchy ✅
```

### Suggestion Rejection Flow

```
Section Expanded
    ↓
Suggestions List Loaded
    ├─ Tab: Active Suggestions
    ├─ Tab: Rejected Suggestions
    └─ Tab: All Suggestions
    ↓
Admin clicks "Reject" on suggestion
    ↓
POST /api/workflow/suggestions/:id/reject
    ├─ Update status = 'rejected'
    ├─ Set rejected_at = NOW()
    ├─ Set rejected_by = user_id
    └─ Set rejected_at_stage_id = current_stage
    ↓
Suggestion moves to "Rejected" tab
    ├─ Hidden from "Active" tab
    ├─ No radio button (can't select)
    └─ Shows "Rejected at X stage" badge
    ↓
Admin can "Unreject" to restore ✅
```

### Section Refresh Flow

```
User selects suggestion
    ↓
Clicks "Lock Selected Suggestion"
    ↓
POST /api/workflow/sections/:id/lock
    ↓
Success response with:
    ├─ Updated section data (is_locked, locked_text, etc.)
    ├─ Updated workflow state (canApprove, canLock, etc.)
    └─ Updated suggestions list (selected highlighted)
    ↓
refreshSectionAfterLock(sectionId, data)
    ├─ Update header badges (show "Locked")
    ├─ Update content text (show locked_text)
    ├─ Update action buttons (enable Approve, disable Lock)
    ├─ Update suggestions (disable radios, highlight selected)
    ├─ Show locked alert box
    └─ Smooth scroll to section
    ↓
Section displays locked state ✅
User can now approve without page reload ✅
```

---

## 🔍 Troubleshooting

### Issue: Hierarchy override not being used

**Check:**
```sql
SELECT id, title, hierarchy_override
FROM documents
WHERE id = 'your-document-id';
```

**Fix:** Ensure `hierarchy_override` is valid JSONB with `levels` array

### Issue: Rejected suggestions still showing

**Check:**
```sql
SELECT id, status, rejected_at, rejected_at_stage_id
FROM suggestions
WHERE status = 'rejected';
```

**Fix:** Ensure frontend filters `status != 'rejected'` by default

### Issue: Section not refreshing after lock

**Check:** Browser console for JavaScript errors

**Debug:**
```javascript
console.log('Lock response:', data);
console.log('Section element:', sectionElement);
```

**Fix:** Ensure `data-section-id` attribute exists on section div

---

## 📞 Support & Next Steps

**Questions?** Review full roadmap: `docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`

**Ready to start?** Begin with Day 1 database migrations

**Blocked?** Check related docs:
- P6 Section Editor: `docs/reports/P6_IMPLEMENTATION_ROADMAP.md`
- Workflow Lock: `docs/WORKFLOW_LOCK_IMPLEMENTATION_COMPLETE.md`
- 10-Level Parsing: `docs/reports/P5_EXECUTIVE_SUMMARY.md`

---

**Status:** ✅ READY TO IMPLEMENT
**Estimated Timeline:** 5-7 days
**Priority:** HIGH
**Dependencies:** None (can start immediately)
