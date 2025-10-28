# Locked State Display Bug - Root Cause Analysis

## Bug Description
After unlocking a section via the admin unlock button, the UI still displays:
- Lock badge in section header (line 530-533 in document-viewer.ejs)
- "Locked" alert in expanded content (line 570-576)
- Even after `location.reload()` the locked state persists

## Root Cause: Incorrect Data Flow

### The Problem Chain

1. **Unlock Endpoint Returns Updated Section** (workflow.js:2558-2561)
   ```javascript
   res.json({
     success: true,
     message: 'Section unlocked successfully',
     section  // ✅ This section HAS is_locked: false
   });
   ```

2. **Client Does Full Page Reload** (document-viewer.ejs:1441)
   ```javascript
   const result = await response.json();
   if (result.success) {
     alert('Section unlocked successfully!');
     location.reload();  // ⚠️ Full page reload
   }
   ```

3. **Page Reload Fetches Sections** (dashboard.js:999-1019)
   ```javascript
   const { data: sections, error: sectionsError } = await supabase
     .from('document_sections')
     .select(`
       id,
       section_number,
       ...
       is_locked,    // ⚠️ THIS is what EJS renders
       locked_at,
       locked_by,
       locked_text,
       ...
     `)
     .eq('document_id', documentId)
     .order('document_order', { ascending: true });
   ```

4. **EJS Renders Lock State** (document-viewer.ejs:530)
   ```ejs
   <% if (section.is_locked) { %>  <!-- ⚠️ Uses section from server render -->
     <span class="ms-2 badge bg-primary">
       <i class="bi bi-lock-fill me-1"></i>Locked
     </span>
   <% } %>
   ```

## Why It Still Shows Locked After Reload

### Scenario Analysis:

**IF unlock worked in DB:**
- Unlock sets `is_locked = false` at line 2522
- Page reload queries DB at dashboard.js:1008
- Should get `is_locked: false`
- Lock badge should NOT render

**IF it still shows locked:**
- Either unlock UPDATE failed silently
- Or there's a trigger/constraint preventing the update
- Or RLS is blocking the update
- Or there's DB-level caching

## Investigation Needed

### 1. Check Unlock Actually Updates DB
```sql
-- After clicking unlock, query directly:
SELECT id, section_number, is_locked, locked_at, locked_by, locked_text
FROM document_sections
WHERE id = '<section_id>';
```

### 2. Check for Triggers/Constraints
```bash
# Search for triggers that might interfere:
grep -r "is_locked" database/migrations/
```

### 3. Check RLS Policies
- The unlock uses `supabaseService` (bypasses RLS)
- But dashboard query uses `req.supabase` (user client)
- **Could RLS be blocking UPDATE but allowing stale SELECT?**

### 4. Verify No DB-Level Caching
- Check if there's a materialized view
- Check if Supabase has query caching enabled

## Diagnostic Steps

1. **Add console logging to unlock endpoint:**
   ```javascript
   console.log('[UNLOCK] Before update:', section);
   const { data: section, error: unlockError } = await supabaseService...
   console.log('[UNLOCK] After update:', section);
   console.log('[UNLOCK] is_locked should be false:', section.is_locked);
   ```

2. **Add console logging to page load:**
   ```javascript
   console.log('[DOCUMENT VIEWER] Section is_locked values:',
     sections.map(s => ({ id: s.id, is_locked: s.is_locked }))
   );
   ```

3. **Check browser cache:**
   - Add `Cache-Control: no-cache` header to document viewer route
   - Or add `?_ts=${Date.now()}` to reload to bust cache

## Expected Fix Locations

### Option 1: Database Constraint Issue
- Check `database/migrations/` for triggers on `is_locked`
- Look for CHECK constraints that might prevent unlock

### Option 2: RLS Policy Issue
- The UPDATE uses service role (bypasses RLS) ✅
- The SELECT uses user client (subject to RLS) ⚠️
- **Verify RLS SELECT policy doesn't show stale/cached data**

### Option 3: Client-Side Caching
- Browser caching the page HTML
- Add cache-busting headers to dashboard route

### Option 4: DB Transaction Issue
- Unlock update happens in transaction
- Page reload happens before transaction commits
- **Add explicit transaction handling or commit verification**

## Files Involved

1. **Unlock Backend:** `/src/routes/workflow.js` lines 2479-2570
2. **Section Query:** `/src/routes/dashboard.js` lines 999-1019
3. **Lock Badge Display:** `/views/dashboard/document-viewer.ejs` lines 530-533, 570-576
4. **Unlock Client:** `/views/dashboard/document-viewer.ejs` lines 1415-1453

## Next Actions

1. ✅ Add diagnostic logging to unlock endpoint
2. ✅ Add diagnostic logging to dashboard section query
3. ✅ Query DB directly after unlock to verify state
4. ✅ Check for triggers/constraints on `is_locked` column
5. ✅ Verify RLS policies don't interfere with unlock/reload

## Hypothesis Priority

**Most Likely → Least Likely:**

1. **DB update succeeds but reload gets stale data** (RLS caching or browser cache)
2. **DB update fails silently** (error swallowed somewhere)
3. **Trigger reverts the unlock** (database-level constraint)
4. **Transaction timing issue** (read happens before commit)
