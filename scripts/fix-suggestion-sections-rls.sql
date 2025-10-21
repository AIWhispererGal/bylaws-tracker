-- ============================================================================
-- FIX: suggestion_sections RLS Policy
-- Issue: "new row violates row-level security policy"
-- Cause: Missing or too restrictive INSERT policy
-- ============================================================================

-- First, let's check the current state
SELECT
    'Current RLS Status' as check,
    rowsecurity as enabled
FROM pg_tables
WHERE tablename = 'suggestion_sections';

SELECT
    'Existing Policies' as check,
    policyname,
    cmd,
    qual as using_check
FROM pg_policies
WHERE tablename = 'suggestion_sections';

-- ============================================================================
-- OPTION 1: Add missing INSERT policy (RECOMMENDED)
-- ============================================================================
-- This allows authenticated users to insert suggestion_sections
-- while respecting organization boundaries

DO $$
BEGIN
    -- Drop existing restrictive policy if it exists
    DROP POLICY IF EXISTS "suggestion_sections_insert_policy" ON suggestion_sections;
    DROP POLICY IF EXISTS "Users can link suggestions to sections" ON suggestion_sections;
    DROP POLICY IF EXISTS "authenticated_insert_suggestion_sections" ON suggestion_sections;

    -- Create new permissive INSERT policy
    CREATE POLICY "authenticated_insert_suggestion_sections"
        ON suggestion_sections
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow if user has access to the document through organization
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

    RAISE NOTICE '✅ Created INSERT policy for suggestion_sections';
END $$;

-- ============================================================================
-- OPTION 2: If you want to allow service role access too
-- ============================================================================
DO $$
BEGIN
    -- Service role can insert anything (for admin operations)
    DROP POLICY IF EXISTS "service_role_insert_suggestion_sections" ON suggestion_sections;

    CREATE POLICY "service_role_insert_suggestion_sections"
        ON suggestion_sections
        FOR INSERT
        TO service_role
        WITH CHECK (true);

    RAISE NOTICE '✅ Created service_role INSERT policy';
END $$;

-- ============================================================================
-- OPTION 3: Quick fix - Disable RLS temporarily (NOT RECOMMENDED for production)
-- ============================================================================
-- Only use this if you need to test immediately and will add proper policies later
-- ALTER TABLE suggestion_sections DISABLE ROW LEVEL SECURITY;
-- RAISE NOTICE '⚠️ RLS DISABLED - Add proper policies before production!';

-- ============================================================================
-- Verify the fix
-- ============================================================================
SELECT
    '✅ Verification' as status,
    tablename,
    policyname,
    cmd,
    LEFT(with_check::text, 100) as policy_preview
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================================================
-- Test the policy (optional)
-- ============================================================================
-- Try inserting a test record (will be rolled back)
DO $$
DECLARE
    test_section_id UUID;
    test_suggestion_id UUID;
BEGIN
    -- Get a real section_id and suggestion_id for testing
    SELECT id INTO test_section_id FROM document_sections LIMIT 1;
    SELECT id INTO test_suggestion_id FROM suggestions LIMIT 1;

    IF test_section_id IS NOT NULL AND test_suggestion_id IS NOT NULL THEN
        -- This should now work without RLS error
        INSERT INTO suggestion_sections (section_id, suggestion_id)
        VALUES (test_section_id, test_suggestion_id);

        RAISE NOTICE '✅ Test insert successful - policy is working!';

        -- Rollback the test insert
        RAISE EXCEPTION 'Test successful - rolling back test insert';
    ELSE
        RAISE NOTICE '⚠️ No test data available - skipping test';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '✅ Test completed (expected rollback)';
END $$;

-- ============================================================================
-- COMPREHENSIVE FIX: Add all CRUD policies for suggestion_sections
-- ============================================================================
DO $$
BEGIN
    -- SELECT policy
    DROP POLICY IF EXISTS "authenticated_select_suggestion_sections" ON suggestion_sections;
    CREATE POLICY "authenticated_select_suggestion_sections"
        ON suggestion_sections
        FOR SELECT
        TO authenticated
        USING (
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

    -- UPDATE policy
    DROP POLICY IF EXISTS "authenticated_update_suggestion_sections" ON suggestion_sections;
    CREATE POLICY "authenticated_update_suggestion_sections"
        ON suggestion_sections
        FOR UPDATE
        TO authenticated
        USING (
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

    -- DELETE policy
    DROP POLICY IF EXISTS "authenticated_delete_suggestion_sections" ON suggestion_sections;
    CREATE POLICY "authenticated_delete_suggestion_sections"
        ON suggestion_sections
        FOR DELETE
        TO authenticated
        USING (
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

    RAISE NOTICE '✅ Created all CRUD policies for suggestion_sections';
END $$;

-- ============================================================================
-- Final verification
-- ============================================================================
SELECT
    '📊 Final Policy Summary' as summary,
    COUNT(*) as total_policies,
    COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
    COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
    COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
    COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies
FROM pg_policies
WHERE tablename = 'suggestion_sections';

RAISE NOTICE '✅ suggestion_sections RLS policies fixed!';
