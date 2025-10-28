# 🧪 HIVE MIND - COMPREHENSIVE TESTING CHECKLIST
## Session Date: 2025-10-27

**Status**: ✅ Fetch Error FIXED - Ready for Human Testing
**Fixed By**: Queen Seraphina & Hive Mind Swarm

---

## 🎯 CRITICAL FIX APPLIED TODAY

### TypeError: fetch failed - RESOLVED ✅

**Problem**:
```
Error loading organization selection: {
  message: 'TypeError: fetch failed',
  details: 'TypeError: fetch failed\n' +
    '    at node:internal/deps/undici/undici:13510:13\n'
    ...
}
```

**Root Cause**:
- Outdated `@supabase/supabase-js` version (2.39.0)
- Incompatibility with Node.js v22's internal fetch (undici)
- Missing peer dependencies after upgrade

**Fix Applied**:
1. ✅ Upgraded `@supabase/supabase-js` from v2.39.0 → v2.76.1
2. ✅ Clean reinstall of all dependencies (`rm -rf node_modules package-lock.json && npm install`)
3. ✅ Verified server starts without errors
4. ✅ Tested auth endpoint - NO MORE FETCH ERRORS!

**Files Modified**: `package.json`, `package-lock.json`

---

## 📋 COMPLETED WORK (From Previous Swarms)

### ✅ Critical Fixes Deployed (Oct 23)

1. **Global Admin Organization Visibility** ✅
   - File: `src/middleware/globalAdmin.js`
   - Fix: Query `users` table instead of `user_organizations`
   - Status: DEPLOYED

2. **Section Move Operation** ✅
   - File: `src/routes/admin.js` (line 1456)
   - Fix: Default ordinal changed from 0 → 1
   - Status: DEPLOYED

3. **Section Split Operation** ✅
   - File: `src/routes/admin.js` (lines 1739-1768)
   - Fix: Added `document_order` field
   - Status: DEPLOYED

4. **Section Indent Operation** ✅
   - File: `src/routes/admin.js` (lines 2014-2031)
   - Fix: Proper NULL handling for `parent_section_id`
   - Status: DEPLOYED

### ✅ Parser Fixes Deployed (Oct 23)

5. **Depth Calculation Bug** ✅
   - Files: `src/parsers/wordParser.js`, `src/parsers/textParser.js`
   - Fix: Use configured depth instead of stack length
   - Status: DEPLOYED

6. **Parent Relationships** ✅
   - File: `src/services/sectionStorage.js`
   - Fix: Call `updateParentRelationships()` after insertion
   - Status: DEPLOYED

---

## 🧪 HUMAN TESTING WORKFLOW

### Phase 1: Basic System Health (5 minutes)

#### Test 1.1: Server Startup
```bash
npm start
```
**Expected**:
- ✅ No "TypeError: fetch failed" errors
- ✅ Server starts on port 3000
- ✅ Shows "Bylaws Amendment Tracker running on http://localhost:3000"

**Status**: □ PASS  □ FAIL

---

#### Test 1.2: Health Check
```bash
curl http://localhost:3000/api/health
```
**Expected**:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "..."
}
```
**Note**: If you see "Could not find table 'bylaw_sections'", that's expected for first-time setup.

**Status**: □ PASS  □ FAIL

---

#### Test 1.3: Organization Selection Page
**Action**: Navigate to `http://localhost:3000/auth/select`

**Expected**:
- ✅ Page loads without errors
- ✅ No "fetch failed" errors in browser console (F12)
- ✅ Organizations list appears (or "No organizations" if none exist)

**Status**: □ PASS  □ FAIL

---

### Phase 2: Authentication & User Management (10 minutes)

#### Test 2.1: User Registration
**Action**: Navigate to `/auth/register`

**Steps**:
1. Fill in email, password, name
2. Click "Register"

**Expected**:
- ✅ User created successfully
- ✅ Redirected to organization selection or dashboard
- ✅ No fetch errors

**Status**: □ PASS  □ FAIL  □ N/A (No users yet)

---

#### Test 2.2: User Login
**Action**: Navigate to `/auth/login`

**Steps**:
1. Enter credentials
2. Click "Login"

**Expected**:
- ✅ Login successful
- ✅ Redirected to dashboard
- ✅ Session established

