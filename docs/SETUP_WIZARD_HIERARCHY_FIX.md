# Setup Wizard Hierarchy Schema Conversion - FIXED ✅

**Date:** 2025-10-19
**Status:** COMPLETE
**File Modified:** `/src/routes/setup.js`
**Backup Created:** `/src/routes/setup.js.backup`

---

## Problem Summary

The setup wizard was storing hierarchy configuration in an **old 2-level format**, but the parser expected a **new 10-level format**. This caused user's custom level names (e.g., "Chapter", "Clause") to be ignored, falling back to defaults ("Article", "Section").

### Before Fix
```javascript
// Old 2-level format (BROKEN)
hierarchy_config: {
  structure_type: 'standard',
  level1_name: 'Chapter',
  level2_name: 'Clause',
  numbering_style: 'roman'
}
```

**Problem:** Missing required fields (`levels`, `type`, `depth`) → validation fails → uses defaults

### After Fix
```javascript
// New 10-level format (CORRECT)
hierarchy_config: {
  levels: [
    { name: 'Chapter', type: 'article', depth: 0, numbering: 'roman', prefix: 'Chapter ' },
    { name: 'Clause', type: 'section', depth: 1, numbering: 'numeric', prefix: 'Clause ' },
    // ... 8 more default levels (Subsection, Paragraph, etc.)
  ],
  maxDepth: 10,
  allowNesting: true
}
```

**Result:** Has all required fields → validation passes → uses custom names

---

## Changes Made

### File: `/src/routes/setup.js`

**Location:** Lines 611-652 (in `processSetupData()` → case 'organization')

**What Changed:**

1. **Import organizationConfig** to get default 10-level hierarchy
2. **Build complete hierarchy** by:
   - Customizing first 2 levels with user's choices
   - Using defaults for remaining 8 levels
   - Including all required fields (`type`, `depth`, `numbering`, `prefix`)
3. **Store in correct format** with `levels` array

**Code Implementation:**

```javascript
// ✅ FIX: Build complete 10-level hierarchy from user choices
const organizationConfig = require('../config/organizationConfig');

const hierarchyConfig = (() => {
  // Get user's choices from setup wizard (or use defaults)
  const level1Name = setupData.documentType?.level1_name || 'Article';
  const level2Name = setupData.documentType?.level2_name || 'Section';
  const numberingStyle = setupData.documentType?.numbering_style || 'roman';

  // Get default 10-level hierarchy structure
  const defaultHierarchy = organizationConfig.getDefaultConfig().hierarchy;

  // Build complete hierarchy: customize first 2 levels, use defaults for remaining 8
  return {
    levels: [
      // Level 0: Customize with user's choice for level 1
      {
        name: level1Name,
        type: 'article',
        numbering: numberingStyle,
        prefix: `${level1Name} `,
        depth: 0
      },
      // Level 1: Customize with user's choice for level 2
      {
        name: level2Name,
        type: 'section',
        numbering: 'numeric',
        prefix: `${level2Name} `,
        depth: 1
      },
      // Levels 2-9: Use defaults from organizationConfig
      ...defaultHierarchy.levels.slice(2)
    ],
    maxDepth: 10,
    allowNesting: true
  };
})();
```

---

## How It Works

### User Journey

