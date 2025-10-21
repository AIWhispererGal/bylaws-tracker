-- ============================================================
-- DIAGNOSTIC: Why Documents Aren't Loading on Dashboard
-- ============================================================
-- Run these queries to diagnose the issue

-- Step 1: Check if documents actually exist for the organization
SELECT
    d.id,
    d.title,
    d.organization_id,
    d.document_type,
    d.created_at,
    o.name as org_name
FROM documents d
JOIN organizations o ON d.organization_id = o.id
ORDER BY d.created_at DESC
LIMIT 10;

-- Step 2: Check sections for those documents
SELECT
    ds.id,
    ds.document_id,
    ds.section_number,
    ds.section_title,
    d.title as document_title
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
ORDER BY ds.created_at DESC
LIMIT 10;

-- Step 3: Check RLS policies on documents table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'documents'
ORDER BY policyname;

-- Step 4: Check if the specific user can see documents
-- Replace with actual user_id from session
DO $$
DECLARE
    v_user_id uuid := '7193f7ad-2f86-4e13-af61-102de9e208de'; -- REPLACE WITH ACTUAL USER ID
    v_org_id uuid;
    v_doc_count integer;
BEGIN
    -- Get user's organization
    SELECT organization_id INTO v_org_id
    FROM user_organizations
    WHERE user_id = v_user_id AND is_active = true
    LIMIT 1;

    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Organization ID: %', v_org_id;

    -- Count documents for that org
    SELECT COUNT(*) INTO v_doc_count
    FROM documents
    WHERE organization_id = v_org_id;

    RAISE NOTICE 'Documents for organization: %', v_doc_count;

    -- Show first few documents
    RAISE NOTICE 'First 3 documents:';
    FOR rec IN
        SELECT id, title, document_type, created_at
        FROM documents
        WHERE organization_id = v_org_id
        ORDER BY created_at DESC
        LIMIT 3
    LOOP
        RAISE NOTICE '  - % (ID: %, Type: %)', rec.title, rec.id, rec.document_type;
    END LOOP;
END $$;

-- Step 5: Test the exact query the API endpoint uses
-- This simulates what /api/dashboard/documents does
SELECT
    d.*,
    (
        SELECT COUNT(*)
        FROM document_sections ds
        WHERE ds.document_id = d.id
    ) as section_count,
    (
        SELECT COUNT(*)
        FROM suggestions s
        WHERE s.document_id = d.id AND s.status = 'open'
    ) as pending_suggestions
FROM documents d
WHERE d.organization_id = (
    SELECT organization_id
    FROM user_organizations
    WHERE user_id = '7193f7ad-2f86-4e13-af61-102de9e208de'
    AND is_active = true
    LIMIT 1
)
ORDER BY d.created_at DESC
LIMIT 50;

-- Step 6: Check if Supabase service role bypass is needed
-- Check auth.uid() function availability
SELECT current_user, session_user;
SELECT auth.uid(); -- This might fail if not using Supabase authenticated connection

-- ============================================================
-- EXPECTED RESULTS:
-- ============================================================
-- Step 1-2: Should show documents and sections exist
-- Step 3: Should show RLS policies (might be blocking)
-- Step 4: Should show user's org and document count
-- Step 5: Should return the same data API endpoint would return
-- Step 6: Shows if we're using service role or user context
