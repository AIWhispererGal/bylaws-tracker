# PRIORITY 5 & 6 ANALYSIS: Subsection Depth Support & Section Editing

**Analyst Agent Report**
**Session**: swarm-1760488231719-uskyostv0
**Date**: 2025-10-14
**Status**: Analysis Complete

---

## EXECUTIVE SUMMARY

**PRIORITY 5 (MEDIUM)**: 10-Level Subsection Depth Support
**STATUS**: ✅ ALREADY SUPPORTED - Only configuration updates needed

**PRIORITY 6 (MEDIUM)**: Organization Admin Section Editing
**STATUS**: ⚠️ PARTIAL - CRUD infrastructure exists, manual section ops need implementation

---

## PRIORITY 5: 10-LEVEL DEPTH SUPPORT ANALYSIS

### Current State Assessment

#### ✅ Database Layer: FULLY SUPPORTS 10 LEVELS
**File**: `/database/migrations/001_generalized_schema.sql`

```sql
-- Line 187: Depth constraint ALREADY supports 10 levels
CHECK(depth >= 0 AND depth <= 10), -- Max 10 levels

-- Line 188-189: Path arrays validated for correct depth
CHECK(array_length(path_ids, 1) = depth + 1),
CHECK(array_length(path_ordinals, 1) = depth + 1),
```

**Trigger Function**: `update_section_path()` (Lines 207-243)
- ✅ Automatically maintains materialized paths for ALL depths
- ✅ Recursively calculates depth from parent relationships
- ✅ No hardcoded depth limits in trigger logic
- ✅ Validates parent-child relationships

**Database Verdict**: 10-level depth is FULLY SUPPORTED. No database changes required.

---

#### ⚠️ Configuration Layer: LIMITED TO 5 LEVELS BY DEFAULT

**File**: `/src/config/configSchema.js`

```javascript
// Line 53: Schema allows up to 20 levels
maxDepth: Joi.number().integer().min(1).max(20).default(10)

// Line 242: Validator ensures maxDepth >= deepest defined level
if (value.maxDepth < maxLevelDepth) {
  errors.push({
    field: 'maxDepth',
    message: `maxDepth (${value.maxDepth}) must be at least ${maxLevelDepth}`
  });
}
```

**File**: `/src/config/organizationConfig.js`

```javascript
// Line 86: Default config only defines 2 levels but allows 5
hierarchy: {
  levels: [
    { name: 'Article', depth: 0, numbering: 'roman', prefix: 'Article' },
    { name: 'Section', depth: 1, numbering: 'numeric', prefix: 'Section' }
  ],
  maxDepth: 5,  // ← Says max 5, but only defines 2 levels
  allowNesting: true
}
```

**Configuration Gap Identified**:
- Config schema allows up to 20 levels
- Database enforces up to 10 levels
- Default organizational config only defines 2 levels (Article, Section)
- Missing levels 2-9 definitions (Subsection, Clause, Paragraph, etc.)

---

#### ✅ Parser Layer: SUPPORTS ARBITRARY DEPTH

**File**: `/src/parsers/hierarchyDetector.js`

```javascript
// Line 251: Reads maxDepth from config (defaults to 10)
const maxDepth = organizationConfig.hierarchy?.maxDepth || 10;

// Line 260-265: Validates depth doesn't exceed maxDepth
if (section.depth > maxDepth) {
  errors.push({
    section: section.citation || `Section ${i + 1}`,
    error: `Depth ${section.depth} exceeds maximum of ${maxDepth}`
  });
}
```

**Key Parser Functions**:
1. **detectHierarchy()** (Lines 12-40): Iterates through ALL configured levels
   - No hardcoded depth limits
   - Uses `organizationConfig.hierarchy.levels` array dynamically

2. **buildHierarchyTree()** (Lines 215-243): Stack-based tree building
   - No depth limits in logic
   - Uses `section.depth` from config

3. **validateHierarchy()** (Lines 248-306):
   - Checks depth against `organizationConfig.hierarchy.maxDepth`
   - Validates numbering format for each depth
   - Ensures no level skipping (depth jumps)

**Parser Verdict**: NO CODE CHANGES needed. Parser reads depth config dynamically.

