-- Test the EXACT query that's failing in setup.js

-- This is what the code is trying to do:
SELECT id, type_code, type_name
FROM user_types
WHERE type_code = 'regular_user';

-- Check if RLS is enabled on user_types
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'user_types';

-- Show all policies on user_types
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_types';

-- Check what's actually in the table
SELECT * FROM user_types;
