# RLS Policy Audit & Fix Guide
## Date: 2025-10-20
## Issue: Row Level Security blocking suggestion_sections inserts

---

## 🎯 QUICK FIX FOR IMMEDIATE ISSUE

**Error:** "Failed to link suggestion to section: new row violates row-level security policy"
**Table:** `suggestion_sections`

### Run This in Supabase SQL Editor:

```bash
# Open the fix script
/scripts/fix-suggestion-sections-rls.sql
```

**OR** quick one-liner fix:

```sql
-- Add INSERT policy for authenticated users
CREATE POLICY "authenticated_insert_suggestion_sections"
    ON suggestion_sections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM document_sections ds
            JOIN documents d ON ds.document_id = d.id
            JOIN user_organizations uo ON uo.organization_id = d.organization_id
            WHERE ds.id = suggestion_sections.section_id
            AND uo.user_id = auth.uid()
            AND uo.is_active = true
        )
    );
```

---

## 📊 COMPREHENSIVE RLS AUDIT

### Step 1: Run Full Audit

```bash
# Copy contents of this file to Supabase SQL Editor:
/scripts/audit-rls-policies.sql
```

This script provides **13 different analyses**:

1. **Overview** - Which tables have RLS enabled?
2. **Detailed Policies** - All RLS policies with definitions
3. **Problem Analysis** - Tables with RLS but NO policies (⚠️ blocks everything!)
4. **suggestion_sections Specific** - Policies on the problematic table
5. **Related Tables** - Policies on suggestion-related tables
6. **Authentication Tables** - User/org security policies
7. **Policy Conflicts** - Multiple policies on same operation
8. **Service Role Access** - Which tables allow service_role?
9. **Dangerous Policies** - Overly permissive policies
10. **Policy Complexity** - Most complex policies to review
11. **Missing Policies** - Tables that might need RLS
12. **Summary Statistics** - Quick overview
13. **Immediate Fix Check** - Diagnoses suggestion_sections issue

### Step 2: Review Key Outputs

Focus on these sections:

#### Section 3: Tables with RLS but NO policies
```sql
⚠️ RLS ENABLED BUT NO POLICIES!
This will block ALL operations!
```
**Action:** Either add policies OR disable RLS on these tables

#### Section 4: suggestion_sections Policies
```sql
-- Should show at least INSERT policy
-- If empty, that's your problem!
```

#### Section 9: Dangerous Policies
```sql
⚠️ POTENTIAL ISSUE
No USING clause - allows all rows!
```
**Action:** Review and tighten these policies

#### Section 13: Immediate Diagnosis
```sql
🔴 NO INSERT POLICY - This is likely causing the error!
```
**Action:** Apply the fix script

---

## 🔍 COMMON RLS ISSUES & FIXES

### Issue 1: RLS Enabled, No Policies
**Symptom:** All operations blocked with RLS error
**Cause:** Table has `rowsecurity = true` but zero policies
**Fix:** Add policies OR disable RLS

```sql
-- Option A: Disable RLS (quick fix)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Option B: Add policy (proper fix)
CREATE POLICY "authenticated_all"
    ON table_name
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
```

### Issue 2: Missing INSERT Policy
**Symptom:** "new row violates row-level security policy"
**Cause:** No INSERT policy or WITH CHECK clause too restrictive
**Fix:** Add INSERT policy with appropriate WITH CHECK

```sql
CREATE POLICY "authenticated_insert"
    ON table_name
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Your organization check here
        organization_id IN (
            SELECT organization_id
            FROM user_organizations
            WHERE user_id = auth.uid()
        )
    );
```

### Issue 3: Too Restrictive USING Clause
**Symptom:** Can't see records that should be visible
**Cause:** USING clause filters too aggressively
**Fix:** Review and loosen the USING clause

```sql
-- Check current policy
SELECT qual as using_clause
FROM pg_policies
WHERE tablename = 'your_table' AND cmd = 'SELECT';

-- Update if needed
DROP POLICY "old_policy" ON your_table;
CREATE POLICY "new_policy" ON your_table
    FOR SELECT
    USING (
        -- More permissive check
        organization_id IN (...)
        OR user_id = auth.uid()  -- Allow own records
    );
```

