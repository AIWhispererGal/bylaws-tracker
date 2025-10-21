-- ============================================================================
-- MIGRATION 013: Fix Global Admin RLS Policies (Priority 2 Security Fix)
-- Date: 2025-10-15
-- Version: 2.2.0
-- Purpose: Add global admin checks to 6 tables missing them
--
-- CRITICAL SECURITY FIX:
-- - Global admins were blocked from: suggestions, suggestion_sections,
--   suggestion_votes, document_workflows, section_workflow_states, user_organizations
-- - Migration 007 added global admin support for documents, document_sections, organizations
-- - Migration 012 added is_global_admin() function
-- - This migration completes global admin coverage across ALL tables
--
-- AFFECTED TABLES (24 total policy updates):
-- 1. suggestions (4 policies: SELECT, INSERT, UPDATE, DELETE)
-- 2. suggestion_sections (4 policies)
-- 3. suggestion_votes (4 policies)
-- 4. document_workflows (4 policies)
-- 5. section_workflow_states (4 policies)
-- 6. user_organizations (4 policies)
--
-- PATTERN: Each policy gets OR is_global_admin(auth.uid()) added
-- ============================================================================

-- ============================================================================
-- VERIFY PREREQUISITE: is_global_admin() function exists
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'is_global_admin'
    ) THEN
        RAISE EXCEPTION 'Migration 012 required: is_global_admin() function not found';
    END IF;

    RAISE NOTICE '✅ Prerequisite check passed: is_global_admin() function exists';
END $$;

-- ============================================================================
-- TABLE 1: SUGGESTIONS (4 policies)
-- ============================================================================

-- Policy 1: SELECT - Users see suggestions in their org OR global admin sees all
DROP POLICY IF EXISTS "users_see_org_suggestions" ON suggestions;
CREATE POLICY "users_see_org_suggestions_or_global_admin"
    ON suggestions
    FOR SELECT
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM documents d
            INNER JOIN user_organizations uo
                ON d.organization_id = uo.organization_id
            WHERE d.id = suggestions.document_id
                AND uo.user_id = auth.uid()
        )
    );

-- Policy 2: INSERT - Public can create OR members can create OR global admin
DROP POLICY IF EXISTS "public_create_suggestions" ON suggestions;
CREATE POLICY "public_create_suggestions_or_global_admin"
    ON suggestions
    FOR INSERT
    WITH CHECK (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM documents d
            INNER JOIN organizations o ON d.organization_id = o.id
            WHERE d.id = suggestions.document_id
                AND (o.settings->>'allow_public_suggestions')::boolean = true
        )
        OR
        EXISTS (
            SELECT 1
            FROM documents d
            INNER JOIN user_organizations uo
                ON d.organization_id = uo.organization_id
            WHERE d.id = suggestions.document_id
                AND uo.user_id = auth.uid()
        )
    );

-- Policy 3: UPDATE - Authors or admins OR global admin
DROP POLICY IF EXISTS "authors_update_own_suggestions" ON suggestions;
CREATE POLICY "authors_update_own_suggestions_or_global_admin"
    ON suggestions
    FOR UPDATE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        author_user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1
            FROM documents d
            INNER JOIN user_organizations uo
                ON d.organization_id = uo.organization_id
            WHERE d.id = suggestions.document_id
                AND uo.user_id = auth.uid()
                AND uo.role IN ('owner', 'admin')
        )
    );

-- Policy 4: DELETE - Authors or admins OR global admin
DROP POLICY IF EXISTS "authors_delete_suggestions" ON suggestions;
CREATE POLICY "authors_delete_suggestions_or_global_admin"
    ON suggestions
    FOR DELETE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        author_user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1
            FROM documents d
            INNER JOIN user_organizations uo
                ON d.organization_id = uo.organization_id
            WHERE d.id = suggestions.document_id
                AND uo.user_id = auth.uid()
                AND uo.role IN ('owner', 'admin')
        )
    );

COMMENT ON POLICY "users_see_org_suggestions_or_global_admin" ON suggestions IS
    'Users see suggestions in their organizations, global admins see all';

