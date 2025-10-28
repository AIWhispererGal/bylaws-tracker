# 🚀 QUICK TEST EXECUTION GUIDE
## For Human Testers (mgall)

**Last Updated**: October 28, 2025 (4:09 AM)
**Test Strategy**: `/tests/hive-mind/COMPREHENSIVE_TEST_STRATEGY.md`

---

## ⚡ QUICK START (5 Minutes)

### Step 1: Verify Server Starts
```bash
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized
npm start
```

**Expected**: Server runs on port 3000, NO "TypeError: fetch failed" errors

---

### Step 2: Check Package Version
```bash
npm list @supabase/supabase-js
```

**Expected**: `@supabase/supabase-js@2.76.1`

---

### Step 3: Test Organization Page
1. Open browser: `http://localhost:3000/auth/select`
2. Open console (F12)
3. **Expected**: Page loads, NO fetch errors

---

## 🎯 PRIORITY TESTS (After Coder Implementation)

### Test 1: Global Admin Upload ⚡ CRITICAL
```
1. Login as global admin
2. Select any organization (not owned by you)
3. Upload a .docx file
4. Expected: Upload succeeds, no 403 error
```

### Test 2: No "warnings is not defined" ⚡ CRITICAL
```
1. Login as org owner
2. Upload a .docx file
3. Check F12 console
4. Expected: NO "warnings is not defined" error
```

### Test 3: Global Admin Section Buttons ⚡ HIGH
```
1. Login as global admin
2. Open a document with sections
3. Click on a section
4. Expected: See indent/dedent/move/split buttons
```

### Test 4: Depth Values Vary ⚡ HIGH
**Requires Migration 025 first!**
```
1. Apply migration: database/migrations/025_fix_depth_trigger.sql
2. Delete old documents
3. Upload new document
4. Check database:
   SELECT section_number, depth FROM document_sections
5. Expected: Depth varies (0, 1, 2, 3...)
```

---

## 🧑‍💻 USER TYPE TESTS

### Test as Global Admin
```
Credentials: alice@test.com / AliceAdmin123!
Can: Access all orgs, upload anywhere, see all buttons
Cannot: Nothing - has full access
```

### Test as Org Owner
```
Credentials: bob@org1.com / BobOwner123!
Can: Manage own org, upload, edit sections
Cannot: Access global routes, see other orgs
```

### Test as Org Member
```
Credentials: charlie@org1.com / CharlieMember123!
Can: View documents, make suggestions
Cannot: Upload, edit, perform section operations
```

---

## 🐛 BUGS TO VERIFY FIXED

### ✅ Fixed (Test These)
1. Global admin upload permission - Should work now
2. "warnings is not defined" (upload) - Should not crash
3. "warnings is not defined" (hierarchy) - Should not crash
4. Global admin section buttons - Should be visible
5. Server fetch errors - Should not occur

### ⚠️ Requires Migration
1. Depth storage - Needs migration 025 applied first

---

## 📊 WHAT TO CHECK

### Browser Console (F12)
```
✅ Good: No errors, clean console
❌ Bad: "warnings is not defined"
❌ Bad: "TypeError: Cannot read properties of undefined"
❌ Bad: "403 Forbidden"
```

### Server Console
```
✅ Good: "Server running on port 3000"
✅ Good: "[hierarchyDetector] ✓ Hierarchy detected"
❌ Bad: "TypeError: fetch failed"
❌ Bad: "ReferenceError: warnings is not defined"
```

### Database (Supabase)
```sql
-- Check depth distribution
SELECT depth, COUNT(*) FROM document_sections GROUP BY depth;

-- Expected:
-- depth 0: 10-15 (Articles)
-- depth 1: 40-50 (Sections)
-- depth 2+: 20-30 (Subsections)
```

---

## 🚨 IF TESTS FAIL

### 1. Document the Error
- Take screenshot (F12 console + page)
- Copy full error message
- Note which test step failed

### 2. Check Server Logs
- Look for error stack traces
- Copy relevant log lines
- Note timestamp of error

### 3. Report to Hive Mind
```bash
# Store bug report in memory
npx claude-flow@alpha memory store "hive/tester/bug-found" "Bug description here" --namespace hive
```

---

## 🎯 SUCCESS CRITERIA

### Minimum Viable Test Results
- ✅ Server starts without errors
- ✅ Organization page loads
- ✅ Upload works for global admin
- ✅ No "warnings is not defined" errors
- ✅ Section buttons visible for global admin

### Complete Success
- ✅ All 7 bug fix tests pass
- ✅ All 3 user journey tests pass
- ✅ All 4 regression tests pass
- ✅ All polish feature tests pass

---

## 📞 NEED HELP?

### Coder Not Done?
- Wait for Coder agent to complete implementation
- Current status: ⏳ **PENDING CODER IMPLEMENTATION**

### Migration 025 Not Applied?
- Location: `database/migrations/025_fix_depth_trigger.sql`
- Instructions: `database/migrations/APPLY_025_FIX_DEPTH.md`
- This blocks depth testing only

### Tests Failing?
- Document the failure
- Contact Queen Seraphina (via Claude)
- Deploy debug swarm if needed

---

## 📋 CHECKLIST FOR HUMAN

Before testing:
- [ ] Server starts successfully
- [ ] Supabase package is v2.76.1
- [ ] Migration 025 applied (for depth tests)
- [ ] Test users created (Alice, Bob, Charlie)
- [ ] Test organizations created

During testing:
- [ ] Test 1: Global admin upload
- [ ] Test 2: No warnings errors
- [ ] Test 3: Section buttons visible
- [ ] Test 4: Depth values vary
- [ ] Test 5: User journey (global admin)
- [ ] Test 6: User journey (org owner)
- [ ] Test 7: User journey (member)

After testing:
- [ ] Document results
- [ ] Take screenshots of any errors
- [ ] Report findings
- [ ] Celebrate success! 🎉

---

**Quick Reference**: See full test strategy at `/tests/hive-mind/COMPREHENSIVE_TEST_STRATEGY.md`

**Ready to test!** 🧪✨
