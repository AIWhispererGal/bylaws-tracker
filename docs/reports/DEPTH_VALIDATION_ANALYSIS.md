# Code Quality Analysis: Document Parser Depth Logic

## Executive Summary

**Issue Identified:** Depth validation fails with error "Depth jumped from X to Y, skipping level(s)" during document upload.

**Root Cause:** Mismatch between how depths are assigned during parsing (`enrichSections`) versus how they are validated (`validateHierarchy`).

**Severity:** HIGH - Blocks document uploads for valid hierarchical structures

---

## Analysis Details

### 1. Depth Detection & Assignment Logic

#### Location: `src/parsers/wordParser.js` - `enrichSections()` (Lines 624-660)

**How Depth is Assigned:**
```javascript
// Line 651: Depth is assigned from the level definition lookup
depth: levelDef?.depth || 0
```

**Process Flow:**
1. Parser detects sections using `hierarchyDetector.detectHierarchy()`
2. Each detected item gets a `type` field (article, section, subsection, etc.)
3. In `enrichSections()`, the depth is looked up from the hierarchy config:
   ```javascript
   const levelDef = levels.find(l => l.type === section.type);
   ```
4. **CRITICAL**: Depth comes from the **hierarchy template configuration**, NOT from document structure

**Hierarchy Template Example** (`src/config/hierarchyTemplates.js`):
```javascript
'standard-bylaws': {
  levels: [
    { name: 'Article',      depth: 0, numbering: 'roman',     prefix: 'Article ' },
    { name: 'Section',      depth: 1, numbering: 'numeric',   prefix: 'Section ' },
    { name: 'Subsection',   depth: 2, numbering: 'numeric',   prefix: '' },
    { name: 'Paragraph',    depth: 3, numbering: 'alphaLower', prefix: '(' },
    // ... continues to depth 9
  ]
}
```

---

### 2. Depth Validation Logic

#### Location: `src/parsers/hierarchyDetector.js` - `validateHierarchy()` (Lines 248-306)

**Validation Rules:**

```javascript
// Lines 267-273: STRICT SEQUENTIAL DEPTH VALIDATION
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  errors.push({
    section: section.citation || `Section ${i + 1}`,
    error: `Depth jumped from ${prevDepth} to ${section.depth}, skipping level(s)`
  });
}
```

**Validation Enforcement:**
- ❌ **PROHIBITS depth jumps > 1** (e.g., depth 0 → 2 is invalid)
- ✅ **ALLOWS:**
  - Depth 0 → 1 (Article → Section)
  - Depth 1 → 2 (Section → Subsection)
  - Depth decreases (any depth → lower depth)
- ❌ **BLOCKS:**
  - Depth 0 → 2 (Article → Subsection, skipping Section)
  - Depth 1 → 3 (Section → Paragraph, skipping Subsection)

---

### 3. The Critical Mismatch

#### Problem Scenario

**Document Structure (Common Bylaws Pattern):**
```
Article I: Name                  (depth 0)
Section 1: Organization Name     (depth 1)
Section 2: Purpose              (depth 1)
Article II: Membership          (depth 0)
  (a) Eligibility criteria      (depth 3 - detected as 'paragraph')
  (b) Application process       (depth 3)
```

**What Happens:**
1. Parser detects "(a)" and matches it to hierarchy level `Paragraph` (depth: 3)
2. Previous section was depth 0 (Article II)
3. **Validation fails:** `3 > 0 + 1` → ERROR

**Why This Happens:**
- **Parser assigns depth from TEMPLATE, not document context**
- **Validator expects SEQUENTIAL document flow**
- **Real documents often skip intermediate levels** (Article directly to lettered list)

---

### 4. Code Snippets - Problematic Logic

#### Depth Assignment (wordParser.js:651)
```javascript
// ❌ PROBLEM: Depth assigned from static template
depth: levelDef?.depth || 0
```

**Issue:** If a document uses `(a)` directly under an Article, it gets depth 3 from the template, but the validator sees depth 0→3 jump.

#### Validation Check (hierarchyDetector.js:268-272)
```javascript
// ❌ PROBLEM: Too strict - doesn't account for flexible document structures
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  errors.push({
    section: section.citation || `Section ${i + 1}`,
    error: `Depth jumped from ${prevDepth} to ${section.depth}, skipping level(s)`
  });
}
```

**Issue:** Enforces strict sequential progression that doesn't match real-world bylaws.

---

### 5. Recent Changes Context

**Migration 018** (Added per-document hierarchy override):
- Purpose: Allow documents to use custom numbering schemas
- **Did NOT address depth calculation logic**
- Still uses static template depth values