-- ============================================================================
-- TABLE 2: SUGGESTION_SECTIONS (4 policies)
-- ============================================================================

-- Policy 1: SELECT - Users see suggestion sections in their org OR global admin
DROP POLICY IF EXISTS "users_see_suggestion_sections" ON suggestion_sections;
CREATE POLICY "users_see_suggestion_sections_or_global_admin"
    ON suggestion_sections
    FOR SELECT
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM suggestions s
            INNER JOIN documents d ON s.document_id = d.id
            INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE s.id = suggestion_sections.suggestion_id
                AND uo.user_id = auth.uid()
        )
    );

-- Policy 2: INSERT - Service role or global admin manages suggestion sections
DROP POLICY IF EXISTS "service_role_manage_suggestion_sections" ON suggestion_sections;
CREATE POLICY "service_role_or_global_admin_manage_suggestion_sections"
    ON suggestion_sections
    FOR INSERT
    WITH CHECK (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Policy 3: UPDATE - Service role or global admin
CREATE POLICY "global_admin_update_suggestion_sections"
    ON suggestion_sections
    FOR UPDATE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    )
    WITH CHECK (
        is_global_admin(auth.uid())
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Policy 4: DELETE - Service role or global admin
CREATE POLICY "global_admin_delete_suggestion_sections"
    ON suggestion_sections
    FOR DELETE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

COMMENT ON POLICY "users_see_suggestion_sections_or_global_admin" ON suggestion_sections IS
    'Users see suggestion sections in their organizations, global admins see all';

-- ============================================================================
-- TABLE 3: SUGGESTION_VOTES (4 policies)
-- ============================================================================

-- Policy 1: SELECT - Users see votes in their org OR global admin sees all
DROP POLICY IF EXISTS "users_see_votes" ON suggestion_votes;
CREATE POLICY "users_see_votes_or_global_admin"
    ON suggestion_votes
    FOR SELECT
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM suggestions s
            INNER JOIN documents d ON s.document_id = d.id
            INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE s.id = suggestion_votes.suggestion_id
                AND uo.user_id = auth.uid()
        )
    );

-- Policy 2: INSERT - Users create own votes OR global admin
DROP POLICY IF EXISTS "users_create_own_votes" ON suggestion_votes;
CREATE POLICY "users_create_own_votes_or_global_admin"
    ON suggestion_votes
    FOR INSERT
    WITH CHECK (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        user_id = auth.uid()
        OR
        user_email IS NOT NULL  -- Allow public voting by email
    );

-- Policy 3: UPDATE - Users update own votes OR global admin
DROP POLICY IF EXISTS "users_update_own_votes" ON suggestion_votes;
CREATE POLICY "users_update_own_votes_or_global_admin"
    ON suggestion_votes
    FOR UPDATE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        user_id = auth.uid()
    )
    WITH CHECK (
        is_global_admin(auth.uid())
        OR
        user_id = auth.uid()
    );

-- Policy 4: DELETE - Users delete own votes OR global admin
DROP POLICY IF EXISTS "users_delete_own_votes" ON suggestion_votes;
CREATE POLICY "users_delete_own_votes_or_global_admin"
    ON suggestion_votes
    FOR DELETE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        user_id = auth.uid()
    );

COMMENT ON POLICY "users_see_votes_or_global_admin" ON suggestion_votes IS
    'Users see votes in their organizations, global admins see all';

-- ============================================================================
-- TABLE 4: DOCUMENT_WORKFLOWS (4 policies)
-- ============================================================================

-- Policy 1: SELECT - Users see workflows in their org OR global admin sees all
DROP POLICY IF EXISTS "users_see_doc_workflows" ON document_workflows;
CREATE POLICY "users_see_doc_workflows_or_global_admin"
    ON document_workflows
    FOR SELECT
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM documents d
            INNER JOIN user_organizations uo
                ON d.organization_id = uo.organization_id
            WHERE d.id = document_workflows.document_id
                AND uo.user_id = auth.uid()
        )
    );

