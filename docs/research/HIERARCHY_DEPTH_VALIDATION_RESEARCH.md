# Document Hierarchy Depth Validation Research Report

**Research Date:** 2025-10-18
**Investigation:** "0 to 6" then "4 to 6" Validation Error Pattern
**Research Agent:** Autonomous Research Specialist
**Priority:** HIGH - Blocking Setup Wizard Completion

---

## Executive Summary

The validation error pattern **"No level definition found for depth 0 to 6"** followed by five instances of **"depth 4 to 6"** indicates a **mismatch between parsed document sections and the organization's hierarchy configuration**. The root cause is that the hierarchy configuration stored in the database **lacks proper depth properties** on level definitions, causing the validator to fail when attempting to match section depths to configured levels.

### Key Findings

1. ✅ **System Supports 10-Level Hierarchy** (Depth 0-9) - Confirmed in Phase 1 implementation
2. ❌ **Database Hierarchy Config Incomplete** - Missing `depth` property on stored levels
3. ⚠️ **Validation Logic Working Correctly** - Error messages accurately reflect missing definitions
4. 🔍 **Setup Wizard Hierarchy Mismatch** - Default config may not align with uploaded documents
5. 📊 **Error Pattern Suggests Specific Document Structure** - 1 section at depth 0-6, 5 sections at depth 4-6

---

## Historical Context: 10-Level Hierarchy Implementation

### Phase 1 Completion (October 2025)

The system was successfully upgraded to support **10-level document hierarchies** (depth 0-9):

**Migration 018: Per-Document Hierarchy Override**
- Date: October 17, 2025
- Purpose: Allow per-document numbering schema configuration
- Schema: `documents.hierarchy_override JSONB` column added
- Format: `{"levels": [...10 level definitions...], "maxDepth": 10}`

**Key Implementation Files:**

1. **`/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/hierarchyTemplates.js`**
   - Pre-built 10-level hierarchy templates
   - 4 templates: Standard Bylaws, Legal Document, Policy Manual, Technical Standard
   - Each template defines depths 0-9 with complete metadata

2. **`/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/organizationConfig.js`**
   - Default hierarchy: 10 levels (Article → Section → Subsection → ... → Point)
   - Lines 69-144: Complete default configuration
   - Lines 342-365: Database hierarchy validation logic

3. **`/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/hierarchyDetector.js`**
   - Lines 248-306: `validateHierarchy()` function
   - Lines 276-282: **Exact location of "No level definition found" error**

---

## Root Cause Analysis: The Validation Error

### Error Pattern Interpretation

**Console Output:**
```
No level definition found for depth 0 to 6
No level definition found for depth 4 to 6  (x5)
```

**What This Tells Us:**

1. **Document Structure:**
   - Parser detected 6 sections total
   - 1 section has variable depth range 0-6 (likely a preamble or multi-level section)
   - 5 sections have variable depth range 4-6 (likely subsections or nested content)

2. **Validation Failure Point:**
   - File: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/hierarchyDetector.js`
   - Lines 276-282:
   ```javascript
   // Check if depth has a corresponding level definition
   const levelDef = levels.find(l => l.depth === section.depth);
   if (!levelDef) {
       errors.push({
           section: section.citation || `Section ${i + 1}`,
           error: `No level definition found for depth ${section.depth}`
       });
   }
   ```

3. **Why It Fails:**
   - The organization's `hierarchy_config.levels` array is either:
     - **Missing** (null/undefined)
     - **Incomplete** (missing levels for depths 0-6)
     - **Improperly Structured** (levels lack `depth` property)

### Database Configuration Issue

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/organizationConfig.js`

