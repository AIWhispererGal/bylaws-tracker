# 🧪 SMOKE TEST GUIDE - Manual Testing
### Practical step-by-step guide to verify your system works

---

## 📋 WHAT ARE SMOKE TESTS?

**Smoke tests** are quick, basic tests to verify the system is working at a fundamental level - like checking if smoke comes out when you turn it on. You're basically making sure nothing is "on fire" before doing a full launch.

Think of it as: **"Can a user actually use the core features?"**

---

## ⏱️ TIME REQUIRED

- **Minimum**: 15 minutes (Tests 1-3 only)
- **Recommended**: 30 minutes (Tests 1-6)
- **Complete**: 45 minutes (All tests)

---

## 🚀 TEST 1: NEW ORGANIZATION CREATION (5 minutes)

### Goal: Verify a new organization can be created from scratch

**Steps**:

1. **Start Fresh**:
   ```bash
   # Make sure server is running
   npm start
   # Open browser to: http://localhost:3000
   ```

2. **Register New Account**:
   - Click "Register" or "Sign Up"
   - Enter NEW email (not used before): `test-user-[timestamp]@example.com`
   - Enter password: `TestPassword123!`
   - Enter name: `Test User`
   - Click "Register"

3. **Expected Result**:
   - ✅ Should see "Check your email for verification" message
   - ✅ OR if email disabled: Should redirect to setup wizard
   - ✅ NO 500 errors in browser console (F12)

4. **Check Email** (if enabled):
   - Open email inbox
   - Find verification email
   - Click verification link
   - ✅ Should redirect to login page

5. **Login**:
   - Enter email and password
   - Click "Login"
   - ✅ Should see setup wizard OR dashboard

---

## 🏢 TEST 2: SETUP WIZARD FLOW (5 minutes)

### Goal: Verify organization setup works end-to-end

**Prerequisites**: Logged in with new account (from Test 1)

**Steps**:

1. **Organization Information**:
   - Enter organization name: `Test Organization [timestamp]`
   - Enter description: `This is a smoke test organization`
   - Upload logo (optional)
   - Click "Next"

2. **Expected Result**:
   - ✅ Should advance to next step
   - ✅ No errors
   - ✅ Form data should be saved

3. **Document Type Configuration**:
   - Select document type: "Bylaws" or "Custom"
   - If custom, enter name: `Test Document Type`
   - Click "Next"

4. **Expected Result**:
   - ✅ Should advance to hierarchy configuration
   - ✅ No errors

5. **Hierarchy Configuration**:
   - You should see hierarchy level inputs
   - Enter Level 1 name: `Article`
   - Enter Level 2 name: `Section`
   - ✅ Check that UI shows ALL 10 levels (even if using defaults)
   - Click "Next" or "Skip to Upload"

6. **Expected Result**:
   - ✅ Should advance to document upload
   - ✅ No JavaScript errors in console

7. **Complete Setup**:
   - Either upload a document OR skip
   - Click "Finish Setup"

8. **Expected Result**:
   - ✅ Should redirect to dashboard
   - ✅ Organization should be created
   - ✅ User should be org admin
   - ✅ Dashboard should load without errors

**🔴 FAIL IF**:
- 500 error at any step
- Stuck on loading screen
- Can't advance to next step
- Dashboard doesn't load

---

## 📊 TEST 3: DASHBOARD ACCESS (3 minutes)

### Goal: Verify dashboard loads and displays correct information

**Prerequisites**: Organization created (from Test 2)

**Steps**:

1. **Dashboard Load**:
   - Should be on dashboard after setup
   - OR navigate to: `http://localhost:3000/dashboard`

2. **Check Display**:
   - ✅ Organization name should be displayed
   - ✅ User name should be displayed
   - ✅ Navigation menu should be visible
   - ✅ No 500 errors in console
   - ✅ No "undefined" or "null" displayed on page

