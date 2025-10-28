# CODER AGENT FIX IMPLEMENTATION PLAN
## Status: Ready for Review & Deployment

**Agent**: Coder Agent
**Date**: 2025-10-23
**Mission**: Prepare concrete fixes for global admin and section operations issues

---

## EXECUTIVE SUMMARY

I have analyzed both issues and prepared detailed fixes. Both issues have clear root causes and straightforward solutions:

### Issue 1: Global Admin Cannot See Organizations
- **Root Cause**: Using wrong `is_global_admin` flag from `user_organizations` table instead of `users` table
- **Impact**: Global admins see empty organization list on `/admin/dashboard`
- **Fix Complexity**: LOW - Simple query change in 2 files

### Issue 2: Section Operations Broken
- **Root Cause**: Three missing RPC functions + invalid `.sql` literal usage + NULL handling bug
- **Impact**: Indent, dedent, move, and split operations fail completely
- **Fix Complexity**: MEDIUM - Need migration + code fixes in multiple places

---

## FIX 1: GLOBAL ADMIN ORGANIZATIONS ACCESS

### Problem Analysis

**File**: `src/middleware/globalAdmin.js` (lines 17-24)

```javascript
// ❌ WRONG TABLE - user_organizations has deprecated is_global_admin column
const { data, error } = await req.supabase
  .from('user_organizations')  // ← WRONG!
  .select('is_global_admin')
  .eq('user_id', req.session.userId)
  .eq('is_global_admin', true)
  .eq('is_active', true)
  .limit(1)
  .maybeSingle();
```

**Schema Reality**:
- `users.is_global_admin` (boolean) - ✅ **CORRECT SOURCE OF TRUTH**
- `user_organizations.is_global_admin` (boolean) - ❌ **DEPRECATED, DO NOT USE**

### Proposed Fix

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/middleware/globalAdmin.js`

**Lines 17-24** (replace entire query):

```javascript
// ✅ CORRECT - Query users table for global admin status
const { data, error } = await req.supabase
  .from('users')  // ← CORRECT TABLE!
  .select('is_global_admin')
  .eq('id', req.session.userId)
  .eq('is_global_admin', true)
  .limit(1)
  .maybeSingle();
```

**Explanation**:
- Global admin status is a user property, not an organization membership property
- `users.is_global_admin` is the single source of truth
- This flag is set once per user and applies across all organizations

### Testing Fix 1

**Test Case 1**: Global admin sees all organizations
```sql
-- Setup: Make user a global admin
UPDATE users SET is_global_admin = true WHERE email = 'admin@test.com';

-- Expected: GET /admin/dashboard returns ALL organizations
-- Verification: Check req.isGlobalAdmin = true in logs
```

**Test Case 2**: Regular user sees only their orgs
```sql
-- Setup: User is NOT global admin
UPDATE users SET is_global_admin = false WHERE email = 'user@test.com';

-- Expected: GET /admin/dashboard returns only user's organizations
-- Verification: Check req.isGlobalAdmin = false in logs
```

---

## FIX 2: SECTION OPERATIONS (Multiple Sub-Fixes)

### 2A: Missing RPC Functions

**Problem**: Database missing 3 critical functions for ordinal management

**Solution**: Create migration file

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/database/migrations/009_section_operations_fix.sql`