**10-Level Support** (Added in previous commits):
- Extended hierarchy templates from 5 to 10 levels
- **Did NOT update validation rules**
- Validation still expects sequential depth progression

---

## Comparison: Parser vs Validator Expectations

| Component | Depth Source | Flexibility | Issue |
|-----------|-------------|-------------|-------|
| **Parser (`enrichSections`)** | Static template lookup by `type` | No document-aware adjustment | Assigns depth 3 to "(a)" regardless of context |
| **Validator (`validateHierarchy`)** | Expects sequential progression from previous section | Strict: only allows depth +1 or less | Rejects valid documents with depth jumps |

---

## Critical Issues Found

### Issue #1: Static Depth Assignment
**Severity:** HIGH
**Location:** `wordParser.js:651`

**Problem:**
```javascript
depth: levelDef?.depth || 0  // Uses template depth, not contextual depth
```

**Impact:** A section type always gets the same depth, even if document context suggests different nesting.

---

### Issue #2: Overly Strict Validation
**Severity:** HIGH
**Location:** `hierarchyDetector.js:268-272`

**Problem:**
```javascript
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  // Blocks depth jumps > 1
}
```

**Impact:** Rejects valid legal documents that skip intermediate numbering levels.

---

### Issue #3: No Context-Aware Depth Calculation
**Severity:** MEDIUM
**Location:** Multiple (parser flow)

**Problem:** Parser doesn't track parent-child relationships during detection phase to assign contextual depths.

**Impact:** Flat detection → template lookup misses document hierarchy intent.

---

## Data Flow Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Upload Flow                      │
└─────────────────────────────────────────────────────────────┘

1. File Upload
   └─> wordParser.parseDocument()

2. Text Extraction
   └─> mammoth.extractRawText()

3. Section Detection
   └─> hierarchyDetector.detectHierarchy(text, organizationConfig)
       • Scans text for patterns matching hierarchy template
       • Returns flat list: [{type: 'article', number: 'I'}, {type: 'paragraph', number: 'a'}, ...]
       • NO depth assigned yet - just 'type' field

4. Section Parsing
   └─> parseSections()
       • Builds sections array with content

5. ENRICHMENT (WHERE DEPTH IS ASSIGNED)
   └─> enrichSections(sections, organizationConfig)
       ┌───────────────────────────────────────────────┐
       │ const levelDef = levels.find(l => l.type === section.type) │
       │ depth: levelDef?.depth || 0  ← STATIC LOOKUP  │
       └───────────────────────────────────────────────┘

6. VALIDATION (WHERE ERROR OCCURS)
   └─> validateSections(sections, organizationConfig)
       └─> hierarchyDetector.validateHierarchy(sections, organizationConfig)
           ┌─────────────────────────────────────────────────┐
           │ if (section.depth > prevDepth + 1) {           │
           │   ERROR: "Depth jumped from X to Y"            │
           │ }                                              │
           └─────────────────────────────────────────────────┘
```

---

## Specific Lines Causing Error

### Error Thrown At:
**File:** `src/parsers/hierarchyDetector.js`
**Lines:** 268-272

```javascript
// Check for skipped levels (depth jumps by more than 1)
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  errors.push({
    section: section.citation || `Section ${i + 1}`,
    error: `Depth jumped from ${prevDepth} to ${section.depth}, skipping level(s)`
  });
}
```

### Depth Value Set At:
**File:** `src/parsers/wordParser.js`
**Line:** 651

```javascript
depth: levelDef?.depth || 0,
```

**Where `levelDef` comes from:**
**Line:** 639
```javascript
const levelDef = levels.find(l => l.type === section.type);
```

---

## Example Failure Scenario

### Document Content:
```
ARTICLE I - NAME
Section 1. The organization name shall be...
Section 2. The purpose of this organization...

ARTICLE II - MEMBERSHIP
(a) Eligibility criteria...
(b) Application process...
```

### Parser Behavior:
```javascript
[
  { type: 'article', number: 'I', depth: 0 },     // ✅ OK: First section
  { type: 'section', number: '1', depth: 1 },     // ✅ OK: 0→1 (+1)
  { type: 'section', number: '2', depth: 1 },     // ✅ OK: 1→1 (same)
  { type: 'article', number: 'II', depth: 0 },    // ✅ OK: 1→0 (decrease)
  { type: 'paragraph', number: 'a', depth: 3 },   // ❌ ERROR: 0→3 (+3 > +1)
                                                  //   "Depth jumped from 0 to 3"
]
```

**Why depth=3 for paragraph?**
Because hierarchy template defines:
```javascript
{ name: 'Paragraph', depth: 3, numbering: 'alphaLower', prefix: '(' }
```

**Why validation fails?**
Because previous section was Article (depth 0), and 3 > 0 + 1.

---

## Recommendations

### Option 1: Dynamic Depth Calculation (RECOMMENDED)
**Change parser to calculate depth from document structure, not template.**

**Implementation:**
```javascript
// In enrichSections(), track current context depth
let contextDepth = 0;
let depthStack = [];

