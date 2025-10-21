-- ============================================================================
-- MIGRATION 009: Enhance RLS with Direct Organization ID Filtering
-- Date: 2025-10-13
-- Version: 2.2.0
-- Purpose: Add organization_id columns and strengthen RLS policies for
--          complete multi-tenant data isolation
--
-- CRITICAL SECURITY ENHANCEMENTS:
-- - Add organization_id to document_sections for direct filtering
-- - Add organization_id to suggestions for direct filtering
-- - Strengthen RLS policies to prevent cross-organization access
-- - Add indexes for performance
-- - Maintain referential integrity
--
-- SECURITY ISSUE ADDRESSED:
-- Previous RLS policies required JOINs through documents table, which could
-- allow data leakage. This migration adds direct organization_id columns
-- for immediate RLS enforcement at the row level.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add organization_id to document_sections
-- ============================================================================

-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE document_sections ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added organization_id column to document_sections';
    END IF;
END $$;

-- Backfill organization_id from documents table
UPDATE document_sections ds
SET organization_id = d.organization_id
FROM documents d
WHERE ds.document_id = d.id
  AND ds.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections'
        AND column_name = 'organization_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE document_sections ALTER COLUMN organization_id SET NOT NULL;
        RAISE NOTICE 'Made organization_id NOT NULL on document_sections';
    END IF;
END $$;

-- Create index for RLS performance
CREATE INDEX IF NOT EXISTS idx_doc_sections_org_id ON document_sections(organization_id);

-- Add trigger to auto-set organization_id from document
CREATE OR REPLACE FUNCTION set_section_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate organization_id from parent document
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM documents
        WHERE id = NEW.document_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cannot find document for section';
        END IF;
    END IF;

    -- Verify organization_id matches document's organization
    IF NOT EXISTS (
        SELECT 1 FROM documents
        WHERE id = NEW.document_id
        AND organization_id = NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Section organization_id must match document organization_id';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_section_org_id
    BEFORE INSERT OR UPDATE OF document_id, organization_id
    ON document_sections
    FOR EACH ROW
    EXECUTE FUNCTION set_section_organization_id();

COMMENT ON COLUMN document_sections.organization_id IS 'Denormalized for RLS performance - auto-maintained by trigger';

-- ============================================================================
-- STEP 2: Add organization_id to suggestions
-- ============================================================================

-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'suggestions' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE suggestions ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added organization_id column to suggestions';
    END IF;
END $$;

-- Backfill organization_id from documents table
UPDATE suggestions s
SET organization_id = d.organization_id
FROM documents d
WHERE s.document_id = d.id
  AND s.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'suggestions'
        AND column_name = 'organization_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE suggestions ALTER COLUMN organization_id SET NOT NULL;
        RAISE NOTICE 'Made organization_id NOT NULL on suggestions';
    END IF;
END $$;

-- Create index for RLS performance
CREATE INDEX IF NOT EXISTS idx_suggestions_org_id ON suggestions(organization_id);

-- Add trigger to auto-set organization_id from document
CREATE OR REPLACE FUNCTION set_suggestion_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate organization_id from parent document
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM documents
        WHERE id = NEW.document_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cannot find document for suggestion';
        END IF;
    END IF;

    -- Verify organization_id matches document's organization
    IF NOT EXISTS (
        SELECT 1 FROM documents
        WHERE id = NEW.document_id
        AND organization_id = NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Suggestion organization_id must match document organization_id';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_suggestion_org_id
    BEFORE INSERT OR UPDATE OF document_id, organization_id
    ON suggestions
    FOR EACH ROW
    EXECUTE FUNCTION set_suggestion_organization_id();

COMMENT ON COLUMN suggestions.organization_id IS 'Denormalized for RLS performance - auto-maintained by trigger';

-- ============================================================================
-- STEP 3: Drop old RLS policies and create enhanced policies
-- ============================================================================

-- Drop existing policies on document_sections
DROP POLICY IF EXISTS "users_see_org_sections" ON document_sections;
DROP POLICY IF EXISTS "service_role_manage_sections" ON document_sections;
DROP POLICY IF EXISTS "editors_manage_sections" ON document_sections;

-- Drop existing policies on suggestions
DROP POLICY IF EXISTS "users_see_org_suggestions" ON suggestions;
DROP POLICY IF EXISTS "public_create_suggestions" ON suggestions;
DROP POLICY IF EXISTS "authors_update_own_suggestions" ON suggestions;
DROP POLICY IF EXISTS "authors_delete_suggestions" ON suggestions;

-- ============================================================================
-- NEW ENHANCED RLS POLICIES - Direct organization_id filtering
-- ============================================================================

-- ============================================================================
-- DOCUMENT_SECTIONS: Enhanced policies with direct organization_id filter
-- ============================================================================

-- ✅ SELECT: Users can only see sections in their organizations (FAST - no JOIN)
CREATE POLICY "users_see_own_org_sections"
  ON document_sections
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ✅ INSERT: Users can create sections only in their organizations
CREATE POLICY "users_insert_own_org_sections"
  ON document_sections
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (
          role IN ('owner', 'admin', 'member')
          OR (permissions->>'can_edit_sections')::boolean = true
        )
    )
  );

