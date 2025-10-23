-- Migration 006: Fix Permission RPC Functions
-- Drops ALL existing overloads and creates the correct ones

-- ============================================================================
-- Step 1: Find and drop ALL existing function overloads
-- ============================================================================

-- Drop user_has_org_permission (all signatures)
DO $$
DECLARE
    func_signature TEXT;
BEGIN
    FOR func_signature IN
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'user_has_org_permission'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS user_has_org_permission(%s) CASCADE', func_signature);
    END LOOP;
END $$;

-- Drop user_has_global_permission (all signatures)
DO $$
DECLARE
    func_signature TEXT;
BEGIN
    FOR func_signature IN
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'user_has_global_permission'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS user_has_global_permission(%s) CASCADE', func_signature);
    END LOOP;
END $$;

-- Drop user_has_min_role_level (all signatures)
DO $$
DECLARE
    func_signature TEXT;
BEGIN
    FOR func_signature IN
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'user_has_min_role_level'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS user_has_min_role_level(%s) CASCADE', func_signature);
    END LOOP;
END $$;

-- Drop get_user_effective_permissions (all signatures)
DO $$
DECLARE
    func_signature TEXT;
BEGIN
    FOR func_signature IN
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'get_user_effective_permissions'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS get_user_effective_permissions(%s) CASCADE', func_signature);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Create the correct function signatures
-- ============================================================================

-- Function 1: user_has_org_permission
CREATE FUNCTION user_has_org_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission BOOLEAN := FALSE;
  v_org_permissions JSONB;
BEGIN
  -- Get user's organization role permissions
  SELECT or_table.org_permissions INTO v_org_permissions
  FROM user_organizations uo
  INNER JOIN organization_roles or_table ON uo.org_role_id = or_table.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE
  LIMIT 1;

  -- If no role found, return false
  IF v_org_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if permission exists and is true
  -- Special handling for "all" in can_approve_stages array
  IF p_permission = 'can_approve_stages' THEN
    v_has_permission := (
      v_org_permissions->>'can_approve_stages' = '["all"]' OR
      v_org_permissions->'can_approve_stages' ? 'all'
    );
  ELSE
    v_has_permission := COALESCE((v_org_permissions->>p_permission)::BOOLEAN, FALSE);
  END IF;

  RETURN v_has_permission;
END;
$$;

-- Function 2: user_has_global_permission
CREATE FUNCTION user_has_global_permission(
  p_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission BOOLEAN := FALSE;
  v_global_permissions JSONB;
BEGIN
  -- Get user's global permissions from user_types
  SELECT ut.global_permissions INTO v_global_permissions
  FROM users u
  INNER JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = p_user_id
  LIMIT 1;

  -- If no global permissions found, return false
  IF v_global_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if permission exists and is true
  v_has_permission := COALESCE((v_global_permissions->>p_permission)::BOOLEAN, FALSE);

  RETURN v_has_permission;
END;
$$;

-- Function 3: user_has_min_role_level
CREATE FUNCTION user_has_min_role_level(
  p_user_id UUID,
  p_organization_id UUID,
  p_min_level INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_level INTEGER;
BEGIN
  -- Get user's hierarchy level in the organization
  SELECT or_table.hierarchy_level INTO v_user_level
  FROM user_organizations uo
  INNER JOIN organization_roles or_table ON uo.org_role_id = or_table.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE
  LIMIT 1;

  -- If no role found, return false
  IF v_user_level IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Lower number = higher privilege, so check if user_level <= min_level
  RETURN v_user_level <= p_min_level;
END;
$$;

-- Function 4: get_user_effective_permissions
CREATE FUNCTION get_user_effective_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_global_permissions JSONB;
  v_org_permissions JSONB;
  v_effective_permissions JSONB := '{}'::JSONB;
BEGIN
  -- Get global permissions
  SELECT ut.global_permissions INTO v_global_permissions
  FROM users u
  INNER JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = p_user_id
  LIMIT 1;

  -- Get organization permissions
  SELECT or_table.org_permissions INTO v_org_permissions
  FROM user_organizations uo
  INNER JOIN organization_roles or_table ON uo.org_role_id = or_table.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE
  LIMIT 1;

  -- Merge permissions (org permissions take precedence)
  v_effective_permissions := COALESCE(v_global_permissions, '{}'::JSONB) || COALESCE(v_org_permissions, '{}'::JSONB);

  RETURN v_effective_permissions;
END;
$$;

-- ============================================================================
-- Step 3: Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION user_has_org_permission(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_global_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_min_role_level(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_effective_permissions(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION user_has_org_permission(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION user_has_global_permission(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION user_has_min_role_level(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_effective_permissions(UUID, UUID) TO service_role;

-- Add comments
COMMENT ON FUNCTION user_has_org_permission IS 'Check if user has specific organization permission';
COMMENT ON FUNCTION user_has_global_permission IS 'Check if user has specific global permission';
COMMENT ON FUNCTION user_has_min_role_level IS 'Check if user meets minimum role level (lower=higher privilege)';
COMMENT ON FUNCTION get_user_effective_permissions IS 'Get merged global and organization permissions';

-- Verification: Check that functions were created
SELECT
  proname as function_name,
  pronargs as num_args
FROM pg_proc
WHERE proname IN ('user_has_org_permission', 'user_has_global_permission', 'user_has_min_role_level', 'get_user_effective_permissions')
ORDER BY proname;