```sql
-- Migration 009: Add section editing RPC functions
-- Purpose: Enable indent, dedent, move operations
-- Date: 2025-10-23

BEGIN;

-- ============================================================================
-- FUNCTION 1: Make space by incrementing ordinals
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Handle both NULL (root level) and non-NULL parent_id
  UPDATE document_sections
  SET ordinal = ordinal + p_increment_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION increment_sibling_ordinals IS
'Shift sibling ordinals up by increment_by, starting from start_ordinal. Handles NULL parent (root sections).';

-- ============================================================================
-- FUNCTION 2: Close gaps by decrementing ordinals
-- ============================================================================
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Shift sections AFTER the deleted/moved section down
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal > p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION decrement_sibling_ordinals IS
'Close gaps by shifting ordinals down after deletion/move. Handles NULL parent.';

-- ============================================================================
-- FUNCTION 3: Swap ordinals for move-up/move-down
-- ============================================================================
CREATE OR REPLACE FUNCTION swap_sibling_ordinals(
  p_section_id_1 UUID,
  p_section_id_2 UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ordinal_1 INTEGER;
  v_ordinal_2 INTEGER;
  v_parent_1 UUID;
  v_parent_2 UUID;
BEGIN
  -- Get ordinals and parents
  SELECT ordinal, parent_section_id
  INTO v_ordinal_1, v_parent_1
  FROM document_sections
  WHERE id = p_section_id_1;

  SELECT ordinal, parent_section_id
  INTO v_ordinal_2, v_parent_2
  FROM document_sections
  WHERE id = p_section_id_2;

  -- Verify both sections exist
  IF v_ordinal_1 IS NULL OR v_ordinal_2 IS NULL THEN
    RAISE EXCEPTION 'One or both sections not found';
  END IF;

  -- Verify same parent (siblings)
  IF v_parent_1 IS DISTINCT FROM v_parent_2 THEN
    RAISE EXCEPTION 'Cannot swap: sections have different parents';
  END IF;

  -- Swap ordinals
  UPDATE document_sections
  SET ordinal = v_ordinal_2, updated_at = NOW()
  WHERE id = p_section_id_1;

  UPDATE document_sections
  SET ordinal = v_ordinal_1, updated_at = NOW()
  WHERE id = p_section_id_2;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION swap_sibling_ordinals IS
'Atomically swap ordinals of two sibling sections for move-up/move-down operations.';

-- ============================================================================
-- FUNCTION 4: Get siblings count (helper for validation)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_siblings_count(
  p_parent_id UUID,
  p_document_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM document_sections
  WHERE document_id = p_document_id
    AND parent_section_id IS NOT DISTINCT FROM p_parent_id;
$$;

COMMENT ON FUNCTION get_siblings_count IS
'Count number of siblings under a parent (or at root if parent is NULL).';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_sibling_ordinals(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_sibling_ordinals(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION swap_sibling_ordinals(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_siblings_count(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION increment_sibling_ordinals(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_sibling_ordinals(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION swap_sibling_ordinals(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_siblings_count(UUID, UUID) TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION TESTS
-- ============================================================================
-- Test 1: Check functions exist
-- SELECT routine_name, routine_type FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name LIKE '%sibling%ordinals%';
-- Expected: 4 functions

-- Test 2: Test increment (make space)
-- SELECT increment_sibling_ordinals(NULL, 2, 1); -- Shift root sections from ordinal 2 up

-- Test 3: Test decrement (close gap)
-- SELECT decrement_sibling_ordinals(NULL, 3, 1); -- Close gap after ordinal 3

-- Test 4: Test swap
-- SELECT swap_sibling_ordinals('section-uuid-1', 'section-uuid-2');
```

### 2B: Fix Invalid Supabase API Usage

**Problem**: Code uses `supabaseService.sql` which doesn't exist in Supabase JS client

**Files to Fix**:
1. `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/admin.js`

**Changes**:

#### Fix 2B.1: Indent Operation (Line ~2029)

**Location**: `POST /admin/sections/:id/indent` route

**REMOVE these lines** (approximately lines 2052-2081):

```javascript
// ❌ DELETE THIS ENTIRE BLOCK - RPC function handles ordinal shifting
// 4. Close gap at old parent by decrementing ordinals
if (section.parent_section_id !== null) {
  const { error: shiftError } = await supabaseService
    .from('document_sections')
    .update({
      ordinal: supabaseService.sql`ordinal - 1`,  // ← INVALID!
      updated_at: new Date().toISOString()
    })
    .eq('parent_section_id', section.parent_section_id)
    .gt('ordinal', section.ordinal);

  if (shiftError) {
    console.error('[INDENT] Ordinal shift error:', shiftError);
    // Not fatal - section moved successfully
  }
}
```

**KEEP these lines** (RPC function call is correct):

```javascript
// ✅ CORRECT - Use RPC function (already in code at line 2054)
const { error: shiftError } = await supabaseService.rpc(
  'decrement_sibling_ordinals',
  {
    p_parent_id: section.parent_section_id,
    p_start_ordinal: section.ordinal,
    p_decrement_by: 1
  }
);
```

#### Fix 2B.2: Dedent Operation (Line ~2159)

