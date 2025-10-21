# Workflow Action Scenarios - Analysis & Recommendations

**Date:** October 17, 2025

---

## 📋 Current Behavior Analysis

### Scenario 1: **Section is LOCKED + Admin clicks APPROVE**

**What Currently Happens:**
- ✅ Approve button is **VISIBLE** (lock state doesn't hide it)
- ✅ Approve endpoint **ALLOWS** the action
- ✅ Workflow state updates to `status = 'approved'`
- ✅ Section remains locked with `locked_text` intact
- ✅ No warning or validation about locked state

**Code Reference:** `src/routes/workflow.js:1351-1430`

```javascript
router.post('/sections/:sectionId/approve', requireAuth, async (req, res) => {
  // ... permission checks ...

  // NO CHECK FOR is_locked!

  // Update workflow state to approved
  const { data: updatedState, error: updateError } = await supabaseService
    .from('section_workflow_states')
    .update({
      status: 'approved',
      actioned_by: userId,
      actioned_at: new Date().toISOString(),
      approval_metadata: { action: 'approved', notes: value.notes, ... }
    })
    .eq('id', currentState.id)
    .select()
    .single();
}
```

**Business Logic:**
- This is **CORRECT BEHAVIOR** ✅
- Locked sections can (and should) be approved to advance workflow
- Lock = "text is final", Approve = "move to next stage"
- These are two separate concerns

---

### Scenario 2: **Section is UNLOCKED + Suggestion SELECTED + Admin clicks APPROVE**

**What Currently Happens:**
- ⚠️ Approve button is **VISIBLE**
- ⚠️ Approve endpoint **ALLOWS** the action
- ⚠️ Workflow state updates to `status = 'approved'`
- ⚠️ **Section is NOT LOCKED** (suggestion selection is ignored!)
- ⚠️ `current_text` remains unchanged
- ⚠️ Selected suggestion is not applied

**Code Reference:** `src/routes/workflow.js:1351-1430`

```javascript
// Approve endpoint does NOT:
// 1. Check if suggestion is selected
// 2. Lock the section
// 3. Apply the selected text
```

**Business Logic:**
- This is **POTENTIALLY WRONG** ⚠️
- Approving without locking means:
  - The selected suggestion is never applied
  - Section can still be edited
  - Workflow advances but text isn't finalized

**Expected Behavior:**
- **Option A:** Require LOCK before APPROVE
- **Option B:** Auto-lock on approve if suggestion selected
- **Option C:** Warn user that selection will be lost

---

### Scenario 3: **Section is LOCKED + Admin clicks REJECT**

**What Currently Happens:**
- ✅ Reject button is **VISIBLE** (lock state doesn't hide it)
- ✅ Reject endpoint **ALLOWS** the action
- ✅ Workflow state updates to `status = 'rejected'`
- ✅ Section remains locked with `locked_text` intact
- ✅ No warning about locked state

**Code Reference:** `src/routes/workflow.js:1436-1507`

```javascript
router.post('/sections/:sectionId/reject', requireAuth, async (req, res) => {
  // ... permission checks ...

  // Requires notes
  if (!value.notes) {
    return res.status(400).json({
      success: false,
      error: 'Rejection reason is required'
    });
  }

  // NO CHECK FOR is_locked!

  // Update workflow state to rejected
  const { data: updatedState, error: updateError } = await supabaseService
    .from('section_workflow_states')
    .update({
      status: 'rejected',
      actioned_by: userId,
      actioned_at: new Date().toISOString(),
      approval_metadata: { action: 'rejected', notes: value.notes, ... }
    })
    .eq('id', currentState.id)
    .select()
    .single();
}
```

**Business Logic:**
- This is **QUESTIONABLE** ⚠️
- If section is locked, rejecting it means:
  - The locked text is rejected
  - But the section remains locked (can't be edited)
  - Admin would need to UNLOCK before changes can be made

**Expected Behavior:**
- **Option A:** Auto-unlock on reject (allow re-editing)
- **Option B:** Warn user that section is locked
- **Option C:** Require unlock before reject

---

### Scenario 4: **Section is UNLOCKED + Nothing SELECTED + Admin clicks APPROVE**

**What Currently Happens:**
- ⚠️ Approve button is **VISIBLE**
- ⚠️ Approve endpoint **ALLOWS** the action
- ⚠️ Workflow state updates to `status = 'approved'`
- ⚠️ Section remains unlocked
- ⚠️ Original/current text is not locked
- ⚠️ **Section can still be edited!**

**Code Reference:** `src/routes/workflow.js:1351-1430`

```javascript
// Approve endpoint does NOT:
// 1. Check if section is locked
// 2. Check if text is finalized
// 3. Prevent approval of unlocked sections
```

**Business Logic:**
- This is **DEFINITELY WRONG** ❌
- Approving an unlocked section means:
  - Text can still be changed after approval
  - No version control or finalization
  - Breaks the approval workflow integrity

**Expected Behavior:**
- **Option A:** Require LOCK before APPROVE (strict)
- **Option B:** Auto-lock current text on approve (lenient)
- **Option C:** Warn user and prevent approval

---

## 🚨 Current Problems Summary

| Scenario | Current Behavior | Issue | Severity |
|----------|------------------|-------|----------|
| **Locked + Approve** | Approves and keeps lock | None - correct | ✅ OK |
| **Unlocked + Selected + Approve** | Approves without locking | Selection ignored, text not finalized | ⚠️ **HIGH** |
| **Locked + Reject** | Rejects but keeps lock | Section can't be edited | ⚠️ **MEDIUM** |
| **Unlocked + Nothing + Approve** | Approves unlocked section | Text can change after approval | 🚨 **CRITICAL** |

---

## 💡 Recommended Solutions

### Solution 1: **Strict Validation (Recommended)**

**Approve Endpoint Changes:**

```javascript
router.post('/sections/:sectionId/approve', requireAuth, async (req, res) => {
  // ... existing permission checks ...

  // NEW: Check if section is locked
  const { data: section } = await supabaseService
    .from('document_sections')
    .select('is_locked')
    .eq('id', sectionId)
    .single();

  if (!section.is_locked) {
    return res.status(400).json({
      success: false,
      error: 'Section must be locked before it can be approved. Please select a suggestion and lock the section first.',
      code: 'SECTION_NOT_LOCKED'
    });
  }

  // ... continue with approval ...
}
```

**Reject Endpoint Changes:**

```javascript
router.post('/sections/:sectionId/reject', requireAuth, async (req, res) => {
  // ... existing permission checks ...

  // NEW: Auto-unlock on reject
  const { data: section } = await supabaseService
    .from('document_sections')
    .select('is_locked')
    .eq('id', sectionId)
    .single();

  if (section.is_locked) {
    // Unlock the section to allow editing
    await supabaseService
      .from('document_sections')
      .update({
        is_locked: false,
        locked_at: null,
        locked_by: null,
        locked_text: null,
        selected_suggestion_id: null
      })
      .eq('id', sectionId);
  }

  // ... continue with rejection ...
}
```

**Frontend Changes:**

```javascript
// In showApprovalActions() function
if (permissions.canApprove && state.status === 'pending') {
  // Check if section is locked
  const isLocked = section?.is_locked || false;

  actionsHTML += `
    <button class="btn btn-success btn-sm"
            onclick="approveSection('${sectionId}')"
            ${!isLocked ? 'disabled' : ''}>
      <i class="bi bi-check-circle me-1"></i>Approve
    </button>
    ${!isLocked ? '<small class="text-muted d-block mt-1">⚠️ Lock a suggestion before approving</small>' : ''}
  `;
}
```

---

### Solution 2: **Lenient Auto-Lock (Alternative)**

**Approve Endpoint Changes:**

```javascript
router.post('/sections/:sectionId/approve', requireAuth, async (req, res) => {
  // ... existing permission checks ...

  // NEW: Check if section is locked
  const { data: section } = await supabaseService
    .from('document_sections')
    .select('is_locked, current_text, original_text')
    .eq('id', sectionId)
    .single();

  // If not locked, auto-lock current text
  if (!section.is_locked) {
    const textToLock = section.current_text || section.original_text;

    await supabaseService
      .from('document_sections')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: userId,
        locked_text: textToLock,
        current_text: textToLock
      })
      .eq('id', sectionId);

    console.log(`[AUTO-LOCK] Section ${sectionId} auto-locked on approval`);
  }

  // ... continue with approval ...
}
```

---

### Solution 3: **Warning Messages Only (Minimal)**

**Frontend Changes Only:**

```javascript
async function approveSection(sectionId) {
  // Check if section is locked
  const response = await fetch(`/api/workflow/sections/${sectionId}/state`);
  const data = await response.json();

  if (!data.section.is_locked) {
    const confirmed = confirm(
      '⚠️ WARNING: This section is not locked.\n\n' +
      'Approving an unlocked section means the text can still be changed.\n\n' +
      'Do you want to proceed anyway?'
    );

    if (!confirmed) {
      return;
    }
  }

  // ... continue with approval ...
}
```

---

## 🎯 Recommended Implementation Plan

### Phase 1: **Add Strict Validation (Immediate)**

1. **Modify Approve Endpoint** - Require locked sections
2. **Modify Reject Endpoint** - Auto-unlock on reject
3. **Update Frontend Approve Button** - Disable if not locked
4. **Add Warning Messages** - Guide users on workflow

**Files to Modify:**
- `src/routes/workflow.js` (approve/reject endpoints)
- `views/dashboard/document-viewer.ejs` (approval actions)
- `public/js/workflow-actions.js` (if exists)

### Phase 2: **Add User Guidance (Short-term)**

1. **Add tooltip/helper text** - Explain lock-before-approve
2. **Add visual indicators** - Show when section is ready to approve
3. **Add workflow progress hints** - "Step 1: Lock, Step 2: Approve"

### Phase 3: **Add Audit Trail (Long-term)**

1. **Track approval attempts on unlocked sections**
2. **Log auto-unlock on reject**
3. **Add approval history entries**

---

## 📊 Decision Matrix

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Strict Validation** | Prevents errors, enforces workflow integrity | Users must lock before approve | ✅ **BEST** |
| **Auto-Lock** | Convenient, no user training needed | Hides workflow steps, less control | ⚠️ OK |
| **Warning Only** | Flexible, no breaking changes | Users can still make mistakes | ❌ **AVOID** |

---

## 🔧 Quick Fix Code Snippets

### Backend: Approve Endpoint Validation

```javascript
// Add after line 1391 in src/routes/workflow.js
// Check if section is locked before approving
const { data: section, error: sectionError } = await supabaseService
  .from('document_sections')
  .select('is_locked')
  .eq('id', sectionId)
  .single();

if (sectionError) {
  console.error('Error fetching section:', sectionError);
  return res.status(500).json({
    success: false,
    error: 'Failed to check section lock status'
  });
}

if (!section.is_locked) {
  return res.status(400).json({
    success: false,
    error: 'Section must be locked before approval. Please select a suggestion and lock it first.',
    code: 'SECTION_NOT_LOCKED',
    requiresLock: true
  });
}
```

### Backend: Reject Endpoint Auto-Unlock

```javascript
// Add after line 1483 in src/routes/workflow.js
// Auto-unlock section on reject to allow editing
const { data: section } = await supabaseService
  .from('document_sections')
  .select('is_locked')
  .eq('id', sectionId)
  .single();

if (section && section.is_locked) {
  await supabaseService
    .from('document_sections')
    .update({
      is_locked: false,
      locked_at: null,
      locked_by: null,
      locked_text: null,
      selected_suggestion_id: null
    })
    .eq('id', sectionId);

  console.log(`[AUTO-UNLOCK] Section ${sectionId} unlocked on rejection`);
}
```

### Frontend: Disable Approve if Not Locked

```javascript
// Update in views/dashboard/document-viewer.ejs around line 1066
if (permissions.canApprove && state.status === 'pending') {
  const isLocked = section?.is_locked || false;

  actionsHTML += `
    <button class="btn btn-success btn-sm"
            onclick="approveSection('${sectionId}')"
            ${!isLocked ? 'disabled title="Lock a suggestion before approving"' : ''}>
      <i class="bi bi-check-circle me-1"></i>Approve
    </button>
    ${!isLocked ? `
      <small class="text-warning d-block mt-1">
        <i class="bi bi-exclamation-triangle me-1"></i>
        Lock a suggestion or "Keep Original Text" before approving
      </small>
    ` : ''}
  `;
}
```

---

## ✅ Testing Checklist (After Implementation)

- [ ] **Locked + Approve** → Should succeed
- [ ] **Unlocked + Approve** → Should fail with error message
- [ ] **Unlocked + Approve** → Approve button disabled in UI
- [ ] **Locked + Reject** → Should succeed and auto-unlock
- [ ] **Unlocked + Reject** → Should succeed (no lock to remove)
- [ ] **Lock then Approve** → Should succeed (happy path)
- [ ] **Reject then Edit then Lock then Approve** → Should succeed

---

## 🎉 Summary

**Current State:**
- ❌ Sections can be approved without being locked
- ❌ Selected suggestions can be ignored
- ❌ Rejected locked sections remain locked

**Recommended State:**
- ✅ Sections MUST be locked before approval
- ✅ Rejected sections auto-unlock for editing
- ✅ Users see clear warnings and disabled buttons
- ✅ Workflow integrity is enforced at backend AND frontend

**Next Steps:**
1. Implement strict validation in approve endpoint
2. Add auto-unlock in reject endpoint
3. Update frontend to disable approve button when not locked
4. Add helper text to guide users
5. Test all scenarios thoroughly