---

#### ✅ Numbering Schemes: SUPPORTS ALL DEPTHS

**File**: `/src/parsers/numberingSchemes.js`

**Numbering Capabilities**:
- ✅ Roman numerals (I, II, III, IV, ..., M, MM, MMM)
- ✅ Numeric (1, 2, 3, ..., 999+)
- ✅ Uppercase alpha (A, B, C, ..., Z, AA, AB, ...)
- ✅ Lowercase alpha (a, b, c, ..., z, aa, ab, ...)
- ✅ Ordinal (1st, 2nd, 3rd, ...)
- ✅ Hierarchical (1.2.3.4.5.6.7.8.9.10)

**Functions Supporting Deep Nesting**:
1. **formatHierarchical()** (Line 175): Joins any number of depth levels
   ```javascript
   formatHierarchical(numbers, separator = '.') {
     return numbers.filter(n => n !== null && n !== undefined).join(separator);
   }
   // Example: [1,2,3,4,5,6,7,8,9,10] → "1.2.3.4.5.6.7.8.9.10"
   ```

2. **parseHierarchical()** (Line 182): Splits any depth
   ```javascript
   parseHierarchical(str, separator = '.') {
     return str.split(separator).map(n => parseInt(n.trim(), 10));
   }
   ```

**Numbering Verdict**: FULLY SUPPORTS 10-level numbering. No changes needed.

---

#### ✅ Storage Layer: HANDLES ARBITRARY DEPTH

**File**: `/src/services/sectionStorage.js`

```javascript
// Line 111-172: buildHierarchy() - Stack-based algorithm
async buildHierarchy(sections) {
  const hierarchicalSections = [];
  const parentStack = []; // ← Stack grows with depth

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const depth = section.depth || 0; // ← No depth limit

    // Pop parents from stack until we find the right depth
    while (parentStack.length > depth) {
      parentStack.pop();
    }

    // Calculate ordinal among siblings at this depth
    // ... (sibling counting logic - no depth restrictions)
  }
}
```

**Storage Verdict**: NO DEPTH LIMITS in hierarchy building. Fully supports 10 levels.

---

### ROOT CAUSE: Configuration Gap Only

**The 10-level depth limitation is NOT a code issue.**

The system architecture FULLY SUPPORTS 10-level depth:
1. ✅ Database schema allows depths 0-10
2. ✅ Parsers read depth config dynamically
3. ✅ Numbering schemes handle any depth
4. ✅ Storage service builds hierarchies recursively
5. ✅ Triggers maintain paths automatically

**The ONLY gap**: Default organizational config only defines 2 levels.

---

### SOLUTION: Configuration Updates Only

#### Option A: Extend Default Configuration

**File**: `/src/config/organizationConfig.js` (Lines 80-95)

```javascript
hierarchy: {
  levels: [
    // Depth 0-1: Already defined
    { name: 'Article', depth: 0, numbering: 'roman', prefix: 'Article', type: 'article' },
    { name: 'Section', depth: 1, numbering: 'numeric', prefix: 'Section', type: 'section' },

    // ADD: Depth 2-9 definitions
    { name: 'Subsection', depth: 2, numbering: 'alphaLower', prefix: '(', suffix: ')', type: 'subsection' },
    { name: 'Clause', depth: 3, numbering: 'numeric', prefix: '(', suffix: ')', type: 'clause' },
    { name: 'Subclause', depth: 4, numbering: 'roman', prefix: '(', suffix: ')', type: 'subclause' },
    { name: 'Paragraph', depth: 5, numbering: 'alpha', prefix: '(', suffix: ')', type: 'paragraph' },
    { name: 'Subparagraph', depth: 6, numbering: 'numeric', prefix: '(', suffix: ')', type: 'subparagraph' },
    { name: 'Item', depth: 7, numbering: 'alphaLower', prefix: '(', suffix: ')', type: 'item' },
    { name: 'Subitem', depth: 8, numbering: 'roman', prefix: '(', suffix: ')', type: 'subitem' },
    { name: 'Point', depth: 9, numbering: 'numeric', prefix: '(', suffix: ')', type: 'point' }
  ],
  maxDepth: 10, // ← Increase from 5 to 10
  allowNesting: true
}
```

