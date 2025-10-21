# QA Testing Checklist - Tasks 3.1 & 3.2
## Admin Section Restrictions

**Date**: October 19, 2025
**Tasks**: 3.1 (Delete Restriction), 3.2 (Split/Join with Suggestions)
**Tester**: _________________
**Test Date**: _________________

---

## Pre-Testing Setup

- [ ] **Environment**: Staging / Production (circle one)
- [ ] **Database**: Backed up before testing
- [ ] **Test Users Created**:
  - [ ] Global Admin account
  - [ ] Org Admin account
  - [ ] Regular user account
- [ ] **Test Document Created** with at least 3 sections
- [ ] **Browser**: Chrome / Firefox / Safari / Edge (circle tested)

---

## Task 3.1: Delete Restriction Testing

### ✅ UI Verification

**Global Admin User**

- [ ] **Step 1**: Login as Global Admin
- [ ] **Step 2**: Navigate to any document
- [ ] **Step 3**: Expand a section
- [ ] **Step 4**: Verify section editing controls visible
- [ ] **Expected**: Delete button is NOT visible
- [ ] **Expected**: Rename, Move, Indent/Dedent, Split, Join buttons ARE visible
- [ ] **Result**: PASS / FAIL (circle one)
- [ ] **Screenshot**: Attached (Y/N)

**Org Admin User**

- [ ] **Step 1**: Login as Org Admin
- [ ] **Step 2**: Navigate to organization's document
- [ ] **Step 3**: Expand a section
- [ ] **Step 4**: Verify section editing controls visible
- [ ] **Expected**: Delete button is NOT visible
- [ ] **Expected**: Other editing buttons ARE visible
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ Backend API Verification

**Direct API Test (Global Admin)**

- [ ] **Step 1**: Login as Global Admin
- [ ] **Step 2**: Get session cookie/token
- [ ] **Step 3**: Execute: `DELETE /admin/sections/{section-id}`
- [ ] **Expected HTTP Status**: 403 Forbidden
- [ ] **Expected Response**:
  ```json
  {
    "success": false,
    "error": "Administrators cannot delete sections. Use editing tools to modify content.",
    "code": "ADMIN_DELETE_FORBIDDEN"
  }
  ```
- [ ] **Result**: PASS / FAIL (circle one)
- [ ] **Response Body**: ______________________________

**Direct API Test (Org Admin)**

- [ ] Same test as above for Org Admin
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ Data Persistence Verification

- [ ] **Step 1**: Note section ID before delete attempt
- [ ] **Step 2**: Attempt delete (should fail)
- [ ] **Step 3**: Query database: `SELECT * FROM document_sections WHERE id = '{section-id}'`
- [ ] **Expected**: Section still exists with unchanged data
- [ ] **Result**: PASS / FAIL (circle one)

---

## Task 3.2: Split/Join with Suggestions Testing

### ✅ Initial State (No Suggestions)

**Split Button - Clean Section**

- [ ] **Step 1**: Login as Admin
- [ ] **Step 2**: Expand section WITHOUT suggestions
- [ ] **Expected**: Split button is ENABLED
- [ ] **Expected**: No warning message below buttons
- [ ] **Expected**: Tooltip says "Split section into two"
- [ ] **Result**: PASS / FAIL (circle one)

**Join Button - Clean Section**

- [ ] Same test for Join button
- [ ] **Expected**: Join button is ENABLED
- [ ] **Expected**: Tooltip says "Join with adjacent sections"
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ State with Active Suggestions

**Add Suggestion to Section**

- [ ] **Step 1**: Expand a section
- [ ] **Step 2**: Click "Add Suggestion"
- [ ] **Step 3**: Submit a suggestion
- [ ] **Step 4**: Refresh page or collapse/expand section
- [ ] **Expected**: Split/Join buttons become DISABLED
- [ ] **Expected**: Warning message appears:
  ```
  ⚠ Split/Join disabled: This section has 1 active suggestion.
  Resolve suggestions before splitting or joining.
  ```
- [ ] **Result**: PASS / FAIL (circle one)
- [ ] **Screenshot**: Attached (Y/N)

**Visual Appearance of Disabled Buttons**