**Location**: `POST /admin/sections/:id/dedent` route

**REPLACE lines 2159-2180** with RPC call:

```javascript
// ❌ OLD CODE (DELETE):
// 4. Shift ordinals of sections after parent to make space
if (parent.parent_section_id !== null) {
  const { error: shiftError } = await supabaseService
    .from('document_sections')
    .update({
      ordinal: supabaseService.sql`ordinal + 1`,  // ← INVALID!
      updated_at: new Date().toISOString()
    })
    .eq('parent_section_id', parent.parent_section_id)
    .gte('ordinal', newOrdinal);

  if (shiftError) {
    console.error('[DEDENT] Shift error:', shiftError);
    throw shiftError;
  }
}

// ✅ NEW CODE (CORRECT):
// 4. Shift ordinals to make space for dedented section
await supabaseService.rpc('increment_sibling_ordinals', {
  p_parent_id: parent.parent_section_id,
  p_start_ordinal: newOrdinal,
  p_increment_by: 1
});
```

### 2C: Fix UUID NULL String Bug

**Problem**: In split operation, code passes string "null" instead of NULL for root-level parent

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/admin.js`

**Location**: Line ~1721 (split operation)

**CHANGE**:

```javascript
// ❌ OLD (Line 1721):
await supabaseService.rpc('increment_sibling_ordinals', {
  p_parent_id: section.parent_section_id || null,  // ← BUG: sends "null" string for root!
  p_start_ordinal: section.ordinal + 1,
  p_increment_by: 1
});

// ✅ NEW (EXPLICIT NULL HANDLING):
await supabaseService.rpc('increment_sibling_ordinals', {
  p_parent_id: section.parent_section_id === null ? null : section.parent_section_id,
  p_start_ordinal: section.ordinal + 1,
  p_increment_by: 1
});
```

**Explanation**: JavaScript's `|| null` converts falsy values to null, but Supabase may serialize this as string "null". Explicit comparison ensures proper NULL value.

### 2D: Fix Document Order NULL Issue

**Problem**: Split operation may create sections with NULL `document_order` (violates NOT NULL constraint)

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/admin.js`

**Location**: Line ~1739 (split - new section creation)

**ADD `document_order` field**:

```javascript
// ✅ ADD document_order calculation (Line ~1739)
// Step 3: Create new section with second part
const newSection = {
  document_id: section.document_id,
  parent_section_id: section.parent_section_id,
  section_number: newSectionNumber || `${section.section_number}.2`,
  section_title: newSectionTitle || `${section.section_title} (Part 2)`,
  section_type: section.section_type,
  ordinal: section.ordinal + 1,
  depth: section.depth,
  original_text: secondPart,
  current_text: secondPart,
  is_locked: false,
  // ✅ ADD THIS LINE:
  document_order: section.document_order + 1,  // Place right after original section
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
```

**Explanation**: `document_order` is a global ordering field (NOT NULL) that ensures consistent section order in the document. Must be set when creating new sections.

---

## DEPLOYMENT PLAN

### Step 1: Apply Fix 1 (Global Admin)
```bash
# Edit file
vim src/middleware/globalAdmin.js

# Restart server
npm run dev
```

### Step 2: Apply Fix 2 (Database Migration)
```bash
# Apply migration
psql $DATABASE_URL -f database/migrations/009_section_operations_fix.sql

# Verify functions exist
psql $DATABASE_URL -c "\df *sibling*ordinals*"
# Expected: 4 functions listed
```

### Step 3: Apply Fix 2B-2D (Code Changes)
```bash
# Edit admin.js with all fixes
vim src/routes/admin.js

# Restart server
npm run dev
```

### Step 4: Verify All Fixes
```bash
# Test global admin
curl -X GET http://localhost:3000/admin/dashboard \
  -H "Cookie: session=..." \
  --verbose

# Test indent operation
curl -X POST http://localhost:3000/admin/sections/{id}/indent \
  -H "Cookie: session=..." \
  --verbose

# Test split operation
curl -X POST http://localhost:3000/admin/sections/{id}/split \
  -H "Content-Type: application/json" \
  -d '{"splitPosition": 100, "newSectionTitle": "Part 2"}' \
  --verbose
```

---

## FILES TO MODIFY

