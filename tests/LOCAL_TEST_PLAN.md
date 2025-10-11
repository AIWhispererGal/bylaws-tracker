# Local Testing Plan - Google Apps Script Removal
## Post-Migration Validation

**Date Created:** 2025-10-11
**Swarm ID:** swarm-1760221389887-x2atwleks
**Prepared by:** TESTER Agent (Hive Mind)

---

## Executive Summary

This test plan validates that:
1. All Google Apps Script functionality has been successfully replaced
2. Custom parsers (Word/mammoth) are functioning correctly
3. The application works completely standalone
4. No breaking changes were introduced
5. Archived files are properly isolated and not interfering

---

## 1. Pre-Test Environment Setup

### 1.1 Required Software
- Node.js (v16+ recommended)
- npm (comes with Node.js)
- Git (for version tracking)
- A modern web browser (Chrome/Firefox/Edge)
- A test Word document (.docx) with sample bylaws

### 1.2 Environment Variables Check

```bash
# Navigate to project directory
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# Verify .env file exists and contains required variables
cat .env
```

**Required variables:**
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-key>
APP_URL=http://localhost:3000
PORT=3000
SESSION_SECRET=<random-secret-string>
```

### 1.3 Install Dependencies

```bash
# Install all node modules
npm install

# Verify installation
npm list mammoth @supabase/supabase-js express multer
```

Expected output should show all packages installed without errors.

### 1.4 Database Verification

Check Supabase tables exist:
- organizations
- bylaw_sections
- bylaw_suggestions
- suggestion_sections
- v_suggestions_with_sections (view)

---

## 2. Custom Parser Functionality Tests

### Test 2.1: Word Document Parser - Basic Functionality

**Objective:** Verify mammoth library successfully parses .docx files

**Test Data Required:**
- A sample Word document with article/section structure
- Example: "ARTICLE I - NAME" followed by "Section 1: Purpose"

**Steps:**
1. Start the application: `npm start`
2. Navigate to `http://localhost:3000`
3. If redirected to setup wizard, complete the setup:
   - Enter organization details
   - Configure document structure (Article → Section)
   - Choose workflow template
   - **Upload test Word document**
   - Wait for processing to complete

**Expected Results:**
- Document uploads without errors
- Sections are detected and parsed correctly
- Article numbers and section numbers are captured
- Section text content is preserved
- No errors in console logs related to parsing

**Validation Queries:**
```sql
-- Run in Supabase SQL Editor
SELECT
  section_citation,
  section_title,
  article_number,
  section_number,
  LENGTH(original_text) as text_length
FROM bylaw_sections
ORDER BY article_number, section_number;
```

**Pass Criteria:**
- [ ] All sections from Word doc appear in database
- [ ] Section citations match document structure
- [ ] Text content is not truncated
- [ ] Article/section numbers are numeric and sequential
- [ ] No "undefined" or "null" values in critical fields

---

### Test 2.2: Hierarchy Detection

**Objective:** Verify hierarchyDetector correctly identifies document structure

**Test File:** `/src/utils/hierarchyDetector.js`

**Manual Verification Steps:**
1. Review your uploaded Word document structure
2. Note the hierarchy levels used (e.g., Roman numerals for articles, Arabic for sections)
3. Check database entries match this structure

**Expected Results:**
- Articles detected with pattern: "ARTICLE I", "ARTICLE II", etc.
- Sections detected with pattern: "Section 1", "Section 2", etc.
- Hierarchy preserved in database (article_number, section_number columns)

**Validation:**
```bash
# Check logs during upload for hierarchy detection messages
# Look for:
# [WordParser] Detected TOC: lines X-Y
# [WordParser] Filtered N TOC items, kept M real headers
# [WordParser] No duplicate sections found
```

**Pass Criteria:**
- [ ] Correct number of articles detected
- [ ] Correct number of sections per article
- [ ] No duplicate sections created
- [ ] Table of contents entries filtered out (if present)
- [ ] Section numbering is sequential within each article

---

### Test 2.3: Text Extraction Quality

**Objective:** Verify that mammoth extracts clean, readable text

**Steps:**
1. Compare a section in your Word document with database content
2. Open a section in the application UI
3. Verify text matches original

**Expected Results:**
- Text formatting is clean (no HTML tags visible)
- Paragraph breaks preserved
- Special characters handled correctly
- No encoding issues (é, ñ, etc. display correctly)

**Validation:**
```sql
-- Check for common parsing issues
SELECT
  section_citation,
  CASE
    WHEN original_text LIKE '%<%>%' THEN 'Contains HTML tags'
    WHEN original_text LIKE '%&nbsp;%' THEN 'Contains HTML entities'
    WHEN LENGTH(original_text) < 10 THEN 'Too short'
    WHEN original_text LIKE '%undefined%' THEN 'Contains undefined'
    ELSE 'OK'
  END as quality_check
FROM bylaw_sections
WHERE quality_check != 'OK';
```

