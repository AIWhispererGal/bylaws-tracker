# 🧪 COMPREHENSIVE TEST STRATEGY - Hive Mind Swarm
## Date: October 28, 2025 (4:05 AM)
## Tester Agent Deployment - Swarm: swarm-1761627819200-fnb2ykjdl

**Status**: 📋 **TEST PLAN CREATED - AWAITING CODER IMPLEMENTATION**
**Test Coverage**: Bug Fixes + User Journeys + Regression + Polish Features

---

## 🎯 TESTING MISSION OBJECTIVES

### Primary Objectives
1. **Bug Fix Validation** - Test all fixes from recent swarm sessions
2. **User Journey Testing** - Validate all user types can complete workflows
3. **Regression Testing** - Ensure existing functionality still works
4. **Polish Feature Testing** - Test UI/UX improvements

### Secondary Objectives
1. **Edge Case Testing** - Test boundary conditions
2. **Error Handling** - Test error scenarios and recovery
3. **Performance Testing** - Test under realistic load
4. **Security Testing** - Test permission boundaries

---

## 📊 BUGS FIXED & REQUIRING TESTING

### ✅ FIXED (October 27, 2025)

#### Bug #1: Global Admin Upload Permission ✅
- **Location**: `src/routes/admin.js:629`
- **Fix**: Added `attachGlobalAdminStatus` middleware
- **Test Required**: Verify global admin can upload to any org

#### Bug #2: "warnings is not defined" (Upload) ✅
- **Locations**: `src/routes/admin.js:761,769` + `src/services/setupService.js:307`
- **Fix**: Added `Array.isArray()` safety checks
- **Test Required**: Upload documents and verify no JavaScript errors

#### Bug #3: "warnings is not defined" (Hierarchy) ✅
- **Location**: `src/parsers/hierarchyDetector.js:335,394`
- **Fix**: Added `const warnings = []` declaration
- **Test Required**: Upload complex documents with hierarchy warnings

#### Bug #4: Global Admin Section Edit Buttons ✅
- **Location**: `views/dashboard/document-viewer.ejs:673`
- **Fix**: Changed permission check from object to string comparison
- **Test Required**: Verify global admin sees all section operation buttons

#### Bug #5: Depth Storage Fix 🎯
- **Location**: `database/migrations/025_fix_depth_trigger.sql`
- **Fix**: Database trigger modified to preserve parser depth values
- **Test Required**: Upload document → verify depth varies (0, 1, 2, 3...)
- **Status**: ⚠️ **MIGRATION NOT YET APPLIED**

#### Bug #6: TypeError: fetch failed ✅
- **Location**: `package.json`
- **Fix**: Upgraded `@supabase/supabase-js` from v2.39.0 → v2.76.1
- **Test Required**: Server starts without fetch errors

---

## 👥 USER TYPES & TEST PERSONAS

### User Type 1: Global Admin
**Characteristics**:
- `users.is_global_admin = true`
- Can see ALL organizations
- Can upload to any organization
- Can perform admin actions across all orgs
- Has full system access

**Test Persona: "Alice Admin"**
- Email: `alice@test.com`
- Password: `AliceAdmin123!`
- Organizations: Can access ALL

### User Type 2: Organization Owner
**Characteristics**:
- `user_organizations.role = 'owner'`
- Can manage their organization
- Can upload to their organization only
- Can invite users to their org
- Cannot access global admin routes

**Test Persona: "Bob Owner"**
- Email: `bob@org1.com`
- Password: `BobOwner123!`
- Organizations: "Test Organization 1" (owner)

### User Type 3: Organization Member
**Characteristics**:
- `user_organizations.role = 'member'`
- Can view documents in their organization
- Can make suggestions
- Cannot upload or perform admin actions
- Limited edit permissions

**Test Persona: "Charlie Member"**
- Email: `charlie@org1.com`
- Password: `CharlieMember123!`
- Organizations: "Test Organization 1" (member)

---

## 🧪 TEST SUITES

---

## TEST SUITE 1: BUG FIX VALIDATION

### Test 1.1: Global Admin Upload Permission
**Objective**: Verify global admin can upload documents to any organization

**Prerequisites**:
- User with `is_global_admin = true` exists
- Multiple organizations exist in database
- User is logged in

