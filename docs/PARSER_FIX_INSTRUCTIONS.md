# URGENT: Parser Fix Instructions for Coder Agent

## Status
❌ **VALIDATION FAILED** - Critical bug blocks 95% retention target

## Problem Summary
- **Current word retention:** 65.76% (need 95%)
- **Missing content:** 3,247 words (34.24% loss)
- **Root cause:** Deduplication runs before content assignment

## The Bug

### What's Happening:
1. Parser detects sections from TOC (Table of Contents) → creates empty sections
2. Parser detects same sections from body → creates empty sections
3. **Deduplication runs** → compares 0 chars vs 0 chars, keeps first (TOC entry)
4. Content gets attached to sections
5. **Too late!** The empty TOC section was already chosen as the "winner"

### Evidence:
```
[WordParser] Skipping duplicate Section 2 (keeping original with 0 chars)
[WordParser] Replacing duplicate Section 3 (0 → 155 chars)
```

## The Fix (2-Line Change)

### File to Edit:
`/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/wordParser.js`

### Method:
`async parseSections(text, html, organizationConfig)` (starts at line 128)

### Current Code (BROKEN - lines 192-199):
```javascript
    // Capture any orphaned content that wasn't assigned to sections
    const sectionsWithOrphans = this.captureOrphanedContent(lines, sections, detectedItems);

    // Deduplicate sections to handle documents with repeated content
    const uniqueSections = this.deduplicateSections(sectionsWithOrphans);

    return this.enrichSections(uniqueSections, organizationConfig);
```

### Fixed Code:
```javascript
    // Capture any orphaned content that wasn't assigned to sections
    const sectionsWithOrphans = this.captureOrphanedContent(lines, sections, detectedItems);

    // Enrich sections FIRST (adds metadata and copies text to original_text)
    const enrichedSections = this.enrichSections(sectionsWithOrphans, organizationConfig);

    // Deduplicate AFTER content is assigned (now can compare actual content)
    const uniqueSections = this.deduplicateSections(enrichedSections);

    return uniqueSections;
```

### What Changed:
1. Call `enrichSections()` BEFORE `deduplicateSections()`
2. Return `uniqueSections` (deduplicated) instead of enriched sections

## Why This Works

**Before (broken):**
- Deduplication compares empty sections (all have `text = ""`)
- Keeps first occurrence (TOC entry)
- Content gets attached to wrong section later

**After (fixed):**
- Enrichment runs first, copies `text` to `original_text`
- Deduplication now compares sections with actual content
- Keeps content-rich version (body), discards empty version (TOC)
- **Result:** 95%+ retention achieved

## Validation Steps

After applying the fix:

```bash
# Clear Jest cache
npx jest --clearCache

# Run validation tests
npx jest tests/integration/rnc-bylaws-parse.test.js --verbose

# Run debug script
node scripts/debug-parser.js
```

## Expected Results After Fix

| Metric | Before | After (Expected) | Status |
|--------|--------|------------------|--------|
| Word Retention | 65.76% | ≥95% | ✅ |
| Character Retention | 84.27% | ≥95% | ✅ |
| Empty Sections | 4 | 0 | ✅ |
| Duplicate Citations | 37 | <5 | ✅ |
| Tests Passing | 15/20 | 20/20 | ✅ |

## Additional Checks

After fixing, verify:
1. ✅ All sections use `text` field for content (not `content` field)
2. ✅ `enrichSections()` correctly copies `text` to `original_text`
3. ✅ Deduplication keeps content-rich versions
4. ✅ No regression in hierarchy detection (28 articles, 68+ sections)

## Files to Review

**Primary:**
- `/src/parsers/wordParser.js` (line 192-199) - **MAKE THE FIX HERE**

**Validation:**
- `/tests/integration/rnc-bylaws-parse.test.js` - Test suite
- `/scripts/debug-parser.js` - Debug script
- `/docs/PARSER_FIX_VALIDATION.md` - Full validation report

## Time Estimate
- **Code change:** 2 minutes
- **Testing:** 5 minutes
- **Verification:** 3 minutes
- **Total:** 10 minutes

## Priority
🔴 **BLOCKER** - Must fix before any deployment

## Coordination

**After fix is applied:**
```bash
# Notify via hooks
npx claude-flow@alpha hooks notify --message "Parser deduplication fix applied. Re-running validation tests."

# Store result
npx claude-flow@alpha hooks post-edit --file "src/parsers/wordParser.js" --memory-key "swarm/coder/parser-fix"
```

**Handoff to Tester:**
- Run validation suite
- Confirm 95%+ retention
- Update PARSER_FIX_VALIDATION.md with ✅ COMPLETE status

---

## Quick Reference

**The 2-line fix:**
```diff
  const sectionsWithOrphans = this.captureOrphanedContent(lines, sections, detectedItems);
- const uniqueSections = this.deduplicateSections(sectionsWithOrphans);
- return this.enrichSections(uniqueSections, organizationConfig);
+ const enrichedSections = this.enrichSections(sectionsWithOrphans, organizationConfig);
+ return this.deduplicateSections(enrichedSections);
```

**Impact:** Fixes 34% content loss, achieves 95%+ retention target.