**Pass Criteria:**
- [ ] Query returns no rows (all sections pass quality check)
- [ ] Text is human-readable in UI
- [ ] No HTML artifacts visible
- [ ] Proper line breaks between paragraphs

---

## 3. Standalone Application Tests

### Test 3.1: No Google Dependencies

**Objective:** Confirm application runs without any Google services

**Steps:**
1. Disconnect from internet (optional but thorough)
2. Start application: `npm start`
3. Access local interface: `http://localhost:3000`
4. Navigate through all major features

**Expected Results:**
- Application starts without network requests to Google
- No console errors about missing Google APIs
- Setup wizard functions completely offline
- File upload works with local files

**Validation:**
Check browser DevTools Network tab:
- Filter: `google.com`
- Should show: **0 requests**

**Pass Criteria:**
- [ ] No requests to googleapis.com
- [ ] No requests to docs.google.com
- [ ] No console errors mentioning Google
- [ ] No "CORS" or "authentication" errors related to Google

---

### Test 3.2: CORS Headers Review

**Objective:** Verify CORS settings are appropriate for standalone use

**Current Code Review:**
```javascript
// In server.js lines 50-56:
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});
```

**Assessment:**
- Currently allows all origins (`*`)
- Was needed for Google Apps Script integration
- Consider tightening for production

**Recommendation:**
For standalone deployment, these broad CORS settings are unnecessary. Consider:
```javascript
// More restrictive CORS for standalone use
app.use((req, res, next) => {
  const allowedOrigins = [process.env.APP_URL];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // ... rest of headers
});
```

**Pass Criteria:**
- [ ] Application functions with current CORS settings
- [ ] No CORS errors in browser console
- [ ] Document recommendation for production hardening

---

## 4. Feature Functionality Tests

### Test 4.1: Section Viewing

**Steps:**
1. Navigate to bylaws page: `http://localhost:3000/bylaws`
2. View list of sections
3. Click to expand a section
4. View section details

**Expected Results:**
- All sections from uploaded document are listed
- Sections display article/section numbers correctly
- Original text displays properly
- No JavaScript errors

**Pass Criteria:**
- [ ] Section list loads completely
- [ ] Click events work
- [ ] Text is readable and properly formatted
- [ ] Section citations match uploaded document

---

### Test 4.2: Suggestion Creation

**Steps:**
1. Select a section
2. Click "Add Suggestion" or similar button
3. Fill in suggestion form:
   - Author name
   - Suggested text
   - Rationale
4. Submit suggestion

**Expected Results:**
- Form accepts input
- Suggestion saves to database
- Suggestion appears in section's suggestion list
- Support count initializes to 0

**Validation:**
```sql
SELECT
  bs.section_citation,
  bsg.author_name,
  bsg.status,
  bsg.suggested_text,
  bsg.created_at
FROM bylaw_suggestions bsg
JOIN bylaw_sections bs ON bsg.section_id = bs.id
ORDER BY bsg.created_at DESC
LIMIT 5;
```

**Pass Criteria:**
- [ ] Suggestions save successfully
- [ ] Author name stored correctly
- [ ] Status set to 'open'
- [ ] Timestamps populated
- [ ] Suggestion visible in UI

---

### Test 4.3: Multi-Section Suggestions

**Steps:**
1. Select multiple sections (Ctrl+Click or Shift+Click)
2. Create a suggestion spanning multiple sections
3. Verify suggestion links to all selected sections

**Expected Results:**
- Junction table `suggestion_sections` populated
- Suggestion shows it spans multiple sections
- All linked sections display the suggestion

**Validation:**
```sql
SELECT
  bsg.id as suggestion_id,
  bsg.article_scope,
  bsg.section_range,
  COUNT(ss.section_id) as section_count,
  STRING_AGG(bs.section_citation, ', ') as sections
FROM bylaw_suggestions bsg
JOIN suggestion_sections ss ON bsg.id = ss.suggestion_id
JOIN bylaw_sections bs ON ss.section_id = bs.id
WHERE bsg.is_multi_section = true
GROUP BY bsg.id, bsg.article_scope, bsg.section_range;
```

**Pass Criteria:**
- [ ] Multi-section suggestions save correctly
- [ ] Junction table records created
- [ ] Article scope and section range calculated
- [ ] All selected sections linked

---

### Test 4.4: Section Locking (Committee Review)

**Steps:**
1. Select a section with suggestions
2. Choose a suggestion (or keep original)
3. Lock section for committee review
4. Add committee notes

