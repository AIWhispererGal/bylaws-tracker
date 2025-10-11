# Quick Start Testing Guide
## Validate Google Removal in 15 Minutes

This is a condensed version of the full test plan for rapid validation.

---

## Pre-Check (2 minutes)

```bash
# 1. Navigate to project
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# 2. Install dependencies (if not already done)
npm install

# 3. Verify environment file exists
cat .env | grep SUPABASE_URL
```

If .env is missing or incomplete, create it:
```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key
APP_URL=http://localhost:3000
PORT=3000
SESSION_SECRET=test-secret-please-change-in-production
```

---

## Critical Path Test (10 minutes)

### Step 1: Start Application (1 min)
```bash
npm start
```

**Expected:** Server starts on port 3000 without errors

**Check for:**
- ✅ "Bylaws Amendment Tracker running on http://localhost:3000"
- ❌ No errors about Google APIs or missing credentials

---

### Step 2: Access Application (1 min)
Open browser: `http://localhost:3000`

**Expected:** Redirected to `/setup` (first-time setup wizard)

**Check for:**
- ✅ Setup wizard loads
- ❌ No console errors about Google in browser DevTools (F12)

---

### Step 3: Complete Setup (5 minutes)

**Organization Info:**
- Name: Test Organization
- Type: Non-Profit
- Email: test@example.com
- (Upload logo optional)
- Click Next

**Document Structure:**
- Select: "Article → Section"
- Numbering: Roman (I, II, III)
- Click Next

**Workflow:**
- Select any template (e.g., "Committee → Board")
- Click Next

**Import Document:** ⭐ CRITICAL TEST
- **Option A:** Upload a Word document (.docx)
- **Option B:** Skip import for now

Click "Import" or "Skip"

**Expected:**
- Processing screen appears
- Progress bar advances
- Completes without errors
- Redirects to success page

**CRITICAL CHECK:**
```bash
# In a separate terminal, check no Google API calls
# While processing is running, in your browser DevTools:
# Network tab → Filter: "google"
# Should show 0 requests to googleapis.com or docs.google.com
```

---

### Step 4: Verify Data (2 minutes)

Click "Go to Dashboard" or navigate to `/bylaws`

**If you uploaded a document:**
- ✅ Sections appear in the list
- ✅ Click a section → content displays
- ✅ Section citations match your Word doc

**If you skipped import:**
- ✅ Empty state message appears
- ✅ No errors in console

---

### Step 5: Test Core Functionality (1 min)

**Create a test suggestion:**
1. Select any section (or create one manually in Supabase)
2. Click "Add Suggestion"
3. Fill in:
   - Author: Test User
   - Suggested Text: This is a test suggestion
   - Rationale: Testing the system
4. Submit

**Expected:**
- ✅ Suggestion saves
- ✅ Appears in section's suggestion list
- ✅ No errors

---

## Verification Queries (2 minutes)

Run in Supabase SQL Editor:

```sql
-- Check organization created
SELECT name, organization_type, is_configured
FROM organizations
ORDER BY created_at DESC
LIMIT 1;

-- Check sections imported (if you uploaded a document)
SELECT COUNT(*) as section_count,
       MIN(section_citation) as first_section,
       MAX(section_citation) as last_section
FROM bylaw_sections;

-- Check suggestions working
SELECT bs.section_citation, bsg.author_name, bsg.status
FROM bylaw_suggestions bsg
JOIN bylaw_sections bs ON bsg.section_id = bs.id
ORDER BY bsg.created_at DESC
LIMIT 5;
```

**Expected:**
- Organization record exists
- Sections exist (if document uploaded)
- Suggestions created successfully

---

## Pass/Fail Criteria

### ✅ PASS if:
- [x] Application starts without Google-related errors
- [x] Setup wizard completes successfully
- [x] Document upload processes (if attempted)
- [x] Sections appear in database
- [x] UI displays sections correctly
- [x] Suggestions can be created
- [x] No browser console errors related to Google
- [x] No network requests to Google APIs

### ❌ FAIL if:
- [ ] Errors mentioning "Google", "googleapis", "clasp"
- [ ] Document upload fails or times out
- [ ] Sections don't appear after upload
- [ ] UI shows broken functionality
- [ ] Network tab shows requests to Google services

---

## Quick Rollback (if needed)

```bash
# Stop server
Ctrl+C

# Check what changed
git status
git diff

# Undo all changes
git checkout .

# Clean untracked files
git clean -fd -n  # Preview what will be deleted
git clean -fd     # Actually delete

# Restart
npm start
```

---

## Common Issues & Solutions

### Issue: npm start fails
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

### Issue: Database connection error
**Solution:** Check .env file has correct SUPABASE_URL and SUPABASE_ANON_KEY

### Issue: Port 3000 already in use
**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Issue: File upload fails
**Solution:**
- Check file is valid .docx (not .doc)
- File size under 10MB
- Check `uploads/setup/` directory exists

---

## Next Steps

**If all tests PASS:**
→ Proceed with full test plan (LOCAL_TEST_PLAN.md)
→ Document any minor issues
→ Ready for staging deployment

**If any tests FAIL:**
→ Document the failure in detail
→ Report to development team
→ DO NOT proceed to production

---

**Quick Test Complete!**
Total time: ~15 minutes
```
