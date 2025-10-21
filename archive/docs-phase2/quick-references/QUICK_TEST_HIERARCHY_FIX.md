# Quick Test Guide - Setup Wizard Hierarchy Fix

## 🚀 Test the Fix in 5 Minutes

### Test Scenario: Custom Level Names

**Goal:** Verify user's custom names ("Chapter", "Clause") are used during parsing, not defaults ("Article", "Section")

---

## Step-by-Step Test

### 1. Prepare Test Environment

```bash
# Option A: Clear existing test organization
# (If you have a test org, delete it via Supabase dashboard)

# Option B: Just create a new test organization
# (No cleanup needed)
```

### 2. Run Setup Wizard

1. Navigate to: `http://localhost:3000/setup`

2. **Organization Info:**
   - Name: "Test Custom Hierarchy"
   - Type: "Non-Profit"
   - Admin email: `test-hierarchy@example.com`
   - Password: `TestPass123!`

3. **Document Structure:** ⭐ CRITICAL STEP
   - **Level 1 Name:** `Chapter` (not "Article")
   - **Level 2 Name:** `Clause` (not "Section")
   - **Numbering:** `Numeric` (or any choice)

4. **Workflow:** Use defaults

5. **Import Document:** Upload any sample bylaws document

---

## 3. Verify the Fix

### Check 1: Database Inspection

**Open Supabase SQL Editor:**

```sql
-- Get the most recently created organization
SELECT
  id,
  name,
  hierarchy_config
FROM organizations
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**

```json
{
  "levels": [
    {
      "name": "Chapter",      // ✅ User's choice
      "type": "article",
      "depth": 0,
      "numbering": "numeric",
      "prefix": "Chapter "
    },
    {
      "name": "Clause",       // ✅ User's choice
      "type": "section",
      "depth": 1,
      "numbering": "numeric",
      "prefix": "Clause "
    },
    {
      "name": "Subsection",   // ✅ Default
      "type": "subsection",
      "depth": 2,
      // ...
    }
    // ... 7 more default levels
  ],
  "maxDepth": 10,
  "allowNesting": true
}
```

**🚨 FAIL if you see:**

```json
{
  "structure_type": "standard",
  "level1_name": "Chapter",
  "level2_name": "Clause",
  "numbering_style": "numeric"
}
```
(This is the OLD format - means fix didn't work)

---

### Check 2: Server Logs

**Look for these log lines:**

```
[SETUP-DEBUG] 📋 hierarchy_config to save: {
  "levels": [
    {
      "name": "Chapter",
      "type": "article",
      "depth": 0,
      "numbering": "numeric",
      "prefix": "Chapter "
    },
    ...
  ],
  "maxDepth": 10,
  "allowNesting": true
}
```

**✅ PASS if:** Log shows full `levels` array with 10 items
**❌ FAIL if:** Log shows old format with `level1_name`, `level2_name`

---

### Check 3: Parsed Sections

**Check parsed sections in database:**

```sql
-- Get sections from the imported document
SELECT
  id,
  section_number,
  section_title,
  hierarchy_path
FROM document_sections
WHERE organization_id = (
  SELECT id
  FROM organizations
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY hierarchy_path
LIMIT 10;
```

**Expected:**

```
section_number | section_title           | hierarchy_path
---------------|-------------------------|---------------
I              | Chapter I               | ["I"]
I.1            | Clause 1.1             | ["I", "1"]
I.2            | Clause 1.2             | ["I", "2"]
II             | Chapter II              | ["II"]
```

**🚨 FAIL if you see:**

```
section_number | section_title           | hierarchy_path
---------------|-------------------------|---------------
I              | Article I               | ["I"]
I.1            | Section 1.1            | ["I", "1"]
```
(Using "Article"/"Section" means parser used defaults, not custom names)

---

### Check 4: Config Loader Validation

**Look for this log when document is uploaded:**

```
[CONFIG-DEBUG] ✅ Using complete hierarchy from database
```

**✅ PASS if:** See "Using complete hierarchy"
**❌ FAIL if:** See "Database hierarchy incomplete (missing type/depth), using defaults"

---

## 4. Quick Visual Test

### Via Web UI

1. Log in with the admin account created
2. Navigate to dashboard
3. Click on the uploaded document
4. **Look at section headings:**
   - Should see: "Chapter I", "Chapter II"
   - Should see: "Clause 1.1", "Clause 1.2"
   - Should **NOT** see: "Article", "Section"

---

## 5. Test Edge Cases

### Test A: Default Names (Article/Section)

1. Run setup again with defaults
2. Verify "Article" and "Section" are used
3. **This should work both before and after the fix**

### Test B: Different Custom Names

Try:
- "Part" / "Division"
- "Title" / "Rule"
- "Book" / "Chapter"

Each should be respected in the parsed output.

---

## Expected Outcomes

### ✅ SUCCESS Indicators

- [ ] Database has `levels` array (not `level1_name`)
- [ ] `levels[0].name` matches user's choice
- [ ] `levels[1].name` matches user's choice
- [ ] Logs show "Using complete hierarchy from database"
- [ ] Parsed sections use custom names
- [ ] No validation warnings

### ❌ FAILURE Indicators

- [ ] Database has `level1_name` field
- [ ] Missing `levels` array
- [ ] Logs show "Database hierarchy incomplete"
- [ ] Parsed sections use "Article"/"Section" despite custom choices
- [ ] Validation errors in logs

---

## Debugging

### If Test Fails

**Check 1: Code was deployed**
```bash
grep -n "organizationConfig.getDefaultConfig" src/routes/setup.js
```
Should show the new code around line 623.

**Check 2: Server was restarted**
```bash
# Restart server
npm run dev
```

**Check 3: No syntax errors**
```bash
node -c src/routes/setup.js
```

**Check 4: Check backup exists**
```bash
ls -lh src/routes/setup.js.backup
```
If fix breaks things, restore with:
```bash
cp src/routes/setup.js.backup src/routes/setup.js
```

---

## What to Report

### If Test Passes ✅

Report:
- "Setup wizard hierarchy fix working"
- "Custom names 'Chapter' and 'Clause' used in parsing"
- Database shows correct 10-level schema

### If Test Fails ❌

Report:
1. **What you tested:** "Custom names 'Chapter' and 'Clause'"
2. **What happened:** "Parser used 'Article' and 'Section' instead"
3. **Database content:** Copy-paste `hierarchy_config` JSON
4. **Logs:** Copy-paste relevant `[SETUP-DEBUG]` and `[CONFIG-DEBUG]` lines
5. **Server version:** Check git commit hash

---

## Rollback Procedure

If the fix causes issues:

```bash
# Restore backup
cp src/routes/setup.js.backup src/routes/setup.js

# Restart server
npm run dev

# Verify old behavior restored
# (Custom names will be ignored again, but at least it works)
```

---

## Summary

**Total Test Time:** ~5 minutes
**Critical Check:** Database has `levels` array (not `level1_name`)
**Success:** Custom names used in parsed sections
**Failure:** Falls back to "Article"/"Section"

**Ready to test!** 🚀