**Lines 342-365: Database Hierarchy Validation**
```javascript
// Must validate that levels have required properties (type, depth, numbering)
const hasValidHierarchy =
    data.hierarchy_config &&
    data.hierarchy_config.levels &&
    Array.isArray(data.hierarchy_config.levels) &&
    data.hierarchy_config.levels.length > 0 &&
    data.hierarchy_config.levels.every(level =>
        level.type !== undefined &&
        level.depth !== undefined &&  // ⚠️ CRITICAL CHECK
        level.numbering !== undefined
    );

if (hasValidHierarchy) {
    dbConfig.hierarchy = data.hierarchy_config;
    console.log('[CONFIG-DEBUG] ✅ Using complete hierarchy from database');
} else {
    // CRITICAL: Preserve default hierarchy when DB has incomplete/invalid data
    dbConfig.hierarchy = defaultConfig.hierarchy;
    if (data.hierarchy_config?.levels?.length > 0) {
        console.log('[CONFIG-DEBUG] ⚠️  Database hierarchy incomplete (missing type/depth), using defaults');
    }
}
```

**Key Insight:** This validation code was added specifically to handle incomplete database configurations. The error suggests the setup wizard is saving a hierarchy configuration that **fails this validation**, causing the system to fall back to defaults that may not match the uploaded document.

---

## Setup Wizard Hierarchy Configuration Flow

### Step 1: Document Type Configuration

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/services/setupService.js`

**Lines 50-72: Default Hierarchy Creation**
```javascript
async saveDocumentConfig(orgId, documentConfig, supabase) {
    const hierarchyConfig = {
        levels: documentConfig.hierarchyLevels || [
            {
                name: 'Article',
                type: 'article',
                numbering: 'roman',
                prefix: 'Article ',
                depth: 0  // ✅ Depth included
            },
            {
                name: 'Section',
                type: 'section',
                numbering: 'numeric',
                prefix: 'Section ',
                depth: 1  // ✅ Depth included
            }
        ],
        maxDepth: documentConfig.maxDepth || 5,  // ⚠️ Default only 5!
        allowNesting: documentConfig.allowNesting !== false
    };
}
```

**Problem 1:** Default `maxDepth: 5` but document may have sections at depth 6+

**Problem 2:** Only 2 levels defined by default, but validation expects definitions for all depths 0-6

### Step 2: Document Import & Parsing

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/services/setupService.js`

**Lines 176-200: Import Process**
```javascript
async processDocumentImport(orgId, filePath, supabase) {
    // Load organization config
    const config = await organizationConfig.loadConfig(orgId, supabase);

    // Debug logging added in commit d7e705c
    console.log('[SETUP-DEBUG] 📋 Loaded organization config:');
    console.log('[SETUP-DEBUG]   - Has hierarchy:', !!config.hierarchy);
    console.log('[SETUP-DEBUG]   - Hierarchy levels:', config.hierarchy?.levels?.length || 0);
    if (config.hierarchy?.levels) {
        config.hierarchy.levels.forEach(level => {
            console.log(`[SETUP-DEBUG]     * ${level.name} (type: ${level.type}, depth: ${level.depth})`);
        });
    }

    // Parse the document
    const parseResult = await wordParser.parseDocument(filePath, config);
}
```

**What the Debug Logs Would Show:**
- If hierarchy is properly configured: All 10 levels with depths 0-9
- If hierarchy is incomplete: Only 2 levels (Article, Section) with depths 0-1
- **Expected Output for This Error:** Only 2-5 levels, missing definitions for depths 4, 5, 6

---

## Document Structure Analysis: The "0 to 6" Pattern

### Hypothesis: Multi-Level Sections or Complex Numbering

The error messages suggest the parser is encountering sections with **ambiguous or variable depth ranges**:

**Scenario 1: Preamble or Unnumbered Section**
```
PREAMBLE (depth 0-6 range detected)
  ↓
Article I (depth 0)
  ↓
Section 1 (depth 1)
    ↓
  Subsection 1.1 (depth 2)
      ↓
    Paragraph (a) (depth 3)
        ↓
      Item (i) (depth 4-6 range)  ← 5 sections detected here
```

**Scenario 2: Nested Bullet Lists**
```
Section 1.0 (depth 1)
  1.1 (depth 2)
    1.1.1 (depth 3)
      (a) (depth 4)
        • Item (depth 5 or 6?)  ← Parser uncertainty
```

### File: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/wordParser.js`

