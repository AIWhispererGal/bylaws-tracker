# Depth Validation Fix - Quick Reference

## Immediate Action Required

**Issue:** Document uploads fail with error `"Depth jumped from X to Y, skipping level(s)"`

**Root Cause:** Mismatch between static template depth assignment vs sequential validation expectations

**Files to Modify:**
1. `src/parsers/hierarchyDetector.js` (validation logic)
2. `src/parsers/wordParser.js` (depth assignment)

---

## Quick Fix (15 minutes) - Option A

### Change Validation from ERROR to WARNING

**File:** `src/parsers/hierarchyDetector.js`
**Lines:** 268-272

**BEFORE:**
```javascript
// Check for skipped levels (depth jumps by more than 1)
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  errors.push({
    section: section.citation || `Section ${i + 1}`,
    error: `Depth jumped from ${prevDepth} to ${section.depth}, skipping level(s)`
  });
}
```

**AFTER:**
```javascript
// Check for skipped levels (depth jumps by more than 1)
// NOTE: This is common in legal documents (e.g., Article → (a) directly)
// Changed to warning instead of error to allow flexible structures
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  warnings.push({
    section: section.citation || `Section ${i + 1}`,
    message: `Depth jumped from ${prevDepth} to ${section.depth} (unusual structure but allowed)`,
    type: 'depth_jump'
  });
}
```

**Also update the validateHierarchy function signature to return warnings:**

**BEFORE:**
```javascript
return {
  valid: errors.length === 0,
  errors
};
```

**AFTER:**
```javascript
return {
  valid: errors.length === 0,
  errors,
  warnings: warnings || []
};
```

**And initialize warnings array at the top of validateHierarchy (line 249):**
```javascript
validateHierarchy(sections, organizationConfig) {
  const errors = [];
  const warnings = []; // ADD THIS LINE
  const levels = organizationConfig.hierarchy?.levels || [];
  const maxDepth = organizationConfig.hierarchy?.maxDepth || 10;
```

---

## Proper Fix (2-3 hours) - Option B (RECOMMENDED)

### Implement Context-Aware Depth Calculation

**File:** `src/parsers/wordParser.js`
**Method:** `enrichSections()` (lines 624-660)

**REPLACE THE ENTIRE enrichSections METHOD WITH:**

```javascript
/**
 * Enrich sections with hierarchy information
 * Uses context-aware depth calculation based on document structure
 */
enrichSections(sections, organizationConfig) {
  const hierarchy = organizationConfig?.hierarchy || {};
  let levels = hierarchy.levels;

  // Handle undefined, null, or non-array levels gracefully
  if (!levels || !Array.isArray(levels)) {
    console.warn('[WordParser] Missing or invalid hierarchy.levels, using empty array as fallback');
    levels = [];
  }

  let articleNumber = null;
  let sectionNumber = 0;

  // Context-aware depth calculation
  let depthStack = [];  // Stack to track current nesting context

  return sections.map((section, index) => {
    // Find matching level definition
    const levelDef = levels.find(l => l.type === section.type);
    const templateDepth = levelDef?.depth || 0;

    // Calculate actual depth from document context
    // Pop stack until we find a parent with lower template depth
    while (depthStack.length > 0 &&
           depthStack[depthStack.length - 1].templateDepth >= templateDepth) {
      depthStack.pop();
    }

    // Actual depth is the current stack depth
    const actualDepth = depthStack.length;

    // Track article and section numbers for the old schema compatibility
    if (section.type === 'article') {
      articleNumber = this.parseNumber(section.number, levelDef?.numbering);
      sectionNumber = 0;
    } else if (section.type === 'section') {
      sectionNumber = this.parseNumber(section.number, levelDef?.numbering);
    }

    // Create enriched section
    const enrichedSection = {
      ...section,
      depth: actualDepth,           // Use calculated contextual depth
      templateDepth: templateDepth,  // Store template depth for reference
      ordinal: index + 1,
      article_number: articleNumber,
      section_number: sectionNumber,
      section_citation: section.citation,
      section_title: `${section.citation} - ${section.title}`,
      original_text: section.text || '(No content)'
    };

    // Push current section to stack for next iteration
    depthStack.push({
      templateDepth: templateDepth,
      actualDepth: actualDepth,
      section: enrichedSection
    });

    return enrichedSection;
  });
}
```

**Key Changes:**
1. Added `depthStack` to track parent-child relationships
2. Calculate `actualDepth` from stack depth, not template
3. Store `templateDepth` separately for reference/debugging
4. Sections with same template depth become siblings (same depth)
5. Sections with higher template depth become children (depth + 1)

---

## Testing the Fix

### Test Case 1: Depth Jump (Article → (a))

**Document:**
```
ARTICLE I - NAME
(a) The organization name shall be...
(b) The acronym shall be...
```

