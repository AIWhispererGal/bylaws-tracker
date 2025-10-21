-- Diagnostic Script: Find the Status Column Error
-- Date: 2025-10-14
-- Purpose: Determine exactly where "column status does not exist" error is occurring

-- ============================================================================
-- STEP 1: VERIFY ALL WORKFLOW TABLES EXIST AND HAVE STATUS COLUMNS
-- ============================================================================

-- Check section_workflow_states (we know this one has status)
SELECT 'section_workflow_states' AS table_name,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'section_workflow_states' AND column_name = 'status'
       ) THEN '✅ HAS status column' ELSE '❌ MISSING status column' END AS status_column;

-- Check if there are other workflow-related tables that might need a status column
SELECT table_name,
       string_agg(column_name, ', ') AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE '%workflow%'
GROUP BY table_name
ORDER BY table_name;

-- ============================================================================
-- STEP 2: CHECK IF DOCUMENT_WORKFLOWS TABLE EXISTS AND HAS STATUS
-- ============================================================================

-- This might be the culprit!
SELECT 'document_workflows' AS table_name,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_name = 'document_workflows'
       ) THEN '✅ Table exists' ELSE '❌ Table missing' END AS table_exists,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'document_workflows' AND column_name = 'status'
       ) THEN '✅ HAS status column' ELSE '❌ MISSING status column' END AS status_column;

-- Show document_workflows columns if it exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_workflows'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 3: RUN MIGRATION 012 LINE BY LINE TO FIND THE ERROR
-- ============================================================================

-- Test 1: Create is_global_admin function
DROP FUNCTION IF EXISTS is_global_admin(UUID);
CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_organizations
        WHERE user_id = p_user_id
        AND is_global_admin = TRUE
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ Test 1 passed: is_global_admin function created' AS result;

-- Test 2: Drop and recreate user_can_approve_stage
DROP FUNCTION IF EXISTS user_can_approve_stage(UUID, UUID);
-- Don't create it yet, just test the drop

SELECT '✅ Test 2 passed: user_can_approve_stage function dropped' AS result;

-- Test 3: Try to create get_section_workflow_stage (THIS MIGHT FAIL)
-- This is the first function that references sws.status
DROP FUNCTION IF EXISTS get_section_workflow_stage(UUID);

-- Try creating it - THIS IS WHERE THE ERROR LIKELY OCCURS
CREATE OR REPLACE FUNCTION get_section_workflow_stage(
    p_section_id UUID
) RETURNS TABLE (
    stage_id UUID,
    stage_name TEXT,
    stage_order INT,
    can_lock BOOLEAN,
    can_approve BOOLEAN,
    status TEXT,
    actioned_by UUID,
    actioned_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.id,
        ws.stage_name,
        ws.stage_order,
        ws.can_lock,
        ws.can_approve,
        sws.status,  -- THIS LINE MIGHT CAUSE THE ERROR
        sws.actioned_by,
        sws.actioned_at
    FROM section_workflow_states sws
    JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
    WHERE sws.section_id = p_section_id
    ORDER BY sws.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ Test 3 passed: get_section_workflow_stage function created' AS result;

-- ============================================================================
-- STEP 4: CHECK SEARCH_PATH AND SCHEMA
-- ============================================================================

-- Show current search_path
SHOW search_path;

-- Check which schema section_workflow_states is in
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename = 'section_workflow_states';

-- Check if there are multiple tables with the same name in different schemas
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename LIKE '%workflow%'
ORDER BY schemaname, tablename;

-- ============================================================================
-- RESULTS INTERPRETATION
-- ============================================================================
-- If Test 3 fails with "column status does not exist", the issue is likely:
-- 1. Schema problem: table is in different schema than expected
-- 2. SECURITY DEFINER context: function can't see the column due to search_path
-- 3. RLS policy blocking access
--
-- If Test 3 passes, the error is happening later in migration 012
-- ============================================================================