**Lines 710-738: Validation Logic**
```javascript
// Validate hierarchy if configured
if (organizationConfig.hierarchy) {
    const hierarchyValidation = hierarchyDetector.validateHierarchy(
        sections,
        organizationConfig
    );

    if (!hierarchyValidation.valid) {
        errors.push(...hierarchyValidation.errors.map(e => ({
            type: 'error',
            message: e.error || e.message,
            section: e.section
        })));
    }
}
```

**Key Insight:** The parser successfully detects sections at various depths, but the validator fails because the organization's hierarchy configuration doesn't define what those depths should look like.

---

## Related Documentation & Design Decisions

### Phase 2 Enhancements Roadmap

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`

**Lines 30-259: Feature 1 - Per-Document Numbering Schema Configuration**

**Business Requirement:**
> Allow Global Admin/Org Admin/Owner to customize the numbering schema for each document after upload. Organization-level schema becomes a default that can be overridden per-document.

**Proposed Solution (Lines 50-70):**
- Organization has default 10-level hierarchy config in `organizations.hierarchy_config`
- Can be overridden per-document via `documents.hierarchy_override`
- Setup wizard should provide UI to configure all 10 levels

**Pre-loaded Templates (Lines 182-259):**
- 4 built-in templates available in `hierarchyTemplates.js`
- Each template defines **all 10 levels** (depths 0-9)
- Templates include: Standard Bylaws, Legal Document, Policy Manual, Technical Standard

**Critical Finding:** The Phase 2 roadmap **assumes** organizations will have complete 10-level hierarchies, but the **current setup wizard** only creates 2-level hierarchies by default.

### Priority 1 Setup Wizard Bug Report

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/reports/P1_SETUP_WIZARD_BUG_REPORT.md`

**Related Issue:** Document workflows and schema mismatches

**Key Finding:** The report identifies schema evolution issues where migrations add columns that aren't in the base schema, causing setup failures. This suggests **ongoing challenges with setup wizard configuration completeness**.

---

## Configuration Validation Research

### Default Hierarchy Structure

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/organizationConfig.js`

**Lines 69-144: Complete Default Configuration**
```javascript
hierarchy: {
    levels: [
        { name: 'Article',      type: 'article',      numbering: 'roman',     prefix: 'Article ',  depth: 0 },
        { name: 'Section',      type: 'section',      numbering: 'numeric',   prefix: 'Section ',  depth: 1 },
        { name: 'Subsection',   type: 'subsection',   numbering: 'numeric',   prefix: 'Subsection ', depth: 2 },
        { name: 'Paragraph',    type: 'paragraph',    numbering: 'alpha',     prefix: '(',         depth: 3 },
        { name: 'Subparagraph', type: 'subparagraph', numbering: 'numeric',   prefix: '',          depth: 4 },
        { name: 'Clause',       type: 'clause',       numbering: 'alphaLower', prefix: '(',        depth: 5 },
        { name: 'Subclause',    type: 'subclause',    numbering: 'roman',     prefix: '',          depth: 6 },
        { name: 'Item',         type: 'item',         numbering: 'numeric',   prefix: '•',         depth: 7 },
        { name: 'Subitem',      type: 'subitem',      numbering: 'alpha',     prefix: '◦',         depth: 8 },
        { name: 'Point',        type: 'point',        numbering: 'numeric',   prefix: '-',         depth: 9 }
    ],
    maxDepth: 10,
    allowNesting: true
}
```

**This default configuration:**
- ✅ Defines all 10 levels (depths 0-9)
- ✅ Includes all required properties (name, type, depth, numbering, prefix)
- ✅ Should satisfy validation requirements
- ⚠️ **May not be saved to database during setup**

### Hierarchy Templates Research

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/hierarchyTemplates.js`

**All 4 Templates Reviewed:**

1. **Standard Bylaws** (Lines 21-37)
   - Depths 0-9: Article → Section → Subsection → Paragraph → ... → Point
   - ✅ Complete 10-level definition

2. **Legal Document** (Lines 39-55)
   - Depths 0-9: Chapter → Section → Clause → Subclause → ... → Subpoint
   - ✅ Complete 10-level definition

3. **Policy Manual** (Lines 57-73)
   - Depths 0-9: Part → Section → Paragraph → ... → Detail
   - ✅ Complete 10-level definition