1. **User runs setup wizard**
2. **Chooses custom names:** "Chapter" and "Clause"
3. **Setup wizard converts** user choices to 10-level schema:
   - Level 0: "Chapter" (user's choice)
   - Level 1: "Clause" (user's choice)
   - Level 2-9: Defaults (Subsection, Paragraph, etc.)
4. **Stores in database** in correct format
5. **Parser loads config** from database
6. **Validation passes** (all required fields present)
7. **Parser uses** "Chapter" and "Clause" ✅

### Technical Flow

```
Setup Wizard
  ↓
User inputs: { level1_name: "Chapter", level2_name: "Clause", numbering_style: "roman" }
  ↓
Conversion Logic (NEW CODE)
  ↓
Load defaults: organizationConfig.getDefaultConfig().hierarchy
  ↓
Merge user choices with defaults
  ↓
Build 10-level schema
  ↓
Store in database: hierarchy_config column
  ↓
Parser loads config
  ↓
Validation checks: ✅ levels array, ✅ type, ✅ depth, ✅ numbering
  ↓
Parser uses custom names: "Chapter" and "Clause"
```

---

## Benefits

### ✅ User's custom names respected immediately
- No more silent fallback to "Article" and "Section"
- What you choose in setup is what you get in parsing

### ✅ Consistent behavior across all flows
- Setup wizard flow: Uses custom names
- Document upload flow: Uses custom names
- Hierarchy editor: Uses custom names

### ✅ Backward compatible
- Existing organizations continue working
- `organizationConfig.loadFromDatabase()` already validates schema
- Invalid schemas fall back to defaults gracefully

### ✅ Future-proof
- All 10 levels available for customization
- Phase 2 enhancements can build on this foundation
- Aligns with existing parser expectations

---

## Testing Required

### Manual Testing

#### Test 1: Fresh Setup with Default Names
1. Clear database
2. Run setup wizard
3. Use defaults ("Article", "Section", "Roman")
4. Upload bylaws document
5. **Verify:** Sections parsed with "Article" and "Section"

#### Test 2: Fresh Setup with Custom Names ⭐ CRITICAL
1. Clear database
2. Run setup wizard
3. Choose custom names ("Chapter", "Clause", "Numeric")
4. Upload bylaws document
5. **Expected:** Sections parsed with "Chapter" and "Clause"
6. **Bug if:** Falls back to "Article" and "Section"

#### Test 3: Document Upload After Setup
1. Complete setup (with custom names)
2. Upload second document via admin panel
3. **Verify:** Same hierarchy used

### Automated Testing

```bash
# Run existing parser tests (should all still pass)
npm test -- tests/unit/wordParser.edge-cases.test.js

# Run setup integration tests
npm test -- tests/integration/setup-flow.test.js
```

### Validation Checks

After deployment, check logs for:

```
[CONFIG-DEBUG] ✅ Using complete hierarchy from database
```

Should NOT see:
```
[CONFIG-DEBUG] ⚠️  Database hierarchy incomplete (missing type/depth), using defaults
```

---

## Rollback Plan

### If Issues Occur

**Restore backup:**
```bash
cp src/routes/setup.js.backup src/routes/setup.js
```

**Or revert git commit:**
```bash
git revert <commit-hash>
```

### Emergency Database Fix

If organizations were created with invalid schema:

```sql
-- Check for invalid schemas
SELECT id, name, hierarchy_config
FROM organizations
WHERE hierarchy_config->'levels' IS NULL
  AND hierarchy_config->>'level1_name' IS NOT NULL;

-- Manual fix (if needed)
-- See /docs/research/PARSING_UNIFICATION_RECOMMENDATIONS.md
-- Section: "Migration for Existing Organizations"
```

---

## Files Changed

| File | Status | Lines Changed | Purpose |
|------|--------|---------------|---------|
| `/src/routes/setup.js` | Modified | ~40 lines | Convert user choices to 10-level schema |
| `/src/routes/setup.js.backup` | Created | - | Backup of original file |
| `/docs/SETUP_WIZARD_HIERARCHY_FIX.md` | Created | - | This documentation |

---

## Related Documentation

- **Research Recommendations:** `/docs/research/PARSING_UNIFICATION_RECOMMENDATIONS.md`
- **Organization Config:** `/src/config/organizationConfig.js`
- **Setup Service:** `/src/services/setupService.js`
- **Word Parser:** `/src/parsers/wordParser.js`

---

## Next Steps

1. ✅ **Code implementation** - COMPLETE
2. ✅ **Backup created** - COMPLETE
3. ⏳ **Testing** - Run manual tests above
4. ⏳ **Deployment** - Deploy to staging/production
5. ⏳ **Migration** - Consider migrating existing organizations (see recommendations doc)
6. ⏳ **Monitoring** - Watch logs for validation warnings

---

## Success Criteria

✅ **Fix is successful if:**

- [ ] Fresh setup with custom names works
- [ ] User chooses "Chapter" / "Clause"
- [ ] Parser uses "Chapter" / "Clause" (not "Article" / "Section")
- [ ] No validation warnings in logs
- [ ] Existing organizations still work
- [ ] All automated tests pass

---

## Summary

**What was broken:** Setup wizard stored hierarchy in old 2-level format
**Why it failed:** Parser expected new 10-level format with `levels` array
**How it's fixed:** Convert user's choices to complete 10-level schema
**Lines changed:** ~40 lines in `/src/routes/setup.js`
**Impact:** User's custom names now respected immediately
**Risk:** Low (backward compatible, validation handles edge cases)

**Status:** ✅ **IMPLEMENTATION COMPLETE - READY FOR TESTING**
