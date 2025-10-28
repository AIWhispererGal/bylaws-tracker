# Page Load Stale Data Bug - Root Cause Analysis

## The Smoking Gun

**User confirms:**
- Manual page refresh (F5) shows STALE lock state
- Database has CORRECT data when checked directly
- API endpoint `/api/dashboard/sections/:sectionId` returns CORRECT data
- This proves: **The page load query is fetching different/stale data than the API**

## Critical Finding: Page Load Query (Lines 999-1019)

```javascript
const { data: sections, error: sectionsError } = await supabase
  .from('document_sections')
  .select(`
    id,
    section_number,
    section_title,
    section_type,
    current_text,
    original_text,
    is_locked,        // ❌ DIRECT COLUMN - NOT WORKFLOW STATE
    locked_at,        // ❌ DIRECT COLUMN - NOT WORKFLOW STATE
    locked_by,        // ❌ DIRECT COLUMN - NOT WORKFLOW STATE
    locked_text,      // ❌ DIRECT COLUMN - NOT WORKFLOW STATE
    selected_suggestion_id,
    parent_section_id,
    ordinal,
    depth,
    path_ordinals
  `)
  .eq('document_id', documentId)
  .order('document_order', { ascending: true });
```

## The Problem

### Page Load (WRONG):
- Queries `document_sections` table directly
- Fetches `is_locked`, `locked_at`, `locked_by`, `locked_text` columns
- These columns are **STALE** and not updated by the unlock endpoint
- **NO JOIN** to `section_workflow_states` table

### API Endpoint (CORRECT):
Location: `/api/dashboard/sections/:sectionId` (lines 765-818)
```javascript
const { data: section, error: sectionError } = await supabase
  .from('document_sections')
  .select(`
    *,
    documents:document_id (
      id,
      title,
      organization_id
    )
  `)
  .eq('id', sectionId)
  .single();
```

**Returns:**
- `original_text`
- `current_text` (or falls back to `original_text`)
- **Does NOT return lock state** - client uses cached/stale state

### Sections List Query (lines 318-391):
```javascript
// Get workflow states for these sections
const sectionIds = sections.map(s => s.id);
const { data: states } = await supabase
  .from('section_workflow_states')
  .select('section_id, status, workflow_stage_id, actioned_at')
  .in('section_id', sectionIds);

// Attach workflow states to sections
sections.forEach(section => {
  const state = statesMap.get(section.id);
  section.workflow_status = state ? state.status : 'draft';
  section.last_action = state ? state.actioned_at : null;
});
```

**This query DOES join workflow states correctly!**

## Why the Bug Occurs

1. **Page load** reads from `document_sections.is_locked` column
2. **Unlock endpoint** updates `section_workflow_states` table (sets status to 'draft')
3. **Unlock endpoint DOES NOT update** `document_sections.is_locked` column
4. **Manual refresh** re-reads stale `document_sections.is_locked` column
5. **User sees old lock state**

## Database Schema Issue

The `document_sections` table has these legacy columns:
- `is_locked` BOOLEAN
- `locked_at` TIMESTAMP
- `locked_by` UUID
- `locked_text` TEXT

**These columns are not updated when workflow state changes!**

## The Fix

### Option 1: Update Page Load Query (RECOMMENDED)
Match the pattern used in `/sections` endpoint (lines 361-379):

```javascript
// 1. Load sections without lock columns
const { data: sections } = await supabase
  .from('document_sections')
  .select(`
    id,
    section_number,
    section_title,
    section_type,
    current_text,
    original_text,
    selected_suggestion_id,
    parent_section_id,
    ordinal,
    depth,
    path_ordinals
  `)
  .eq('document_id', documentId)
  .order('document_order', { ascending: true });

// 2. Load workflow states separately
const sectionIds = sections.map(s => s.id);
const { data: workflowStates } = await supabase
  .from('section_workflow_states')
  .select('section_id, status, locked_at, locked_by, actioned_at')
  .in('section_id', sectionIds);

// 3. Map workflow states to sections
const statesMap = new Map(workflowStates?.map(s => [s.section_id, s]) || []);
sections.forEach(section => {
  const state = statesMap.get(section.id);
  section.is_locked = state?.status === 'locked';
  section.locked_at = state?.locked_at;
  section.locked_by = state?.locked_by;
  section.workflow_status = state?.status || 'draft';
});
```

### Option 2: Create Database View (BETTER)
Create a view that always joins fresh workflow state:

```sql
CREATE VIEW document_sections_with_state AS
SELECT
  ds.*,
  sws.status as workflow_status,
  (sws.status = 'locked') as is_locked_live,
  sws.locked_at as locked_at_live,
  sws.locked_by as locked_by_live,
  sws.actioned_at
FROM document_sections ds
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id;
```

Then query from the view instead of the table.

### Option 3: Database Trigger (MOST ROBUST)
Create trigger to sync `document_sections` columns when `section_workflow_states` changes:

```sql
CREATE OR REPLACE FUNCTION sync_section_lock_state()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE document_sections
  SET
    is_locked = (NEW.status = 'locked'),
    locked_at = CASE WHEN NEW.status = 'locked' THEN NEW.locked_at ELSE NULL END,
    locked_by = CASE WHEN NEW.status = 'locked' THEN NEW.locked_by ELSE NULL END
  WHERE id = NEW.section_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_section_lock_state
AFTER INSERT OR UPDATE ON section_workflow_states
FOR EACH ROW
EXECUTE FUNCTION sync_section_lock_state();
```

## Files to Fix

1. `/src/routes/dashboard.js` - Line 999-1019 (handleDocumentView function)
2. Potentially create database migration for Option 2 or 3

## Test Plan

1. Lock a section via UI
2. Verify `section_workflow_states` has status='locked'
3. Verify `document_sections.is_locked` = true
4. Unlock section via API
5. Verify `section_workflow_states` has status='draft'
6. **Verify `document_sections.is_locked` = false (currently fails)**
7. Manual page refresh (F5)
8. **Verify section shows as unlocked (currently fails)**

## Recommendation

**Use Option 1 (Update Page Load Query)** as immediate fix because:
- Matches existing pattern in `/sections` endpoint
- No database schema changes required
- Can be deployed immediately
- Fixes stale data at source

Then **add Option 3 (Trigger)** as follow-up to keep columns in sync for any other code that might read them.