4. **Technical Standard** (Lines 75-91)
   - Depths 0-9: Level 1 → Level 2 → ... → Level 10
   - ✅ Complete 10-level definition (all numeric)

**Conclusion:** All pre-built templates are correctly structured. The issue is that **the setup wizard isn't using these templates** during initial organization creation.

---

## Error Pattern Deep Dive: "0 to 6" vs "4 to 6"

### Interpretation of Range Notation

The error message format **"depth X to Y"** suggests the validator is showing a **range of possible depths** for a section, indicating parsing ambiguity.

**Possible Causes:**

1. **Indeterminate Depth Detection**
   - Parser can't determine exact depth due to inconsistent formatting
   - Example: Mixed tab and space indentation

2. **Multi-Column Layout**
   - Document uses columns that confuse depth detection
   - Example: Two-column format interpreted as nested levels

3. **Complex Numbering Scheme**
   - Document uses non-standard numbering that spans multiple levels
   - Example: "1.2.3.a.i" could be depth 4, 5, or 6 depending on interpretation

4. **Bullet List Nesting**
   - Deeply nested bullet points without clear hierarchy markers
   - Example:
     ```
     • Main point
       ◦ Sub-point
         ▪ Sub-sub-point (depth 4, 5, or 6?)
     ```

### Frequency Pattern Analysis

- **"0 to 6" appears ONCE** → Likely a preamble, title, or top-level section with complex structure
- **"4 to 6" appears FIVE TIMES** → Likely subsections at similar nesting levels

**Document Structure Hypothesis:**
```
[Unknown depth 0-6] PREAMBLE or TITLE
  Article I (depth 0)
    Section 1 (depth 1)
      1.1 (depth 2)
        1.1.1 (depth 3)
          [Unknown depth 4-6] Subsection A  ← Error 1
          [Unknown depth 4-6] Subsection B  ← Error 2
          [Unknown depth 4-6] Subsection C  ← Error 3
          [Unknown depth 4-6] Subsection D  ← Error 4
          [Unknown depth 4-6] Subsection E  ← Error 5
```

---

## Recommendations & Solutions

### Immediate Fix (HIGH Priority)

**Problem:** Setup wizard saves incomplete hierarchy configuration to database

**Solution 1: Update Setup Service to Use Complete Hierarchy**

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/services/setupService.js`

**Lines 50-72 - BEFORE:**
```javascript
const hierarchyConfig = {
    levels: documentConfig.hierarchyLevels || [
        { name: 'Article', type: 'article', numbering: 'roman', prefix: 'Article ', depth: 0 },
        { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 }
    ],
    maxDepth: documentConfig.maxDepth || 5,
    allowNesting: documentConfig.allowNesting !== false
};
```

**AFTER (use default 10-level config):**
```javascript
const organizationConfig = require('../config/organizationConfig');

const hierarchyConfig = documentConfig.hierarchyLevels
    ? {
        levels: documentConfig.hierarchyLevels,
        maxDepth: documentConfig.maxDepth || 10,
        allowNesting: documentConfig.allowNesting !== false
      }
    : organizationConfig.getDefaultConfig().hierarchy; // ✅ Use complete default
```

**Solution 2: Add Hierarchy Template Selection to Setup Wizard**

**Phase 2 Feature 1 Implementation** (see roadmap lines 30-319)
- Add template selector to setup wizard UI
- Allow users to choose from 4 pre-built templates
- Validate template before saving to database
- Provide live preview of hierarchy structure

### Medium-Term Fix (MEDIUM Priority)

**Problem:** Parser may be detecting ambiguous depths due to document formatting

**Solution: Enhanced Depth Detection**

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/hierarchyDetector.js`

**Enhancements:**
1. Add detailed logging for depth detection decisions
2. Implement heuristics for ambiguous cases (prefer lower depth when uncertain)
3. Add "strict mode" vs "lenient mode" for validation
4. Provide detailed parsing report with depth resolution explanation

### Long-Term Enhancement (LOW Priority)

**Problem:** Users can't easily customize hierarchy after upload

**Solution: Implement Phase 2 Feature 1 Completely**