**Status**: □ PASS  □ FAIL  □ N/A (No users yet)

---

#### Test 2.3: Global Admin Organization Access
**Prerequisites**: User with `is_global_admin = true` in `users` table

**Action**: Log in as global admin

**Expected**:
- ✅ Can see ALL organizations (not just assigned ones)
- ✅ Organization selector shows all orgs
- ✅ Can switch between any organization

**Status**: □ PASS  □ FAIL  □ N/A (No global admin)

---

### Phase 3: Document Upload & Parsing (15 minutes)

#### Test 3.1: Document Upload
**Action**: Navigate to Admin → Upload Document

**Steps**:
1. Select a Word (.docx) document
2. Click "Upload"
3. Wait for parsing

**Expected**:
- ✅ Upload completes without errors
- ✅ Document appears in document list
- ✅ Sections are parsed

**Status**: □ PASS  □ FAIL

---

#### Test 3.2: Verify Section Hierarchy (CRITICAL)
**Action**: Export `document_sections` table from Supabase

**Check These Fields**:
```sql
SELECT
  section_number,
  depth,
  parent_section_id,
  type
FROM document_sections
ORDER BY document_order
LIMIT 20;
```

**Expected Depth Distribution**:
- Depth 0: Articles, Preamble (~10-15 sections)
- Depth 1: Sections under Articles (~40-50 sections)
- Depth 2+: Subsections (if present)

**Expected Parent Relationships**:
- ✅ All depth 0 sections have `parent_section_id = NULL`
- ✅ All depth 1 sections have `parent_section_id` pointing to their Article
- ✅ NO depth 1 sections with NULL parent

**Status**: □ PASS  □ FAIL

---

#### Test 3.3: Server Logs During Upload
**Action**: Check server console during upload

**Look For**:
```
✅ Good Signs:
[CONFIG-DEBUG] ✅ Using complete hierarchy from database
[CONTEXT-DEPTH] Using configured depth: 1 (from levelDef for type section)
[sectionStorage] ✓ Successfully updated X parent relationships

❌ Bad Signs:
[CONFIG-DEBUG] ⚠️ No database hierarchy, using defaults
[CONTEXT-DEPTH] No configured depth, using stack: 0
[sectionStorage] ⚠️ Parent relationships could not be set
```

**Status**: □ PASS  □ FAIL

---

### Phase 4: Section Operations (20 minutes)

**Prerequisites**: Document uploaded with proper hierarchy

#### Test 4.1: Move Section
**Action**:
1. Open document editor
2. Select a section
3. Click "Move" and reorder it

**Expected**:
- ✅ Section moves successfully
- ✅ No "ordinal constraint violation" error
- ✅ Section appears in new position

**Status**: □ PASS  □ FAIL

---

#### Test 4.2: Indent Section
**Action**:
1. Select a TOP-LEVEL section (depth 0)
2. Click "Indent"

**Expected**:
- ✅ Section indents successfully
- ✅ No "invalid input syntax for type uuid: 'null'" error
- ✅ Section becomes child of previous sibling

**Status**: □ PASS  □ FAIL

---

#### Test 4.3: Dedent Section
**Action**:
1. Select a NESTED section (depth > 0)
2. Click "Dedent"

**Expected**:
- ✅ Section dedents successfully
- ✅ Moves to parent's level
- ✅ Ordinals recalculated

**Status**: □ PASS  □ FAIL

---

#### Test 4.4: Split Section
**Action**:
1. Select any section
2. Click "Split"
3. Enter split position and new section details

**Expected**:
- ✅ Section splits into two
- ✅ No "null value in column 'document_order'" error
- ✅ Both sections have proper `document_order` and `organization_id`

**Status**: □ PASS  □ FAIL

---

### Phase 5: Setup Wizard (Optional - 15 minutes)

**Note**: Setup wizard was partially fixed in earlier sessions but may need additional work.

#### Test 5.1: Organization Setup Screen
**Action**: Navigate to `/setup` (fresh database)

**Expected**:
- ✅ Form displays correctly
- ✅ Can fill organization details
- ✅ Click "Next" redirects to document-type screen

**Status**: □ PASS  □ FAIL  □ SKIPPED

---

#### Test 5.2: Document Type Screen
**Action**: Continue from organization screen

