# P6: Section Editor Design Specification

**Priority**: 6 - MEDIUM
**Type**: Design & Architecture
**Status**: ✅ Design Complete
**Estimated Implementation**: 4-7 days (Backend: 1-2 days, Frontend: 3-5 days)

---

## Executive Summary

Organization admins need the ability to manually adjust document sections after parsing to correct parsing errors, reorganize content, or refine document structure. This design specifies CRUD operations for section manipulation with proper handling of hierarchical relationships, workflow states, and existing suggestions.

### Operations Required
1. **Split Section** - Divide one section into multiple sections
2. **Join Sections** - Merge adjacent sections into one
3. **Retitle Section** - Change section title and/or numbering
4. **Move Section** - Change parent or reorder within siblings
5. **Delete Section** - Remove section (with cascade handling)

---

## Current State Analysis

### What Exists ✅

**Admin Route Infrastructure** (`/src/routes/admin.js`):
- GET `/admin/users` - User management page
- GET `/admin/dashboard` - Organization overview
- GET `/admin/organization/:id` - Organization details
- POST `/admin/organization/:id/delete` - Delete organization
- GET `/admin/workflows` - Workflow template management
- GET `/admin/workflows/create` - Create workflow template
- GET `/admin/workflows/:id/edit` - Edit workflow template

**Access Control**:
- `requireAdmin()` - Org admin OR global admin access
- `requireGlobalAdmin()` - Global admin only access
- RLS policies enforcing organization-level isolation

**Database Schema**:
```sql
-- document_sections table with full hierarchy support
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  parent_section_id UUID,          -- Adjacency list
  ordinal INTEGER NOT NULL,        -- Position among siblings
  depth INTEGER NOT NULL,          -- Tree depth
  path_ids UUID[],                 -- Materialized path
  path_ordinals INTEGER[],         -- Ordinal path
  section_number VARCHAR(50),      -- Display number
  section_title TEXT,
  section_type VARCHAR(50),
  original_text TEXT,
  current_text TEXT,
  metadata JSONB,
  UNIQUE(document_id, parent_section_id, ordinal)
);

-- Auto-maintained materialized paths
CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();
```

**Related Tables**:
```sql
-- Suggestions attached to sections
suggestion_sections (suggestion_id, section_id, ordinal)

-- Workflow states for sections
section_workflow_states (section_id, workflow_stage_id, status)
```

### What's Missing ❌

**API Routes** (all missing from `/src/routes/admin.js`):
- POST `/admin/sections/:id/split` - Split section operation
- POST `/admin/sections/join` - Join multiple sections
- PUT `/admin/sections/:id/retitle` - Retitle/renumber section
- PUT `/admin/sections/:id/move` - Move to different parent or reorder
- DELETE `/admin/sections/:id` - Delete section
- GET `/admin/documents/:docId/sections/tree` - Get section tree for editing

**Database Helper Functions**:
- `increment_sibling_ordinals(parent_id, start_ordinal)` - Shift ordinals up
- `decrement_sibling_ordinals(parent_id, start_ordinal)` - Shift ordinals down
- `validate_section_editable(section_id)` - Check if section locked
- `relocate_suggestions(old_section_id, new_section_id)` - Move suggestions

**Admin UI Components**:
- Section tree editor with drag-and-drop
- Split section modal with text preview
- Join sections confirmation dialog
- Retitle/renumber form
- Move section parent selector

---

## Detailed API Design

### 1. Split Section

**Endpoint**: `POST /admin/sections/:id/split`

**Purpose**: Divide one section into multiple sections by splitting the text content.

**Request Body**:
```json
{
  "splitPoints": [
    {
      "position": 120,           // Character offset in original_text
      "title": "Part B",         // Title for new section
      "sectionNumber": "3b"      // Optional: explicit section number
    }
  ],
  "suggestionHandling": "first" | "distribute" | "both",
  "preserveOriginalId": true     // Keep original ID on first section
}
```

**Response**:
```json
{
  "success": true,
  "original": {
    "id": "uuid-A",
    "text": "First part content...",
    "ordinal": 2
  },
  "newSections": [
    {
      "id": "uuid-B",
      "text": "Second part content...",
      "ordinal": 3,
      "title": "Part B"
    }
  ],
  "siblingsUpdated": 3,          // Number of siblings with incremented ordinals
  "suggestionsRelocated": 2
}
```

**Algorithm**:
```javascript
async function splitSection(sectionId, splitPoints, options) {
  // 1. Validate section is editable
  const section = await validateSectionEditable(sectionId);

  // 2. Sort split points by position
  splitPoints.sort((a, b) => a.position - b.position);

  // 3. Begin transaction
  await supabase.rpc('begin_transaction');

  try {
    // 4. Increment ordinals of subsequent siblings
    await supabase.rpc('increment_sibling_ordinals', {
      p_parent_id: section.parent_section_id,
      p_start_ordinal: section.ordinal + 1,
      p_increment_by: splitPoints.length
    });

    // 5. Split text content
    const textParts = splitTextAtPositions(section.original_text, splitPoints);

    // 6. Update original section with first part
    await supabase
      .from('document_sections')
      .update({
        original_text: textParts[0],
        current_text: textParts[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId);

    // 7. Insert new sections for remaining parts
    const newSections = [];
    for (let i = 1; i < textParts.length; i++) {
      const newSection = await supabase
        .from('document_sections')
        .insert({
          document_id: section.document_id,
          parent_section_id: section.parent_section_id,
          ordinal: section.ordinal + i,
          section_title: splitPoints[i - 1].title,
          section_number: splitPoints[i - 1].sectionNumber ||
                          deriveNextNumber(section.section_number, i),
          section_type: section.section_type,
          original_text: textParts[i],
          current_text: textParts[i],
          metadata: { ...section.metadata, splitFrom: sectionId }
        })
        .select()
        .single();

      newSections.push(newSection.data);
    }

    // 8. Handle suggestions
    await handleSuggestionsOnSplit(
      sectionId,
      newSections.map(s => s.id),
      options.suggestionHandling
    );

    // 9. Commit transaction
    await supabase.rpc('commit_transaction');

    return { success: true, original: section, newSections };

  } catch (error) {
    await supabase.rpc('rollback_transaction');
    throw error;
  }
}
```

