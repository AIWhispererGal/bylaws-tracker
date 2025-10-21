-- Migration 026: Seed User Types (SIMPLIFIED)
-- Purpose: Add required user types for setup wizard
-- THIS MUST RUN BEFORE SETUP

-- Insert user types (will not fail if they already exist)
INSERT INTO user_types (
  type_code,
  type_name,
  description,
  global_permissions,
  is_system_type
) VALUES
  (
    'global_admin',
    'Global Administrator',
    'Platform-wide administrator',
    '{"can_create_organizations": true, "can_manage_all_organizations": true}'::jsonb,
    true
  ),
  (
    'regular_user',
    'Regular User',
    'Standard user',
    '{"can_create_organizations": true, "can_manage_all_organizations": false}'::jsonb,
    true
  )
ON CONFLICT (type_code) DO NOTHING;

-- Verify they were inserted
SELECT
  type_code,
  type_name,
  is_system_type
FROM user_types
WHERE type_code IN ('global_admin', 'regular_user')
ORDER BY type_code;

-- Show count
SELECT COUNT(*) as user_type_count FROM user_types;
