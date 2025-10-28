-- ============================================
-- DATABASE DIAGNOSTIC: Organizations Table
-- ============================================
-- Purpose: Investigate is_configured state and org data
-- Date: 2025-10-27
-- ============================================

-- 1. Show ALL organizations with full details
SELECT
    id,
    name,
    is_configured,
    created_at,
    updated_at,
    CASE
        WHEN is_configured THEN '✓ CONFIGURED'
        ELSE '✗ NOT CONFIGURED'
    END as config_status
FROM organizations
ORDER BY created_at DESC;

-- 2. Count configured vs unconfigured
SELECT
    is_configured,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM organizations
GROUP BY is_configured
ORDER BY is_configured DESC;

-- 3. Total organizations count
SELECT
    COUNT(*) as total_organizations,
    COUNT(CASE WHEN is_configured = true THEN 1 END) as configured_count,
    COUNT(CASE WHEN is_configured = false THEN 1 END) as unconfigured_count
FROM organizations;

-- 4. Check if ANY configured orgs exist
SELECT
    EXISTS(
        SELECT 1 FROM organizations WHERE is_configured = true
    ) as has_configured_orgs;

-- 5. Most recently created organization
SELECT
    id,
    name,
    is_configured,
    created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 1;

-- 6. Organizations created today
SELECT
    id,
    name,
    is_configured,
    created_at
FROM organizations
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- 7. Check for NULL is_configured values (should not exist with DEFAULT false)
SELECT
    COUNT(*) as null_is_configured_count
FROM organizations
WHERE is_configured IS NULL;

-- ============================================
-- HYPOTHESIS TESTING QUERIES
-- ============================================

-- Hypothesis 1: All orgs have is_configured=false
SELECT
    CASE
        WHEN COUNT(*) = COUNT(CASE WHEN is_configured = false THEN 1 END)
        THEN 'CONFIRMED: All orgs are is_configured=false'
        ELSE 'REJECTED: Some orgs have is_configured=true'
    END as hypothesis_1
FROM organizations
WHERE id IS NOT NULL; -- ensure we have orgs

-- Hypothesis 2: No configured orgs exist
SELECT
    CASE
        WHEN NOT EXISTS(SELECT 1 FROM organizations WHERE is_configured = true)
        THEN 'CONFIRMED: Zero configured organizations exist'
        ELSE 'REJECTED: At least one configured org exists'
    END as hypothesis_2;

-- Hypothesis 3: Default value is working correctly for new orgs
SELECT
    id,
    name,
    is_configured,
    CASE
        WHEN is_configured = false THEN 'DEFAULT WORKING'
        WHEN is_configured = true THEN 'MANUALLY SET TO TRUE'
        ELSE 'NULL VALUE (BUG)'
    END as default_status
FROM organizations
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- RECOMMENDED FIX QUERY (IF NEEDED)
-- ============================================
-- If you need to manually configure a test org:
-- UPDATE organizations
-- SET is_configured = true
-- WHERE id = '<your-org-id>';
