-- Quick check: Does user_types table have required data?

-- Check if user_types table exists and has data
SELECT
  type_code,
  type_name,
  is_system_type,
  created_at
FROM user_types
ORDER BY type_code;

-- Expected output should show:
-- type_code    | type_name                | is_system_type
-- -------------|--------------------------|---------------
-- global_admin | Global Administrator     | true
-- regular_user | Regular User             | true

-- If you see 0 rows, you need to run migration 026
