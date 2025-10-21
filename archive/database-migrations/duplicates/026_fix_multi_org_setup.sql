-- Migration 026: Fix Multi-Organization Support
-- Purpose: Ensure user_types table has required entries
-- This supports: Users creating multiple organizations
-- Created: 2025-10-20

-- =============================================================================
-- PART 1: Seed User Types (if not already present)
-- =============================================================================

-- Insert user types if they don't exist
INSERT INTO user_types (
  type_code,
  type_name,
  description,
  global_permissions,
  is_system_type
) VALUES
  -- Global Admin (first org creator, platform admin)
  (
    'global_admin',
    'Global Administrator',
    'Platform-wide administrator with access to all organizations',
    '{
      "can_create_organizations": true,
      "can_manage_all_organizations": true,
      "can_view_system_settings": true,
      "can_manage_global_settings": true
    }'::jsonb,
    true
  ),

  -- Regular User (default for all users)
  (
    'regular_user',
    'Regular User',
    'Standard user with access to assigned organizations',
    '{
      "can_create_organizations": true,
      "can_manage_all_organizations": false,
      "can_view_system_settings": false,
      "can_manage_global_settings": false
    }'::jsonb,
    true
  )

ON CONFLICT (type_code) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  global_permissions = EXCLUDED.global_permissions,
  is_system_type = EXCLUDED.is_system_type,
  updated_at = now();

-- =============================================================================
-- PART 2: Verification
-- =============================================================================

-- Verify user types exist
DO $$
DECLARE
  type_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO type_count FROM user_types WHERE is_system_type = true;

  IF type_count < 2 THEN
    RAISE EXCEPTION 'Expected 2 user types, found %', type_count;
  END IF;

  RAISE NOTICE '✅ User types verified: % system types', type_count;
END $$;

-- Display user types
SELECT
  type_code,
  type_name,
  (global_permissions->>'can_create_organizations')::boolean as can_create_orgs,
  is_system_type
FROM user_types
ORDER BY type_code;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