**Expected Result:**
```javascript
[
  { type: 'article', depth: 0, templateDepth: 0 },  // Root
  { type: 'paragraph', depth: 1, templateDepth: 3 }, // Child of Article
  { type: 'paragraph', depth: 1, templateDepth: 3 }  // Sibling
]
```

**Validation:** Should PASS ✅ (depth progression: 0→1→1)

---

### Test Case 2: Complex Nesting

**Document:**
```
ARTICLE I
  Section 1
    (a) Item
      (1) Sub-item
    (b) Item
  Section 2
ARTICLE II
```

**Expected Result:**
```javascript
[
  { type: 'article', depth: 0, templateDepth: 0 },     // Root
  { type: 'section', depth: 1, templateDepth: 1 },     // Child
  { type: 'paragraph', depth: 2, templateDepth: 3 },   // Grandchild
  { type: 'subparagraph', depth: 3, templateDepth: 4 },// Great-grandchild
  { type: 'paragraph', depth: 2, templateDepth: 3 },   // Back to grandchild
  { type: 'section', depth: 1, templateDepth: 1 },     // Back to child
  { type: 'article', depth: 0, templateDepth: 0 }      // Back to root
]
```

**Validation:** Should PASS ✅ (proper nesting, decreases allowed)

---

## Validation Changes (If Using Option B)

**File:** `src/parsers/hierarchyDetector.js`
**Method:** `validateHierarchy()`

**OPTIONAL:** You can also update validation to be smarter about depth jumps:

```javascript
// Check for skipped levels (depth jumps by more than 1)
// With context-aware depth calculation, this should rarely trigger
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  // Only error if the jump seems truly invalid
  // (More than 2 levels at once might indicate parsing issue)
  if (section.depth > prevDepth + 2) {
    errors.push({
      section: section.citation || `Section ${i + 1}`,
      error: `Depth jumped from ${prevDepth} to ${section.depth} (possible parsing error)`
    });
  } else {
    warnings.push({
      section: section.citation || `Section ${i + 1}`,
      message: `Depth jumped from ${prevDepth} to ${section.depth} (unusual but allowed)`
    });
  }
}
```

---

## Deployment Checklist

### Quick Fix (Option A):
- [ ] Modify `hierarchyDetector.js` validation logic
- [ ] Add `warnings` array initialization
- [ ] Update return statement to include warnings
- [ ] Test with failing document
- [ ] Commit with message: "fix: Allow depth jumps in hierarchy validation"
- [ ] Deploy to production

### Proper Fix (Option B):
- [ ] Backup current `enrichSections()` method
- [ ] Replace with context-aware version
- [ ] Add unit tests for depth calculation
- [ ] Test with multiple document structures
- [ ] Verify all existing tests still pass
- [ ] Update documentation
- [ ] Commit with message: "feat: Implement context-aware depth calculation for document hierarchy"
- [ ] Deploy to production

---

## Verification

### After Quick Fix (Option A):
```bash
# Upload a document with depth jumps
# Should succeed with warnings, not errors

# Check logs for:
# "Depth jumped from 0 to 3 (unusual structure but allowed)"
```

### After Proper Fix (Option B):
```bash
# Run unit tests
npm test -- wordParser

# Upload test documents:
# 1. Bylaws with Article → (a) pattern
# 2. Complex nested hierarchy
# 3. Mixed numbering styles

# Verify depth values in database match document structure
```

---

## Rollback Plan

### If Quick Fix (Option A) Causes Issues:
```bash
git revert HEAD
# Restore original validation logic
```

### If Proper Fix (Option B) Causes Issues:
```bash
git revert HEAD
# Restore original enrichSections() method
# Fall back to Quick Fix (Option A) if needed
```

---

## Support Scripts

### Check Current Depth Assignment
```javascript
// Add to wordParser.js enrichSections() for debugging:
console.log(`[DEPTH] ${section.citation}: template=${templateDepth}, actual=${actualDepth}, stack=${depthStack.length}`);
```

### Validate Depth Consistency
```sql
-- Run in database to check for depth issues
SELECT
  d.title,
  ds.section_number,
  ds.depth,
  ds.parent_section_id
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
ORDER BY d.id, ds.path_ordinals;
```

---

## Related Documentation

- **Full Analysis:** `docs/reports/DEPTH_VALIDATION_ANALYSIS.md`
- **Visual Diagram:** `docs/reports/DEPTH_VALIDATION_VISUAL_DIAGRAM.txt`
- **Parser Architecture:** `docs/PARSER_ARCHITECTURE.md`
- **Hierarchy Templates:** `src/config/hierarchyTemplates.js`

---

## Contact

If issues persist after applying fix:
1. Check server logs for detailed error messages
2. Verify hierarchy configuration in organization settings
3. Test with minimal document (Article + Section only)
4. Review database schema for `document_sections.depth` column