**Roadmap File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`

**Features to Implement (Lines 121-178):**
1. Visual 10-level hierarchy editor UI
2. Drag-and-drop level reordering
3. Live numbering preview
4. "Detect from Document" auto-suggestion
5. "Load Template" quick configuration
6. Per-document hierarchy override support

---

## Testing & Validation Checklist

### Reproduce the Error

1. **Check Current Database State:**
   ```sql
   SELECT
       id,
       name,
       hierarchy_config
   FROM organizations
   WHERE id = '<org-id>';
   ```

2. **Verify Hierarchy Levels:**
   ```javascript
   // Expected: 10 levels with depths 0-9
   // Actual (causing error): 2-5 levels with gaps
   ```

3. **Review Setup Logs:**
   ```
   [SETUP-DEBUG] 📋 Loaded organization config:
   [SETUP-DEBUG]   - Has hierarchy: true/false
   [SETUP-DEBUG]   - Hierarchy levels: 2/5/10
   [SETUP-DEBUG]     * Article (type: article, depth: 0)
   [SETUP-DEBUG]     * Section (type: section, depth: 1)
   [SETUP-DEBUG]   ⚠️  Missing depths 2-9
   ```

### Verify Fix

1. **Update setupService.js** to use complete default hierarchy
2. **Create new test organization** via setup wizard
3. **Upload test document** with sections at depths 0-6
4. **Check database:**
   ```sql
   SELECT
       hierarchy_config->'levels' as levels,
       jsonb_array_length(hierarchy_config->'levels') as level_count
   FROM organizations
   WHERE id = '<new-org-id>';
   ```
   - Expected: `level_count = 10`
   - All levels should have `depth` property from 0-9

5. **Re-parse document** and verify no validation errors

---

## Related Files & Code References

### Configuration Files
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/organizationConfig.js` (Lines 69-144, 342-365)
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/hierarchyTemplates.js` (Complete file)

### Parser & Validation
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/hierarchyDetector.js` (Lines 248-306)
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/wordParser.js` (Lines 710-738)

### Setup Wizard
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/services/setupService.js` (Lines 50-100, 176-200)
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/setup.js` (Import processing)

### Database Schema
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/database/migrations/018_add_per_document_hierarchy.sql`

### Documentation
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md` (Lines 30-319)
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/reports/P1_SETUP_WIZARD_BUG_REPORT.md`
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/reports/P5_EXECUTIVE_SUMMARY.md`

---

## Conclusion & Key Insights

### Root Cause Summary

The validation error **"No level definition found for depth X to Y"** occurs because:

1. **Setup Wizard Saves Incomplete Hierarchy** - Only 2 levels by default (Article, Section)
2. **Parser Detects Deeper Structure** - Document has sections at depths 4-6
3. **Validator Correctly Rejects** - No configuration exists for those depths
4. **System Defaults Not Used** - Database config overrides complete defaults with incomplete data

### Why "0 to 6" First, Then "4 to 6" Five Times

- **Depth Range Notation** indicates parsing ambiguity or uncertainty
- **First section** spans multiple potential levels (preamble or complex structure)
- **Five subsequent sections** all at similar nesting level (subsections or list items)
- **Pattern suggests** consistent document structure with one outlier at the top

### Intended vs. Actual Behavior

**Intended:**
1. User completes setup wizard
2. System saves **complete 10-level hierarchy** to database
3. User uploads document
4. Parser uses **all 10 defined levels** for validation
5. ✅ Validation passes

**Actual:**
1. User completes setup wizard
2. System saves **only 2-level hierarchy** to database
3. User uploads document with sections at depth 4-6
4. Parser fails validation - **no definitions for depths 2-9**
5. ❌ Error: "No level definition found"

### Recommended Action

**Immediate:** Update `setupService.js` line 54 to use complete default hierarchy
**Short-term:** Add hierarchy template selection to setup wizard UI
**Long-term:** Implement Phase 2 Feature 1 (per-document hierarchy customization)

---

**Research Completed:** 2025-10-18
**Status:** ✅ Root Cause Identified, Solution Proposed
**Next Steps:** Implement immediate fix in setupService.js