**Edge Cases**:
- Split position falls in middle of word → snap to word boundary
- Section has children → prevent split (must be leaf node)
- Section has locked workflow state → return 403 Forbidden
- Split creates empty section → validate minimum text length (10 chars)

---

### 2. Join Sections

**Endpoint**: `POST /admin/sections/join`

**Purpose**: Merge multiple adjacent sections into one combined section.

**Request Body**:
```json
{
  "sectionIds": ["uuid-A", "uuid-B", "uuid-C"],  // In order
  "joinedTitle": "Combined Section",
  "joinedNumber": "2-4",                          // Optional
  "separator": "\n\n",                            // Text separator
  "suggestionHandling": "merge" | "first" | "delete",
  "keepFirstId": true                             // Preserve first section's ID
}
```

**Response**:
```json
{
  "success": true,
  "merged": {
    "id": "uuid-A",                  // First section ID preserved
    "text": "Part 1\n\nPart 2\n\nPart 3",
    "ordinal": 2,
    "title": "Combined Section"
  },
  "deleted": ["uuid-B", "uuid-C"],
  "siblingsUpdated": 5,              // Subsequent siblings decremented
  "suggestionsRelocated": 7
}
```

**Algorithm**:
```javascript
async function joinSections(sectionIds, options) {
  // 1. Validate all sections are editable
  const sections = await validateSectionsEditable(sectionIds);

  // 2. Verify sections are adjacent siblings
  validateAdjacentSiblings(sections);

  // 3. Begin transaction
  await supabase.rpc('begin_transaction');

  try {
    const firstSection = sections[0];
    const lastSection = sections[sections.length - 1];

    // 4. Merge text content
    const mergedText = sections
      .map(s => s.original_text)
      .join(options.separator);

    // 5. Update first section with merged content
    await supabase
      .from('document_sections')
      .update({
        original_text: mergedText,
        current_text: mergedText,
        section_title: options.joinedTitle || firstSection.section_title,
        section_number: options.joinedNumber || firstSection.section_number,
        metadata: {
          ...firstSection.metadata,
          joinedFrom: sectionIds,
          joinedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', firstSection.id);

    // 6. Relocate suggestions from deleted sections
    for (let i = 1; i < sections.length; i++) {
      await supabase.rpc('relocate_suggestions', {
        p_old_section_id: sections[i].id,
        p_new_section_id: firstSection.id
      });
    }

    // 7. Delete other sections
    await supabase
      .from('document_sections')
      .delete()
      .in('id', sectionIds.slice(1));

    // 8. Decrement ordinals of subsequent siblings
    await supabase.rpc('decrement_sibling_ordinals', {
      p_parent_id: firstSection.parent_section_id,
      p_start_ordinal: lastSection.ordinal + 1,
      p_decrement_by: sections.length - 1
    });

    // 9. Commit transaction
    await supabase.rpc('commit_transaction');

    return { success: true, merged: firstSection, deleted: sectionIds.slice(1) };

  } catch (error) {
    await supabase.rpc('rollback_transaction');
    throw error;
  }
}
```

**Edge Cases**:
- Sections not adjacent → return 400 Bad Request
- Sections have different parents → return 400 Bad Request
- Any section has children → prevent join (children would be orphaned)
- Merged text exceeds reasonable length (>100KB) → warn user

---

### 3. Retitle Section

**Endpoint**: `PUT /admin/sections/:id/retitle`

**Purpose**: Change section title and/or section number without affecting content or hierarchy.

**Request Body**:
```json
{
  "title": "New Section Title",
  "sectionNumber": "3.5",           // Optional: override automatic numbering
  "updateMetadata": true            // Update citation/breadcrumb metadata
}
```

**Response**:
```json
{
  "success": true,
  "section": {
    "id": "uuid-A",
    "title": "New Section Title",
    "sectionNumber": "3.5",
    "citation": "Article II, Section 3.5"  // Updated
  }
}
```

**Algorithm**:
```javascript
async function retitleSection(sectionId, title, sectionNumber, options) {
  // 1. Validate section is editable
  const section = await validateSectionEditable(sectionId);

  // 2. Update section
  const { data, error } = await supabase
    .from('document_sections')
    .update({
      section_title: title,
      section_number: sectionNumber || section.section_number,
      updated_at: new Date().toISOString()
    })
    .eq('id', sectionId)
    .select()
    .single();

  if (error) throw error;

  // 3. Optionally update metadata (citation, breadcrumb)
  if (options.updateMetadata) {
    const citation = await buildCitation(sectionId);
    await supabase
      .from('document_sections')
      .update({
        metadata: {
          ...data.metadata,
          citation: citation,
          lastRetitled: new Date().toISOString()
        }
      })
      .eq('id', sectionId);
  }

  return { success: true, section: data };
}
```

