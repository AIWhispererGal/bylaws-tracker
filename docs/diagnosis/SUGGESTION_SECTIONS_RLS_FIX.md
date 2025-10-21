# Suggestion Sections RLS Fix
## Date: 2025-10-20
## Issue: Service role blocked by RLS on suggestion_sections

---

## 🎯 ROOT CAUSE IDENTIFIED

**File:** `/src/routes/dashboard.js` line 721
**Code:**
```javascript
// Step 2: Link suggestion to section via junction table
// Use service client to bypass RLS on junction table
// (Junction table RLS may be too restrictive for user inserts)
const { error: linkError } = await supabaseService  // ← Service role client
  .from('suggestion_sections')
  .insert({
    suggestion_id: suggestion.id,
    section_id: section_id,
    ordinal: 1
  });
```

**Problem:** Code uses `supabaseService` (service role key) but **RLS still blocks it!**

**Why?** When RLS is enabled on a table, **even service_role needs a policy** unless you explicitly allow it.

---

## ✅ THE FIX

**Run this in Supabase SQL Editor:**

```sql
CREATE POLICY IF NOT EXISTS "service_role_all_suggestion_sections"
    ON suggestion_sections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```

**OR** use the provided script:
```bash
# Copy contents from:
/scripts/fix-suggestion-sections-service-role.sql
```

---

## 🔍 AUDIT REVEALED THE ISSUE

Your audit showed:
```json
{
  "rls_enabled": true,
  "policy_count": 7,
  "insert_policy_status": "✓ INSERT policy exists"
}
```

**INSERT policies exist** BUT none for `service_role`!

The 7 existing policies are probably all for `authenticated` role:
- SELECT for authenticated
- INSERT for authenticated
- UPDATE for authenticated
- DELETE for authenticated
- Maybe some permissive/restrictive combinations

But **NO service_role policy** = service role gets blocked too!

---

## 🛠️ WHY THIS HAPPENS

### Misconception:
```
"Service role key bypasses RLS automatically" ❌
```

### Reality:
```
Service role key CAN bypass RLS IF you allow it in policy ✅
```

### How RLS Works:

1. **RLS Enabled** → Checks policies for EVERY role (including service_role)
2. **No matching policy** → Operation blocked
3. **Service role needs policy too** → Must explicitly allow it

### Code Comment Was Misleading:

```javascript
// Use service client to bypass RLS on junction table
const { error: linkError } = await supabaseService
```

Should say:
```javascript
// Use service client which has permissive RLS policy allowing all operations
const { error: linkError } = await supabaseService
```

---

## 📊 VERIFICATION

After applying fix, run this:

```sql
-- Check that service role policy exists
SELECT
    policyname,
    cmd,
    roles,
    'Service role can perform: ' || cmd::text as capability
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND roles::text LIKE '%service_role%'
ORDER BY cmd;
```

**Expected:**
```
service_role_all_suggestion_sections | ALL | service_role | Service role can perform: ALL
```

---

## 🎯 EXPECTED RESULTS

### Before Fix:
```
❌ Error: Failed to link suggestion to section: new row violates row-level security policy
❌ Suggestion created but not linked (orphaned)
❌ Need to manually clean up orphaned suggestions
```

### After Fix:
```
✅ Suggestion created
✅ Linked to section via junction table
✅ Dashboard displays suggestion correctly
✅ No RLS errors
```

---

## 🔒 SECURITY CONSIDERATIONS

**Q:** Isn't allowing service_role to do anything a security risk?

**A:** No, because:
1. Service role key is stored server-side only (never sent to client)
2. Only your backend code can use it
3. This is exactly what service role is FOR - admin operations
4. Client-side code uses `req.supabase` (authenticated user client) which IS restricted by RLS

**Architecture:**
```
Client request
  ↓
Backend route (dashboard.js)
  ↓
Step 1: Create suggestion using req.supabase (user client)
        → Restricted by authenticated user RLS policies
  ↓
Step 2: Link to section using supabaseService (service role)
        → Needs service_role policy to work
        → Safe because only backend can call it
```

---

## 📋 CHECKLIST

After applying fix:

- [ ] Run `/scripts/fix-suggestion-sections-service-role.sql` in Supabase
- [ ] Verify policy created (should see service_role_all_suggestion_sections)
- [ ] Test creating a suggestion in the app
- [ ] Verify no RLS errors in console
- [ ] Check suggestion is properly linked to section

---

## 🎓 LEARNING

**Key Takeaway:** Service role is NOT automatically exempt from RLS. You must:

1. **Enable RLS** on table
2. **Add policies for authenticated users** (restrictive - organization-based)
3. **Add policy for service_role** (permissive - allows all)

**Pattern for all junction/admin tables:**

```sql
-- Authenticated users: Restricted
CREATE POLICY "authenticated_insert_table"
    ON table_name
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Check organization membership, etc.
        organization_id IN (...)
    );

-- Service role: Permissive (for backend operations)
CREATE POLICY "service_role_all_table"
    ON table_name
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```

---

## 🚀 QUICK FIX SUMMARY

**1 SQL statement fixes everything:**

```sql
CREATE POLICY IF NOT EXISTS "service_role_all_suggestion_sections"
    ON suggestion_sections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```

**Time to fix:** 10 seconds
**Time to test:** 30 seconds
**Total downtime:** ~1 minute

---

*"Even the mighty service role must ask permission from RLS."*
*— The Security Swarm* 🛡️🐝

**Fix Created: 2025-10-20**
**Ready to Apply: YES**