**Test Steps**:
1. Login as global admin (Alice Admin)
2. Navigate to `/auth/select`
3. Select "Test Organization 1" (not owned by Alice)
4. Navigate to Dashboard → Upload Document
5. Select a `.docx` file and click "Upload"
6. Wait for parsing completion

**Expected Results**:
- ✅ Upload succeeds without 403 permission error
- ✅ Document appears in document list
- ✅ Sections are parsed correctly
- ✅ No "Permission Denied" errors in console

**Test Data**:
- Document: `test-bylaws.docx` (sample bylaws document)
- Organization: Any organization Alice is not a member of

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 1.2: Warnings Array Safety (Upload Success)
**Objective**: Verify upload success handler doesn't crash with undefined warnings

**Prerequisites**:
- User logged in with upload permissions
- Organization selected

**Test Steps**:
1. Login as org owner (Bob Owner)
2. Navigate to Dashboard → Upload Document
3. Select a valid `.docx` file
4. Click "Upload" and wait for success message
5. Open browser console (F12)
6. Check for JavaScript errors

**Expected Results**:
- ✅ Success message displays correctly
- ✅ NO "warnings is not defined" error
- ✅ If warnings exist, they display in success message
- ✅ If no warnings, success message shows without errors

**Console Check**:
```javascript
// Should NOT see:
TypeError: Cannot read properties of undefined (reading 'length')

// Should see:
✅ Document uploaded successfully
```

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 1.3: Warnings Array Safety (Upload Error)
**Objective**: Verify upload error handler displays both errors and warnings

**Prerequisites**:
- User logged in with upload permissions

**Test Steps**:
1. Login as org owner (Bob Owner)
2. Navigate to Dashboard → Upload Document
3. Select an INVALID file (e.g., `.pdf` or `.exe`)
4. Click "Upload" and wait for error message
5. Check error message content

**Expected Results**:
- ✅ Error message displays correctly
- ✅ Validation errors shown in error message
- ✅ Warnings (if any) shown in error message
- ✅ NO JavaScript console errors

**Example Expected Message**:
```
❌ Upload failed

Validation Errors:
- Only .doc, .docx, .txt, and .md files are allowed

Warnings:
- File type not recognized
```

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 1.4: Hierarchy Detector Warnings
**Objective**: Verify hierarchyDetector.js returns warnings array correctly

**Prerequisites**:
- User logged in with upload permissions

**Test Steps**:
1. Login as org owner (Bob Owner)
2. Upload a document with COMPLEX hierarchy (nested sections, unusual numbering)
3. Check server logs for hierarchy warnings
4. Verify no crash during hierarchy detection

**Expected Results**:
- ✅ Hierarchy detection completes successfully
- ✅ Warnings array is properly initialized (`const warnings = []`)
- ✅ Warnings are returned in the response object
- ✅ NO "warnings is not defined" errors in server logs

**Server Log Check**:
```bash
# Should see:
[hierarchyDetector] ✓ Hierarchy detected with X sections
[hierarchyDetector] Warnings: [array of warnings if any]

# Should NOT see:
ReferenceError: warnings is not defined
```

**Test Data**: Document with unusual section numbering (e.g., skipped numbers, roman numerals)

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 1.5: Global Admin Section Edit Buttons
**Objective**: Verify global admin can see all section operation buttons

**Prerequisites**:
- Global admin user exists and is logged in
- Document uploaded with sections
- Organization selected (any org)

**Test Steps**:
1. Login as global admin (Alice Admin)
2. Select any organization
3. Navigate to a document with sections
4. Open document viewer
5. Click on a section to select it
6. Check for visible operation buttons

**Expected Results**:
- ✅ "Indent" button is visible
- ✅ "Dedent" button is visible
- ✅ "Move Up" button is visible
- ✅ "Move Down" button is visible
- ✅ "Split" button is visible
- ✅ "Join" button is visible
- ✅ Buttons are clickable (not disabled)

**Check Implementation**:
```javascript
// File: views/dashboard/document-viewer.ejs:673
// Should use: userRole === 'admin'
// NOT: userRole?.role_code === 'admin'
```

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 1.6: Depth Storage and Trigger
**Objective**: Verify database trigger preserves parser-assigned depth values

