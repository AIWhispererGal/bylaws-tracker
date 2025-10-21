-- ============================================================================
-- MIGRATION 007: Create Global Superuser Support
-- Date: 2025-10-12
-- Purpose: Enable a superuser who can access ALL organizations
-- ============================================================================

-- STEP 1: Add is_global_admin flag to user_organizations
-- ============================================================================
ALTER TABLE user_organizations
ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_orgs_global_admin
ON user_organizations(user_id)
WHERE is_global_admin = true;

COMMENT ON COLUMN user_organizations.is_global_admin IS
  'Global admin can access ALL organizations, not just this one';

-- ============================================================================
-- STEP 2: Create helper function to check if user is global admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_organizations
    WHERE user_id = p_user_id
      AND is_global_admin = true
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_global_admin IS
  'Returns true if user has global admin privileges';

-- ============================================================================
-- STEP 3: Update RLS policies to allow global admin access
-- ============================================================================

-- Documents: Allow global admins to see all documents
DROP POLICY IF EXISTS "global_admin_see_all_documents" ON documents;
CREATE POLICY "global_admin_see_all_documents"
  ON documents
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

DROP POLICY IF EXISTS "global_admin_manage_all_documents" ON documents;
CREATE POLICY "global_admin_manage_all_documents"
  ON documents
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

-- Document Sections: Allow global admins to see all sections
DROP POLICY IF EXISTS "global_admin_see_all_sections" ON document_sections;
CREATE POLICY "global_admin_see_all_sections"
  ON document_sections
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

DROP POLICY IF EXISTS "global_admin_manage_all_sections" ON document_sections;
CREATE POLICY "global_admin_manage_all_sections"
  ON document_sections
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

-- Organizations: Allow global admins to see and manage all organizations
DROP POLICY IF EXISTS "global_admin_see_all_organizations" ON organizations;
CREATE POLICY "global_admin_see_all_organizations"
  ON organizations
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

DROP POLICY IF EXISTS "global_admin_manage_all_organizations" ON organizations;
CREATE POLICY "global_admin_manage_all_organizations"
  ON organizations
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

-- ============================================================================
-- STEP 4: Create function to link user to all existing organizations
-- ============================================================================

CREATE OR REPLACE FUNCTION link_global_admin_to_all_orgs(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_org_record RECORD;
  v_linked_count INTEGER := 0;
BEGIN
  -- Loop through all organizations
  FOR v_org_record IN
    SELECT id, name FROM organizations
  LOOP
    -- Link user to organization with superuser role
    INSERT INTO user_organizations (
      user_id,
      organization_id,
      role,
      is_global_admin,
      permissions,
      created_at
    )
    VALUES (
      p_user_id,
      v_org_record.id,
      'superuser',
      true,
      '{
        "can_edit_sections": true,
        "can_create_suggestions": true,
        "can_vote": true,
        "can_approve_stages": ["all"],
        "can_manage_users": true,
        "can_manage_workflows": true,
        "is_superuser": true,
        "is_global_admin": true
      }'::jsonb,
      NOW()
    )
    ON CONFLICT (user_id, organization_id) DO UPDATE
    SET role = 'superuser',
        is_global_admin = true,
        permissions = EXCLUDED.permissions,
        updated_at = NOW();

    v_linked_count := v_linked_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'organizations_linked', v_linked_count,
    'message', format('User linked to %s organization(s) as global admin', v_linked_count)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION link_global_admin_to_all_orgs IS
  'Links a user to ALL organizations with global admin privileges';

-- ============================================================================
-- STEP 5: Verification and usage instructions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 007 COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🌍 Global Superuser Features:';
  RAISE NOTICE '  ✅ is_global_admin column added';
  RAISE NOTICE '  ✅ RLS policies allow global admin access';
  RAISE NOTICE '  ✅ Helper function is_global_admin() created';
  RAISE NOTICE '  ✅ Function to link admin to all orgs created';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Usage After Setup Wizard:';
  RAISE NOTICE '';
  RAISE NOTICE '  1. Complete setup wizard normally';
  RAISE NOTICE '  2. Get your auth user ID from Supabase Auth UI';
  RAISE NOTICE '  3. Run this SQL:';
  RAISE NOTICE '';
  RAISE NOTICE '     SELECT link_global_admin_to_all_orgs(';
  RAISE NOTICE '       ''YOUR-AUTH-USER-ID''::uuid';
  RAISE NOTICE '     );';
  RAISE NOTICE '';
  RAISE NOTICE '  This will:';
  RAISE NOTICE '    - Link you to ALL existing organizations';
  RAISE NOTICE '    - Grant global admin privileges';
  RAISE NOTICE '    - Allow access to all org data';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Check Global Admin Status:';
  RAISE NOTICE '';
  RAISE NOTICE '  SELECT * FROM user_organizations';
  RAISE NOTICE '  WHERE is_global_admin = true;';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
