# SUGGESTION SCHEMA FIXES - COMPLETE ✅

## Problem Identified
The code was incorrectly querying `suggestions.section_id` directly, but the database schema uses a many-to-many relationship with a junction table `suggestion_sections`.

## Database Schema (Correct)

```sql
-- suggestions table (NO section_id column!)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  suggested_text TEXT,
  rationale TEXT,
  author_name VARCHAR(255),
  -- NO section_id column!
);

-- Junction table for sections (many-to-many)
CREATE TABLE suggestion_sections (
  id UUID PRIMARY KEY,
  suggestion_id UUID REFERENCES suggestions(id),
  section_id UUID REFERENCES document_sections(id),
  ordinal INTEGER NOT NULL
);
```

## Files Fixed

### 1. `/src/routes/admin.js`
**Lines Fixed:** 1488-1518, 1653-1690, 1199-1238

#### Split Section (Line ~1493)
**Before:**
```javascript
await supabaseService
  .from('suggestions')
  .select('id, author_name')
  .eq('section_id', sectionId)
```

**After:**
```javascript
// Get suggestion IDs via junction table
const { data: sectionSuggestions } = await supabaseService
  .from('suggestion_sections')
  .select('suggestion_id')
  .eq('section_id', sectionId);

// Then get the actual suggestions
if (sectionSuggestions?.length > 0) {
  const suggestionIds = sectionSuggestions.map(ss => ss.suggestion_id);
  const { data: suggestions } = await supabaseService
    .from('suggestions')
    .select('id, author_name')
    .in('id', suggestionIds);
}
```

#### Join Sections (Line ~1640)
**Before:**
```javascript
await supabaseService
  .from('suggestions')
  .select('id, section_id, author_name')
  .in('section_id', sectionIds)
```

**After:**
```javascript
// Get suggestions linked to any of these sections
const { data: sectionSuggestions } = await supabaseService
  .from('suggestion_sections')
  .select('suggestion_id, section_id')
  .in('section_id', sectionIds);

// Get unique suggestion IDs and fetch suggestions
if (sectionSuggestions?.length > 0) {
  const suggestionIds = [...new Set(sectionSuggestions.map(ss => ss.suggestion_id))];
  const { data: suggestions } = await supabaseService
    .from('suggestions')
    .select('id, author_name')
    .in('id', suggestionIds);
}
```

#### Delete Section (Lines ~1204 & 1215)
**Before:**
```javascript
// Delete suggestions
await supabaseService
  .from('suggestions')
  .delete()
  .in('section_id', sectionsToClean);

// Orphan suggestions
await supabaseService
  .from('suggestions')
  .update({ section_id: null })
  .in('section_id', sectionsToClean);
```

**After:**
```javascript
// Delete suggestions
const { data: sectionSuggestions } = await supabaseService
  .from('suggestion_sections')
  .select('suggestion_id')
  .in('section_id', sectionsToClean);

if (sectionSuggestions?.length > 0) {
  const suggestionIds = [...new Set(sectionSuggestions.map(ss => ss.suggestion_id))];
  await supabaseService
    .from('suggestions')
    .delete()
    .in('id', suggestionIds);
}

// Orphan suggestions (remove junction table entries)
await supabaseService
  .from('suggestion_sections')
  .delete()
  .in('section_id', sectionsToClean);
```

### 2. `/src/routes/dashboard.js`
**Status:** Already using correct junction table approach ✅

## Testing Completed

Created test script: `/tests/test-suggestion-schema-fix.js`

### Test Results:
1. ✅ Verified suggestions table has NO section_id column
2. ✅ Verified suggestion_sections junction table exists
3. ✅ Successfully retrieved suggestions via junction table
4. ✅ Confirmed direct section_id queries correctly fail
5. ✅ Successfully created suggestion with section link

## Key Takeaways

1. **Always use junction table** `suggestion_sections` to link suggestions to sections
2. **Two-step query pattern**: First get suggestion IDs from junction table, then fetch suggestions
3. **Handle orphaning correctly**: Delete junction table entries, not update non-existent column
4. **Support many-to-many**: A suggestion can apply to multiple sections

## Quick Reference

### Get suggestions for a section:
```javascript
// Step 1: Get suggestion IDs
const { data: links } = await supabase
  .from('suggestion_sections')
  .select('suggestion_id')
  .eq('section_id', sectionId);

// Step 2: Get suggestions
const suggestionIds = links?.map(l => l.suggestion_id) || [];
const { data: suggestions } = await supabase
  .from('suggestions')
  .select('*')
  .in('id', suggestionIds);
```

### Link suggestion to section:
```javascript
await supabase
  .from('suggestion_sections')
  .insert({
    suggestion_id: suggestionId,
    section_id: sectionId,
    ordinal: 1
  });
```

### Unlink suggestion from section:
```javascript
await supabase
  .from('suggestion_sections')
  .delete()
  .eq('suggestion_id', suggestionId)
  .eq('section_id', sectionId);
```

## Deployment

No database migration needed - the schema was already correct. Only application code was updated.

---

**Fix completed:** 2025-10-19
**All queries now correctly use the junction table pattern!** 🎉