**Expected Results:**
- Section marked as `locked_by_committee = true`
- Selected suggestion ID recorded
- Lock timestamp recorded
- Notes saved

**Validation:**
```sql
SELECT
  section_citation,
  locked_by_committee,
  locked_by,
  locked_at,
  committee_notes,
  selected_suggestion_id
FROM bylaw_sections
WHERE locked_by_committee = true;
```

**Pass Criteria:**
- [ ] Sections lock successfully
- [ ] Cannot edit locked sections
- [ ] Lock status visible in UI
- [ ] Unlock functionality works

---

## 5. Archived Files Isolation Test

### Test 5.1: Google Apps Script Directory

**Objective:** Confirm archived Google Apps Script files don't interfere

**Steps:**
1. Verify google-apps-script directory exists but is not loaded
2. Check no .gs files are referenced in package.json
3. Confirm no references to Google APIs in active code

**Verification Commands:**
```bash
# List archived files
ls -la google-apps-script/

# Search for references to these files in active code
grep -r "google-apps-script" src/ public/ --exclude-dir=node_modules
grep -r "\.gs" src/ server.js --exclude-dir=node_modules | grep -v ".gitignore"
grep -r "clasp" . --exclude-dir=node_modules --exclude=".git"

# Check no Google API references
grep -r "googleapis" src/ server.js --exclude-dir=node_modules
grep -r "google.script" public/ --exclude-dir=node_modules
```

**Expected Results:**
- No active references to .gs files
- No `clasp` commands in scripts
- No Google API client libraries loaded
- Directory exists but isolated

**Pass Criteria:**
- [ ] Searches return 0 active references
- [ ] google-apps-script/ is effectively archived
- [ ] No runtime errors from missing Google files
- [ ] Application doesn't try to load .gs files

---

### Test 5.2: Code Path Analysis

**Files to Verify Are Google-Free:**

1. `/server.js` - Main server file
   - Uses: mammoth for parsing (NOT Google)
   - Uses: Supabase (NOT Google Docs API)

2. `/src/routes/setup.js` - Setup wizard
   - Line 244-256: Google Doc URL accepted but not used
   - Comment says: "TODO: Implement Google Docs fetching"
   - Actually uses file upload path

3. `/src/parsers/googleDocsParser.js`
   - File exists but is placeholder
   - NOT actively used (file upload uses wordParser.js)

4. `/src/parsers/wordParser.js`
   - Uses mammoth library
   - Active parser in use

**Pass Criteria:**
- [ ] server.js imports only mammoth, not Google libraries
- [ ] setup.js processes file uploads, not Google Docs
- [ ] wordParser.js is the active parser
- [ ] googleDocsParser.js is not imported anywhere

---

## 6. Performance & Stability Tests

### Test 6.1: Upload Large Document

**Objective:** Verify parser handles realistic bylaw documents

**Test File Requirements:**
- Word document (.docx)
- 20-50 pages
- 30-100 sections
- Mixed formatting

**Steps:**
1. Upload document via setup wizard
2. Monitor console for errors
3. Wait for processing to complete
4. Verify all sections captured

**Expected Results:**
- Processing completes within 2 minutes
- All sections extracted
- No memory errors
- No timeout errors

**Pass Criteria:**
- [ ] Document processes successfully
- [ ] All sections appear in database
- [ ] No server crash or timeout
- [ ] Memory usage remains reasonable

---

### Test 6.2: Concurrent User Simulation

**Objective:** Test multi-user scenarios

**Steps:**
1. Open application in 2-3 browser windows
2. Perform actions simultaneously:
   - Create suggestions
   - Lock sections
   - View different sections

**Expected Results:**
- No database conflicts
- Changes reflect correctly
- No race conditions

**Pass Criteria:**
- [ ] Concurrent operations succeed
- [ ] No database deadlocks
- [ ] Data consistency maintained
- [ ] No "locked" errors inappropriately

---

## 7. Edge Case Tests

### Test 7.1: Empty Sections

**Objective:** Handle sections with no content

**Test Data:** Word document with section headers but minimal content

**Expected Results:**
- Sections created even if content is brief
- No null text fields
- Default "(No content)" or similar placeholder

**Validation:**
```sql
SELECT
  section_citation,
  LENGTH(original_text) as text_length,
  original_text
FROM bylaw_sections
WHERE LENGTH(original_text) < 20
ORDER BY LENGTH(original_text);
```

**Pass Criteria:**
- [ ] Empty sections handled gracefully
- [ ] No null or undefined in original_text
- [ ] User warned if many empty sections

---

### Test 7.2: Special Characters

**Objective:** Handle Unicode and special characters

