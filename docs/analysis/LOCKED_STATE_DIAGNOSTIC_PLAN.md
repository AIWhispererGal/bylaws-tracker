# Diagnostic Plan: Locked State Display Bug

## Summary
After clicking "Unlock" button, the section still displays as locked even after page reload. This indicates either:
1. The database update is not completing
2. The page reload is reading stale/cached data
3. There's a trigger or RLS policy interfering

## Step-by-Step Diagnostic Process

### Phase 1: Verify Database Update Actually Happens

**Add diagnostic logging to unlock endpoint:**

File: `/src/routes/workflow.js` line 2519

```javascript
// BEFORE UPDATE - Add logging
console.log('[UNLOCK DIAGNOSTIC] Section BEFORE unlock:', sectionId);

const { data: sectionBefore } = await supabaseService
  .from('document_sections')
  .select('id, section_number, is_locked, locked_at, locked_by, locked_text')
  .eq('id', sectionId)
  .single();

console.log('[UNLOCK DIAGNOSTIC] Current state:', sectionBefore);

// Unlock the section
const { data: section, error: unlockError } = await supabaseService
  .from('document_sections')
  .update({
    is_locked: false,
    locked_at: null,
    locked_by: null,
    selected_suggestion_id: null,
    locked_text: null
  })
  .eq('id', sectionId)
  .select()
  .single();

// AFTER UPDATE - Verify
console.log('[UNLOCK DIAGNOSTIC] Update error:', unlockError);
console.log('[UNLOCK DIAGNOSTIC] Section AFTER unlock:', section);
console.log('[UNLOCK DIAGNOSTIC] is_locked should be FALSE:', section?.is_locked);

// Verify with a fresh query
const { data: sectionVerify } = await supabaseService
  .from('document_sections')
  .select('id, section_number, is_locked, locked_at, locked_by')
  .eq('id', sectionId)
  .single();

console.log('[UNLOCK DIAGNOSTIC] Fresh query result:', sectionVerify);
```

### Phase 2: Verify Page Reload Gets Fresh Data

**Add diagnostic logging to dashboard route:**

File: `/src/routes/dashboard.js` line 999

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
    is_locked,
    locked_at,
    locked_by,
    locked_text,
    selected_suggestion_id,
    parent_section_id,
    ordinal,
    depth,
    path_ordinals
  `)
  .eq('document_id', documentId)
  .order('document_order', { ascending: true });

// ADD DIAGNOSTIC LOGGING
console.log('[DOCUMENT VIEWER DIAGNOSTIC] Sections locked states:');
sections?.forEach(s => {
  if (s.is_locked !== undefined) {
    console.log(`  Section ${s.section_number}: is_locked=${s.is_locked}, locked_at=${s.locked_at}`);
  }
});
```

### Phase 3: Add Client-Side Diagnostic

**Add logging to unlock function:**

File: `/views/dashboard/document-viewer.ejs` line 1422

```javascript
const response = await fetch(`/api/workflow/sections/${sectionId}/unlock`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notes: 'Unlocked by admin'
  })
});

const data = await response.json();
console.log('[CLIENT UNLOCK] Response:', data);
console.log('[CLIENT UNLOCK] Section is_locked should be false:', data.section?.is_locked);

if (data.success) {
  console.log('[CLIENT UNLOCK] Unlock succeeded, reloading in 1 second...');

  // Give the DB a moment to commit before reloading
  setTimeout(() => {
    console.log('[CLIENT UNLOCK] Reloading now...');
    location.reload();
  }, 1000);
}
```

### Phase 4: Check for Browser Caching

**Add cache-busting headers to dashboard route:**

File: `/src/routes/dashboard.js` line 1079 (before res.render)

```javascript
// Prevent browser caching of document viewer page
res.set({
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0'
});

res.render('dashboard/document-viewer', {
  title: document.title,
  // ... rest of render data
});
```

## Expected Test Results

### Scenario A: Database Update Works
```
[UNLOCK DIAGNOSTIC] Current state: { is_locked: true }
[UNLOCK DIAGNOSTIC] Section AFTER unlock: { is_locked: false }
[UNLOCK DIAGNOSTIC] Fresh query result: { is_locked: false }
[DOCUMENT VIEWER DIAGNOSTIC] Section X: is_locked=false
```
**Result:** Bug is browser caching → Apply cache headers fix

### Scenario B: Database Update Fails
```
[UNLOCK DIAGNOSTIC] Current state: { is_locked: true }
[UNLOCK DIAGNOSTIC] Update error: { message: "..." }
[UNLOCK DIAGNOSTIC] Section AFTER unlock: null
```
**Result:** RLS or constraint issue → Check policies/triggers

### Scenario C: Update Works but Reload Gets Stale Data
```
[UNLOCK DIAGNOSTIC] Section AFTER unlock: { is_locked: false }
[UNLOCK DIAGNOSTIC] Fresh query result: { is_locked: false }
[DOCUMENT VIEWER DIAGNOSTIC] Section X: is_locked=true
```
**Result:** RLS SELECT policy or Supabase caching → Check RLS SELECT policy

### Scenario D: Timing Issue
```
[CLIENT UNLOCK] Reloading now...
[DOCUMENT VIEWER DIAGNOSTIC] Section X: is_locked=true
```
(But DB query shows false)
**Result:** Transaction not committed yet → Increase reload delay

## Implementation Steps

1. Apply Phase 1 logging to workflow.js
2. Apply Phase 2 logging to dashboard.js
3. Apply Phase 3 logging to document-viewer.ejs
4. Test unlock operation
5. Analyze console logs
6. Apply fix based on scenario match

## Quick Test Commands

**After implementing diagnostics:**

1. Start server: `npm start`
2. Open browser DevTools Console
3. Navigate to a locked section
4. Click "Unlock" button
5. Watch console for diagnostic logs
6. Take screenshot of all console output
7. Match to scenarios above

## Files to Modify

- `/src/routes/workflow.js` - Add unlock diagnostics
- `/src/routes/dashboard.js` - Add page load diagnostics
- `/views/dashboard/document-viewer.ejs` - Add client diagnostics