3. **Check Permissions**:
   - ✅ Should see admin options (if you're org admin)
   - ✅ Should NOT see global admin options (unless you're global admin)

4. **Navigation**:
   - Click through menu items
   - ✅ Each page should load
   - ✅ No 500 errors

**🔴 FAIL IF**:
- Dashboard shows blank/white screen
- 500 errors
- Infinite loading
- Permission errors

---

## 📄 TEST 4: DOCUMENT UPLOAD & PARSING (10 minutes)

### Goal: Verify document upload and parsing works

**Prerequisites**: Dashboard accessible (from Test 3)

**Steps**:

1. **Navigate to Upload**:
   - Find "Upload Document" or "Documents" menu
   - Click to open upload interface

2. **Prepare Test Document**:
   - Use existing `.docx` file with clear structure
   - OR create simple test document with headings:
     ```
     Article I - General Provisions
       Section 1.1 - Purpose
       Section 1.2 - Scope
     Article II - Membership
       Section 2.1 - Eligibility
       Section 2.2 - Rights
     ```

3. **Upload Document**:
   - Click "Upload" or "Choose File"
   - Select your `.docx` file
   - Click "Submit" or "Upload"

4. **Monitor Upload**:
   - ✅ Progress indicator should appear
   - ✅ Should show "Processing..." or similar
   - ✅ Watch browser console (F12) for parsing logs

5. **Expected Result** (This is critical):
   - ✅ Upload should complete (1-30 seconds depending on size)
   - ✅ Should see "Upload successful" or redirect to document view
   - ✅ NO errors like "Failed to parse" or "Invalid document"

6. **View Parsed Document**:
   - Should see document in list OR auto-open
   - Click to view document

7. **Verify Parsing Quality**:
   - ✅ Document sections should be displayed
   - ✅ Hierarchy should be detected (Articles, Sections, etc.)
   - ✅ Section numbers should be present
   - ✅ Content should be readable
   - ⚠️ Check for "orphan sections" (sections with no parent) - some are OK
   - ⚠️ Check depth levels are correct

8. **Check Console Logs**:
   - Open browser console (F12)
   - Look for parsing logs
   - ✅ Should see depth calculation logs (if verbose logging enabled)
   - ❌ Should NOT see errors or exceptions

**🔴 FAIL IF**:
- Upload times out
- Parser crashes
- No sections appear
- All sections are orphans
- Document is completely unreadable

**⚠️ ACCEPTABLE ISSUES** (Not blockers):
- 5-10% orphan sections (complex documents)
- Some depth levels incorrect (edge cases)
- Slow parsing (2-5 seconds for 100 sections)

---

## 👥 TEST 5: USER INVITATION (Optional - 5 minutes)

### Goal: Verify user invitation system works

**Prerequisites**: Organization created, you're org admin

**Steps**:

1. **Navigate to User Management**:
   - Find "Users" or "Members" in menu
   - Click to open

2. **Invite New User**:
   - Click "Invite User" or similar
   - Enter email: `invited-user-[timestamp]@example.com`
   - Select role: "Member" or "Editor"
   - Click "Send Invitation"

3. **Expected Result**:
   - ✅ Should see "Invitation sent" confirmation
   - ✅ Invitation should appear in pending list
   - ✅ No errors

4. **Check Invitation Link** (if you can access email):
   - Open email
   - Find invitation email
   - Copy invitation link
   - ✅ Link should be in format: `/auth/accept-invite/[token]`

5. **Accept Invitation** (Optional):
   - Open invitation link in incognito/private window
   - Should see invitation acceptance page
   - Create account or login
   - ✅ Should be added to organization

**🔴 FAIL IF**:
- Can't send invitation
- Invitation link is broken
- User can't accept invitation

---

## 📝 TEST 6: SUGGESTION WORKFLOW (Optional - 10 minutes)

### Goal: Verify suggestion and approval workflow

**Prerequisites**: Document uploaded with sections

**Steps**:

1. **Navigate to Document**:
   - Open a document with sections
   - Find a section to edit

2. **Create Suggestion**:
   - Click "Suggest Edit" or "Edit Section"
   - Modify the content
   - Add note: `Test suggestion - smoke test`
   - Click "Submit Suggestion"

3. **Expected Result**:
   - ✅ Suggestion should be created
   - ✅ Section should show "pending" or "locked" status
   - ✅ Suggestion should appear in list

4. **Approval Workflow** (if you have approver role):
   - Navigate to "My Tasks" or "Approvals"
   - Find the suggestion
   - Click "Review"
   - ✅ Should see diff view (old vs new content)
   - Click "Approve" or "Reject"

5. **Expected Result**:
   - ✅ Approval/rejection should process
   - ✅ Section status should update
   - ✅ If approved: Section content should update
   - ✅ If rejected: Section should unlock

**🔴 FAIL IF**:
- Can't create suggestions
- Workflow doesn't advance
- Approvals don't work
- Section stays locked forever

---

## 🔍 TEST 7: BROWSER CONSOLE CHECK (2 minutes)

### Goal: Verify no major JavaScript errors

**Steps**:

1. **Open Browser Console**:
   - Press F12 (Windows/Linux) or Cmd+Option+I (Mac)
   - Click "Console" tab

2. **Check for Errors**:
   - Look through console messages
   - ✅ Some warnings are OK (yellow)
   - ❌ Red errors are concerning
   - 🔴 Errors with "500" or "RLS" are critical

3. **Common Acceptable Warnings**:
   - Favicon missing
   - Third-party library warnings
   - CSS warnings
   - Development mode warnings

4. **Critical Errors to Watch For**:
   - 🔴 "500 Internal Server Error"
   - 🔴 "RLS policy violation"
   - 🔴 "Infinite recursion"
   - 🔴 "Unauthorized" (when you should be authorized)
   - 🔴 "Cannot read property of undefined" (repeated many times)

**🔴 FAIL IF**:
- Many red errors (>10)
- Any RLS recursion errors
- Repeated 500 errors

---

## 📊 SMOKE TEST RESULTS TRACKER

After running tests, fill this out:

```
SMOKE TEST RESULTS - [DATE]
========================================

✅ / ❌  Test 1: New Organization Creation
   Notes: _______________________________

✅ / ❌  Test 2: Setup Wizard Flow
   Notes: _______________________________

✅ / ❌  Test 3: Dashboard Access
   Notes: _______________________________

✅ / ❌  Test 4: Document Upload & Parsing
   Notes: _______________________________

✅ / ❌  Test 5: User Invitation (Optional)
   Notes: _______________________________

✅ / ❌  Test 6: Suggestion Workflow (Optional)
   Notes: _______________________________

✅ / ❌  Test 7: Browser Console Check
   Notes: _______________________________

OVERALL RESULT: PASS / FAIL
========================================

Critical Issues Found:
1. _______________________________
2. _______________________________
3. _______________________________

Minor Issues Found:
1. _______________________________
2. _______________________________

Ready for Launch? YES / NO / MAYBE
```

---

## 🚨 WHAT TO DO IF TESTS FAIL

### If Test 1-3 Fail (Auth/Setup):
1. Check server logs for errors
2. Verify database connection
3. Check Supabase Auth is configured
4. Verify migrations 023 and 024 are applied
5. Check `/docs/hive-mind/researcher-schema-findings.md` for auth issues

### If Test 4 Fails (Document Parsing):
1. Check browser console for errors
2. Check server logs during upload
3. Verify document is valid `.docx` format
4. See detailed parsing test (next file)
5. Check `/docs/hive-mind/coder-parser-findings.md` for parser issues

### If Test 5-6 Fail (Workflows):
1. Check permissions/roles
2. Verify workflow configuration
3. Check `/docs/hive-mind/tester-mvp-findings.md` for workflow issues

---

## ✅ MINIMUM PASSING CRITERIA

**For MVP Launch, you MUST pass**:
- ✅ Test 1: New Organization Creation
- ✅ Test 2: Setup Wizard Flow
- ✅ Test 3: Dashboard Access
- ✅ Test 4: Document Upload & Parsing (at least basic documents)

**Optional but Recommended**:
- Test 5: User Invitation
- Test 6: Suggestion Workflow

**If Tests 1-4 all pass**: You're **READY FOR SOFT LAUNCH** 🎉

---

## 📞 NEXT STEPS

### If All Tests Pass:
1. Run document parsing test (separate script)
2. Test on different browsers
3. Soft launch to 2-3 beta users
4. Monitor closely for issues

### If Some Tests Fail:
1. Document exact failure point
2. Check error messages in console and logs
3. Refer to Hive Mind specialist reports
4. Fix critical issues before launch

---

**Remember**: Smoke tests are meant to catch **obvious, critical issues**. They're not comprehensive - that's what your full test suite is for. The goal is to make sure the house isn't on fire before inviting guests.

Good luck! 🚀