#### Option B: Per-Organization Configuration

Organizations can customize via setup wizard or database:

```sql
UPDATE organizations
SET hierarchy_config = '{
  "levels": [
    {"name": "Article", "depth": 0, "numbering": "roman", "prefix": "Article"},
    {"name": "Section", "depth": 1, "numbering": "numeric", "prefix": "Section"},
    {"name": "Subsection", "depth": 2, "numbering": "alphaLower", "prefix": "(", "suffix": ")"},
    ...
  ],
  "maxDepth": 10
}'
WHERE id = 'org-uuid';
```

#### Option C: UI Configuration Editor

Add admin interface to define custom hierarchy levels:
- Dynamic level editor (add/remove/reorder)
- Numbering scheme picker (roman, numeric, alpha, etc.)
- Prefix/suffix customization
- Live preview of numbering format

---

### TESTING REQUIREMENTS FOR P5

#### Test Case 1: Database Depth Validation
```sql
-- Test: Insert section at depth 10
INSERT INTO document_sections (
  document_id, parent_section_id, ordinal, depth,
  section_number, section_title, original_text, current_text,
  path_ids, path_ordinals
) VALUES (
  'doc-uuid', 'parent-uuid', 1, 10,
  '1.2.3.4.5.6.7.8.9.10', 'Deep Subsection', 'Text', 'Text',
  ARRAY['root', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'self'],
  ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1]
);
-- Expected: SUCCESS (depth 10 is within CHECK constraint)

-- Test: Insert section at depth 11
INSERT INTO document_sections (..., depth = 11, ...)
-- Expected: FAIL with CHECK constraint violation
```

#### Test Case 2: Parser Recognition
```javascript
const config = {
  hierarchy: {
    levels: [
      { name: 'Article', depth: 0, numbering: 'roman', prefix: 'Article' },
      { name: 'Section', depth: 1, numbering: 'numeric', prefix: 'Section' },
      { name: 'Subsection', depth: 2, numbering: 'alphaLower', prefix: '(' },
      { name: 'Clause', depth: 3, numbering: 'numeric', prefix: '(' },
      // ... up to depth 9
    ],
    maxDepth: 10
  }
};

const text = `
Article I
Section 1
(a) First subsection
(1) First clause
(i) First subclause
(A) First paragraph
(1) First subparagraph
(a) First item
(i) First subitem
(1) First point - DEPTH 9!
`;

const detected = hierarchyDetector.detectHierarchy(text, config);
// Expected: All 10 levels detected correctly
```

#### Test Case 3: Numbering Scheme Depth
```javascript
const path = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const formatted = numberingSchemes.formatHierarchical(path);
// Expected: "1.2.3.4.5.6.7.8.9.10"

const parsed = numberingSchemes.parseHierarchical("1.2.3.4.5.6.7.8.9.10");
// Expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

#### Test Case 4: UI Rendering
```html
<!-- Test: Render 10-level hierarchy tree -->
<div class="section-tree">
  <div class="depth-0">Article I</div>
  <div class="depth-1">  Section 1</div>
  <div class="depth-2">    (a)</div>
  <div class="depth-3">      (1)</div>
  <div class="depth-4">        (i)</div>
  <div class="depth-5">          (A)</div>
  <div class="depth-6">            (1)</div>
  <div class="depth-7">              (a)</div>
  <div class="depth-8">                (i)</div>
  <div class="depth-9">                  (1) ← DEPTH 9</div>
</div>
```

---

## PRIORITY 6: ORGANIZATION ADMIN SECTION EDITING

### Current State Assessment

#### ✅ Admin Infrastructure EXISTS

**File**: `/src/routes/admin.js`

**Existing Admin Routes**:
1. **GET /admin/users** (Line 30): User management page
2. **GET /admin/dashboard** (Line 52): Global admin overview with org stats
3. **GET /admin/organization** (Line 144): Organization settings page
4. **GET /admin/organization/:id** (Line 170): Organization detail view
5. **POST /admin/organization/:id/delete** (Line 238): Delete organization
6. **GET /admin/workflows** (Line 277): Workflow template management
7. **GET /admin/workflows/create** (Line 328): Create workflow template
8. **GET /admin/workflows/:id/edit** (Line 343): Edit workflow template

**Access Control**:
```javascript
// Line 15-25: Organization admin OR global admin
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin && !req.isGlobalAdmin) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Admin access required'
    });
  }
  next();
}

