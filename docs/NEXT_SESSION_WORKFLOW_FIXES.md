# Next Session: Workflow Approval Fixes

**Date:** October 17, 2025
**Context:** 2% remaining, need to implement approved changes

---

## ✅ APPROVED CHANGES TO IMPLEMENT

### 1. **Approve Endpoint: Require Lock First**

**File:** `src/routes/workflow.js` (lines ~1391-1430)

**Add after permission checks (around line 1391):**

```javascript
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

---

### 2. **Remove Reject Button from UI**

**File:** `views/dashboard/document-viewer.ejs` (lines ~1074-1080)

**DELETE THIS CODE:**
```javascript
if (permissions.canReject && state.status !== 'rejected') {
  actionsHTML += `
    <button class="btn btn-danger btn-sm" onclick="rejectSection('${sectionId}')">
      <i class="bi bi-x-circle me-1"></i>Reject
    </button>
  `;
}
```

**Reason:** Section-level reject not needed. Workflow uses lock/approve flow only.

---

### 3. **Disable Approve Button When Not Locked**

**File:** `views/dashboard/document-viewer.ejs` (lines ~1066-1072)

**REPLACE:**
```javascript
if (permissions.canApprove && state.status === 'pending') {
  actionsHTML += `
    <button class="btn btn-success btn-sm" onclick="approveSection('${sectionId}')">
      <i class="bi bi-check-circle me-1"></i>Approve
    </button>
  `;
}
```

**WITH:**
```javascript
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

### 4. **Add Frontend Error Handling**

**File:** `public/js/workflow-actions.js` OR inline in `document-viewer.ejs`

**Update approveSection() function to handle SECTION_NOT_LOCKED error:**

```javascript
async function approveSection(sectionId) {
  // ... existing code ...

  const data = await response.json();

  if (!data.success) {
    if (data.code === 'SECTION_NOT_LOCKED') {
      showToast('⚠️ Please lock a suggestion before approving', 'warning');
    } else {
      showToast('Error: ' + (data.error || 'Failed to approve section'), 'danger');
    }
    return;
  }

  // ... success handling ...
}
```

---

## 📊 Summary of Changes

### Backend (src/routes/workflow.js)
- ✅ Add lock validation to approve endpoint
- ⚠️ Keep reject endpoint (may be used elsewhere, just remove UI button)

### Frontend (views/dashboard/document-viewer.ejs)
- ✅ Disable approve button when section not locked
- ✅ Add warning text when not locked
- ✅ Remove reject button from UI
- ✅ Update approveSection() error handling

---

## 🧪 Testing Checklist

After implementing:
- [ ] Try to approve unlocked section → Should show error
- [ ] Approve button should be disabled (gray) when not locked
- [ ] Warning text should appear: "Lock a suggestion before approving"
- [ ] Lock section → Approve button enables (green)
- [ ] Approve locked section → Should succeed
- [ ] Reject button should NOT appear anywhere

---

## 🚀 Deployment

```bash
# After implementing changes
git add src/routes/workflow.js views/dashboard/document-viewer.ejs docs/
git commit -m "feat: Require section lock before approval and remove reject button

### Changes
- Add validation to approve endpoint requiring locked sections
- Disable approve button when section not locked
- Add warning text guiding users to lock first
- Remove section-level reject button from UI

### Business Logic
- Sections MUST be locked before approval to ensure text finalization
- Lock-then-approve flow enforces workflow integrity
- Prevents approving changeable text

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

## 📚 Related Documentation

- **Main Analysis:** `docs/WORKFLOW_SCENARIOS_ANALYSIS.md`
- **Lock Implementation:** `docs/WORKFLOW_LOCK_IMPLEMENTATION_COMPLETE.md`
- **Unlock Implementation:** `docs/WORKFLOW_UNLOCK_IMPLEMENTATION.md`

---

## ⚠️ IMPORTANT NOTES

1. **Don't delete reject endpoint** - Keep backend endpoint in case it's used elsewhere
2. **Only remove UI button** - Just hide it from document viewer
3. **Test with admin user** - Approval requires permissions
4. **Section must be locked** - This is now enforced at backend AND frontend

---

**Status:** READY TO IMPLEMENT
**Estimated Time:** 10-15 minutes
**Priority:** HIGH (fixes critical workflow integrity issue)
