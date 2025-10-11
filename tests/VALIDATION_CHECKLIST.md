# Validation Checklist - Google Removal Migration
## Complete Testing Verification

**Project:** Bylaws Amendment Tracker
**Migration:** Google Apps Script → Custom Parser (Mammoth)
**Test Date:** _____________
**Tested By:** _____________

---

## ✅ Pre-Flight Checks

### Environment
- [ ] Node.js installed (version: ______)
- [ ] npm installed (version: ______)
- [ ] Git installed (version: ______)
- [ ] Modern browser available (Chrome/Firefox/Edge)

### Configuration
- [ ] .env file exists in project root
- [ ] SUPABASE_URL configured
- [ ] SUPABASE_ANON_KEY configured
- [ ] APP_URL set to http://localhost:3000
- [ ] SESSION_SECRET set to secure random string

### Dependencies
- [ ] npm install completed without errors
- [ ] mammoth library installed
- [ ] @supabase/supabase-js installed
- [ ] express and express-session installed
- [ ] multer installed (for file uploads)

### Database
- [ ] Supabase project accessible
- [ ] organizations table exists
- [ ] bylaw_sections table exists
- [ ] bylaw_suggestions table exists
- [ ] suggestion_sections table exists
- [ ] v_suggestions_with_sections view exists

---

## 🚫 Google Dependency Checks

### Code Review
- [ ] No `@google/clasp` in package.json
- [ ] No `googleapis` library in dependencies
- [ ] No references to Google APIs in server.js
- [ ] google-apps-script/ directory isolated (not imported)

### Runtime Verification
- [ ] Application starts without Google-related errors
- [ ] Browser console shows 0 Google API requests
- [ ] Network tab shows no calls to googleapis.com
- [ ] Network tab shows no calls to docs.google.com
- [ ] No authentication errors related to Google

### File References
Run these commands and verify NO results:
```bash
grep -r "googleapis" src/ server.js --exclude-dir=node_modules
grep -r "google.script" public/ --exclude-dir=node_modules
grep -r "clasp" package.json
grep -r "GOOGLE_DOC_ID" .env
```
- [ ] All searches return 0 results
- [ ] No active Google dependencies found

---

## 📄 Custom Parser Validation

### Word Parser (Mammoth)
- [ ] wordParser.js file exists at /src/parsers/wordParser.js
- [ ] Mammoth library imported correctly
- [ ] parseDocument() function works
- [ ] extractRawText() successfully extracts text
- [ ] convertToHtml() available for rich formatting

### Hierarchy Detection
- [ ] hierarchyDetector.js exists at /src/utils/hierarchyDetector.js
- [ ] Detects Roman numerals (I, II, III, etc.)
- [ ] Detects Arabic numbers (1, 2, 3, etc.)
- [ ] Detects section patterns
- [ ] Builds correct section citations
- [ ] Article/section numbers calculated correctly

### Text Quality
- [ ] Text extracted is clean (no HTML tags)
- [ ] Paragraph breaks preserved
- [ ] Special characters handled (é, ñ, ©, etc.)
- [ ] No "undefined" or "null" in text
- [ ] Line breaks maintained
- [ ] Whitespace normalized properly

### Table of Contents Handling
- [ ] TOC entries detected and filtered out
- [ ] No duplicate sections from TOC + body
- [ ] Real headers properly identified
- [ ] Section count accurate

---

## 🔧 Functional Tests

### Application Startup
- [ ] npm start completes successfully
- [ ] Server listens on port 3000
- [ ] No error messages in console
- [ ] Supabase connection confirmed
- [ ] Session middleware active

### Setup Wizard
- [ ] Redirects to /setup on first access
- [ ] Organization info form loads
- [ ] Logo upload works (optional)
- [ ] Document structure page loads
- [ ] Workflow configuration loads
- [ ] Import page loads

### File Upload
- [ ] File upload button visible
- [ ] Accepts .docx files
- [ ] Rejects invalid file types (.txt, .pdf, etc.)
- [ ] Shows upload progress (if applicable)
- [ ] Processing screen appears
- [ ] Progress updates visible
- [ ] Completes without timeout