// Line 52: Global admin only for dashboard
router.get('/dashboard', requireGlobalAdmin, async (req, res) => { ... });
```

---

#### ⚠️ MISSING: Section CRUD Operations

**Gap Identified**: No routes exist for section-level operations:
- ❌ POST /admin/sections/:id/split - Split section into multiple
- ❌ POST /admin/sections/:id/join - Join with adjacent section
- ❌ PUT /admin/sections/:id/retitle - Change section title/number
- ❌ PUT /admin/sections/:id/move - Move section to new parent
- ❌ DELETE /admin/sections/:id - Delete section

---

### SOLUTION DESIGN: Section CRUD Operations

#### 1. Split Section Operation

**Use Case**: Split "Section 2" into "Section 2" and "Section 3", renumbering subsequent sections.

**API Design**:
```javascript
POST /admin/sections/:id/split
{
  "splitPosition": 150,  // Character position in original_text
  "newTitle": "Membership Eligibility",
  "preserveSuggestions": "first" // "first", "second", or "both"
}
```

**Implementation Logic**:
```javascript
router.post('/sections/:id/split', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { splitPosition, newTitle, preserveSuggestions } = req.body;
  const { supabaseService } = req;

  // 1. Get original section
  const { data: original, error } = await supabaseService
    .from('document_sections')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !original) {
    return res.status(404).json({ error: 'Section not found' });
  }

  // 2. Check workflow state - prevent splitting locked sections
  const { data: workflowStates } = await supabaseService
    .from('section_workflow_states')
    .select('status')
    .eq('section_id', id);

  const isLocked = workflowStates?.some(s => s.status === 'locked');
  if (isLocked) {
    return res.status(403).json({
      error: 'Cannot split locked section. Unlock in workflow first.'
    });
  }

  // 3. Split text content
  const text1 = original.original_text.substring(0, splitPosition);
  const text2 = original.original_text.substring(splitPosition);

  // 4. Update first section (keep original ID)
  await supabaseService
    .from('document_sections')
    .update({
      original_text: text1,
      current_text: text1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  // 5. Insert new second section (increment ordinal)
  const { data: newSection } = await supabaseService
    .from('document_sections')
    .insert({
      document_id: original.document_id,
      parent_section_id: original.parent_section_id,
      ordinal: original.ordinal + 1, // Next sibling
      depth: original.depth,
      section_number: incrementSectionNumber(original.section_number),
      section_title: newTitle,
      section_type: original.section_type,
      original_text: text2,
      current_text: text2,
      metadata: { split_from: id, split_at: new Date().toISOString() }
    })
    .select()
    .single();

  // 6. Increment ordinals of subsequent siblings
  await supabaseService.rpc('increment_sibling_ordinals', {
    p_document_id: original.document_id,
    p_parent_id: original.parent_section_id,
    p_start_ordinal: original.ordinal + 1
  });

  // 7. Handle suggestions
  if (preserveSuggestions === 'both') {
    // Duplicate suggestions to both sections
    const { data: suggestions } = await supabaseService
      .from('suggestion_sections')
      .select('suggestion_id')
      .eq('section_id', id);

    for (const s of suggestions) {
      await supabaseService
        .from('suggestion_sections')
        .insert({
          suggestion_id: s.suggestion_id,
          section_id: newSection.id,
          ordinal: 1
        });
    }
  } else if (preserveSuggestions === 'second') {
    // Move suggestions to second section
    await supabaseService
      .from('suggestion_sections')
      .update({ section_id: newSection.id })
      .eq('section_id', id);
  }
  // else "first": keep suggestions on original section (default)

  res.json({
    success: true,
    original: { id, text: text1 },
    new: { id: newSection.id, text: text2 }
  });
});
```

**Helper Function**:
```javascript
function incrementSectionNumber(sectionNumber) {
  // "Section 2" → "Section 3"
  // "1.2.3" → "1.2.4"
  const match = sectionNumber.match(/^(.+?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2]);
    return prefix + (num + 1);
  }
  return sectionNumber + " (New)";
}
```

**Database Helper Function** (SQL):
```sql
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_document_id UUID,
  p_parent_id UUID,
  p_start_ordinal INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal + 1
  WHERE document_id = p_document_id
    AND parent_section_id = p_parent_id
    AND ordinal >= p_start_ordinal;