**Prerequisites**:
- Migration 025 has been applied to database
- No existing documents (or old documents deleted)

**Test Steps**:
1. Login as org owner (Bob Owner)
2. Upload a new document with hierarchical structure
3. Wait for parsing completion
4. Query database: `SELECT section_number, depth, type FROM document_sections ORDER BY document_order LIMIT 20`
5. Analyze depth distribution

**Expected Results**:
- ✅ Articles have `depth = 0`
- ✅ Sections under articles have `depth = 1`
- ✅ Subsections have `depth = 2` or higher
- ✅ NO sections have incorrect depth values
- ✅ Depth values vary (not all 0)

**SQL Validation**:
```sql
-- Check depth distribution
SELECT depth, COUNT(*) as count
FROM document_sections
GROUP BY depth
ORDER BY depth;

-- Expected result:
-- depth | count
-- ------|------
--   0   |  10-15  (Articles, Preamble)
--   1   |  40-50  (Sections)
--   2+  |  20-30  (Subsections, if present)
```

**Status**: ⚠️ **BLOCKED - MIGRATION 025 NOT APPLIED**

---

### Test 1.7: Server Startup (No Fetch Errors)
**Objective**: Verify server starts without "TypeError: fetch failed" errors

**Prerequisites**:
- `@supabase/supabase-js` version 2.76.1 installed
- Clean `node_modules` directory

**Test Steps**:
1. Stop server (if running)
2. Run `npm start`
3. Watch server console for errors
4. Wait for "Server running on port 3000" message

**Expected Results**:
- ✅ Server starts successfully
- ✅ NO "TypeError: fetch failed" errors
- ✅ NO undici errors
- ✅ Supabase client initializes correctly

**Server Log Check**:
```bash
# Should see:
Server running on port 3000

# Should NOT see:
TypeError: fetch failed
    at node:internal/deps/undici/undici:13510:13
```

**Verification Command**:
```bash
npm list @supabase/supabase-js
# Should show: @supabase/supabase-js@2.76.1
```

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

## TEST SUITE 2: USER JOURNEY VALIDATION

### Test 2.1: Global Admin Complete Workflow
**Objective**: Test complete workflow for global admin user

**Test Persona**: Alice Admin (Global Admin)

**Test Steps**:
1. **Login**
   - Navigate to `/auth/login`
   - Enter credentials: `alice@test.com` / `AliceAdmin123!`
   - Click "Login"
   - Verify redirect to organization selection

2. **Organization Selection**
   - Navigate to `/auth/select`
   - Verify ALL organizations are visible
   - Select "Test Organization 1" (not owned by Alice)
   - Click "Select Organization"
   - Verify redirect to dashboard

3. **Dashboard Navigation**
   - Verify dashboard loads correctly
   - Check navigation menu shows admin links
   - Verify "Upload Document" button is visible

4. **Document Upload**
   - Click "Upload Document"
   - Select `test-bylaws.docx`
   - Click "Upload"
   - Wait for success message
   - Verify document appears in document list

5. **Document Viewing**
   - Click on uploaded document
   - Verify document viewer opens
   - Verify sections are listed correctly
   - Check section hierarchy (proper indentation)

6. **Section Operations**
   - Click on a section to select it
   - Verify ALL operation buttons are visible:
     - Indent, Dedent, Move Up, Move Down, Split, Join
   - Try "Move Up" operation
   - Verify section moves successfully
   - Try "Indent" operation
   - Verify section indents correctly

7. **Switch Organizations**
   - Navigate to `/auth/select`
   - Select "Test Organization 2" (different org)
   - Verify can access and upload to this org too
   - Verify documents from other org are separate

8. **Logout**
   - Click "Logout"
   - Verify redirect to login page
   - Verify session cleared

**Expected Results**:
- ✅ Complete workflow succeeds without errors
- ✅ Global admin can access ALL organizations
- ✅ Can upload and perform operations in any organization
- ✅ All navigation links work correctly
- ✅ No permission errors at any step

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 2.2: Organization Owner Complete Workflow
**Objective**: Test complete workflow for org owner user

**Test Persona**: Bob Owner (Organization Owner)