return sections.map((section, index) => {
  const levelDef = levels.find(l => l.type === section.type);
  const templateDepth = levelDef?.depth || 0;

  // Calculate actual depth from nesting context
  while (depthStack.length > 0 &&
         depthStack[depthStack.length - 1].templateDepth >= templateDepth) {
    depthStack.pop();
  }

  const actualDepth = depthStack.length;
  depthStack.push({ templateDepth, section });

  return {
    ...section,
    depth: actualDepth,  // Use calculated depth, not template depth
    templateDepth: templateDepth,  // Store template depth for reference
    // ... rest of fields
  };
});
```

### Option 2: Relax Validation (QUICK FIX)
**Allow depth jumps, only warn instead of error.**

**Implementation:**
```javascript
// In validateHierarchy()
if (section.depth > prevDepth + 1 && prevDepth >= 0) {
  // Change to warning instead of error
  warnings.push({
    section: section.citation || `Section ${i + 1}`,
    message: `Depth jumped from ${prevDepth} to ${section.depth} (unusual but allowed)`
  });
}
```

### Option 3: Hybrid Approach (BALANCED)
**Calculate relative depth within parent context.**

**Implementation:**
- Track parent section IDs during parsing
- Calculate depth as: parent's depth + 1
- Use template depth only as a hint for section type recognition

---

## Testing Requirements

### Unit Tests Needed:
1. **Test depth calculation with skipped levels:**
   ```javascript
   Article → (a) → (i)  // Should handle 0→1→2, not 0→3→5
   ```

2. **Test validation with complex nesting:**
   ```javascript
   Article → Section → (a) → (1) → (i)
   ```

3. **Test depth decrease handling:**
   ```javascript
   Article I → Section 1 → (a) → Article II → Section 1
   ```

### Integration Tests Needed:
1. Real bylaws with non-sequential numbering
2. Documents mixing numbering styles
3. Per-document hierarchy overrides

---

## Files Requiring Changes

1. **`src/parsers/wordParser.js`** (Lines 624-660)
   - `enrichSections()` method
   - Add context-aware depth calculation

2. **`src/parsers/hierarchyDetector.js`** (Lines 248-306)
   - `validateHierarchy()` method
   - Relax or remove strict depth progression check

3. **`src/config/hierarchyTemplates.js`** (Entire file)
   - Add documentation about depth being a "template hint"
   - Not a strict requirement

---

## Impact Assessment

### If Not Fixed:
- ❌ Blocks uploads of valid legal documents
- ❌ Users forced to manually restructure documents
- ❌ 10-level hierarchy feature unusable for many documents
- ❌ Per-document hierarchy override feature partially broken

### If Fixed with Option 1:
- ✅ Supports all valid document structures
- ✅ Depth reflects actual nesting, not template
- ✅ Validation becomes more intelligent
- ⚠️ Requires moderate code changes

### If Fixed with Option 2:
- ✅ Quick fix, minimal code change
- ✅ Immediate unblocking of uploads
- ⚠️ Doesn't solve underlying depth assignment issue
- ⚠️ May allow truly invalid documents

---

## Conclusion

The "Depth jumped" validation error stems from a fundamental architectural mismatch:

1. **Parser uses static template depths** (article=0, section=1, paragraph=3)
2. **Validator expects sequential progression** (0→1→2→3, not 0→3)
3. **Real documents skip intermediate levels** (Article directly to (a) list)

**Recommended Fix:** Implement dynamic depth calculation based on document structure (Option 1), as it aligns with the original intent of supporting flexible document hierarchies.

**Immediate Workaround:** Relax validation to allow depth jumps (Option 2), then implement proper fix.

---

## Code Quality Score

**Overall Quality: 6/10**

**Strengths:**
- ✅ Clear separation of concerns (detection vs validation)
- ✅ Good error messaging
- ✅ Configurable hierarchy templates

**Weaknesses:**
- ❌ Static depth assignment doesn't match validation expectations
- ❌ No context-aware depth calculation
- ❌ Validation too strict for real-world documents
- ❌ Mismatch between parser and validator contracts

**Technical Debt:**
- Depth calculation logic needs refactoring
- Validation rules need to account for flexible structures
- Integration tests missing for depth edge cases