END;
$$ LANGUAGE plpgsql;
```

---

#### 2. Join Sections Operation

**Use Case**: Merge "Section 2" and "Section 3" into single "Section 2".

**API Design**:
```javascript
POST /admin/sections/:id/join
{
  "targetSectionId": "uuid-of-section-3",
  "separator": "\n\n",  // Text between joined sections
  "deleteWorkflowStates": false  // Preserve workflow history
}
```

**Implementation**:
```javascript
router.post('/sections/:id/join', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { targetSectionId, separator, deleteWorkflowStates } = req.body;
  const { supabaseService } = req;

  // 1. Get both sections
  const { data: sections, error } = await supabaseService
    .from('document_sections')
    .select('*')
    .in('id', [id, targetSectionId]);

  if (error || sections.length !== 2) {
    return res.status(404).json({ error: 'Sections not found' });
  }

  const [first, second] = sections.sort((a, b) => a.ordinal - b.ordinal);

  // 2. Verify sections are siblings (same parent)
  if (first.parent_section_id !== second.parent_section_id) {
    return res.status(400).json({
      error: 'Can only join sibling sections with same parent'
    });
  }

  // 3. Check workflow locks
  const { data: workflowStates } = await supabaseService
    .from('section_workflow_states')
    .select('section_id, status')
    .in('section_id', [first.id, second.id]);

  const anyLocked = workflowStates?.some(s => s.status === 'locked');
  if (anyLocked) {
    return res.status(403).json({
      error: 'Cannot join locked sections'
    });
  }

  // 4. Merge text content
  const mergedText = first.original_text + separator + second.original_text;

  // 5. Update first section with merged content
  await supabaseService
    .from('document_sections')
    .update({
      original_text: mergedText,
      current_text: mergedText,
      metadata: {
        ...first.metadata,
        merged_from: second.id,
        merged_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', first.id);

  // 6. Move suggestions from second to first
  await supabaseService
    .from('suggestion_sections')
    .update({ section_id: first.id })
    .eq('section_id', second.id);

  // 7. Delete or archive workflow states
  if (deleteWorkflowStates) {
    await supabaseService
      .from('section_workflow_states')
      .delete()
      .eq('section_id', second.id);
  } else {
    // Move workflow states to merged section
    await supabaseService
      .from('section_workflow_states')
      .update({
        section_id: first.id,
        notes: `Merged from ${second.section_number}`
      })
      .eq('section_id', second.id);
  }

  // 8. Delete second section (CASCADE will handle children)
  await supabaseService
    .from('document_sections')
    .delete()
    .eq('id', second.id);

  // 9. Decrement ordinals of subsequent siblings
  await supabaseService.rpc('decrement_sibling_ordinals', {
    p_document_id: first.document_id,
    p_parent_id: first.parent_section_id,
    p_start_ordinal: second.ordinal
  });

  res.json({
    success: true,
    merged: { id: first.id, text: mergedText }
  });
});
```

---

#### 3. Retitle Section Operation

**Use Case**: Change "Article I - Membership" to "Article I - Members".

**API Design**:
```javascript
PUT /admin/sections/:id/retitle
{
  "newTitle": "Members",
  "updateCitation": true,  // Update section_number if needed
  "newSectionNumber": "Article I"  // Optional: change numbering
}
```

**Implementation**:
```javascript
router.put('/sections/:id/retitle', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newTitle, updateCitation, newSectionNumber } = req.body;
  const { supabaseService } = req;

  const updateData = {
    section_title: newTitle,
    updated_at: new Date().toISOString()
  };

  if (updateCitation && newSectionNumber) {
    updateData.section_number = newSectionNumber;
  }

  const { data, error } = await supabaseService
    .from('document_sections')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, section: data });
});
```

---

#### 4. Move Section Operation

**Use Case**: Move "Section 3" from "Article I" to "Article II" as "Section 1".

**API Design**:
```javascript
PUT /admin/sections/:id/move
{
  "newParentId": "uuid-of-article-2",
  "newOrdinal": 1,
  "renumber": true  // Auto-recalculate section numbers
}
```

**Implementation**:
```javascript
router.put('/sections/:id/move', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newParentId, newOrdinal, renumber } = req.body;
  const { supabaseService } = req;

  // 1. Get current section
  const { data: section, error } = await supabaseService
    .from('document_sections')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  // 2. Verify new parent is in same document
  const { data: newParent } = await supabaseService
    .from('document_sections')
    .select('document_id, depth')
    .eq('id', newParentId)
    .single();

  if (newParent.document_id !== section.document_id) {
    return res.status(400).json({
      error: 'Cannot move to different document'
    });
  }

  // 3. Update section with new parent and ordinal
  // Trigger will recalculate path_ids, path_ordinals, and depth
  const { error: updateError } = await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: newParentId,
      ordinal: newOrdinal,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  // 4. Recalculate paths for all descendants (CASCADE via trigger)
  // The update_section_path() trigger handles this automatically

  // 5. Decrement ordinals in old parent's children
  await supabaseService.rpc('decrement_sibling_ordinals', {
    p_document_id: section.document_id,
    p_parent_id: section.parent_section_id,
    p_start_ordinal: section.ordinal + 1
  });

  // 6. Increment ordinals in new parent's children
  await supabaseService.rpc('increment_sibling_ordinals', {
    p_document_id: section.document_id,
    p_parent_id: newParentId,
    p_start_ordinal: newOrdinal
  });

  // 7. Optional: Renumber section numbers
  if (renumber) {
    await supabaseService.rpc('renumber_document_sections', {
      p_document_id: section.document_id
    });
  }

  res.json({ success: true });
});
```

**Database Helper** (Renumbering):
```sql
CREATE OR REPLACE FUNCTION renumber_document_sections(p_document_id UUID)
RETURNS VOID AS $$
DECLARE
  section RECORD;
  new_number TEXT;
