-- Migration 016: Fix Verification Function for INSERT Policies
-- The previous verification function only checked USING clause (qual)
-- but INSERT policies use WITH CHECK clause, so it showed null

-- Drop old verification function
DROP FUNCTION IF EXISTS verify_invitation_global_admin_policies();

-- Create corrected verification function that checks BOTH qual and with_check
CREATE OR REPLACE FUNCTION verify_invitation_global_admin_policies()
RETURNS TABLE(
  policy_name TEXT,
  policy_command TEXT,
  has_global_admin_check BOOLEAN,
  check_location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.policyname::TEXT,
    p.cmd::TEXT,
    CASE
      WHEN p.qual::TEXT LIKE '%is_global_admin%' THEN true
      WHEN p.with_check::TEXT LIKE '%is_global_admin%' THEN true
      ELSE false
    END AS has_global_admin_check,
    CASE
      WHEN p.qual::TEXT LIKE '%is_global_admin%' THEN 'USING clause'
      WHEN p.with_check::TEXT LIKE '%is_global_admin%' THEN 'WITH CHECK clause'
      ELSE 'NOT FOUND'
    END AS check_location
  FROM pg_policies p
  WHERE p.tablename = 'user_invitations'
  ORDER BY p.cmd, p.policyname;
END;
$$ LANGUAGE plpgsql;

-- Run verification with corrected function
SELECT * FROM verify_invitation_global_admin_policies();

-- Additional detailed check - show actual policy definitions
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN 'USING: ' || qual::TEXT
    ELSE 'USING: (none)'
  END as using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check::TEXT
    ELSE 'WITH CHECK: (none)'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'user_invitations'
ORDER BY cmd, policyname;

COMMENT ON FUNCTION verify_invitation_global_admin_policies() IS 'Verifies global admin bypass in both USING and WITH CHECK clauses';
