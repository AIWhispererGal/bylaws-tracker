# Manual Testing Guide: RNCBYLAWS Depth Fixes

**Purpose:** Step-by-step guide for completing manual testing of setup wizard and integration

---

## Prerequisites

1. **Application Running:**
   ```bash
   cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized
   npm start
   ```

2. **Test Document Ready:**
   - Location: `C:\Users\mgall\OneDrive\Desktop\RNCBYLAWS_2024.docx`
   - Size: 448.8 KB
   - Verified accessible: ✅

3. **Database Access:**
   - Supabase credentials in `.env`
   - Database connection working

---

## Test Scenario 1: Setup Wizard with Custom Hierarchy

### Step 1: Access Setup Wizard

1. Open browser: `http://localhost:3000`
2. Navigate to: `http://localhost:3000/setup`
3. Should see: "Welcome to Bylaws Tool Setup"

### Step 2: Create Organization

1. Click "Get Started" or "Create Organization"
2. Fill in organization details:
   ```
   Organization Name: Test Org - Custom Hierarchy
   Organization Type: Neighborhood Council
   ```
3. Click "Next" or "Continue"

### Step 3: Configure Custom Hierarchy

**This is the critical test for the setup wizard fix!**

1. Look for "Document Hierarchy Configuration" section
2. Configure **CUSTOM LEVEL NAMES** for first 3 levels:

   **Level 1 (Article):**
   ```
   Name: Chapter
   Numbering: Roman numerals (I, II, III)
   Prefix: Chapter
   ```

   **Level 2 (Section):**
   ```
   Name: Clause
   Numbering: Uppercase letters (A, B, C)
   Prefix: Clause
   ```

   **Level 3 (Subsection):**
   ```
   Name: Provision
   Numbering: Numbers (1, 2, 3)
   Prefix: Provision
   ```

3. **Leave remaining levels as defaults** (or use default button)
4. Click "Next" or "Save Configuration"

### Step 4: Verify in Database

Open Supabase SQL Editor or use psql:

```sql
-- Find your test organization
SELECT id, name, hierarchy_config
FROM organizations
WHERE name LIKE '%Test Org - Custom Hierarchy%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**

```json
{
  "levels": [
    {
      "name": "Chapter",
      "type": "article",
      "numbering": "roman",
      "prefix": "Chapter ",
      "depth": 0
    },
    {
      "name": "Clause",
      "type": "section",
      "numbering": "letters",
      "prefix": "Clause ",
      "depth": 1
    },
    {
      "name": "Provision",
      "type": "subsection",
      "numbering": "numeric",
      "prefix": "Provision ",
      "depth": 2
    },
    // ... 7 more default levels (depths 3-9)
  ],
  "maxDepth": 10
}
```

**✅ PASS Criteria:**
- ✅ `hierarchy_config.levels` is an array
- ✅ Array has exactly **10 items** (indices 0-9)
- ✅ First 3 levels have your custom names
- ✅ Remaining 7 levels have default names
- ✅ `maxDepth` is 10

**❌ FAIL Indicators:**
- ❌ `hierarchy_config.levels` is null or undefined
- ❌ Array has fewer than 10 items
- ❌ Custom names not preserved
- ❌ Database errors

---

## Test Scenario 2: Upload RNCBYLAWS with Custom Hierarchy

### Step 5: Upload Document

1. Continue in setup wizard OR navigate to admin dashboard
2. Look for "Upload Document" or "Import Document"
3. Select file: `C:\Users\mgall\OneDrive\Desktop\RNCBYLAWS_2024.docx`
4. Click "Upload" or "Import"

### Step 6: Monitor Upload Process

**Watch for:**

1. **Progress indicator** or upload status
2. **Success message** (should appear within 5-10 seconds)
3. **NO error messages** about "depth jumped"

**✅ Expected Success Messages:**
```
✓ Document uploaded successfully
✓ Parsed 51 sections
✓ Document ready for review
```

**❌ Expected NO Error Messages:**
```
❌ Depth jumped from 0 to 6  ← Should NOT appear
❌ Validation failed          ← Should NOT appear
❌ Missing hierarchy levels   ← Should NOT appear
```

### Step 7: Verify Document Sections

Navigate to the document viewer or sections list.

**Expected:**
- See list of 51 sections
- Sections organized by hierarchy
- Custom names appear in section citations

**Example expected sections:**
```
Chapter I - NAME
  Clause A - Mission
  Clause B - Policy
  Clause C - Execution of Purpose

Chapter II - PURPOSE
  Clause A - Boundary Description
  Clause B - Internal Boundaries
```

**Note:** The actual document (RNCBYLAWS) uses "Article" and "Section" in the source text, but if custom names are working, citations should show your custom names.

### Step 8: Verify Database Storage

```sql
-- Get document ID (use org ID from Step 4)
SELECT id, title, organization_id
FROM documents
WHERE organization_id = 'YOUR_ORG_ID_HERE'
ORDER BY created_at DESC
LIMIT 1;

-- Count sections
SELECT COUNT(*) as section_count
FROM document_sections
WHERE document_id = 'YOUR_DOC_ID_HERE';
-- Expected: 51