### Document Processing
- [ ] Sections extracted from Word document
- [ ] Correct number of sections detected
- [ ] Article numbers assigned correctly
- [ ] Section numbers assigned correctly
- [ ] Section citations formatted properly
- [ ] Text content preserved completely

---

## 💾 Database Validation

### Organizations Table
```sql
SELECT * FROM organizations ORDER BY created_at DESC LIMIT 1;
```
- [ ] Organization record created
- [ ] name field populated
- [ ] slug generated correctly
- [ ] organization_type set
- [ ] is_configured = true
- [ ] contact_email stored

### Bylaw Sections Table
```sql
SELECT COUNT(*) as total,
       MIN(article_number) as first_article,
       MAX(article_number) as last_article,
       COUNT(DISTINCT article_number) as article_count
FROM bylaw_sections;
```
- [ ] Section records created
- [ ] section_citation not null
- [ ] section_title not null
- [ ] original_text not null
- [ ] article_number populated
- [ ] section_number populated
- [ ] No duplicate citations

### Data Integrity
```sql
-- Check for empty text
SELECT COUNT(*) as empty_sections
FROM bylaw_sections
WHERE original_text IS NULL OR TRIM(original_text) = '';
```
- [ ] Query returns 0 (no empty sections)
- [ ] All text fields populated
- [ ] No truncated content
- [ ] Special characters preserved

---

## 🎨 User Interface Tests

### Section List View
- [ ] Navigate to /bylaws successfully
- [ ] Section list displays
- [ ] Sections in correct order
- [ ] Article/section numbers visible
- [ ] Section titles readable
- [ ] Click to expand works

### Section Detail View
- [ ] Section content displays fully
- [ ] Text formatting preserved
- [ ] No HTML artifacts visible
- [ ] Line breaks correct
- [ ] Special characters display correctly

### Suggestion Creation
- [ ] "Add Suggestion" button visible
- [ ] Form opens correctly
- [ ] Author name field works
- [ ] Suggested text field accepts input
- [ ] Rationale field works
- [ ] Submit button functions
- [ ] Suggestion saves successfully
- [ ] Appears in suggestion list

### Multi-Section Suggestions
- [ ] Can select multiple sections
- [ ] Multi-section form appears
- [ ] Article scope calculated
- [ ] Section range displayed
- [ ] Junction table populated correctly
- [ ] All sections linked to suggestion

### Section Locking
- [ ] Lock button visible for unlocked sections
- [ ] Can select a suggestion to lock with
- [ ] Can lock with original text (no suggestion)
- [ ] Committee notes field works
- [ ] Lock timestamp recorded
- [ ] Locked sections show lock icon
- [ ] Cannot edit locked sections
- [ ] Unlock button works

---

## ⚡ Performance Tests

### Small Document (< 10 pages)
- [ ] Upload time: ______ seconds
- [ ] Processing time: ______ seconds
- [ ] Total time: ______ seconds
- [ ] ✅ Acceptable (under 30 seconds)

### Medium Document (10-30 pages)
- [ ] Upload time: ______ seconds
- [ ] Processing time: ______ seconds
- [ ] Total time: ______ seconds
- [ ] ✅ Acceptable (under 60 seconds)

### Large Document (30+ pages)
- [ ] Upload time: ______ seconds
- [ ] Processing time: ______ seconds
- [ ] Total time: ______ seconds
- [ ] ✅ Acceptable (under 120 seconds)

### Memory Usage
- [ ] No memory leaks detected
- [ ] Process doesn't crash with large files
- [ ] Server remains responsive
- [ ] Browser tab doesn't freeze

---

## 🔍 Edge Cases

### Empty Sections
Test with document containing headers with no content:
- [ ] Empty sections handled gracefully
- [ ] Default text provided: "(No content)"
- [ ] No null errors in UI
- [ ] Can still create suggestions