**Edge Cases**:
- Empty title → use "(Untitled)" placeholder
- Duplicate section number → warn but allow (numbering conflicts user's responsibility)
- Section number format invalid → validate against organization's hierarchy config

---

### 4. Move Section

**Endpoint**: `PUT /admin/sections/:id/move`

**Purpose**: Change section's parent or reorder among siblings.

**Request Body**:
```json
{
  "newParentId": "uuid-parent" | null,  // null = move to root level
  "newOrdinal": 3,                      // Position in new parent's children
  "renumber": true                       // Auto-renumber to match new position
}
```

**Response**:
```json
{
  "success": true,
  "section": {
    "id": "uuid-A",
    "parentId": "uuid-new-parent",
    "ordinal": 3,
    "depth": 2,                          // Updated by trigger
    "pathIds": [...],                    // Recalculated by trigger
    "pathOrdinals": [...]                // Recalculated by trigger
  },
  "oldSiblingsUpdated": 2,
  "newSiblingsUpdated": 3
}
```

**Algorithm**:
```javascript
async function moveSection(sectionId, newParentId, newOrdinal, renumber) {
  // 1. Validate section is editable
  const section = await validateSectionEditable(sectionId);

  // 2. Verify new parent exists and is in same document
  if (newParentId) {
    await validateParentExists(newParentId, section.document_id);
  }

  // 3. Check for circular reference (parent can't be descendant)
  await validateNoCircularReference(sectionId, newParentId);

  // 4. Begin transaction
  await supabase.rpc('begin_transaction');

  try {
    const oldParentId = section.parent_section_id;
    const oldOrdinal = section.ordinal;

    // 5. Decrement ordinals in old parent (close gap)
    await supabase.rpc('decrement_sibling_ordinals', {
      p_parent_id: oldParentId,
      p_start_ordinal: oldOrdinal + 1,
      p_decrement_by: 1
    });

    // 6. Increment ordinals in new parent (make space)
    await supabase.rpc('increment_sibling_ordinals', {
      p_parent_id: newParentId,
      p_start_ordinal: newOrdinal,
      p_increment_by: 1
    });

    // 7. Update section's parent and ordinal
    // Trigger will automatically recalculate path_ids, path_ordinals, depth
    const { data, error } = await supabase
      .from('document_sections')
      .update({
        parent_section_id: newParentId,
        ordinal: newOrdinal,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId)
      .select()
      .single();

    if (error) throw error;

    // 8. Optionally renumber to match new position
    if (renumber) {
      const newNumber = deriveNumberFromParentAndOrdinal(
        newParentId,
        newOrdinal,
        section.document_id
      );
      await supabase
        .from('document_sections')
        .update({ section_number: newNumber })
        .eq('id', sectionId);
    }

    // 9. Recursively update all descendants (paths changed)
    await recalculateDescendantPaths(sectionId);

    // 10. Commit transaction
    await supabase.rpc('commit_transaction');

    return { success: true, section: data };

  } catch (error) {
    await supabase.rpc('rollback_transaction');
    throw error;
  }
}
```

**Edge Cases**:
- Move to same parent at same ordinal → no-op
- Move to own descendant → return 400 Bad Request (circular reference)
- New ordinal > max sibling ordinal + 1 → clamp to max + 1
- Section has workflow states → states follow section (no disruption)

---

### 5. Delete Section

**Endpoint**: `DELETE /admin/sections/:id`

**Purpose**: Remove section from document hierarchy.

**Query Parameters**:
- `cascade=true|false` - Delete children recursively (default: false)
- `suggestions=delete|orphan` - Delete suggestions or leave orphaned

**Response**:
```json
{
  "success": true,
  "deleted": {
    "sections": ["uuid-A", "uuid-B"],  // Section + children if cascade
    "suggestions": 5,                   // Deleted suggestions
    "workflowStates": 3                 // Deleted workflow states
  },
  "siblingsUpdated": 4                  // Subsequent siblings decremented
}
```

**Algorithm**:
```javascript
async function deleteSection(sectionId, cascade, suggestionHandling) {
  // 1. Validate section is editable
  const section = await validateSectionEditable(sectionId);

  // 2. Check for children
  const { data: children } = await supabase
    .from('document_sections')
    .select('id')
    .eq('parent_section_id', sectionId);

  if (children.length > 0 && !cascade) {
    return {
      success: false,
      error: 'Section has children. Use cascade=true to delete recursively.'
    };
  }

  // 3. Begin transaction
  await supabase.rpc('begin_transaction');

  try {
    // 4. Collect all sections to delete (self + descendants if cascade)
    const sectionsToDelete = cascade
      ? await getDescendants(sectionId)
      : [sectionId];

    // 5. Handle suggestions
    if (suggestionHandling === 'delete') {
      await supabase
        .from('suggestion_sections')
        .delete()
        .in('section_id', sectionsToDelete);
    }
    // If 'orphan', suggestions remain linked to deleted section IDs

    // 6. Delete workflow states
    await supabase
      .from('section_workflow_states')
      .delete()
      .in('section_id', sectionsToDelete);

    // 7. Delete sections (CASCADE handles suggestion_sections via FK)
    await supabase
      .from('document_sections')
      .delete()
      .in('id', sectionsToDelete);

    // 8. Decrement ordinals of subsequent siblings
    await supabase.rpc('decrement_sibling_ordinals', {
      p_parent_id: section.parent_section_id,
      p_start_ordinal: section.ordinal + 1,
      p_decrement_by: 1
    });

    // 9. Commit transaction
    await supabase.rpc('commit_transaction');

    return {
      success: true,
      deleted: { sections: sectionsToDelete }
    };

  } catch (error) {
    await supabase.rpc('rollback_transaction');
    throw error;
  }
}
```

**Edge Cases**:
- Section is root with many descendants → require explicit cascade confirmation
- Delete creates numbering gaps (Section 1, 3, 4) → acceptable, admin's choice
- Suggestions become orphaned → show warning in UI

---

## Materialized Path Recalculation

### Automatic Recalculation (via Trigger)

The `update_section_path()` trigger automatically maintains materialized paths:

```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;
  ELSE
    -- Child section: inherit parent's path and append self
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Trigger Fires On**:
- INSERT - New section gets correct path from parent
- UPDATE OF parent_section_id - Section moved to new parent
- UPDATE OF ordinal - Section reordered among siblings

### Manual Recalculation (for Bulk Operations)

For operations affecting multiple sections, provide a function to recalculate descendants:

```sql
-- Recalculate paths for all descendants of a section
CREATE OR REPLACE FUNCTION recalculate_descendant_paths(p_section_id UUID)
RETURNS void AS $$
DECLARE
  v_descendant RECORD;
BEGIN
  -- Iterate through all descendants in breadth-first order
  FOR v_descendant IN
    SELECT id, parent_section_id, ordinal
    FROM document_sections
    WHERE p_section_id = ANY(path_ids)
      AND id != p_section_id
    ORDER BY depth, ordinal
  LOOP
    -- Update triggers recalculation
    UPDATE document_sections
    SET updated_at = NOW()
    WHERE id = v_descendant.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Usage**:
```javascript
// After moving section with children
await supabase.rpc('recalculate_descendant_paths', {
  p_section_id: movedSectionId
});
```

---

## Handling Suggestions and Workflow States

### Suggestion Preservation Strategies

**1. On Split**:
- `"first"` - All suggestions move to first section (default)
- `"distribute"` - Suggestions distributed based on text position
- `"both"` - Suggestions duplicated to both sections

```javascript
async function handleSuggestionsOnSplit(originalId, newIds, strategy) {
  const { data: suggestions } = await supabase
    .from('suggestion_sections')
    .select('*, suggestions(*)')
    .eq('section_id', originalId);

  switch (strategy) {
    case 'first':
      // Already attached to original - no action needed
      break;

    case 'distribute':
      // Analyze suggestion text position and move to appropriate section
      for (const sugg of suggestions) {
        const position = findTextPosition(originalText, sugg.suggestions.suggested_text);
        const targetSectionId = position < splitPoint ? originalId : newIds[0];

        if (targetSectionId !== originalId) {
          await supabase
            .from('suggestion_sections')
            .update({ section_id: targetSectionId })
            .eq('id', sugg.id);
        }
      }
      break;

    case 'both':
      // Duplicate suggestions to new sections
      for (const newId of newIds) {
        for (const sugg of suggestions) {
          await supabase
            .from('suggestion_sections')
            .insert({
              suggestion_id: sugg.suggestion_id,
              section_id: newId,
              ordinal: sugg.ordinal
            });
        }
      }
      break;
  }
}
```

**2. On Join**:
- `"merge"` - All suggestions moved to merged section (default)
- `"first"` - Keep suggestions from first section only
- `"delete"` - Delete all suggestions from joined sections

```javascript
async function handleSuggestionsOnJoin(sectionIds, mergedId, strategy) {
  switch (strategy) {
    case 'merge':
      // Relocate all suggestions to merged section
      await supabase
        .from('suggestion_sections')
        .update({ section_id: mergedId })
        .in('section_id', sectionIds);
      break;

    case 'first':
      // Keep first section's suggestions, delete others
      await supabase
        .from('suggestion_sections')
        .delete()
        .in('section_id', sectionIds.slice(1));
      break;

    case 'delete':
      // Delete all suggestions
      await supabase
        .from('suggestion_sections')
        .delete()
        .in('section_id', sectionIds);
      break;
  }
}
```

**3. On Move**:
- Suggestions automatically follow section (no action needed)
- `section_id` foreign key constraint maintains relationship

**4. On Delete**:
- `"delete"` - Delete suggestions via CASCADE
- `"orphan"` - Leave suggestions with reference to deleted section_id

### Workflow State Validation

**Prevent Editing Locked Sections**:

```javascript
async function validateSectionEditable(sectionId) {
  // 1. Fetch section
  const { data: section } = await supabase
    .from('document_sections')
    .select('*')
    .eq('id', sectionId)
    .single();

  if (!section) {
    throw new Error('Section not found', 404);
  }

  // 2. Check workflow states
  const { data: states } = await supabase
    .from('section_workflow_states')
    .select('status, workflow_stage_id, workflow_stages(stage_name)')
    .eq('section_id', sectionId);

  // 3. Check if any state is locked
  const lockedState = states?.find(s => s.status === 'locked');

  if (lockedState) {
    throw new Error(
      `Section is locked at workflow stage: ${lockedState.workflow_stages.stage_name}`,
      403
    );
  }

  // 4. Optionally check if approved (may want to prevent edits)
  const approvedState = states?.find(s => s.status === 'approved');

  if (approvedState) {
    console.warn(`Section has approved state at: ${approvedState.workflow_stages.stage_name}`);
    // Decision: Allow or prevent? Return warning?
  }

  return section;
}
```

**Workflow State Preservation**:
- On split: First section keeps states, new sections start fresh
- On join: Merged section keeps first section's states
- On move: States follow section (no change)
- On delete: States deleted via CASCADE

---

## Security Considerations

### RLS Policy Requirements

**Section Editing Policies**:

```sql
-- Allow admins to UPDATE sections in their organization
CREATE POLICY "Admins can edit sections in own organization"
  ON document_sections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
        AND uo.is_active = TRUE
    )
  );

-- Allow admins to INSERT sections in their organization
CREATE POLICY "Admins can create sections in own organization"
  ON document_sections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
        AND uo.is_active = TRUE
    )
  );

-- Allow admins to DELETE sections in their organization
CREATE POLICY "Admins can delete sections in own organization"
  ON document_sections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
        AND uo.is_active = TRUE
    )
  );

-- Global admins can edit any section
CREATE POLICY "Global admins can edit any section"
  ON document_sections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_global_admin = TRUE
        AND is_active = TRUE
    )
  );
```

### Additional Security Measures

**1. Input Validation**:
```javascript
// Validate split position
if (splitPosition < 10 || splitPosition > originalText.length - 10) {
  throw new Error('Split position must create sections with at least 10 characters');
}

// Validate ordinal
if (newOrdinal < 1 || newOrdinal > maxOrdinal + 1) {
  throw new Error('Invalid ordinal position');
}

// Validate circular reference
if (await isDescendant(sectionId, newParentId)) {
  throw new Error('Cannot move section to its own descendant');
}
```

**2. Transaction Isolation**:
```javascript
// Use serializable isolation for complex operations
await supabase.rpc('set_transaction_isolation', { level: 'SERIALIZABLE' });
```

**3. Audit Logging**:
```javascript
// Log all section edits
await supabase
  .from('audit_logs')
  .insert({
    user_id: req.session.userId,
    action: 'section_split',
    resource_type: 'document_section',
    resource_id: sectionId,
    details: {
      splitPoints: splitPoints,
      newSectionIds: newSections.map(s => s.id)
    },
    ip_address: req.ip,
    user_agent: req.headers['user-agent']
  });
```

---

## Database Helper Functions

### Function 1: Increment Sibling Ordinals

```sql
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Increment ordinals of siblings >= start_ordinal
  UPDATE document_sections
  SET ordinal = ordinal + p_increment_by
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_sibling_ordinals IS
  'Shift sibling ordinals up by N positions to make space for insertion';
```

### Function 2: Decrement Sibling Ordinals

```sql
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Decrement ordinals of siblings >= start_ordinal
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_sibling_ordinals IS
  'Shift sibling ordinals down by N positions to close gaps after deletion';
```

### Function 3: Relocate Suggestions

```sql
CREATE OR REPLACE FUNCTION relocate_suggestions(
  p_old_section_id UUID,
  p_new_section_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_relocated INTEGER;
BEGIN
  -- Move all suggestions from old section to new section
  UPDATE suggestion_sections
  SET section_id = p_new_section_id
  WHERE section_id = p_old_section_id;

  GET DIAGNOSTICS v_relocated = ROW_COUNT;
  RETURN v_relocated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION relocate_suggestions IS
  'Move all suggestions from one section to another (used in join/merge operations)';
```

### Function 4: Validate Section Editable

```sql
CREATE OR REPLACE FUNCTION validate_section_editable(p_section_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  -- Check if section has any locked workflow states
  SELECT EXISTS (
    SELECT 1
    FROM section_workflow_states
    WHERE section_id = p_section_id
      AND status = 'locked'
  ) INTO v_locked;

  RETURN NOT v_locked;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_section_editable IS
  'Returns true if section can be edited (not locked in workflow)';
```

### Function 5: Get Section Descendants

```sql
CREATE OR REPLACE FUNCTION get_descendants(p_section_id UUID)
RETURNS TABLE (
  id UUID,
  depth INTEGER,
  section_number VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT ds.id, ds.depth, ds.section_number
  FROM document_sections ds
  WHERE p_section_id = ANY(ds.path_ids)
    AND ds.id != p_section_id
  ORDER BY ds.path_ordinals;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_descendants IS
  'Returns all descendant sections in tree order (for cascade operations)';
```

---

## Implementation Plan

### Phase 1: Database Functions (1 day)

**Tasks**:
1. ✅ Create helper functions (increment/decrement ordinals, relocate suggestions)
2. ✅ Add RLS policies for section editing
3. ✅ Create migration script for functions
4. ✅ Test functions in isolation

**Deliverables**:
- `/database/migrations/013_section_editing_functions.sql`
- Unit tests for each function

### Phase 2: Backend API Routes (1 day)

**Tasks**:
1. ✅ Implement POST `/admin/sections/:id/split`
2. ✅ Implement POST `/admin/sections/join`
3. ✅ Implement PUT `/admin/sections/:id/retitle`
4. ✅ Implement PUT `/admin/sections/:id/move`
5. ✅ Implement DELETE `/admin/sections/:id`
6. ✅ Add validation middleware
7. ✅ Add error handling

**Deliverables**:
- Updated `/src/routes/admin.js` with new routes
- Integration tests for each endpoint

### Phase 3: Admin UI Components (3-5 days)

**Tasks**:
1. ✅ Create section tree editor component
2. ✅ Implement split section modal
3. ✅ Implement join sections confirmation dialog
4. ✅ Implement retitle form
5. ✅ Implement move section drag-and-drop
6. ✅ Add confirmation dialogs for destructive ops
7. ✅ Style components with existing theme

**Deliverables**:
- `/views/admin/section-editor.ejs`
- `/public/js/section-editor.js`
- `/public/css/section-editor.css`

### Phase 4: Testing & Documentation (1 day)

**Tasks**:
1. ✅ Write integration tests for all CRUD operations
2. ✅ Write E2E tests for UI workflows
3. ✅ Update admin documentation
4. ✅ Create user guide with screenshots

**Deliverables**:
- `/tests/integration/section-editing.test.js`
- `/tests/e2e/admin-section-editor.test.js`
- `/docs/ADMIN_SECTION_EDITOR_GUIDE.md`

---

## UI Mockup Descriptions

### 1. Section Tree Editor

**Layout**:
```
┌──────────────────────────────────────────────────────────────┐
│ Document: Reseda Bylaws v2.0                    [Edit Mode ▼]│
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 📄 Preamble                                [Edit] [Delete]    │
│                                                               │
│ 📑 Article I - Name                        [Edit] [Delete]    │
│   ├─ 📝 Section 1                          [Edit] [Delete]    │
│   └─ 📝 Section 2                          [Edit] [Delete]    │
│                                                               │
│ 📑 Article II - Membership                 [Edit] [Delete]    │
│   ├─ 📝 Section 1 - Eligibility            [Split] [Join]     │
│   │   ├─ 📌 (a) Geographic Requirement     [Edit] [Delete]    │
│   │   └─ 📌 (b) Age Requirement            [Edit] [Delete]    │
│   ├─ 📝 Section 2 - Voting Rights          [Edit] [Delete]    │
│   └─ 📝 Section 3 - Dues                   [Edit] [Delete]    │
│                                                               │
│ [+ Add Section at Root]                                       │
└──────────────────────────────────────────────────────────────┘
```

**Features**:
- Collapsible tree structure
- Drag-and-drop to reorder or move
- Context menu on right-click (Split, Join, Retitle, Move, Delete)
- Icons indicate section type and depth
- Badges show suggestion count and workflow status
- Hover shows section preview tooltip

### 2. Split Section Modal

```
┌──────────────────────────────────────────────────────────────┐
│ Split Section: Article II, Section 1 - Eligibility       [×] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Current Text (select split point):                           │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ All stakeholders living within the boundaries of the   │  │
│ │ Reseda Neighborhood Council are eligible for membership│  │
│ │ provided they are at least 16 years of age.            │  │
│ │                                                         │  │
│ │ [█ SPLIT HERE]                                          │  │
│ │                                                         │  │
│ │ Members must register by providing proof of residency  │  │
│ │ and completing the membership application form.        │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ Split Configuration:                                          │
│                                                               │
│ ☐ First Part:                                                 │
│   Title: [Eligibility Requirements         ]                 │
│   Number: [1a                              ]                  │
│                                                               │
│ ☐ Second Part:                                                │
│   Title: [Registration Process             ]                 │
│   Number: [1b                              ]                  │
│                                                               │
│ Suggestions (3 total):                                        │
│ ⚪ Keep on first section                                      │
│ ⚪ Distribute by position                                     │
│ ⚪ Duplicate to both sections                                 │
│                                                               │
│              [Cancel]              [Split Section]            │
└──────────────────────────────────────────────────────────────┘
```

### 3. Join Sections Dialog

```
┌──────────────────────────────────────────────────────────────┐
│ Join Sections                                             [×] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Selected Sections (in order):                                │
│                                                               │
│ ✓ Section 2 - Voting Rights                                  │
│   (125 words, 2 suggestions)                                  │
│                                                               │
│ ✓ Section 3 - Meeting Attendance                             │
│   (89 words, 1 suggestion)                                    │
│                                                               │
│ Result:                                                       │
│ Title: [Membership Rights and Responsibilities]               │
│ Number: [2-3                                ]                 │
│                                                               │
│ Text Separator: [⚪ Double newline  ⚪ Paragraph break]        │
│                                                               │
│ Suggestions (3 total):                                        │
│ ⚪ Merge all to combined section                              │
│ ⚪ Keep from first section only                               │
│ ⚪ Delete all suggestions                                     │
│                                                               │
│ ⚠️  Warning: This will delete Section 3. All content will be │
│    merged into Section 2. This action cannot be undone.      │
│                                                               │
│              [Cancel]              [Join Sections]            │
└──────────────────────────────────────────────────────────────┘
```

### 4. Retitle Section Form

```
┌──────────────────────────────────────────────────────────────┐
│ Edit Section: Article II, Section 1                      [×] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Section Title:                                                │
│ [Membership Eligibility and Requirements                    ] │
│                                                               │
│ Section Number:                                               │
│ [1                                        ] ☐ Auto-number     │
│                                                               │
│ Section Type:                                                 │
│ [Section          ▼]                                          │
│                                                               │
│ ☑ Update citation metadata                                   │
│ ☐ Renumber child sections                                    │
│                                                               │
│                        [Cancel]  [Save Changes]               │
└──────────────────────────────────────────────────────────────┘
```

### 5. Delete Confirmation Dialog

```
┌──────────────────────────────────────────────────────────────┐
│ Delete Section: Article II, Section 1                    [×] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ ⚠️  Warning: You are about to delete this section:           │
│                                                               │
│ 📝 Section 1 - Eligibility                                   │
│    - 256 words of content                                    │
│    - 3 suggestions will be affected                          │
│    - 2 child subsections (a, b)                              │
│    - Currently in workflow: Committee Review (Approved)      │
│                                                               │
│ Options:                                                      │
│                                                               │
│ Child Sections:                                               │
│ ⚪ Delete recursively (cascade)                               │
│ ⚪ Cancel (cannot delete section with children)               │
│                                                               │
│ Suggestions:                                                  │
│ ⚪ Delete all suggestions                                     │
│ ⚪ Leave orphaned (keep for reference)                        │
│                                                               │
│ Type section number to confirm: [_____]                       │
│                                                               │
│              [Cancel]              [Delete Section]           │
└──────────────────────────────────────────────────────────────┘
```

---

## Test Scenarios & Edge Cases

### Test Scenario 1: Split Section

**Setup**:
- Section with 300 words of content
- 3 suggestions attached
- No workflow locks

**Steps**:
1. Select split point at 150 words
2. Choose "distribute" for suggestions
3. Execute split

**Expected**:
- ✅ Original section text = first 150 words
- ✅ New section created with last 150 words
- ✅ Suggestions distributed based on position
- ✅ Subsequent siblings ordinals incremented
- ✅ Section numbers updated (1 → 1a, 1b)

**Edge Cases**:
- Split at word boundary, not mid-word
- Empty sections rejected (min 10 chars)
- Section with children → prevent split

### Test Scenario 2: Join Adjacent Sections

**Setup**:
- Section 2 (100 words, 2 suggestions)
- Section 3 (150 words, 1 suggestion)
- Sections are adjacent siblings

**Steps**:
1. Select both sections
2. Choose "merge" for suggestions
3. Execute join

**Expected**:
- ✅ Section 2 text = merged content
- ✅ Section 3 deleted
- ✅ All suggestions moved to Section 2
- ✅ Subsequent siblings ordinals decremented
- ✅ Merged section number = "2-3"

**Edge Cases**:
- Non-adjacent sections → reject
- Different parents → reject
- One section has children → reject

### Test Scenario 3: Move Section to New Parent

**Setup**:
- Section 2 under Article I (ordinal: 2)
- Move to Article II (ordinal: 1)

**Steps**:
1. Drag Section 2 to Article II
2. Drop at position 1
3. Execute move

**Expected**:
- ✅ Section parent_id = Article II
- ✅ Section ordinal = 1
- ✅ Old siblings ordinals decremented (close gap)
- ✅ New siblings ordinals incremented (make space)
- ✅ path_ids recalculated by trigger
- ✅ Descendants paths updated recursively

**Edge Cases**:
- Move to own descendant → reject (circular reference)
- Move to same position → no-op
- Section with workflow states → states follow

### Test Scenario 4: Retitle Section

**Setup**:
- Section 1 - "Eligibility"
- No workflow locks

**Steps**:
1. Change title to "Membership Eligibility"
2. Change number to "1.5"
3. Update metadata enabled

**Expected**:
- ✅ section_title = "Membership Eligibility"
- ✅ section_number = "1.5"
- ✅ metadata.citation updated
- ✅ No hierarchy changes

**Edge Cases**:
- Empty title → use "(Untitled)"
- Duplicate number → warn but allow
- Invalid number format → validate

### Test Scenario 5: Delete Section with Children (Cascade)

**Setup**:
- Section 1 with 2 child subsections (a, b)
- 3 suggestions on parent, 1 on each child
- cascade=true, suggestions=delete

**Steps**:
1. Select Section 1
2. Choose cascade delete
3. Confirm deletion

**Expected**:
- ✅ Section 1 deleted
- ✅ Children (a, b) deleted
- ✅ All 5 suggestions deleted
- ✅ Workflow states deleted
- ✅ Subsequent siblings ordinals decremented

**Edge Cases**:
- cascade=false with children → reject
- suggestions=orphan → keep suggestions with deleted section_id

### Test Scenario 6: Locked Section Edit Attempt

**Setup**:
- Section with workflow status = "locked"
- User is org admin

**Steps**:
1. Attempt to split/join/delete section
2. Validate check fails

**Expected**:
- ✅ Return 403 Forbidden
- ✅ Error message: "Section is locked at workflow stage: Committee Review"
- ✅ No changes made

---

## Performance Considerations

### Query Optimization

**1. Batch Ordinal Updates**:
```javascript
// Instead of updating ordinals one-by-one:
// ❌ for (let i = 0; i < siblings.length; i++) {
//     await update({ ordinal: i + 1 })
// }

// Use single query with function:
// ✅ await supabase.rpc('increment_sibling_ordinals', { ... })
```

**2. Minimize Path Recalculation**:
```javascript
// Trigger handles parent/ordinal changes automatically
// Only manually recalculate on bulk operations
if (movedSectionHasChildren) {
  await supabase.rpc('recalculate_descendant_paths', { p_section_id });
}
```

**3. Index Usage**:
```sql
-- Existing indexes optimize these queries:
CREATE INDEX idx_doc_sections_parent ON document_sections(parent_section_id);
CREATE INDEX idx_doc_sections_ordinal ON document_sections(parent_section_id, ordinal);
CREATE INDEX idx_doc_sections_path ON document_sections USING GIN(path_ids);
```

### Caching Strategy

**Cache Section Trees**:
```javascript
// Cache section tree per document (invalidate on edit)
const cacheKey = `doc_sections_tree:${documentId}`;
let tree = await redis.get(cacheKey);

if (!tree) {
  tree = await buildSectionTree(documentId);
  await redis.set(cacheKey, JSON.stringify(tree), 'EX', 3600);
}
```

### Transaction Management

**Use Transactions for Multi-Step Ops**:
```javascript
// Ensure atomicity for split/join/move operations
try {
  await supabase.rpc('begin_transaction');

  // 1. Update ordinals
  // 2. Insert/update sections
  // 3. Handle suggestions

  await supabase.rpc('commit_transaction');
} catch (error) {
  await supabase.rpc('rollback_transaction');
  throw error;
}
```

---

## Error Handling & User Feedback

### Error Codes

```javascript
const ERRORS = {
  SECTION_NOT_FOUND: { code: 404, message: 'Section not found' },
  SECTION_LOCKED: { code: 403, message: 'Section is locked in workflow' },
  CIRCULAR_REFERENCE: { code: 400, message: 'Cannot move section to own descendant' },
  NON_ADJACENT: { code: 400, message: 'Sections must be adjacent siblings' },
  HAS_CHILDREN: { code: 400, message: 'Section has children. Use cascade or move children first' },
  INVALID_ORDINAL: { code: 400, message: 'Invalid ordinal position' },
  SPLIT_TOO_SHORT: { code: 400, message: 'Split would create section shorter than 10 characters' }
};
```

### User Feedback Messages

**Success Messages**:
- ✅ "Section split successfully into 2 parts"
- ✅ "3 sections merged into 'Combined Section'"
- ✅ "Section moved to Article II"
- ✅ "Section title updated"
- ✅ "Section and 2 children deleted"

**Warning Messages**:
- ⚠️ "This section has 3 suggestions. Choose how to handle them."
- ⚠️ "Section is currently approved in workflow. Edits may require re-approval."
- ⚠️ "Deleting this section will orphan 5 suggestions."

**Error Messages**:
- ❌ "Cannot edit: Section is locked at Board Approval stage"
- ❌ "Cannot join: Sections have different parent articles"
- ❌ "Cannot delete: Section has 2 children. Use cascade delete or move children first"
- ❌ "Cannot move: Would create circular reference"

---

## Monitoring & Observability

### Metrics to Track

```javascript
// Track section editing operations
const metrics = {
  section_splits_total: counter(),
  section_joins_total: counter(),
  section_moves_total: counter(),
  section_deletes_total: counter(),

  section_edit_duration_seconds: histogram(),
  section_edit_errors_total: counter(),

  suggestions_relocated_total: counter(),
  ordinals_updated_total: counter()
};
```

### Audit Logging

```javascript
// Log all section edits for compliance
await auditLog({
  action: 'section_split',
  user_id: req.session.userId,
  organization_id: req.session.organizationId,
  resource_type: 'document_section',
  resource_id: sectionId,
  details: {
    document_id: documentId,
    split_points: splitPoints,
    new_section_ids: newSections.map(s => s.id),
    suggestions_affected: suggestionsRelocated
  },
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});
```

---

## Implementation Checklist

### Backend Tasks

- [ ] Create database helper functions
  - [ ] `increment_sibling_ordinals()`
  - [ ] `decrement_sibling_ordinals()`
  - [ ] `relocate_suggestions()`
  - [ ] `validate_section_editable()`
  - [ ] `recalculate_descendant_paths()`

- [ ] Implement API routes
  - [ ] POST `/admin/sections/:id/split`
  - [ ] POST `/admin/sections/join`
  - [ ] PUT `/admin/sections/:id/retitle`
  - [ ] PUT `/admin/sections/:id/move`
  - [ ] DELETE `/admin/sections/:id`
  - [ ] GET `/admin/documents/:docId/sections/tree`

- [ ] Add RLS policies
  - [ ] Admin can UPDATE sections
  - [ ] Admin can INSERT sections
  - [ ] Admin can DELETE sections
  - [ ] Global admin can edit any section

- [ ] Add validation middleware
  - [ ] `validateSectionEditable()`
  - [ ] `validateAdjacentSiblings()`
  - [ ] `validateNoCircularReference()`

- [ ] Error handling
  - [ ] Define error codes
  - [ ] Add error responses
  - [ ] Transaction rollback

- [ ] Write backend tests
  - [ ] Unit tests for helper functions
  - [ ] Integration tests for API routes
  - [ ] Edge case tests

### Frontend Tasks

- [ ] Create UI components
  - [ ] Section tree editor
  - [ ] Split section modal
  - [ ] Join sections dialog
  - [ ] Retitle form
  - [ ] Move section drag-and-drop
  - [ ] Delete confirmation dialog

- [ ] Add JavaScript functionality
  - [ ] Tree rendering and collapsing
  - [ ] Drag-and-drop reordering
  - [ ] Modal interactions
  - [ ] API calls with fetch/axios
  - [ ] Real-time validation

- [ ] Style components
  - [ ] Tree structure CSS
  - [ ] Modal styling
  - [ ] Button states
  - [ ] Loading indicators
  - [ ] Error displays

- [ ] Write frontend tests
  - [ ] Component render tests
  - [ ] Interaction tests
  - [ ] E2E workflow tests

### Documentation Tasks

- [ ] Admin guide
  - [ ] How to split sections
  - [ ] How to join sections
  - [ ] How to move sections
  - [ ] Best practices

- [ ] API documentation
  - [ ] Endpoint descriptions
  - [ ] Request/response examples
  - [ ] Error codes

- [ ] Database documentation
  - [ ] Helper function reference
  - [ ] Migration guide

---

## Conclusion

This design provides a comprehensive blueprint for implementing section editing functionality for organization admins. The system respects existing hierarchical relationships, workflow states, and suggestions while providing flexible CRUD operations.

**Key Advantages**:
1. ✅ Materialized paths automatically maintained by trigger
2. ✅ Transaction-based operations ensure data integrity
3. ✅ Workflow state validation prevents editing locked sections
4. ✅ Flexible suggestion handling preserves user intent
5. ✅ RLS policies enforce organization-level security
6. ✅ Comprehensive error handling and user feedback

**Next Steps**:
1. Review design with team
2. Implement Phase 1 (database functions)
3. Implement Phase 2 (API routes)
4. Implement Phase 3 (admin UI)
5. Implement Phase 4 (testing & docs)

**Estimated Timeline**: 4-7 working days

---

**Document Version**: 1.0
**Last Updated**: 2025-10-15
**Author**: System Architecture Designer
**Status**: ✅ Ready for Implementation