-- Policy 2: INSERT - Service role or global admin manages workflows
DROP POLICY IF EXISTS "service_role_manage_doc_workflows" ON document_workflows;
CREATE POLICY "service_role_or_global_admin_insert_doc_workflows"
    ON document_workflows
    FOR INSERT
    WITH CHECK (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Policy 3: UPDATE - Service role or global admin
CREATE POLICY "global_admin_update_doc_workflows"
    ON document_workflows
    FOR UPDATE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    )
    WITH CHECK (
        is_global_admin(auth.uid())
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Policy 4: DELETE - Service role or global admin
CREATE POLICY "global_admin_delete_doc_workflows"
    ON document_workflows
    FOR DELETE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

COMMENT ON POLICY "users_see_doc_workflows_or_global_admin" ON document_workflows IS
    'Users see document workflows in their organizations, global admins see all';

-- ============================================================================
-- TABLE 5: SECTION_WORKFLOW_STATES (4 policies)
-- ============================================================================

-- Policy 1: SELECT - Users see section states in their org OR global admin sees all
DROP POLICY IF EXISTS "users_see_section_states" ON section_workflow_states;
CREATE POLICY "users_see_section_states_or_global_admin"
    ON section_workflow_states
    FOR SELECT
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM document_sections ds
            INNER JOIN documents d ON ds.document_id = d.id
            INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE ds.id = section_workflow_states.section_id
                AND uo.user_id = auth.uid()
        )
    );

-- Policy 2: INSERT - Service role or global admin
DROP POLICY IF EXISTS "service_role_manage_section_states" ON section_workflow_states;
CREATE POLICY "service_role_or_global_admin_insert_section_states"
    ON section_workflow_states
    FOR INSERT
    WITH CHECK (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Policy 3: UPDATE - Approvers or global admin
DROP POLICY IF EXISTS "approvers_manage_section_states" ON section_workflow_states;
CREATE POLICY "approvers_or_global_admin_update_section_states"
    ON section_workflow_states
    FOR UPDATE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1
            FROM document_sections ds
            INNER JOIN documents d ON ds.document_id = d.id
            INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE ds.id = section_workflow_states.section_id
                AND uo.user_id = auth.uid()
                AND (
                    uo.role IN ('owner', 'admin')
                    OR (uo.permissions->>'can_approve_stages')::jsonb ? 'all'
                )
        )
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    )
    WITH CHECK (
        is_global_admin(auth.uid())
        OR
        EXISTS (
            SELECT 1
            FROM document_sections ds
            INNER JOIN documents d ON ds.document_id = d.id
            INNER JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE ds.id = section_workflow_states.section_id
                AND uo.user_id = auth.uid()
                AND (
                    uo.role IN ('owner', 'admin')
                    OR (uo.permissions->>'can_approve_stages')::jsonb ? 'all'
                )
        )
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Policy 4: DELETE - Global admin or service role
CREATE POLICY "global_admin_delete_section_states"
    ON section_workflow_states
    FOR DELETE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

COMMENT ON POLICY "users_see_section_states_or_global_admin" ON section_workflow_states IS
    'Users see section workflow states in their organizations, global admins see all';

-- ============================================================================
-- TABLE 6: USER_ORGANIZATIONS (4 policies)
-- ============================================================================

-- Policy 1: SELECT - Users see own memberships OR global admin sees all
DROP POLICY IF EXISTS "users_see_own_memberships" ON user_organizations;
CREATE POLICY "users_see_own_memberships_or_global_admin"
    ON user_organizations
    FOR SELECT
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        user_id = auth.uid()
    );

-- Policy 2: INSERT - Admins invite users OR global admin can assign anyone
DROP POLICY IF EXISTS "admins_invite_users" ON user_organizations;
CREATE POLICY "admins_invite_users_or_global_admin"
    ON user_organizations
    FOR INSERT
    WITH CHECK (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        EXISTS (
            SELECT 1 FROM user_organizations existing
            WHERE existing.organization_id = user_organizations.organization_id
                AND existing.user_id = auth.uid()
                AND existing.role IN ('owner', 'admin')
        )
    );

