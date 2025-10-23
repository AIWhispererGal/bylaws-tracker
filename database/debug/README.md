# Database Debugging Tools

This directory contains diagnostic and repair scripts for troubleshooting organization visibility issues after RLS policy changes.

---

## Quick Start (3 Steps)

### 1. Run Quick Diagnosis (30 seconds)
```bash
psql [YOUR_DATABASE_URL] -f quick_diagnosis.sql
```
**Output:** Identifies exact problem and generates fix SQL

### 2. Apply Emergency Fix (if needed)
```bash
psql [YOUR_DATABASE_URL] -f emergency_fix_user_assignment.sql
```
**Output:** Automatically fixes missing user assignments

### 3. Test from User Perspective
```bash
# Run with user JWT token (not service role)
psql [YOUR_DATABASE_URL] -f test_user_context.sql
```
**Output:** Verifies RLS policies work correctly

---

## Files Overview

| File | Purpose | Run As | Duration |
|------|---------|--------|----------|
| `quick_diagnosis.sql` | Fast problem identification | Service Role | 30 sec |
| `emergency_fix_user_assignment.sql` | Auto-fix user assignment | Service Role | 10 sec |
| `test_user_context.sql` | Test RLS from user view | User JWT | 20 sec |
| `diagnose_org_visibility.sql` | Comprehensive analysis | Service Role | 2 min |
| `DIAGNOSTIC_REPORT.md` | Full investigation report | Read Only | N/A |
| `README.md` | This file | Read Only | N/A |

---

## Detailed File Descriptions

### `quick_diagnosis.sql` ⚡ (RECOMMENDED START HERE)

**Purpose:** Rapid triage to identify exact problem in 6 automated steps

**What it checks:**
1. ✅ User exists in auth.users
2. ✅ User exists in public.users
3. ✅ User_organizations assignments exist
4. ✅ Organization 5bc79ee9-ac8d-4638-864c-3e05d4e60810 exists
5. ✅ User is assigned to organization
6. ✅ Assignment is active

**Output:**
- Clear diagnosis message (e.g., "❌ NO USER ASSIGNMENTS to organization")
- Recommended fix with exact SQL
- Ready-to-run INSERT statement

**Run as:** Service Role (bypasses RLS to see all data)

**Example:**
```bash
# Supabase CLI
supabase db execute -f database/debug/quick_diagnosis.sql

# Direct psql
psql postgresql://postgres:[PASSWORD]@[HOST]/postgres -f database/debug/quick_diagnosis.sql
```

---

### `emergency_fix_user_assignment.sql` 🚑

**Purpose:** Automatically assign latest user to organization

**What it does:**
1. Safety checks (org exists, user exists)
2. Checks if user already assigned
3. Creates assignment if missing
4. Activates assignment if inactive
5. Verifies fix was successful

**Safety Features:**
- Won't create duplicate assignments
- Validates organization exists
- Validates user exists
- Shows before/after state

**Run as:** Service Role

**Example:**
```bash
supabase db execute -f database/debug/emergency_fix_user_assignment.sql
```

---

### `test_user_context.sql` 🔐

**Purpose:** Test RLS policies from an authenticated user's perspective

**What it tests:**
1. auth.uid() returns valid user ID
2. JWT role is 'authenticated'
3. User can query user_organizations table
4. User can see organizations via join
5. User can see specific organization (5bc79ee9...)
6. is_org_admin() helper function works
7. Overall system health

**IMPORTANT:** Must run with **user JWT token**, not service role!

**How to run with user context:**

#### Option 1: Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Paste script contents
3. Select "Run as: Authenticated user" (not service role)
4. Provide JWT token from logged-in user

#### Option 2: psql with JWT
```bash
# Set JWT as environment variable
export SUPABASE_JWT="eyJhbGc..."

# Run with JWT in connection string
psql "postgresql://postgres:[PASSWORD]@[HOST]/postgres?options=-c%20jwt.claims.role=authenticated" \
  -f database/debug/test_user_context.sql
```

---

### `diagnose_org_visibility.sql` 🔍