**Test Steps**:
1. **Login**
   - Navigate to `/auth/login`
   - Enter credentials: `bob@org1.com` / `BobOwner123!`
   - Click "Login"
   - Verify redirect to organization selection

2. **Organization Selection**
   - Navigate to `/auth/select`
   - Verify ONLY owned/member organizations are visible
   - Verify CANNOT see organizations Bob is not a member of
   - Select "Test Organization 1" (Bob's org)
   - Click "Select Organization"

3. **Dashboard Access**
   - Verify dashboard loads correctly
   - Verify "Upload Document" button is visible
   - Verify admin features are available for owned org

4. **Document Upload**
   - Click "Upload Document"
   - Select `test-bylaws.docx`
   - Click "Upload"
   - Verify upload succeeds without errors
   - Verify no "warnings is not defined" error

5. **Document Management**
   - View uploaded document
   - Verify can edit sections
   - Try section operations (indent, dedent, move)
   - Verify operations succeed

6. **User Invitation**
   - Navigate to organization settings
   - Click "Invite User"
   - Enter email for new member
   - Select role: "member"
   - Click "Send Invitation"
   - Verify invitation sent successfully

7. **Access Restrictions**
   - Try to navigate to `/admin/global-settings` (global admin route)
   - Verify 403 Forbidden response
   - Verify CANNOT access other organizations

8. **Logout**
   - Click "Logout"
   - Verify redirect to login page

**Expected Results**:
- ✅ Org owner has full access to THEIR organization
- ✅ CANNOT access global admin routes
- ✅ CANNOT see or access other organizations
- ✅ Can upload, edit, and manage documents
- ✅ Can invite users to their organization
- ✅ All buttons and links work correctly

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 2.3: Organization Member Limited Workflow
**Objective**: Test limited workflow for org member user

**Test Persona**: Charlie Member (Organization Member)

**Test Steps**:
1. **Login**
   - Navigate to `/auth/login`
   - Enter credentials: `charlie@org1.com` / `CharlieMember123!`
   - Click "Login"

2. **Organization Selection**
   - Verify only member organizations are visible
   - Select "Test Organization 1"

3. **Dashboard Restrictions**
   - Verify dashboard loads
   - Verify "Upload Document" button is **HIDDEN** or **DISABLED**
   - Verify admin menu items are hidden

4. **Document Viewing (Read-Only)**
   - Navigate to documents list
   - Click on a document
   - Verify document viewer opens
   - Verify sections are visible

5. **Section Operations (Restricted)**
   - Click on a section
   - Verify section operation buttons are **HIDDEN** or **DISABLED**
   - Try to perform operations via API (if possible)
   - Verify 403 Forbidden response

6. **Suggestion Feature**
   - Navigate to a section
   - Click "Make Suggestion" (if available)
   - Enter suggestion text
   - Submit suggestion
   - Verify suggestion saved successfully

7. **Access Restrictions**
   - Try to access admin routes
   - Verify 403 Forbidden responses
   - Try to access other organizations
   - Verify access denied

**Expected Results**:
- ✅ Member can view documents
- ✅ Member can make suggestions
- ✅ Member CANNOT upload documents
- ✅ Member CANNOT perform section operations
- ✅ Member CANNOT access admin features
- ✅ All restrictions properly enforced

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

## TEST SUITE 3: ERROR HANDLING & POLISH FEATURES

### Test 3.1: Error Page Redirect
**Objective**: Verify custom error page displays correctly

**Test Steps**:
1. Trigger 404 error: Navigate to `/nonexistent-page`
2. Check for custom 404 page (not default Node.js error)
3. Verify "Return to Dashboard" button works
4. Trigger 500 error: Upload corrupt file
5. Check for custom 500 error page
6. Verify error is logged to console

**Expected Results**:
- ✅ Custom error pages display (not default)
- ✅ Error pages have consistent styling
- ✅ "Return to Dashboard" links work
- ✅ Errors are logged for debugging

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 3.2: Document Navigation Sidebar
**Objective**: Test collapsible navigation sidebar functionality

**Test Steps**:
1. Open a document with multiple sections
2. Verify sidebar shows section tree
3. Click sidebar collapse button
4. Verify sidebar collapses smoothly
5. Click expand button
6. Verify sidebar expands
7. Click section in sidebar
8. Verify document scrolls to section

**Expected Results**:
- ✅ Sidebar is visible and shows hierarchy
- ✅ Collapse/expand animation smooth
- ✅ Clicking section navigates correctly
- ✅ Sidebar state persists during session

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 3.3: Article Collapsing
**Objective**: Test article expand/collapse functionality

**Test Steps**:
1. Open document with articles
2. Click collapse icon next to Article I
3. Verify Article I sections collapse
4. Click expand icon
5. Verify Article I sections expand
6. Test "Collapse All" button
7. Verify all articles collapse
8. Test "Expand All" button

**Expected Results**:
- ✅ Individual articles collapse/expand
- ✅ Collapse state persists during navigation
- ✅ "Collapse All" / "Expand All" work
- ✅ Animations are smooth

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 3.4: Responsive Design (Mobile/Tablet)
**Objective**: Test UI responsiveness across screen sizes

**Test Steps**:
1. Open dashboard in desktop browser (1920x1080)
2. Verify layout looks correct
3. Resize to tablet (768x1024)
4. Verify layout adjusts correctly
5. Resize to mobile (375x667)
6. Verify mobile navigation menu works
7. Test document viewer on mobile
8. Verify sidebar becomes overlay on mobile

**Expected Results**:
- ✅ Layout responsive on all screen sizes
- ✅ Navigation adapts to small screens
- ✅ Text remains readable
- ✅ Buttons remain accessible
- ✅ No horizontal scrolling

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

## TEST SUITE 4: REGRESSION TESTING

### Test 4.1: Section Operations (Previous Fixes)
**Objective**: Verify October 23 section operation fixes still work

**Prerequisites**:
- Document with proper hierarchy uploaded
- Sections have correct depth values

**Test Cases**:

#### 4.1a: Move Section
- Select a section
- Click "Move Up" or "Move Down"
- Expected: Section moves, no "ordinal constraint violation" error
- Status: ⏳ **PENDING**

#### 4.1b: Indent Section (Root Level)
- Select a depth 0 section
- Click "Indent"
- Expected: Section becomes child of previous sibling, no NULL UUID error
- Status: ⏳ **PENDING**

#### 4.1c: Dedent Section (Nested)
- Select a depth 1+ section
- Click "Dedent"
- Expected: Section moves to parent level, ordinals recalculated
- Status: ⏳ **PENDING**

#### 4.1d: Split Section
- Select any section
- Click "Split"
- Enter split position and new section details
- Expected: Section splits, both have `document_order` and `organization_id`
- Status: ⏳ **PENDING**

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

### Test 4.2: Parser Depth Calculation
**Objective**: Verify parser assigns correct depth values

**Test Steps**:
1. Upload a document with clear hierarchy:
   - Preamble (should be depth 0)
   - Article I (should be depth 0)
   - Section 1 under Article I (should be depth 1)
   - Subsection A under Section 1 (should be depth 2)
2. Query database for depth values
3. Verify depth progression is correct

**Expected Depth Pattern**:
```
Preamble            → depth: 0
Article I           → depth: 0
  Section 1         → depth: 1
    Subsection A    → depth: 2
  Section 2         → depth: 1
Article II          → depth: 0
  Section 1         → depth: 1
```

**SQL Query**:
```sql
SELECT section_number, depth, type, parent_section_id
FROM document_sections
ORDER BY document_order
LIMIT 20;
```

**Status**: ⚠️ **BLOCKED - MIGRATION 025 REQUIRED**

---

### Test 4.3: Parent Relationships
**Objective**: Verify `updateParentRelationships()` builds correct hierarchy

**Test Steps**:
1. Upload a document
2. Query database for parent relationships
3. Verify all depth 1+ sections have correct `parent_section_id`
4. Verify depth 0 sections have `parent_section_id = NULL`

**SQL Validation**:
```sql
-- Check for orphaned sections (depth > 0 with NULL parent)
SELECT section_number, depth, parent_section_id
FROM document_sections
WHERE depth > 0 AND parent_section_id IS NULL;

-- Should return 0 rows
```

**Expected Results**:
- ✅ NO depth 1+ sections with NULL parent
- ✅ All sections have correct parent reference
- ✅ Hierarchy is properly connected

**Status**: ⏳ **PENDING CODER IMPLEMENTATION**

---

## 🎯 TEST EXECUTION PLAN

### Phase 1: Pre-Testing Setup (15 minutes)
1. **Database Setup**
   - Apply migration 025 in Supabase
   - Create test organizations:
     - "Test Organization 1"
     - "Test Organization 2"
   - Create test users:
     - Alice Admin (global admin)
     - Bob Owner (owner of org 1)
     - Charlie Member (member of org 1)
2. **Environment Verification**
   - Verify `@supabase/supabase-js` is version 2.76.1
   - Verify server starts without errors
   - Verify database connection works

### Phase 2: Bug Fix Tests (30 minutes)
1. Execute Test Suite 1 (Tests 1.1-1.7)
2. Document any failures
3. Create bug reports for new issues

### Phase 3: User Journey Tests (45 minutes)
1. Execute Test Suite 2 (Tests 2.1-2.3)
2. Test each user persona workflow end-to-end
3. Document navigation issues or permission errors

### Phase 4: Polish & Error Handling (20 minutes)
1. Execute Test Suite 3 (Tests 3.1-3.4)
2. Test error pages and UI features
3. Test responsive design

### Phase 5: Regression Tests (30 minutes)
1. Execute Test Suite 4 (Tests 4.1-4.3)
2. Verify all previous fixes still work
3. Check for any regressions

### Phase 6: Reporting (20 minutes)
1. Compile test results
2. Create test execution report
3. Store results in memory for Queen
4. Document any blockers or failures

**Total Estimated Time**: 2.5 hours

---

## 📋 TEST DATA REQUIREMENTS

### Test Organizations
- **Test Organization 1**
  - Name: "Test Organization 1"
  - Type: nonprofit
  - Owner: Bob Owner
  - Members: Charlie Member

- **Test Organization 2**
  - Name: "Test Organization 2"
  - Type: nonprofit
  - Owner: (None - for global admin testing)

### Test Users
- **Alice Admin**
  - Email: `alice@test.com`
  - Password: `AliceAdmin123!`
  - Global Admin: YES
  - Organizations: (All via global admin access)

- **Bob Owner**
  - Email: `bob@org1.com`
  - Password: `BobOwner123!`
  - Global Admin: NO
  - Organizations: Test Organization 1 (owner)

- **Charlie Member**
  - Email: `charlie@org1.com`
  - Password: `CharlieMember123!`
  - Global Admin: NO
  - Organizations: Test Organization 1 (member)

### Test Documents
- **test-bylaws.docx**
  - Contains: Articles, Sections, Subsections
  - Hierarchy: 3 levels deep
  - Section count: ~50-60 sections

- **simple-document.docx**
  - Contains: Only top-level sections
  - Hierarchy: 1 level
  - Section count: ~10-15 sections

- **complex-hierarchy.docx**
  - Contains: Deeply nested structure
  - Hierarchy: 4-5 levels deep
  - Section count: ~80-100 sections

---

## 🚨 BLOCKERS & DEPENDENCIES

### Current Blockers
1. **Migration 025 Not Applied** ⚠️
   - Blocks: Test 1.6 (Depth Storage)
   - Blocks: Test 4.2 (Parser Depth)
   - Required Action: Apply migration manually in Supabase

2. **Coder Implementation Pending** ⏳
   - Blocks: ALL test execution
   - Required Action: Wait for Coder agent to complete implementation

### Dependencies
1. **Test Users Created** - Required before any testing
2. **Test Organizations Created** - Required before upload tests
3. **Test Documents Available** - Required for upload/parsing tests
4. **Server Running** - Required for all manual tests

---

## 📊 SUCCESS CRITERIA

### Bug Fix Tests
- ✅ 7/7 bug fix tests PASS
- ✅ No JavaScript console errors
- ✅ No server errors during operations
- ✅ All warnings arrays properly initialized

### User Journey Tests
- ✅ 3/3 user personas complete workflows successfully
- ✅ Global admin can access all organizations
- ✅ Org owner cannot access global routes
- ✅ Org member has proper restrictions

### Regression Tests
- ✅ All section operations work correctly
- ✅ Parser assigns correct depth values
- ✅ Parent relationships properly established
- ✅ No regressions from October 23 fixes

### Polish Features
- ✅ Error pages display correctly
- ✅ Navigation sidebar works smoothly
- ✅ Article collapse/expand functions
- ✅ Responsive design works on all screen sizes

---

## 📝 REPORTING STRUCTURE

### Test Execution Report Format
```markdown
# Test Execution Report
## Date: [Date]
## Tester: Tester Agent

### Summary
- Total Tests: X
- Passed: Y
- Failed: Z
- Blocked: W
- Pass Rate: Y%

### Failed Tests
1. [Test ID] - [Test Name]
   - Error: [Error description]
   - Expected: [Expected behavior]
   - Actual: [Actual behavior]
   - Screenshots: [Links to screenshots]

### Blockers
1. [Blocker description]
   - Impact: [Which tests blocked]
   - Resolution: [Required action]

### Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
```

---

## 🎯 NEXT STEPS

### Immediate Actions
1. **Wait for Coder** - All tests pending implementation
2. **Apply Migration 025** - Unblocks depth tests
3. **Create Test Users** - Required for manual testing

### After Coder Implementation
1. **Execute Phase 1** - Setup test environment
2. **Execute Phase 2-5** - Run all test suites
3. **Execute Phase 6** - Report findings to Queen

### If Tests Fail
1. **Document Failures** - Detailed error descriptions
2. **Create Bug Reports** - New bugs found during testing
3. **Coordinate with Coder** - Work together to fix issues
4. **Re-test** - Verify fixes before final report

---

## 🐝 COORDINATION PROTOCOL

### Before Testing
```bash
npx claude-flow@alpha hooks pre-task --description "Execute comprehensive test suite"
npx claude-flow@alpha hooks session-restore --session-id "swarm-1761627819200-fnb2ykjdl"
```

### During Testing
```bash
# After each test suite
npx claude-flow@alpha hooks post-edit --memory-key "hive/tester/suite-X-results"
npx claude-flow@alpha hooks notify --message "Test suite X completed: Y/Z tests passed"
```

### After Testing
```bash
npx claude-flow@alpha hooks post-task --task-id "testing"
npx claude-flow@alpha hooks notify --message "All testing complete - report ready"
npx claude-flow@alpha hooks session-end --export-metrics true
```

### Memory Storage
```bash
# Store test results
npx claude-flow@alpha memory store "hive/tester/test-results" "[JSON results]" --namespace hive

# Store bug reports
npx claude-flow@alpha memory store "hive/tester/bugs-found" "[Bug list]" --namespace hive

# Store recommendations
npx claude-flow@alpha memory store "hive/tester/recommendations" "[Recommendations]" --namespace hive
```

---

## 📚 REFERENCE DOCUMENTS

### Prior Swarm Work
- `/docs/SESSION_COMPLETE_2025-10-27.md` - Upload bug fixes
- `/docs/HIVE_SWARM_MISSION_COMPLETE.md` - Section operations fixes
- `/docs/reports/HIVE_TESTING_CHECKLIST.md` - Previous testing guide
- `/docs/reports/SESSION_2025-10-27_SUMMARY.md` - Session summary

### Technical Documentation
- `/docs/COMPLETE_HIERARCHY_FIX_SUMMARY.md` - Parser depth fixes
- `/docs/YOLO_DEPLOYMENT_COMPLETE.md` - Section operation deployment
- `/database/migrations/025_fix_depth_trigger.sql` - Depth trigger fix

### Architecture
- `/docs/ADR-001-RLS-SECURITY-MODEL.md` - Security model
- `/docs/ADR-002-CONTEXT-AWARE-DEPTH-ARCHITECTURE.md` - Depth architecture

---

## ✅ TESTER AGENT STATUS

**Current Status**: 📋 **TEST PLAN COMPLETE**
**Waiting For**: 🕒 **CODER IMPLEMENTATION**
**Ready To Execute**: ⏳ **PENDING**

**Test Strategy Created**: ✅
**Test Suites Defined**: ✅ (4 suites, 20+ tests)
**Test Data Defined**: ✅
**Execution Plan Created**: ✅
**Reporting Structure Defined**: ✅

---

**The Tester stands ready. Awaiting Coder implementation to begin test execution.**

**- Tester Agent, Hive Mind Swarm** 🐝🧪
