# Quick Testing Guide - User Facing Validation

**Purpose:** Get the server running and perform critical user-facing tests ASAP.

---

## Prerequisites

```bash
# 1. Navigate to project directory
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# 2. Ensure dependencies are installed
npm install

# 3. Check .env file exists with Supabase credentials
cat .env | grep SUPABASE_URL
```

---

## Start Server

```bash
# Start the server
npm start

# Expected output:
# > Bylaws Amendment Tracker running on http://localhost:3000
# > Current Configuration:
# > - App URL: http://localhost:3000
# > - Supabase: Connected
```

---

## Critical Tests (5 minutes)

### Test 1: Admin Organization Route (CRITICAL)

**URL:** http://localhost:3000/admin/organization

**Expected:**
- HTTP 200 status
- Organization list displays
- No JavaScript errors in console

**Actual:** _____________________

**Screenshots:** _____________________

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

---

### Test 2: Suggestion Filtering

**URL:** http://localhost:3000/bylaws

**Steps:**
1. Open browser DevTools (F12)
2. Navigate to /bylaws page
3. Expand Section 1.1
4. In Console tab, run:

```javascript
// Get section ID from expanded section
const section = currentSections[0];
console.log('Testing section:', section.section_citation);

// Load suggestions via API
const response = await fetch(`/bylaws/api/sections/${section.id}/suggestions`);
const data = await response.json();

// Verify all suggestions belong to this section
const wrongSection = data.suggestions.filter(s => s.section_id !== section.id);

if (wrongSection.length > 0) {
  console.error('❌ FAIL: Found', wrongSection.length, 'suggestions from other sections!');
} else {
  console.log('✅ PASS: All', data.suggestions.length, 'suggestions belong to this section');
}
```

**Result:** _____________________

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

---

### Test 3: Diff View Display

**URL:** http://localhost:3000/bylaws

**Steps:**
1. Expand any section with suggestions
2. Click "Show Changes" button on a suggestion
3. Verify visual styling:
   - Deleted text: RED background + strikethrough
   - Added text: GREEN background
   - Unchanged text: normal styling

**Visual Check:**
- ⬜ Red deletions visible
- ⬜ Green additions visible
- ⬜ Text properly formatted
- ⬜ Changes make sense

**Screenshots:** _____________________

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

---

### Test 4: Section Locking

**URL:** http://localhost:3000/bylaws

**Steps:**
1. Expand an unlocked section
2. Select a suggestion (radio button)
3. Click "Lock Section with Selection"
4. Enter notes (optional)
5. Submit

**Expected:**
- Section background turns yellow
- Lock badge shows "🔒 Locked"
- Selected text appears in locked section
- "Unlock Section" button appears

**Visual Check:**
- ⬜ Yellow background
- ⬜ Lock badge updated
- ⬜ Selected text shown
- ⬜ Unlock button present

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

---

### Test 5: Suggestion Count Accuracy

**URL:** http://localhost:3000/bylaws

**Run in Console:**
```javascript
// Auto-verify suggestion counts
function verifyCounts() {
  const sections = document.querySelectorAll('.section-card');
  let allCorrect = true;
  let results = [];

  sections.forEach((card, index) => {
    const citation = card.querySelector('h6').textContent;
    const badge = card.querySelector('.badge.bg-info');
    const badgeCount = parseInt(badge.textContent.split(' ')[0]);

    // Expand section
    card.click();

    setTimeout(() => {
      const suggestions = card.querySelectorAll('.suggestion-item');
      const actualCount = suggestions.length - 1; // Subtract "Keep Original"

      const match = badgeCount === actualCount;
      results.push({
        section: citation,
        badge: badgeCount,
        actual: actualCount,
        match: match
      });

      if (!match) {
        console.error(`❌ ${citation}: Badge=${badgeCount}, Actual=${actualCount}`);
        allCorrect = false;
      } else {
        console.log(`✅ ${citation}: ${actualCount} suggestions`);
      }

      if (index === sections.length - 1) {
        setTimeout(() => {
          console.table(results);
          if (allCorrect) {
            console.log('\n✅ ALL COUNTS ACCURATE!');
          } else {
            console.error('\n❌ SOME COUNTS ARE WRONG!');
          }
        }, 1000);
      }
    }, 300 * (index + 1));
  });
}

verifyCounts();
```

**Result:** _____________________

**Pass/Fail:** ⬜ PASS  ⬜ FAIL

---

## API Verification Tests

### Direct API Test (Run in Terminal)

```bash
# Get all sections
curl http://localhost:3000/bylaws/api/sections/default | jq '.sections[] | {citation, id, suggestions: (.bylaw_suggestions | length)}'

# Get suggestions for specific section (replace {section_id})
curl http://localhost:3000/bylaws/api/sections/{section_id}/suggestions | jq '.suggestions[] | {id, section_id, author_name}'

# Verify all suggestions belong to the section
curl http://localhost:3000/bylaws/api/sections/{section_id}/suggestions | jq '.suggestions[] | select(.section_id != "{section_id}")'
# Should return EMPTY (no results = correct filtering)
```

---

## Database Verification

```sql
-- Connect to Supabase via psql or Supabase Dashboard SQL Editor

-- Check sections exist
SELECT id, section_citation, article_number, section_number, locked_by_committee
FROM bylaw_sections
ORDER BY section_citation
LIMIT 10;

-- Check suggestion distribution
SELECT
  s.section_citation,
  COUNT(sug.id) as direct_suggestions,
  COUNT(DISTINCT ss.suggestion_id) as multi_section_suggestions
FROM bylaw_sections s
LEFT JOIN bylaw_suggestions sug ON s.id = sug.section_id
LEFT JOIN suggestion_sections ss ON s.id = ss.section_id
GROUP BY s.id, s.section_citation
ORDER BY s.section_citation;

-- Verify suggestion filtering (should return NO ROWS with wrong section_id)
SELECT sug.id, sug.section_id, s.section_citation
FROM bylaw_suggestions sug
JOIN bylaw_sections s ON s.id = '{test_section_id}'
WHERE sug.section_id != '{test_section_id}';
```

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Admin Organization Route | ⬜ | _________ |
| Suggestion Filtering | ⬜ | _________ |
| Diff View Display | ⬜ | _________ |
| Section Locking | ⬜ | _________ |
| Suggestion Count | ⬜ | _________ |

---

## Critical Issues Found During Testing

### Issue 1:
**Description:** _____________________
**Severity:** ⬜ CRITICAL  ⬜ HIGH  ⬜ MEDIUM  ⬜ LOW
**Steps to Reproduce:** _____________________
**Expected:** _____________________
**Actual:** _____________________
**Screenshots:** _____________________

### Issue 2:
**Description:** _____________________
**Severity:** ⬜ CRITICAL  ⬜ HIGH  ⬜ MEDIUM  ⬜ LOW
**Steps to Reproduce:** _____________________
**Expected:** _____________________
**Actual:** _____________________
**Screenshots:** _____________________

---

## Sign-off

**Tester Name:** _____________________
**Date:** _____________________
**Time Spent:** _____________________

**Overall Assessment:**
⬜ PASS - Ready for deployment
⬜ CONDITIONAL PASS - Minor issues found, non-blocking
⬜ FAIL - Critical issues found, deployment blocked

**Notes:** _____________________

---

**Next Steps:**
1. If all tests PASS → Update main validation document and approve deployment
2. If tests FAIL → Document issues, create bug tickets, re-test after fixes
3. Archive test results with screenshots for audit trail
