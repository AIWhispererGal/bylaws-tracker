-- Migration 010: Fix First User Admin Status
-- Make the first user of each organization an 'owner' (with admin privileges)
-- This should have been automatic but wasn't in early setups

BEGIN;

-- Update the first user (by joined_at) of each organization to be 'owner'
WITH first_users AS (
  SELECT DISTINCT ON (organization_id)
    user_id,
    organization_id
  FROM user_organizations
  WHERE is_active = true
  ORDER BY organization_id, joined_at ASC
)
UPDATE user_organizations uo
SET
  role = 'owner',
  is_admin = true,
  updated_at = NOW()
FROM first_users fu
WHERE uo.user_id = fu.user_id
  AND uo.organization_id = fu.organization_id
  AND uo.role NOT IN ('owner'); -- Don't override if already owner

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % users to owner role', updated_count;
END $$;

COMMIT;

-- Verify the changes
SELECT
  o.name as organization_name,
  u.email as user_email,
  uo.role,
  uo.is_admin,
  uo.joined_at
FROM user_organizations uo
JOIN organizations o ON o.id = uo.organization_id
JOIN users u ON u.id = uo.user_id
WHERE uo.role = 'owner'
ORDER BY o.name, uo.joined_at;
