-- Migration 006: Create RPC Functions for Permissions System
-- Creates the database functions needed by src/middleware/permissions.js

-- ============================================================================
-- DROP existing functions first (if they exist with different signatures)
-- ============================================================================
DROP FUNCTION IF EXISTS user_has_org_permission(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS user_has_global_permission(UUID, TEXT);
DROP FUNCTION IF EXISTS user_has_min_role_level(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_user_effective_permissions(UUID, UUID);

-- ============================================================================
-- Function 1: user_has_org_permission
-- Check if a user has a specific permission in an organization
-- ============================================================================
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

-- ============================================================================
-- Function 2: user_has_global_permission
-- Check if a user has a specific global permission
-- ============================================================================
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

-- ============================================================================
-- Function 3: user_has_min_role_level
-- Check if user has minimum role level in organization
-- (Lower hierarchy_level = higher privilege)
-- ============================================================================
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

-- ============================================================================
-- Function 4: get_user_effective_permissions
-- Get merged global + organization permissions for a user
-- ============================================================================
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
-- Grant execute permissions to authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION user_has_org_permission(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_global_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_min_role_level(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_effective_permissions(UUID, UUID) TO authenticated;

-- Also grant to service role for backend usage
GRANT EXECUTE ON FUNCTION user_has_org_permission(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION user_has_global_permission(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION user_has_min_role_level(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_effective_permissions(UUID, UUID) TO service_role;

COMMENT ON FUNCTION user_has_org_permission IS 'Check if user has specific organization permission';
COMMENT ON FUNCTION user_has_global_permission IS 'Check if user has specific global permission';
COMMENT ON FUNCTION user_has_min_role_level IS 'Check if user meets minimum role level (lower=higher privilege)';
COMMENT ON FUNCTION get_user_effective_permissions IS 'Get merged global and organization permissions';