-- Check depth distribution
SELECT depth, COUNT(*) as count
FROM document_sections
WHERE document_id = 'YOUR_DOC_ID_HERE'
GROUP BY depth
ORDER BY depth;
-- Expected:
--   depth 0: 15 sections
--   depth 1: 36 sections

-- View sample sections
SELECT
  citation,
  depth,
  section_title,
  LEFT(content, 50) as content_preview
FROM document_sections
WHERE document_id = 'YOUR_DOC_ID_HERE'
ORDER BY depth, citation
LIMIT 20;
```

**✅ PASS Criteria:**
- ✅ Exactly 51 sections stored
- ✅ All depths are 0 or 1 (no invalid depths)
- ✅ No NULL depths
- ✅ Citations are well-formed
- ✅ Content is present (not empty)

---

## Test Scenario 3: Default Organization (No Custom Hierarchy)

### Step 9: Create Second Test Organization

1. Logout or use different browser/incognito
2. Go through setup wizard again
3. Create organization: `Test Org - Default Hierarchy`
4. **Accept all default hierarchy settings** (don't customize)
5. Upload same document: RNCBYLAWS_2024.docx

### Step 10: Verify Default Hierarchy Works

```sql
-- Check organization config
SELECT hierarchy_config
FROM organizations
WHERE name LIKE '%Test Org - Default%';

-- Should still have 10 levels
-- But with default names: Article, Section, Subsection, etc.
```

**✅ PASS Criteria:**
- ✅ Still has 10 levels
- ✅ Default names used: "Article", "Section", "Subsection", etc.
- ✅ Document uploads successfully
- ✅ Same 51 sections parsed

---

## Troubleshooting

### Issue: "Depth jumped" error appears

**Cause:** Parser fix not working
**Action:**
1. Check that `/src/parsers/wordParser.js` has the context-aware depth calculation code
2. Look for `enrichSectionsWithContext()` function
3. Review parser logs in console

### Issue: Hierarchy config has fewer than 10 levels

**Cause:** Setup wizard fix not applied
**Action:**
1. Check that `/src/services/setupService.js` has been updated
2. Look for code that auto-fills default levels
3. Review database migration scripts

### Issue: Custom names not appearing in sections

**Expected:** This is actually normal!
**Reason:** The source document (RNCBYLAWS) contains "Article I", "Section 1", etc. in the actual text. Custom names apply to the hierarchy *configuration*, not the source text.

**To see custom names work:**
- Create a new document from scratch using the hierarchy editor
- OR check that citations use the configured prefixes

### Issue: Upload hangs or times out

**Possible Causes:**
1. Document too large (unlikely - 448KB is small)
2. Database connection issues
3. Parser stuck in infinite loop

**Action:**
1. Check browser console for errors
2. Check server logs: `npm start` terminal
3. Try with a smaller test document first

---

## Quick Validation Checklist

### Setup Wizard ✅/❌

- [ ] Organization created successfully
- [ ] Custom hierarchy names can be entered
- [ ] Configuration saved to database
- [ ] `hierarchy_config.levels` has 10 items
- [ ] Custom names preserved in database
- [ ] Default levels auto-filled

### Document Upload ✅/❌

- [ ] Document uploads without errors
- [ ] No "depth jumped" errors appear
- [ ] Success message displayed
- [ ] 51 sections counted
- [ ] Sections visible in UI

### Database Verification ✅/❌

- [ ] Document record created
- [ ] 51 sections stored
- [ ] All depths are 0-9 (valid range)
- [ ] Depth distribution: 15 at depth 0, 36 at depth 1
- [ ] No NULL values in critical fields
- [ ] Content field populated

---

## Expected Timeline

| Task | Estimated Time |
|------|----------------|
| Setup Wizard Test | 5 minutes |
| Document Upload | 2 minutes |
| Database Verification | 3 minutes |
| Second Org Test | 5 minutes |
| **Total** | **~15 minutes** |

---

## Success Criteria Summary

**Overall PASS requires:**

1. ✅ Setup wizard accepts custom hierarchy names
2. ✅ Database stores exactly 10 hierarchy levels
3. ✅ RNCBYLAWS_2024.docx uploads without errors
4. ✅ Zero "depth jumped" validation errors
5. ✅ 51 sections parsed and stored correctly
6. ✅ All section depths in range 0-9
7. ✅ Both custom and default hierarchies work

**If all criteria met:** ✅ **DEPLOYMENT APPROVED**

---

## Reporting Results

After completing tests, report findings:

1. **Screenshot evidence:**
   - Setup wizard with custom names
   - Successful upload message
   - Section list in UI
   - Database query results

2. **Issues found:**
   - What went wrong
   - Error messages
   - Steps to reproduce

3. **Metrics collected:**
   - Upload time
   - Number of sections parsed
   - Any warnings or edge cases

---

## Contact

If you encounter issues or need clarification:

1. Check logs in browser console (F12)
2. Check server logs in terminal
3. Review test reports in `/docs/reports/`
4. Consult developer documentation

---

**Happy Testing!** 🧪