### Special Characters
Test with document containing:
- [ ] Smart quotes: " "
- [ ] Em dashes: —
- [ ] Accented characters: é, ñ, ü
- [ ] Symbols: §, ©, ®, ™
- [ ] All display correctly in UI
- [ ] All saved correctly to database

### Long Sections
Test with very long section text (1000+ words):
- [ ] Entire text captured
- [ ] No truncation
- [ ] Displays correctly in UI
- [ ] Can scroll to see full content

### Concurrent Users
Open application in 2 browsers simultaneously:
- [ ] Both can view sections
- [ ] Both can create suggestions
- [ ] No database conflicts
- [ ] Changes reflect correctly

---

## 🛡️ Security & Stability

### CSRF Protection
- [ ] CSRF middleware active
- [ ] Setup routes exempt (multipart/form-data)
- [ ] API routes exempt (for JSON)
- [ ] Form submissions protected

### Session Management
- [ ] Sessions persist across page reloads
- [ ] Setup progress saved in session
- [ ] isConfigured flag works correctly
- [ ] Session cleanup on completion

### Error Handling
- [ ] Invalid file types rejected gracefully
- [ ] File size limits enforced (10MB)
- [ ] Database errors caught and logged
- [ ] User-friendly error messages shown

### SQL Injection Prevention
- [ ] Supabase client uses parameterized queries
- [ ] No raw SQL with user input
- [ ] Input validation on all forms

---

## 📊 Comparison Tests

### Before (Google Apps Script) vs After (Custom Parser)

| Feature | Google Method | Custom Parser | Status |
|---------|---------------|---------------|--------|
| Document source | Google Docs URL | Local .docx upload | [ ] Works |
| Parsing | Google API calls | Mammoth library | [ ] Works |
| Internet required | Yes | No | [ ] Works |
| Authentication | Google OAuth | None | [ ] Works |
| Speed | Variable (API) | Fast (local) | [ ] Works |
| Offline capable | No | Yes | [ ] Works |
| Setup complexity | High | Low | [ ] Works |

---

## 🚀 Production Readiness

### Code Quality
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive
- [ ] Comments clear and helpful
- [ ] Code follows consistent style
- [ ] No unused imports or variables

### Configuration
- [ ] Environment variables documented
- [ ] .env.example file exists
- [ ] Secrets not hardcoded
- [ ] CORS settings reviewed (consider tightening)

### Documentation
- [ ] README.md updated with new setup instructions
- [ ] Google removal documented
- [ ] Setup wizard steps explained
- [ ] API endpoints documented

### Deployment
- [ ] render.yaml updated (if applicable)
- [ ] Build scripts work
- [ ] Start scripts work
- [ ] Health check endpoint functional (/api/health)

---

## ⚠️ Issues Found

### Critical Issues (Blockers)
_List any issues that prevent deployment:_

1. ___________________________________________________________
2. ___________________________________________________________
3. ___________________________________________________________

### High Priority Issues
_Important but not blocking:_

1. ___________________________________________________________
2. ___________________________________________________________
3. ___________________________________________________________

### Medium Priority Issues
_Should fix but not urgent:_

1. ___________________________________________________________
2. ___________________________________________________________
3. ___________________________________________________________

### Low Priority / Nice-to-Have
_Future improvements:_

1. ___________________________________________________________
2. ___________________________________________________________
3. ___________________________________________________________

---

## ✅ Final Sign-Off

### Test Summary
- Total test items: 150+
- Items passed: _______
- Items failed: _______
- Items blocked: _______
- Pass rate: _______%

### Recommendation
- [ ] ✅ APPROVE: Ready for production deployment
- [ ] ⚠️ CONDITIONAL: Fix critical issues first, then deploy
- [ ] ❌ REJECT: Major issues found, requires significant rework

### Notes
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

### Signatures

**Tester:** _________________________ Date: ___________

**Reviewer:** _________________________ Date: ___________

**Approver:** _________________________ Date: ___________

---

**END OF VALIDATION CHECKLIST**