**Purpose:** Comprehensive diagnostic covering all aspects of authentication and RLS

**Sections (10 total):**
1. Authentication Context - Current user and JWT info
2. User Data Inspection - All users in auth + public tables
3. Organization Data - All organizations
4. User-Organization Assignments - All assignments
5. RLS Policy Verification - Policy status and definitions
6. Simulate User Queries - Test queries with auth.uid()
7. Test Specific User - Template for user-specific testing
8. Common Issues Checklist - Known problems
9. Recommended Fixes - SQL fix templates
10. Manual Test Queries - Interactive testing

**Use when:**
- Quick diagnosis didn't identify the problem
- Need deep investigation
- Want comprehensive system health check

**Run as:** Service Role

**Example:**
```bash
psql [DATABASE_URL] -f database/debug/diagnose_org_visibility.sql > diagnosis_output.txt
```

---

### `DIAGNOSTIC_REPORT.md` 📋

**Purpose:** Complete investigation report with findings and analysis

**Contents:**
- Executive summary
- Investigation findings
- Code analysis (auth.js login flow)
- RLS policy status
- Known facts
- Problem likelihood ranking
- Recommended action plan
- Critical questions to answer

**Read this to understand:**
- Why user can't see organizations
- How login flow works
- What RLS policies do
- Most likely root causes
- How to fix each problem

---

## Common Scenarios

### Scenario 1: User can't see organization after login

**Symptoms:**
- User logs in successfully
- No errors in console
- Dashboard shows "no organizations in database"

**Solution:**
```bash
# 1. Diagnose
psql [DB_URL] -f quick_diagnosis.sql

# 2. Fix (if diagnosis shows missing assignment)
psql [DB_URL] -f emergency_fix_user_assignment.sql

# 3. Verify
psql [DB_URL] -f test_user_context.sql
```

### Scenario 2: RLS policies causing errors

**Symptoms:**
- "Infinite recursion detected in policy" error
- 500 errors when querying organizations
- Console shows RLS-related errors

**Solution:**
```bash
# 1. Check RLS policy status
psql [DB_URL] -f diagnose_org_visibility.sql | grep -A 20 "RLS POLICY"

# 2. Verify migration 005 was applied
psql [DB_URL] -c "SELECT * FROM pg_policies WHERE tablename = 'user_organizations';"

# 3. If needed, re-run migration 005
psql [DB_URL] -f database/migrations/005_fix_rls_recursion_safe.sql
```

### Scenario 3: User exists but assignments are inactive

**Symptoms:**
- User exists in database
- user_organizations record exists
- is_active = false

**Solution:**
```bash
# Emergency fix will detect and activate inactive assignments
psql [DB_URL] -f emergency_fix_user_assignment.sql
```

### Scenario 4: Multiple users, need to assign specific one

**Symptoms:**
- Need to assign a specific user (not latest)
- Multiple users in system

**Solution:**
```sql
-- 1. Find the user ID
SELECT id, email FROM auth.users;

-- 2. Manually assign (replace USER_ID)
INSERT INTO user_organizations (user_id, organization_id, role, is_active)
VALUES (
  'USER_ID_HERE',
  '5bc79ee9-ac8d-4638-864c-3e05d4e60810',
  'owner',
  true
);
```

---

## Troubleshooting

### Problem: "permission denied for table user_organizations"

**Cause:** Running as anonymous user instead of service role

**Fix:** Ensure you're using service role credentials:
```bash
# Check your connection string includes service role key
psql "postgresql://postgres:[SERVICE_ROLE_KEY]@[HOST]/postgres" -f script.sql
```

### Problem: "auth.uid() returns NULL"

**Cause:** Not authenticated or running with service role

**Fix:** Use user JWT token for `test_user_context.sql`:
1. Get JWT from logged-in user (browser localStorage)
2. Run query with authenticated context
3. Or run via Supabase Dashboard with "Authenticated user" option

### Problem: "Organization not found"

**Cause:** Organization ID is incorrect

