-- Quick Fix: Mark existing organization as configured
-- Run this in Supabase SQL Editor to fix the setup redirect

-- Update your organization to mark it as configured
UPDATE organizations
SET
  is_configured = true,
  updated_at = NOW()
WHERE is_configured = false
  OR is_configured IS NULL;

-- Verify the fix
SELECT
  id,
  name,
  is_configured,
  created_at,
  updated_at
FROM organizations;

-- Expected result: is_configured should be TRUE