**Expected**:
- ✅ Document type cards are CLICKABLE
- ✅ Can select a structure type
- ✅ Click "Next" redirects to workflow screen

**Known Issue**: Previous swarm fixed duplicate JavaScript initialization bug.

**Status**: □ PASS  □ FAIL  □ SKIPPED

---

#### Test 5.3: Complete Wizard Flow
**Action**: Complete all 5 wizard steps

**Expected**:
- ✅ Organization created in Supabase
- ✅ Redirected to main application
- ✅ Can log in and use the system

**Status**: □ PASS  □ FAIL  □ SKIPPED

---

## 🚨 KNOWN ISSUES & WORKAROUNDS

### Issue 1: bylaw_sections Table Not Found
**Symptom**: Health check shows "Could not find table 'public.bylaw_sections'"

**Impact**: Low - Health check is informational only

**Workaround**:
- This is expected for fresh installations
- Table is created when first document is uploaded
- Or run migrations manually

**Status**: □ Encountered  □ Not Encountered

---

### Issue 2: No Organizations in Database
**Symptom**: Organization selection page shows empty list

**Impact**: Medium - Can't proceed without organization

**Workaround**:
1. Use setup wizard to create first organization
2. Or manually insert into `organizations` table:
```sql
INSERT INTO organizations (name, organization_type)
VALUES ('Test Organization', 'nonprofit');
```

**Status**: □ Encountered  □ Not Encountered

---

### Issue 3: No Users Exist
**Symptom**: Can't log in (no accounts)

**Impact**: High - Can't test authentication

**Workaround**:
1. Use `/auth/register` to create first user
2. Manually set `is_global_admin = true` in database for testing:
```sql
UPDATE users
SET is_global_admin = true
WHERE email = 'your-email@example.com';
```

**Status**: □ Encountered  □ Not Encountered

---

## 📊 TEST SUMMARY

### Results:
- Total Tests: _____ / 18
- Passed: _____
- Failed: _____
- Skipped: _____

### Critical Tests (Must Pass):
- [ ] Test 1.1: Server Startup
- [ ] Test 1.3: Organization Selection Page (no fetch errors)
- [ ] Test 3.2: Section Hierarchy Depth & Parents
- [ ] Test 4.1: Move Section
- [ ] Test 4.2: Indent Section
- [ ] Test 4.4: Split Section

### Blockers Found:
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Notes:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

## 🎯 NEXT STEPS BASED ON RESULTS

### If All Tests Pass ✅:
1. Celebrate! 🎉
2. Begin production deployment planning
3. Create user documentation
4. Set up monitoring and logging
5. Plan for load testing

### If Tests Fail ❌:
1. Document exact error messages
2. Check server logs for stack traces
3. Export relevant database tables
4. Share findings with development team
5. Deploy new swarm to investigate and fix

---

## 📝 NOTES FOR NEXT SWARM SESSION

### What We Fixed Today:
- ✅ TypeError: fetch failed (Supabase JS upgrade)
- ✅ Package dependency issues (clean reinstall)

### What's Already Fixed (Previous Swarms):
- ✅ Global admin visibility
- ✅ Section operations (move, indent, split)
- ✅ Parser depth calculation
- ✅ Parent relationship building

### What Might Need Work:
- ⏳ Setup wizard (document-type screen forward)
- ⏳ Database migrations (if missing tables)
- ⏳ User invitation workflow
- ⏳ Email sending (Resend integration)

---

## 📞 SUPPORT RESOURCES

**Documentation**:
- `/docs/YOLO_DEPLOYMENT_COMPLETE.md` - Section operations fixes
- `/docs/COMPLETE_HIERARCHY_FIX_SUMMARY.md` - Parser fixes
- `/docs/START_HERE_NEXT_SESSION.md` - Setup wizard status
- `/docs/CODER_MISSION_COMPLETE.md` - Implementation details

**Database Schema**:
- `/database/migrations/` - All database migrations
- Check Supabase dashboard for current schema

**Contact**:
- User: mgall (you!)
- Hive Mind: Available via Claude Code
- Queen Seraphina: Coordinates all swarms

---

**Happy Testing! 🐝✨**

**Remember**: You're just you and Claude - no other users yet. Focus on core functionality first!