BEGIN
  FOR section IN
    SELECT id, path_ordinals, section_type
    FROM document_sections
    WHERE document_id = p_document_id
    ORDER BY path_ordinals
  LOOP
    -- Generate new number from path_ordinals
    -- Example: [1, 2, 3] → "1.2.3"
    new_number := array_to_string(section.path_ordinals, '.');

    UPDATE document_sections
    SET section_number = new_number
    WHERE id = section.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

#### 5. Delete Section Operation

**Use Case**: Remove "Section 4" and its descendants.

**API Design**:
```javascript
DELETE /admin/sections/:id
{
  "deleteDescendants": true,  // Delete children too (CASCADE)
  "preserveSuggestions": false  // Delete suggestions or keep as orphaned
}
```

**Implementation**:
```javascript
router.delete('/sections/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { deleteDescendants, preserveSuggestions } = req.body;
  const { supabaseService } = req;

  // 1. Check for workflow locks
  const { data: workflowStates } = await supabaseService
    .from('section_workflow_states')
    .select('status')
    .eq('section_id', id);

  if (workflowStates?.some(s => s.status === 'locked')) {
    return res.status(403).json({
      error: 'Cannot delete locked section'
    });
  }

  // 2. Get section for ordinal cleanup
  const { data: section } = await supabaseService
    .from('document_sections')
    .select('document_id, parent_section_id, ordinal')
    .eq('id', id)
    .single();

  // 3. Handle suggestions
  if (!preserveSuggestions) {
    await supabaseService
      .from('suggestion_sections')
      .delete()
      .eq('section_id', id);
  }

  // 4. Delete section (CASCADE handles descendants if ON DELETE CASCADE)
  const { error } = await supabaseService
    .from('document_sections')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // 5. Decrement ordinals of subsequent siblings
  await supabaseService.rpc('decrement_sibling_ordinals', {
    p_document_id: section.document_id,
    p_parent_id: section.parent_section_id,
    p_start_ordinal: section.ordinal + 1
  });

  res.json({ success: true });
});
```