- [ ] **Opacity**: Button appears grayed out (~50% opacity)
- [ ] **Cursor**: Changes to "not-allowed" on hover
- [ ] **Tooltip**: Shows warning instead of action description
- [ ] **Background**: Light gray (#e9ecef)
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ Client-side Validation

**Split Button Click Test**

- [ ] **Step 1**: Section has active suggestion
- [ ] **Step 2**: Split button is disabled
- [ ] **Step 3**: Try clicking disabled button
- [ ] **Expected**: Toast notification appears: "Cannot split section with active suggestions. Resolve suggestions first."
- [ ] **Expected**: Modal does NOT open
- [ ] **Result**: PASS / FAIL (circle one)

**Join Button Click Test**

- [ ] Same test for Join button
- [ ] **Expected**: Toast notification appears
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ Backend API Validation - Split

**Test Split with Active Suggestion**

- [ ] **Step 1**: Create section with suggestion
- [ ] **Step 2**: Execute: `POST /admin/sections/{section-id}/split`
  ```json
  {
    "splitPosition": 25,
    "newSectionTitle": "Test Part 2",
    "newSectionNumber": "1.2"
  }
  ```
- [ ] **Expected HTTP Status**: 400 Bad Request
- [ ] **Expected Response**:
  ```json
  {
    "success": false,
    "error": "Cannot split this section because it has 1 active suggestion(s). Resolve suggestions first.",
    "code": "HAS_ACTIVE_SUGGESTIONS",
    "suggestionCount": 1,
    "suggestions": [...]
  }
  ```
- [ ] **Result**: PASS / FAIL (circle one)

**Test Split After Resolving Suggestions**

- [ ] **Step 1**: Reject the suggestion (set `rejected_at`)
- [ ] **Step 2**: Execute same split API call
- [ ] **Expected HTTP Status**: 200 OK
- [ ] **Expected**: Section successfully split into 2 sections
- [ ] **Expected**: Original section text shortened
- [ ] **Expected**: New section created with second part
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ Backend API Validation - Join

**Test Join with Active Suggestions**

- [ ] **Step 1**: Create 2 adjacent sections
- [ ] **Step 2**: Add suggestion to first section
- [ ] **Step 3**: Execute: `POST /admin/sections/join`
  ```json
  {
    "sectionIds": ["{section1-id}", "{section2-id}"],
    "separator": "\n\n",
    "targetSectionId": "{section1-id}"
  }
  ```
- [ ] **Expected HTTP Status**: 400 Bad Request
- [ ] **Expected Response**:
  ```json
  {
    "success": false,
    "error": "Cannot join sections: 1 active suggestion(s) exist across 1 section(s). Resolve all suggestions before joining.",
    "code": "HAS_ACTIVE_SUGGESTIONS",
    "totalSuggestions": 1,
    "affectedSections": [
      {
        "id": "...",
        "number": "1",
        "title": "Section 1",
        "suggestionCount": 1
      }
    ]
  }
  ```
- [ ] **Result**: PASS / FAIL (circle one)

**Test Join with Multiple Sections Having Suggestions**

- [ ] **Step 1**: Create 3 adjacent sections
- [ ] **Step 2**: Add suggestions to first AND third sections
- [ ] **Step 3**: Execute join API call
- [ ] **Expected**: Error shows ALL affected sections
- [ ] **Expected**: `totalSuggestions` matches sum across sections
- [ ] **Expected**: `affectedSections` array has 2 entries
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ UI State Updates

**After Rejecting Suggestion**

- [ ] **Step 1**: Section has active suggestion (buttons disabled)
- [ ] **Step 2**: Click "Reject" on the suggestion
- [ ] **Step 3**: Refresh page or collapse/expand section
- [ ] **Expected**: Split/Join buttons become ENABLED
- [ ] **Expected**: Warning message disappears
- [ ] **Result**: PASS / FAIL (circle one)

**Dynamic Count Display**

- [ ] **Step 1**: Section has 1 suggestion
- [ ] **Step 2**: Add another suggestion (total 2)
- [ ] **Step 3**: Refresh view
- [ ] **Expected**: Warning shows "2 active suggestions"
- [ ] **Expected**: Buttons still disabled
- [ ] **Result**: PASS / FAIL (circle one)

### ✅ Edge Cases

**Rejected Suggestions Don't Block**

- [ ] **Step 1**: Create section with suggestion
- [ ] **Step 2**: Reject the suggestion
- [ ] **Step 3**: Verify buttons are ENABLED
- [ ] **Expected**: Rejected suggestions don't count as "active"
- [ ] **Result**: PASS / FAIL (circle one)

**Multiple Sections, Some with Suggestions**

- [ ] **Step 1**: Section A: no suggestions (buttons enabled)
- [ ] **Step 2**: Section B: has suggestions (buttons disabled)
- [ ] **Step 3**: Verify each section's buttons have correct state
- [ ] **Result**: PASS / FAIL (circle one)

**Locked Section Behavior**

- [ ] **Step 1**: Lock a section (via workflow)
- [ ] **Step 2**: Try to access split/join
- [ ] **Expected**: Section editing controls not accessible (locked sections can't be edited)
- [ ] **Result**: PASS / FAIL (circle one)

---

## Cross-Browser Testing

### Chrome
- [ ] All Task 3.1 tests: PASS / FAIL
- [ ] All Task 3.2 tests: PASS / FAIL
- [ ] **Version**: _________

### Firefox
- [ ] All Task 3.1 tests: PASS / FAIL
- [ ] All Task 3.2 tests: PASS / FAIL
- [ ] **Version**: _________

### Safari
- [ ] All Task 3.1 tests: PASS / FAIL
- [ ] All Task 3.2 tests: PASS / FAIL
- [ ] **Version**: _________

### Edge
- [ ] All Task 3.1 tests: PASS / FAIL
- [ ] All Task 3.2 tests: PASS / FAIL
- [ ] **Version**: _________

---

## Performance Testing

**Page Load with 50+ Sections**

- [ ] **Step 1**: Document with 50+ sections
- [ ] **Step 2**: 25 sections have suggestions
- [ ] **Step 3**: Load document viewer page
- [ ] **Expected**: Page loads within 3 seconds
- [ ] **Expected**: Button states correctly set for all sections
- [ ] **Actual Load Time**: _________ seconds
- [ ] **Result**: PASS / FAIL (circle one)

**Suggestion Count Query Performance**

- [ ] **Step 1**: Monitor database queries during page load
- [ ] **Expected**: One query per section (or batch query)
- [ ] **Expected**: Query uses index on `section_id` and `rejected_at`
- [ ] **Actual Query Count**: _________
- [ ] **Result**: PASS / FAIL (circle one)

---

## Accessibility Testing

**Keyboard Navigation**

- [ ] **Tab** through section editing controls
- [ ] **Expected**: Disabled buttons are focusable but show disabled cursor
- [ ] **Expected**: Tooltip appears on focus
- [ ] **Result**: PASS / FAIL (circle one)

**Screen Reader**

- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] **Expected**: Button state announced as "disabled"
- [ ] **Expected**: Warning message read aloud
- [ ] **Result**: PASS / FAIL (circle one)

---

## Security Testing

**Session Bypass Attempt**

- [ ] **Step 1**: Login as admin
- [ ] **Step 2**: Manually change session cookie/role
- [ ] **Step 3**: Attempt delete via API
- [ ] **Expected**: Server validates session server-side
- [ ] **Expected**: 403 or 401 error
- [ ] **Result**: PASS / FAIL (circle one)

**CSRF Protection**

- [ ] **Step 1**: Attempt API calls without CSRF token
- [ ] **Expected**: Requests rejected
- [ ] **Result**: PASS / FAIL (circle one)

---

## Error Message Testing

**User-Friendly Messages**

All error messages should be:
- [ ] Clear and actionable
- [ ] Free of technical jargon
- [ ] Explain how to resolve the issue
- [ ] Result**: PASS / FAIL (circle one)

**Error Message Examples**

Task 3.1:
- [ ] "Administrators cannot delete sections. Use editing tools to modify content."

Task 3.2 (Split):
- [ ] "Cannot split this section because it has N active suggestion(s). Resolve suggestions first."

Task 3.2 (Join):
- [ ] "Cannot join sections: N active suggestion(s) exist across M section(s). Resolve all suggestions before joining."

---

## Integration Testing

**Workflow Integration**

- [ ] **Step 1**: Section in workflow (e.g., "Under Review")
- [ ] **Step 2**: Add suggestion
- [ ] **Step 3**: Verify buttons disabled for BOTH workflow AND suggestions
- [ ] **Result**: PASS / FAIL (circle one)

**Suggestion Lifecycle**

- [ ] **Step 1**: Create suggestion → buttons disabled
- [ ] **Step 2**: Approve suggestion → suggestion resolved
- [ ] **Step 3**: Verify buttons re-enabled
- [ ] **Result**: PASS / FAIL (circle one)

---

## Regression Testing

**Existing Features Still Work**

- [ ] Rename section: WORKS / BROKEN
- [ ] Move section up/down: WORKS / BROKEN
- [ ] Indent/dedent section: WORKS / BROKEN
- [ ] Add suggestion: WORKS / BROKEN
- [ ] Reject suggestion: WORKS / BROKEN
- [ ] Lock section (workflow): WORKS / BROKEN
- [ ] Approve section (workflow): WORKS / BROKEN

---

## Bugs Found

| # | Severity | Description | Steps to Reproduce | Expected | Actual |
|---|----------|-------------|-------------------|----------|--------|
| 1 | High/Med/Low | | | | |
| 2 | High/Med/Low | | | | |
| 3 | High/Med/Low | | | | |

---

## Overall Test Results

### Task 3.1: Delete Restriction
- **Total Tests**: _____
- **Passed**: _____
- **Failed**: _____
- **Success Rate**: _____%
- **Status**: ✅ PASS / ❌ FAIL

### Task 3.2: Split/Join with Suggestions
- **Total Tests**: _____
- **Passed**: _____
- **Failed**: _____
- **Success Rate**: _____%
- **Status**: ✅ PASS / ❌ FAIL

### Overall Implementation
- **Ready for Production**: YES / NO / NEEDS FIXES
- **Critical Issues Found**: _____
- **Minor Issues Found**: _____

---

## Sign-Off

**QA Tester**: _________________________ Date: _________
**Signature**: _________________________

**Developer**: _________________________ Date: _________
**Signature**: _________________________

**Product Owner**: _____________________ Date: _________
**Signature**: _________________________

---

## Notes & Comments

```
[Additional testing notes, observations, or recommendations]






```

---

**Testing completed on**: _________________
**Environment**: Staging / Production
**Build/Commit**: _________________