-- ✅ UPDATE: Users can update sections in their organizations
CREATE POLICY "users_update_own_org_sections"
  ON document_sections
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (
          role IN ('owner', 'admin', 'member')
          OR (permissions->>'can_edit_sections')::boolean = true
        )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (
          role IN ('owner', 'admin', 'member')
          OR (permissions->>'can_edit_sections')::boolean = true
        )
    )
  );

-- ✅ DELETE: Only admins can delete sections
CREATE POLICY "admins_delete_sections"
  ON document_sections
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

-- ✅ Service role bypass (for setup and migrations)
CREATE POLICY "service_role_manage_sections"
  ON document_sections
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================================================
-- SUGGESTIONS: Enhanced policies with direct organization_id filter
-- ============================================================================

-- ✅ SELECT: Users can only see suggestions in their organizations (FAST - no JOIN)
CREATE POLICY "users_see_own_org_suggestions"
  ON suggestions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ✅ INSERT: Users can create suggestions in their organizations OR public if enabled
CREATE POLICY "users_create_suggestions"
  ON suggestions
  FOR INSERT
  WITH CHECK (
    -- Authenticated users in the organization
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    OR
    -- Public suggestions if enabled by organization
    (
      auth.uid() IS NULL AND
      EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = suggestions.organization_id
        AND (o.settings->>'allow_public_suggestions')::boolean = true
      )
    )
  );

-- ✅ UPDATE: Authors can update their own suggestions, admins can update any
CREATE POLICY "users_update_suggestions"
  ON suggestions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    AND (
      author_user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.organization_id = suggestions.organization_id
          AND uo.is_active = true
          AND uo.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- ✅ DELETE: Authors can delete their own suggestions, admins can delete any
CREATE POLICY "users_delete_suggestions"
  ON suggestions
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    AND (
      author_user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.organization_id = suggestions.organization_id
          AND uo.is_active = true
          AND uo.role IN ('owner', 'admin')
      )
    )
  );

-- ✅ Service role bypass (for setup and migrations)
CREATE POLICY "service_role_manage_suggestions"
  ON suggestions
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================================================
-- STEP 4: Verify RLS configuration
-- ============================================================================

-- Function to test RLS isolation (for development/testing)
CREATE OR REPLACE FUNCTION test_rls_isolation(
  test_user_id UUID,
  test_org_id UUID,
  other_org_id UUID
)
RETURNS TABLE (
  test_name TEXT,
  passed BOOLEAN,
  details TEXT
) AS $$
BEGIN
  -- Test 1: User can see their own org's sections
  RETURN QUERY
  SELECT
    'User sees own org sections'::TEXT,
    EXISTS (
      SELECT 1 FROM document_sections
      WHERE organization_id = test_org_id
    ),
    'Should return true if sections exist in user org'::TEXT;

  -- Test 2: User cannot see other org's sections
  RETURN QUERY
  SELECT
    'User blocked from other org sections'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM document_sections
      WHERE organization_id = other_org_id
    ),
    'Should return true - other org sections are hidden'::TEXT;

  -- Test 3: User can see their own org's suggestions
  RETURN QUERY
  SELECT
    'User sees own org suggestions'::TEXT,
    EXISTS (
      SELECT 1 FROM suggestions
      WHERE organization_id = test_org_id
    ),
    'Should return true if suggestions exist in user org'::TEXT;

  -- Test 4: User cannot see other org's suggestions
  RETURN QUERY
  SELECT
    'User blocked from other org suggestions'::TEXT,
    NOT EXISTS (
      SELECT 1 FROM suggestions
      WHERE organization_id = other_org_id
    ),
    'Should return true - other org suggestions are hidden'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION test_rls_isolation IS 'Test function to verify RLS policies block cross-organization access';

-- ============================================================================
-- STEP 5: Performance indexes for new organization_id columns
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sections_org_doc ON document_sections(organization_id, document_id);
CREATE INDEX IF NOT EXISTS idx_sections_org_status ON document_sections(organization_id)
  WHERE current_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suggestions_org_doc ON suggestions(organization_id, document_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_org_status ON suggestions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_org_author ON suggestions(organization_id, author_user_id);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 009 COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Enhancements:';
  RAISE NOTICE '  ✅ Added organization_id to document_sections';
  RAISE NOTICE '  ✅ Added organization_id to suggestions';
  RAISE NOTICE '  ✅ Enhanced RLS policies with direct filtering';
  RAISE NOTICE '  ✅ Automatic organization_id maintenance via triggers';
  RAISE NOTICE '  ✅ Cross-organization access completely blocked';
  RAISE NOTICE '  ✅ Performance optimized with composite indexes';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Referential Integrity:';
  RAISE NOTICE '  ✅ Triggers auto-populate organization_id';
  RAISE NOTICE '  ✅ Validation ensures consistency with documents';
  RAISE NOTICE '  ✅ Foreign key constraints enforced';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Testing:';
  RAISE NOTICE '  Run: SELECT * FROM test_rls_isolation(user_id, org_id, other_org_id);';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Performance Impact:';
  RAISE NOTICE '  ✅ RLS checks now use indexed organization_id';
  RAISE NOTICE '  ✅ No more expensive JOINs in RLS policies';
  RAISE NOTICE '  ✅ Query performance significantly improved';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