---

### UI Considerations for Section Editing

#### Admin Section Editor Interface

**Location**: `/admin/organization/:id/sections` or `/admin/sections/:id/edit`

**Features**:
1. **Section Tree View**: Visual hierarchy with expand/collapse
2. **Inline Editing**: Click to edit title/number
3. **Context Menu**: Right-click for operations
   - Split Section...
   - Join with Next/Previous...
   - Move to Parent...
   - Retitle...
   - Delete Section...
4. **Workflow Status Indicators**: Show locked/approved states
5. **Suggestion Count Badge**: Show # of pending suggestions
6. **Drag-and-Drop**: Reorder sections by dragging

---

## IMPLEMENTATION PRIORITY RECOMMENDATIONS

### Phase 1: Configuration (P5) - IMMEDIATE
**Effort**: 2 hours
**Impact**: HIGH

1. Update `/src/config/organizationConfig.js` with 10-level defaults
2. Document configuration options in admin docs
3. Test parsing with 10-level sample document

### Phase 2: Section CRUD Routes (P6) - SHORT TERM
**Effort**: 1-2 days
**Impact**: MEDIUM

1. Implement POST /admin/sections/:id/split
2. Implement POST /admin/sections/:id/join
3. Implement PUT /admin/sections/:id/retitle
4. Implement PUT /admin/sections/:id/move
5. Implement DELETE /admin/sections/:id
6. Add database helper functions (increment/decrement ordinals, renumber)

### Phase 3: Admin UI (P6) - MEDIUM TERM
**Effort**: 3-5 days
**Impact**: HIGH (User Experience)

1. Build section tree editor component
2. Add inline editing capabilities
3. Implement drag-and-drop reordering
4. Add confirmation dialogs for destructive operations
5. Display workflow state warnings

---

## DEPENDENCIES & RISKS

### P5 Dependencies
- ✅ None - purely configuration change
- ✅ All infrastructure already exists

### P6 Dependencies
- ⚠️ Requires database helper functions (not yet created)
- ⚠️ UI components need design/implementation
- ⚠️ Workflow state checking must prevent invalid operations

### Risks
1. **Data Integrity**: Moving/splitting sections could orphan suggestions
   - **Mitigation**: Validate workflow states before allowing edits
2. **Renumbering Complexity**: Auto-renumbering could conflict with custom numbering
   - **Mitigation**: Make renumbering optional, allow manual override
3. **Cascade Deletes**: Deleting parent could remove large subtrees
   - **Mitigation**: Confirm before deletion, show descendant count

---

## TESTING CHECKLIST

### P5: 10-Level Depth
- [ ] Database accepts depth 10 sections
- [ ] Parser detects 10-level hierarchies
- [ ] Numbering schemes format 10-level paths
- [ ] UI renders 10-level trees correctly
- [ ] Materialized paths calculate correctly for depth 10

### P6: Section Operations
- [ ] Split section preserves workflow states
- [ ] Join sections merges suggestions correctly
- [ ] Move section recalculates paths
- [ ] Delete section prevents locked sections
- [ ] Retitle updates citations consistently
- [ ] Ordinal increment/decrement maintains sibling order

---

## FILES REQUIRING CHANGES

### P5: Configuration Only
1. `/src/config/organizationConfig.js` - Add levels 2-9 definitions
2. `/docs/ADMIN_GUIDE.md` - Document hierarchy configuration

### P6: CRUD Operations
1. `/src/routes/admin.js` - Add section CRUD routes
2. `/database/migrations/013_section_admin_helpers.sql` - Helper functions
3. `/views/admin/section-editor.ejs` - Admin UI template
4. `/public/js/section-editor.js` - Frontend JavaScript
5. `/tests/integration/admin-section-crud.test.js` - Integration tests

---

## CONCLUSION

**PRIORITY 5**: System ALREADY SUPPORTS 10-level depth. Only configuration update needed.

**PRIORITY 6**: Infrastructure EXISTS (admin routes, access control), but section CRUD operations need implementation. Estimated 4-7 days for full implementation with UI.

**Recommendation**: Implement P5 immediately (2 hours), schedule P6 for next sprint (1 week).
