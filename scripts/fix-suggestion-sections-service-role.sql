-- ============================================================================
-- QUICK FIX: Add service_role policy to suggestion_sections
-- Issue: Even service role key is blocked by RLS
-- Location: dashboard.js line 721 uses supabaseService but still gets RLS error
-- ============================================================================

-- The code comment says "Use service client to bypass RLS" but service role
-- ALSO needs a policy if RLS is enabled!

-- ============================================================================
-- Add service_role policy for ALL operations
-- ============================================================================
-- Drop first (safe - won't error if doesn't exist)
DROP POLICY IF EXISTS "service_role_all_suggestion_sections" ON suggestion_sections;

-- Create the policy
CREATE POLICY "service_role_all_suggestion_sections"
    ON suggestion_sections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Verify the policy was created
-- ============================================================================
SELECT
    '✅ Service Role Policy Created' as status,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND policyname = 'service_role_all_suggestion_sections';

-- ============================================================================
-- Show all policies now on suggestion_sections
-- ============================================================================
SELECT
    '📊 All Policies on suggestion_sections' as info,
    policyname,
    cmd as operation,
    roles as for_roles,
    CASE
        WHEN roles::text LIKE '%service_role%' THEN '✓ Service role can use'
        WHEN roles::text LIKE '%authenticated%' THEN 'Only authenticated users'
        ELSE roles::text
    END as access_level
FROM pg_policies
WHERE tablename = 'suggestion_sections'
ORDER BY
    CASE WHEN roles::text LIKE '%service%' THEN 1 ELSE 2 END,
    cmd,
    policyname;

RAISE NOTICE '✅ Service role can now bypass RLS on suggestion_sections';
RAISE NOTICE '✅ dashboard.js line 721 will now work!';
