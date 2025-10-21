# RLS Testing Quick Start Guide

## Overview

This guide helps you verify multi-tenant data isolation for the 99 neighborhood councils platform.

## Test Files

1. **Test Suite**: `/database/tests/rls_isolation_test.sql`
   - 22 comprehensive security tests
   - Tests cross-tenant isolation
   - Validates CRUD permissions

2. **Test Report**: `/docs/reports/RLS_TEST_RESULTS.md`
   - Expected vs actual results
   - Vulnerability analysis
   - Remediation roadmap

## Quick Test Execution

### Option 1: Supabase Dashboard (Easiest)

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `/database/tests/rls_isolation_test.sql`
3. Click "Run"
4. Review output for ✅ PASS / ⚠️ FAIL / ❌ ERROR

### Option 2: Supabase CLI

```bash
# Navigate to project root
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# Run test suite
supabase db query < database/tests/rls_isolation_test.sql
```

### Option 3: Direct PostgreSQL

```bash
psql -h db.your-project.supabase.co \
     -U postgres \
     -d postgres \
     -f database/tests/rls_isolation_test.sql
```

## What the Tests Do

### 1. Create Test Data (Isolated Councils)
- **Test Council A**: 2 users, 1 document, 2 sections, 1 suggestion
- **Test Council B**: 2 users, 1 document, 2 sections, 1 suggestion

### 2. Run 7 Test Suites
- **Suite 1**: Organization visibility isolation
- **Suite 2**: Document access control
- **Suite 3**: Section-level segregation
- **Suite 4**: Suggestion privacy
- **Suite 5**: Anonymous setup wizard access
- **Suite 6**: CRUD permission validation
- **Suite 7**: Advanced attack vector testing

### 3. Report Results
- Displays RLS status for all tables
- Shows pass/fail for each test
- Provides remediation recommendations

## Interpreting Results

### ⚠️ Current Expected Output (RLS Disabled)

```
🔒 RLS Status Check:
================================
  ❌ organizations: RLS DISABLED
  ❌ documents: RLS DISABLED
  ❌ document_sections: RLS DISABLED
  ... (all disabled)
================================

🧪 TEST SUITE 1: Organization Isolation
========================================
  ✅ Test 1.1 PASSED: User A can see Council A
  ⚠️  Test 1.2 FAILED: User A can see Council B (RLS DISABLED!)
  ✅ Test 1.3 PASSED: User B can see Council B

... (mix of passes and warnings)

📊 RLS Status: DISABLED (on organizations table)

⚠️  CRITICAL SECURITY ISSUE:
   RLS is currently DISABLED on all tables!
   This means ANY user can see ALL organization data.
```

### ✅ Target Output (After RLS Re-enabled)

```
🔒 RLS Status Check:
================================
  ✅ organizations: RLS ENABLED
  ✅ documents: RLS ENABLED
  ✅ document_sections: RLS ENABLED
  ... (all enabled)
================================

🧪 TEST SUITE 1: Organization Isolation
========================================
  ✅ Test 1.1 PASSED: User A can see Council A
  ✅ Test 1.2 PASSED: User A cannot see Council B
  ✅ Test 1.3 PASSED: User B can see Council B

... (all tests passing)

📋 Test Results:
   Total Tests Run: 22
   ✅ Tests Passed: 22
   ❌ Tests Failed: 0

🎉 SECURITY VALIDATED: Multi-tenant isolation confirmed!
```

## When to Run These Tests

### ✅ Required:
1. **Before production deployment** (CRITICAL!)
2. **After enabling/modifying RLS policies**
3. **After schema changes to multi-tenant tables**
4. **During security audits**
5. **In CI/CD pipeline (automated)**

### 🟡 Recommended:
1. **Weekly during development**
2. **Before major releases**
3. **After Supabase updates**
4. **When adding new organizations**

### ⚪ Optional:
1. **Single-tenant deployments** (no multi-tenancy)
2. **Trusted internal tools** (all users have full access)
3. **Development environments** (test data only)

## Cleanup

The test suite leaves test data in place for inspection. To clean up:

```sql
-- Run this in Supabase SQL Editor
DELETE FROM user_organizations WHERE organization_id IN (
  SELECT id FROM organizations WHERE slug IN ('test-council-a', 'test-council-b')
);

DELETE FROM documents WHERE organization_id IN (
  SELECT id FROM organizations WHERE slug IN ('test-council-a', 'test-council-b')
);

DELETE FROM organizations WHERE slug IN ('test-council-a', 'test-council-b');

DELETE FROM users WHERE email IN (
  'user-a@test.com',
  'user-b@test.com',
  'admin-a@test.com',
  'admin-b@test.com'
);
```

## Next Steps

1. **Review Test Results**: See `/docs/reports/RLS_TEST_RESULTS.md`
2. **Enable RLS**: Create `/database/migrations/005_enable_rls_properly.sql`
3. **Re-test**: Run test suite again to verify all tests pass
4. **Document**: Update security documentation with RLS policies

## Troubleshooting

### "Tests are failing with RLS enabled"

**Possible causes**:
- JWT claims not properly set (`auth.uid()` is NULL)
- RLS policies are too restrictive
- Recursive policy dependencies
- Missing user_organizations entries

**Solutions**:
1. Check Supabase Auth configuration
2. Review RLS policy logic for recursion
3. Ensure test users have proper organization memberships
4. Use service role key for backend operations

### "Tests pass but app doesn't work"

**Possible causes**:
- Test environment differs from production
- Application not sending JWT properly
- Service role key used in app (bypasses RLS)
- Client-side filtering masking RLS issues

**Solutions**:
1. Test with actual JWT tokens from auth
2. Verify anon key vs service role key usage
3. Test RLS policies with `auth.uid()` from real users
4. Review application-level security layers

## Security Checklist

Before deploying to production with 99 councils:

- [ ] RLS enabled on all multi-tenant tables
- [ ] All 22 tests passing
- [ ] Non-recursive RLS policies implemented
- [ ] Supabase Auth properly configured
- [ ] Service role key secured (not in client code)
- [ ] Setup wizard authentication flow documented
- [ ] Regular RLS testing in CI/CD pipeline
- [ ] Security team has reviewed policies
- [ ] Incident response plan for data breaches
- [ ] Monitoring/alerting for RLS policy violations

## Support

For questions or issues:
1. Review `/docs/reports/RLS_TEST_RESULTS.md` for detailed analysis
2. Check Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
3. Review schema: `/database/migrations/001_generalized_schema.sql`
4. Check RLS fix history: `/database/migrations/004_fix_rls_recursion.sql`

---

**Last Updated**: 2025-10-12
**Version**: 1.0.0
**Status**: 🔴 RLS Currently Disabled (Action Required)