**Fix:** Check actual organization ID:
```sql
SELECT id, name FROM organizations ORDER BY created_at DESC;
```

Update scripts with correct organization ID.

### Problem: Scripts hang or timeout

**Cause:** Database connection issue

**Fix:**
1. Check connection string is correct
2. Verify database is accessible
3. Check firewall rules
4. Increase timeout: `psql -c "SET statement_timeout = '60s';" ...`

---

## Expected Output Examples

### Quick Diagnosis - Success
```
STEP 5: PROBLEM IDENTIFICATION
✓ ALL TESTS PASSED - User should be able to see their organizations

STEP 6: READY-TO-RUN FIX
No fix needed - everything is working correctly
```

### Quick Diagnosis - Missing Assignment
```
STEP 5: PROBLEM IDENTIFICATION
❌ PROBLEM: User has no organization memberships - need to assign user to org

STEP 6: READY-TO-RUN FIX
INSERT INTO user_organizations (user_id, organization_id, role, is_active, joined_at)
VALUES ('abc-123...', '5bc79ee9-ac8d-4638-864c-3e05d4e60810', 'owner', true, NOW());
```

### Emergency Fix - Success
```
✓ Organization exists: 5bc79ee9-ac8d-4638-864c-3e05d4e60810
✓ Found user ID: abc-123-def-456
Creating user_organization assignment...
✓ SUCCESS: User assigned to organization as owner

=== VERIFICATION ===
✓ User can now access organization
```

### Test User Context - All Pass
```
TEST 1: Check auth.uid() returns valid user ID
✓ PASSED - User is authenticated

TEST 2: Check JWT role
✓ PASSED - Using authenticated role

TEST 3: Can user query their own user_organizations?
✓ PASSED - User can see their user_organizations (1 records found)

TEST 7: SUMMARY
✓ ALL TESTS PASSED - User should be able to see their organizations
```

---

## Database Connection Strings

### Supabase (Recommended)
```bash
# Service Role (for fixes)
postgresql://postgres.[PROJECT_REF]:[SERVICE_ROLE_KEY]@aws-0-us-west-1.pooler.supabase.com:5432/postgres

# With supabase CLI
supabase db execute -f database/debug/quick_diagnosis.sql
```

### Local Development
```bash
postgresql://postgres:postgres@localhost:54322/postgres
```

### Environment Variables
```bash
export DATABASE_URL="postgresql://..."
psql $DATABASE_URL -f database/debug/quick_diagnosis.sql
```

---

## Safety Notes

1. **Always run quick_diagnosis.sql first** - Don't blindly run fixes
2. **Backup before fixes** - Emergency fix modifies data
3. **Use service role carefully** - Has full database access
4. **Test in development first** - If possible
5. **Read DIAGNOSTIC_REPORT.md** - Understand the problem before fixing

---

## Need Help?

1. Read `DIAGNOSTIC_REPORT.md` for full context
2. Run `diagnose_org_visibility.sql` for comprehensive analysis
3. Check RLS policy status in migration 005
4. Verify JWT tokens are being passed correctly
5. Check server logs for errors

---

## Quick Reference Commands

```bash
# Full diagnostic workflow
psql [DB] -f quick_diagnosis.sql           # 1. Diagnose
psql [DB] -f emergency_fix_user_assignment.sql  # 2. Fix
psql [DB] -f test_user_context.sql         # 3. Verify

# Check RLS policies
psql [DB] -c "SELECT * FROM pg_policies WHERE tablename = 'user_organizations';"

# List all users
psql [DB] -c "SELECT id, email FROM auth.users;"

# List all organizations
psql [DB] -c "SELECT id, name FROM organizations;"

# List all assignments
psql [DB] -c "SELECT uo.user_id, u.email, uo.organization_id, o.name, uo.role, uo.is_active FROM user_organizations uo LEFT JOIN users u ON uo.user_id = u.id LEFT JOIN organizations o ON uo.organization_id = o.id;"
```

---

**Last Updated:** 2025-10-22
**Version:** 1.0
**Maintained by:** Database Detective Agent
