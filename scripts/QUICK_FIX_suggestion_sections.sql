-- ============================================================================
-- QUICK FIX: Add service_role policy to suggestion_sections
-- Fixed: Removed IF NOT EXISTS (not supported for policies)
-- ============================================================================

-- Drop the policy if it exists (safe - won't error if it doesn't exist)
DROP POLICY IF EXISTS "service_role_all_suggestion_sections" ON suggestion_sections;

-- Create the service_role policy
CREATE POLICY "service_role_all_suggestion_sections"
    ON suggestion_sections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify it worked
SELECT
    '✅ Policy Created!' as status,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND policyname = 'service_role_all_suggestion_sections';