### File 1: Global Admin Middleware
**Path**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/middleware/globalAdmin.js`
**Lines**: 17-24
**Change**: Query `users` table instead of `user_organizations`

### File 2: Database Migration (NEW FILE)
**Path**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/database/migrations/009_section_operations_fix.sql`
**Content**: RPC functions (see above)

### File 3: Admin Routes
**Path**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/admin.js`
**Changes**:
- Line ~2052-2081: Remove invalid `.sql` usage in indent
- Line ~2159-2180: Fix dedent RPC call
- Line ~1721: Fix NULL string bug
- Line ~1739: Add `document_order` field

---

## ROLLBACK PLAN

### Rollback Fix 1 (Global Admin)
```bash
git checkout src/middleware/globalAdmin.js
npm run dev
```

### Rollback Fix 2 (Section Operations)
```bash
# Rollback database
psql $DATABASE_URL <<EOF
DROP FUNCTION IF EXISTS increment_sibling_ordinals(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS decrement_sibling_ordinals(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS swap_sibling_ordinals(UUID, UUID);
DROP FUNCTION IF EXISTS get_siblings_count(UUID, UUID);
EOF

# Rollback code
git checkout src/routes/admin.js
npm run dev
```

---

## RISK ASSESSMENT

### Fix 1: Global Admin (LOW RISK)
- ✅ Simple query change
- ✅ No schema changes
- ✅ Backward compatible
- ⚠️ Test thoroughly with both global admin and regular users

### Fix 2: Section Operations (MEDIUM RISK)
- ✅ RPC functions use SECURITY DEFINER (tested pattern from migration 008c)
- ✅ NULL handling improved
- ⚠️ Test edge cases (root-level sections, deep nesting)
- ⚠️ Verify constraint violations don't occur

---

## TEST CASES

### Test Suite 1: Global Admin Access
```javascript
describe('Global Admin Organization Access', () => {
  it('Global admin sees ALL organizations', async () => {
    // Setup: user.is_global_admin = true
    const response = await request(app)
      .get('/admin/dashboard')
      .set('Cookie', globalAdminSession);

    expect(response.body.organizations.length).toBeGreaterThan(0);
    expect(response.body.organizations).toContain(orgNotMemberOf);
  });

  it('Regular user sees ONLY their organizations', async () => {
    // Setup: user.is_global_admin = false
    const response = await request(app)
      .get('/admin/dashboard')
      .set('Cookie', regularUserSession);

    expect(response.body.organizations).toHaveLength(userOrgCount);
  });
});
```

### Test Suite 2: Section Operations
```javascript
describe('Section Indent/Dedent', () => {
  it('Indent section makes it child of previous sibling', async () => {
    // Setup: 3 root sections
    const response = await request(app)
      .post(`/admin/sections/${section2.id}/indent`)
      .set('Cookie', adminSession);

    expect(response.body.success).toBe(true);
    expect(response.body.newParentId).toBe(section1.id);
  });

  it('Split section calculates document_order correctly', async () => {
    const response = await request(app)
      .post(`/admin/sections/${section.id}/split`)
      .send({ splitPosition: 100 })
      .set('Cookie', adminSession);

    expect(response.body.success).toBe(true);
    expect(response.body.newSection.document_order).toBe(section.document_order + 1);
  });
});
```

---

## NEXT STEPS (After Review)

1. ✅ Queen reviews this implementation plan
2. ⏳ Queen approves changes
3. ⏳ Apply Fix 1 (global admin middleware)
4. ⏳ Apply Fix 2A (database migration)
5. ⏳ Apply Fixes 2B-2D (code changes)
6. ⏳ Run test suite
7. ⏳ Deploy to production

---

## COORDINATION NOTES

**Stored in memory**: `swarm/coder/fixes`
**Status**: READY FOR REVIEW
**Blocking**: Awaiting Queen Seraphina's approval

**Dependencies**:
- Researcher Alpha findings: Global admin schema analysis
- Researcher Beta findings: Section operations bug analysis
- Migration 008c pattern: SECURITY DEFINER functions

**Files Ready**:
- ✅ Implementation plan (this document)
- ✅ Migration 009 SQL
- ✅ Code fix locations identified
- ✅ Test cases defined
- ✅ Rollback procedures documented
