# 🚀 QUICK TEST - Upload Fixes
**Time Required:** 5 minutes
**What Was Fixed:** "warnings is not defined" error + error message improvements

---

## ⚡ 3-STEP QUICK TEST

### Step 1: Start Server (1 minute)
```bash
npm start
```

**Expected Output:**
```
✅ Server running on port 3000
✅ No "fetch failed" errors
✅ No startup errors
```

---

### Step 2: Test Upload as Org Owner (2 minutes)

1. **Open browser:** http://localhost:3000/auth/select
2. **Login** as org owner account
3. **Select organization**
4. **Click** "Upload Document" button
5. **Choose** a .docx file
6. **Upload** the file

**Expected Result:**
```
✅ Progress bar shows upload
✅ Success message displays:
   "Document 'filename.docx' uploaded successfully with X sections"
✅ Page reloads after 2 seconds
✅ Document appears in list
```

**Check F12 Console:**
```
✅ NO "warnings is not defined" error
✅ NO JavaScript errors at all
✅ Clean console output
```

---

### Step 3: Test Upload as Global Admin (2 minutes)

1. **Logout** and login as **global admin**
2. **Select ANY organization** (not just your own)
3. **Upload** a document
4. **Verify** success

**Expected Result:**
```
✅ Global admin can select any org
✅ Upload succeeds
✅ No permission errors
✅ Document created in selected org
```

---

## ✅ SUCCESS CRITERIA

All 3 checks must pass:

1. ✅ **Server Starts** - No errors in terminal
2. ✅ **Org Owner Upload** - No "warnings is not defined" error
3. ✅ **Global Admin Upload** - No permission errors

---

## ❌ IF SOMETHING FAILS

### Error: "warnings is not defined"
**Status:** 🐛 This should be FIXED now
**Action:** Check `views/dashboard/dashboard.ejs` lines 794 and 823
**Expected:** Should use `Array.isArray(response.warnings)`

### Error: "Permission Denied"
**Status:** 🐛 This should be FIXED for global admins
**Action:**
1. Verify you're logged in as global admin
2. Check `users` table: `is_global_admin = true`
3. Check session has `isGlobalAdmin: true`

### Error: "No organization selected"
**Status:** ⚠️ Expected if you didn't select an org
**Action:** Go to org selection page and pick an organization

---

## 🎯 WHAT TO REPORT BACK

### If Everything Works ✅
```
✅ All 3 tests passed!
✅ No JavaScript errors
✅ Upload works for org owners
✅ Upload works for global admins
✅ Ready to move on to next tasks!
```

### If Something Fails ❌
Please report:
1. Which step failed (1, 2, or 3)
2. What error message appeared
3. What's in F12 console
4. Screenshot if possible

---

## 📝 BONUS TEST (Optional - 3 minutes)

### Test Error Handling

1. **Upload invalid file** (e.g., .pdf)
2. **Expected:** Error message shows
3. **Check:** Error message includes warnings (if any)

**Example Expected Error:**
```
❌ Upload failed

Validation Errors:
- Only .doc, .docx, .txt, and .md files are allowed

Warnings:
- File type not recognized
```

This verifies the error handler properly displays warnings too!

---

## 🎊 AFTER TESTING

If all tests pass, you're ready to:
1. ✅ Commit the fixes
2. ✅ Move on to workflow implementation
3. ✅ Test section operations (move, indent, split)

**Total time investment:** 5 minutes
**Confidence gained:** 100% that uploads work! 🚀