**Test Strings in Document:**
- Smart quotes: "Hello" 'World'
- Em dashes: — vs. hyphens: -
- Accented characters: café, résumé
- Symbols: § © ® ™

**Expected Results:**
- All characters preserved correctly
- No encoding corruption
- Display correctly in UI

**Pass Criteria:**
- [ ] Special characters display correctly
- [ ] No "???" or boxes for characters
- [ ] UTF-8 encoding maintained

---

## 8. Rollback Procedures

### If Tests Fail

**Immediate Actions:**
1. Stop the application: `Ctrl+C` in terminal
2. Document the error message and step where failure occurred
3. Do not proceed with deployment

**Rollback Git Changes (if needed):**
```bash
# View current changes
git status
git diff

# Discard changes and return to previous working state
git checkout .
git clean -fd

# Or revert to specific commit
git log --oneline -10
git reset --hard <commit-hash-of-working-version>
```

**Restore Supabase Data (if data corrupted):**
```sql
-- Delete test data
DELETE FROM suggestion_sections WHERE suggestion_id IN (
  SELECT id FROM bylaw_suggestions WHERE created_at > '2025-10-11'
);
DELETE FROM bylaw_suggestions WHERE created_at > '2025-10-11';
DELETE FROM bylaw_sections WHERE doc_id IN (
  SELECT id FROM organizations WHERE created_at > '2025-10-11'
);
DELETE FROM organizations WHERE created_at > '2025-10-11';
```

**Re-enable Google Apps Script (if necessary):**
1. Restore google-apps-script/ files from backup
2. Install clasp: `npm install -g @google/clasp`
3. Re-deploy: `clasp push`
4. Update server.js to re-enable Google integration

---

## 9. Test Execution Checklist

### Pre-Test Setup
- [ ] Node.js and npm installed
- [ ] Dependencies installed (`npm install`)
- [ ] .env file configured
- [ ] Supabase database accessible
- [ ] Test Word document prepared
- [ ] Browser DevTools ready

### Section 1: Environment Setup
- [ ] 1.1 Software verified
- [ ] 1.2 Environment variables correct
- [ ] 1.3 Dependencies installed
- [ ] 1.4 Database tables exist

### Section 2: Parser Tests
- [ ] 2.1 Basic parsing works
- [ ] 2.2 Hierarchy detected correctly
- [ ] 2.3 Text extraction quality good

### Section 3: Standalone Tests
- [ ] 3.1 No Google dependencies
- [ ] 3.2 CORS settings reviewed

### Section 4: Feature Tests
- [ ] 4.1 Section viewing works
- [ ] 4.2 Suggestion creation works
- [ ] 4.3 Multi-section suggestions work
- [ ] 4.4 Section locking works

### Section 5: Archived Files
- [ ] 5.1 Google directory isolated
- [ ] 5.2 Code paths verified

### Section 6: Performance
- [ ] 6.1 Large document handling
- [ ] 6.2 Concurrent users

### Section 7: Edge Cases
- [ ] 7.1 Empty sections handled
- [ ] 7.2 Special characters work

### Post-Test Actions
- [ ] All tests passed
- [ ] Results documented
- [ ] Issues logged (if any)
- [ ] Report prepared for team

---

## 10. Test Results Template

```markdown
# Test Execution Results
Date: __________
Tester: __________
Environment: Local (Windows/Linux/Mac)

## Summary
Total Tests: 23
Passed: ___
Failed: ___
Blocked: ___

## Critical Issues Found
1. [Description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce:
   - Expected vs Actual:

## Minor Issues Found
1. [Description]

## Recommendations
- [Action items]

## Approval
- [ ] Ready for production deployment
- [ ] Requires fixes before deployment
- [ ] Requires additional testing

Signed: ___________
```

---

## 11. Success Criteria

**The migration is successful if:**

1. **Functionality**
   - All core features work without Google Apps Script
   - File upload and parsing functional
   - Database operations successful

2. **Performance**
   - No significant slowdown vs. previous version
   - Handles realistic document sizes

3. **Stability**
   - No crashes or errors during normal use
   - No data loss
   - Concurrent users supported

4. **Independence**
   - Zero dependencies on Google services
   - Runs completely offline
   - No external API calls required

5. **Data Integrity**
   - All sections captured from Word docs
   - Text preserved accurately
   - Relationships maintained

**Go/No-Go Decision:** All items above must be "Pass" for production deployment.

---

## Contact & Support

**For Issues During Testing:**
1. Document the error thoroughly
2. Include screenshots if applicable
3. Note the exact step where failure occurred
4. Check server console for error logs
5. Report to development team

**Log Locations:**
- Browser console: F12 → Console tab
- Server logs: Terminal where `npm start` is running
- Application logs: Check `.swarm/` directory for coordination logs

---

**End of Test Plan**