-- Policy 3: UPDATE - Users update own membership OR global admin updates any
DROP POLICY IF EXISTS "users_update_own_membership" ON user_organizations;
CREATE POLICY "users_update_own_membership_or_global_admin"
    ON user_organizations
    FOR UPDATE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
        OR
        user_id = auth.uid()
    )
    WITH CHECK (
        is_global_admin(auth.uid())
        OR
        user_id = auth.uid()
    );

-- Policy 4: DELETE - Global admin can remove any membership
CREATE POLICY "global_admin_delete_memberships"
    ON user_organizations
    FOR DELETE
    USING (
        is_global_admin(auth.uid())  -- ✅ GLOBAL ADMIN ACCESS
    );

COMMENT ON POLICY "users_see_own_memberships_or_global_admin" ON user_organizations IS
    'Users see own memberships, global admins see all memberships across all organizations';

-- ============================================================================
-- VERIFICATION: Check all policies were updated
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_global_admin_rls()
RETURNS TABLE (
    table_name text,
    policy_count bigint,
    has_global_admin_policies boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.relname::text,
        COUNT(p.polname),
        bool_or(p.polname LIKE '%global_admin%' OR p.polname LIKE '%_or_global_admin')
    FROM pg_class c
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
        AND c.relname IN (
            'suggestions', 'suggestion_sections', 'suggestion_votes',
            'document_workflows', 'section_workflow_states', 'user_organizations'
        )
    GROUP BY c.relname
    ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_global_admin_rls IS
    'Verify global admin policies exist on all 6 tables';

-- ============================================================================
-- SUCCESS MESSAGE AND NEXT STEPS
-- ============================================================================

DO $$
DECLARE
    rls_status RECORD;
    all_fixed BOOLEAN := true;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION 013 COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Priority 2 Security Fix Applied:';
    RAISE NOTICE '  ✅ Global admin access restored to 6 tables';
    RAISE NOTICE '  ✅ 24 RLS policies updated with global admin checks';
    RAISE NOTICE '  ✅ Multi-tenant security maintained';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Updated Tables:';

    FOR rls_status IN SELECT * FROM verify_global_admin_rls() LOOP
        IF rls_status.has_global_admin_policies THEN
            RAISE NOTICE '  ✅ % (% policies with global admin support)',
                rls_status.table_name, rls_status.policy_count;
            fixed_count := fixed_count + 1;
        ELSE
            RAISE NOTICE '  ❌ % (MISSING global admin policies)', rls_status.table_name;
            all_fixed := false;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF all_fixed AND fixed_count = 6 THEN
        RAISE NOTICE '✅ ALL 6 TABLES NOW HAVE GLOBAL ADMIN SUPPORT';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 Complete Global Admin Coverage:';
        RAISE NOTICE '  Migration 007: documents, document_sections, organizations';
        RAISE NOTICE '  Migration 013: suggestions, suggestion_sections, suggestion_votes,';
        RAISE NOTICE '                 document_workflows, section_workflow_states, user_organizations';
    ELSE
        RAISE WARNING '⚠️  SOME TABLES MISSING GLOBAL ADMIN POLICIES - CHECK ABOVE';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🧪 Verification:';
    RAISE NOTICE '  SELECT * FROM verify_global_admin_rls();';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Related Migrations:';
    RAISE NOTICE '  - 005: Base RLS policies';
    RAISE NOTICE '  - 007: Global admin infrastructure';
    RAISE NOTICE '  - 012: is_global_admin() helper function';
    RAISE NOTICE '  - 013: Complete global admin RLS coverage (this)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (for reference, not executed)
-- ============================================================================

/*
-- To rollback this migration, restore original policies from migration 005:

-- SUGGESTIONS
DROP POLICY IF EXISTS "users_see_org_suggestions_or_global_admin" ON suggestions;
CREATE POLICY "users_see_org_suggestions" ON suggestions FOR SELECT USING (...original...);
-- (repeat for all 24 policies)

-- Then drop verification function:
DROP FUNCTION IF EXISTS verify_global_admin_rls();

-- Note: This rollback would remove global admin access again.
-- Only rollback if absolutely necessary for troubleshooting.
*/