### Issue 4: Service Role Can't Access
**Symptom:** Admin operations fail even with service role key
**Cause:** No service_role policy
**Fix:** Add service_role policy

```sql
CREATE POLICY "service_role_all"
    ON table_name
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```

---

## 🛡️ BEST PRACTICES FOR RLS POLICIES

### 1. Always Have Four Policies Per Table

```sql
-- SELECT - who can see rows
CREATE POLICY "table_select" ON table FOR SELECT USING (...);

-- INSERT - who can create rows + what data is allowed
CREATE POLICY "table_insert" ON table FOR INSERT WITH CHECK (...);

-- UPDATE - who can modify rows
CREATE POLICY "table_update" ON table FOR UPDATE USING (...);

-- DELETE - who can delete rows
CREATE POLICY "table_delete" ON table FOR DELETE USING (...);
```

### 2. Use Organization-Based Security

```sql
USING (
    organization_id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()
        AND is_active = true
    )
)
```

### 3. Separate Policies for Service Role

```sql
-- Regular users - restrictive
CREATE POLICY "user_select" ON table
    FOR SELECT TO authenticated
    USING (organization_id = ...);

-- Service role - permissive
CREATE POLICY "service_select" ON table
    FOR SELECT TO service_role
    USING (true);
```

### 4. Test Policies Before Enabling RLS

```sql
-- Add policies first
CREATE POLICY ...

-- Then enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- NOT the other way around!
```

### 5. Use WITH CHECK for Data Validation

```sql
WITH CHECK (
    -- Ensure data belongs to user's organization
    organization_id IN (SELECT ...)
    -- Ensure required fields are set
    AND field IS NOT NULL
    -- Prevent invalid states
    AND status IN ('draft', 'pending', 'approved')
)
```

---

## 📋 RLS AUDIT CHECKLIST

After running the audit script, review:

- [ ] **Section 3** - Fix tables with RLS but no policies
- [ ] **Section 4** - Verify suggestion_sections has INSERT policy
- [ ] **Section 9** - Review dangerous/permissive policies
- [ ] **Section 11** - Decide if tables need RLS enabled
- [ ] **Section 13** - Confirm suggestion_sections diagnosis

Then apply fixes:

- [ ] Run `/scripts/fix-suggestion-sections-rls.sql`
- [ ] Add missing policies to other tables
- [ ] Tighten overly permissive policies
- [ ] Test with actual user accounts (not service role)
- [ ] Verify no RLS errors in application logs

---

## 🚨 EMERGENCY DISABLE (Last Resort)

If you need to disable RLS completely to unblock work:

```sql
-- Find all tables with RLS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Disable RLS on specific table
ALTER TABLE suggestion_sections DISABLE ROW LEVEL SECURITY;

-- ⚠️ Remember to re-enable with proper policies later!
```

---

## 📊 EXPECTED RESULTS AFTER FIX

### Before Fix:
```
❌ Error: new row violates row-level security policy for table "suggestion_sections"
❌ Can't link suggestions to sections
❌ Document viewer fails when creating suggestions
```

### After Fix:
```
✅ Suggestions link to sections successfully
✅ No RLS policy errors
✅ Document viewer works end-to-end
✅ Multi-tenant security maintained
```

---

## 🔧 FILES PROVIDED

1. **`/scripts/audit-rls-policies.sql`**
   - 13 comprehensive queries
   - Identifies all RLS issues
   - Run in Supabase SQL Editor

2. **`/scripts/fix-suggestion-sections-rls.sql`**
   - Immediate fix for suggestion_sections
   - Adds all CRUD policies
   - Safe to run multiple times

3. **`/docs/diagnosis/RLS_AUDIT_GUIDE.md`**
   - This guide
   - Best practices
   - Troubleshooting tips

---

## 🎯 NEXT STEPS

1. **Run the audit** → `/scripts/audit-rls-policies.sql`
2. **Review Section 13** → Confirms suggestion_sections issue
3. **Apply the fix** → `/scripts/fix-suggestion-sections-rls.sql`
4. **Test in app** → Try linking suggestions to sections
5. **Review other issues** → Check Section 3, 9, 11 of audit

---

*"Defense in depth with RLS policies that actually work."*
*— The Security Swarm* 🛡️🐝

**Audit Scripts Created: 2025-10-20**
**Ready to Run: YES**
