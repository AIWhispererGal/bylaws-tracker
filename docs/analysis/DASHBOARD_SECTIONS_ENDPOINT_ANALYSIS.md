# Dashboard Sections Endpoint Analysis

## Investigation: Why `original_text` is Empty

**Date**: 2025-10-27
**Endpoint**: `GET /api/dashboard/sections/:sectionId`
**Issue**: `original_text` field returns empty even though it exists in database

---

## FINDINGS

### 1. Endpoint Location
**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/dashboard.js`
**Line**: 765-815

### 2. Database Query
The endpoint uses Supabase to query `document_sections`:

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

**QUERY INCLUDES ALL FIELDS** - The `*` selector means `original_text` IS retrieved from database.

### 3. Response Structure - THE PROBLEM

**Lines 800-808** show the response object:

```javascript
res.json({
  success: true,
  section: {
    id: section.id,
    current_text: section.current_text || section.original_text || '',
    section_number: section.section_number,
    section_title: section.section_title
  }
});
```

**ROOT CAUSE IDENTIFIED**:
- The endpoint queries `original_text` from the database (via `SELECT *`)
- But the response object **explicitly excludes** `original_text` from the response
- Only returns: `id`, `current_text`, `section_number`, `section_title`
- `original_text` is intentionally omitted from the response

### 4. Database Schema Confirms Field Exists

From `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/database/migrations/002_migrate_existing_data.sql`:

```sql
CREATE TABLE IF NOT EXISTS document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  path_ids UUID[] NOT NULL,
  path_ordinals INTEGER[] NOT NULL,
  section_number VARCHAR(50),
  section_title TEXT,
  section_type VARCHAR(50),
  original_text TEXT,        -- <-- FIELD EXISTS
  current_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  ...
);
```

### 5. RLS Policies Do NOT Filter Fields

The Row Level Security policy for `document_sections`:

```sql
CREATE POLICY "Users see sections in accessible documents"
  ON document_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
      AND uo.user_id = auth.uid()
      AND uo.is_active = true
    )
    OR is_global_admin(auth.uid())
  );
```

**RLS Controls Row Access, Not Column Access** - All columns are available when row is accessible.

---

## THE ACTUAL RESPONSE STRUCTURE

**What the endpoint returns:**
```json
{
  "success": true,
  "section": {
    "id": "<uuid>",
    "current_text": "<text or empty>",
    "section_number": "<number>",
    "section_title": "<title>"
  }
}
```

**What fields are available but NOT returned:**
- `original_text` - ❌ Not included in response
- `document_id` - ❌ Not included
- `parent_section_id` - ❌ Not included
- `depth` - ❌ Not included
- `ordinal` - ❌ Not included
- `metadata` - ❌ Not included
- `created_at` - ❌ Not included
- `updated_at` - ❌ Not included

---

## SOLUTION OPTIONS

### Option 1: Add `original_text` to Response (Recommended)

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/dashboard.js`
**Line**: 800-808

**Change from:**
```javascript
res.json({
  success: true,
  section: {
    id: section.id,
    current_text: section.current_text || section.original_text || '',
    section_number: section.section_number,
    section_title: section.section_title
  }
});
```

**Change to:**
```javascript
res.json({
  success: true,
  section: {
    id: section.id,
    original_text: section.original_text || '',
    current_text: section.current_text || section.original_text || '',
    section_number: section.section_number,
    section_title: section.section_title
  }
});
```

### Option 2: Return All Fields (More Flexible)

```javascript
res.json({
  success: true,
  section: {
    ...section,  // Include all fields
    documents: undefined  // Remove the joined documents object if not needed
  }
});
```

### Option 3: Create Separate Endpoint for Original Text

Create `GET /api/dashboard/sections/:sectionId/original` that returns only `original_text`.

---

## COMPARISON WITH OTHER ENDPOINTS

### Workflow Route (Does Include original_text)

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/workflow.js`
**Line**: 1272

```javascript
.select('id, is_locked, locked_at, locked_by, locked_text, selected_suggestion_id, original_text, current_text')
```

The workflow endpoint **explicitly includes** `original_text` in its response.

---

## SUMMARY

### Question: "Why is `original_text` empty?"
**Answer**: It's not empty in the database. The endpoint intentionally excludes it from the response object.

### The Data Flow:
1. ✅ Database contains `original_text` (confirmed by schema)
2. ✅ Query retrieves `original_text` (via `SELECT *`)
3. ✅ RLS policy allows access to field
4. ❌ **Response object excludes `original_text`** - THIS IS THE ISSUE

### Fix Required:
Add `original_text` field to the response object in `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/dashboard.js` line 802-806.

---

## IMPACT ANALYSIS

**Who is affected:**
- `getSectionOriginalText()` function in frontend
- Any code expecting `original_text` from this endpoint
- Document viewer components

**Breaking change?**
- No - adding a field to response is backwards compatible
- Frontend code that checks for `original_text` will start working

**Testing required:**
- Verify `original_text` appears in response
- Verify no performance impact
- Check that sensitive data is not exposed (original_text should be safe)
