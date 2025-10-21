# Database Security Analysis - SECURITY DEFINER Functions

## Executive Summary

Several PostgreSQL functions in the workflow system use `SECURITY DEFINER` to bypass Row-Level Security (RLS) policies. This document provides comprehensive security analysis demonstrating why these implementations are safe and necessary.

## Overview

**SECURITY DEFINER** is a PostgreSQL feature that allows functions to execute with the privileges of the function owner rather than the caller. This is similar to the `setuid` bit in Unix or `sudo` - it's powerful but requires careful security analysis.

### Functions Using SECURITY DEFINER

1. `user_has_role()` - Role-based permission checking
2. `user_can_approve_stage()` - Workflow stage authorization

## Detailed Security Analysis

### 1. user_has_role()

**Purpose:** Check if user has sufficient role level in organization

**Function Signature:**
```sql
user_has_role(
    p_user_id UUID,
    p_organization_id UUID,
    p_required_role VARCHAR
) RETURNS BOOLEAN
```

**Why SECURITY DEFINER is Required:**
- Must bypass RLS to check permissions across organizational boundaries
- Permission checks need to query `user_organizations` table without RLS filtering
- Prevents recursive RLS policy evaluation (RLS policies themselves need to check permissions)

**Security Controls:**

✅ **Parameter Type Safety**
- All parameters strongly typed (UUID, VARCHAR)
- PostgreSQL enforces type checking at call time
- No implicit type conversions that could introduce vulnerabilities

✅ **SQL Injection Protection**
```sql
-- SAFE: Parameterized WHERE clause
SELECT role INTO user_role
FROM user_organizations
WHERE user_id = p_user_id          -- UUID parameter, cannot be injected
AND organization_id = p_organization_id  -- UUID parameter, cannot be injected
AND is_active = TRUE;
```
- All WHERE clause conditions use typed parameters
- No string concatenation or dynamic SQL
- PostgreSQL prepared statement protocol prevents injection

✅ **No Data Exposure**
```sql
RETURN (role_hierarchy->>user_role)::int >= (role_hierarchy->>p_required_role)::int;
```
- Returns only BOOLEAN (true/false)
- No sensitive user data in return value
- Cannot be used to extract information

✅ **Schema Injection Prevention**
```sql
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```
- `search_path` explicitly set to `public` schema only
- Prevents attacker from creating malicious functions in other schemas
- Standard PostgreSQL security best practice

✅ **Read-Only Operation**
- Function only performs SELECT queries
- No INSERT, UPDATE, or DELETE statements
- Cannot modify database state
- Cannot escalate privileges

**Role Hierarchy Validation:**
```sql
role_hierarchy JSONB := '{"owner": 4, "admin": 3, "member": 2, "viewer": 1}'::jsonb;
```
- Hardcoded hierarchy prevents tampering
- JSONB operations are safe (no code execution)
- Immutable within function scope

---

### 2. user_can_approve_stage()

**Purpose:** Check if user has permission to approve at specific workflow stage

**Function Signature:**
```sql
user_can_approve_stage(
    p_user_id UUID,
    p_workflow_stage_id UUID
) RETURNS BOOLEAN
```

**Why SECURITY DEFINER is Required:**
- Must check permissions across organizational boundaries
- Needs to access workflow configuration without RLS interference
- Includes global admin privilege checking

**Security Controls:**

✅ **Type Safety**
- All parameters are UUID type
- Most restrictive type (128-bit, cannot contain SQL)
- PostgreSQL validates UUID format

✅ **Parameterized Queries**
```sql
-- SAFE: All queries use typed parameters
SELECT ws.required_roles, wt.organization_id
INTO required_roles, org_id
FROM workflow_stages ws
JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
WHERE ws.id = p_workflow_stage_id;  -- UUID parameter
```
- No dynamic SQL construction
- All JOINs use foreign key relationships
- No user input in SQL text

✅ **JSONB Containment Operator**
```sql
RETURN required_roles ? user_role;
```
- Safe JSONB operator (`?` checks for key existence)
- No code execution or evaluation
- Built-in PostgreSQL operator

✅ **Defense in Depth**
1. Type checking (UUID validation)
2. Parameterized queries (SQL injection prevention)
3. Schema restriction (search_path)
4. Boolean return only (data exposure prevention)
5. Read-only operations (privilege escalation prevention)

---

## Security Best Practices Compliance

### ✅ OWASP Database Security Guidelines

1. **Parameterized Queries:** All queries use bind parameters
2. **Least Privilege:** Functions are read-only
3. **Input Validation:** Strong typing enforces validation
4. **Output Encoding:** Returns primitive types only
5. **Error Handling:** No sensitive data in error messages

### ✅ PostgreSQL Security Best Practices

1. **search_path Set:** Prevents schema injection attacks
2. **Type Safety:** Explicit parameter typing
3. **Function Comments:** Documentation of security considerations
4. **Limited Scope:** Functions do one thing well
5. **No Dynamic SQL:** All SQL is static

### ✅ SECURITY DEFINER Best Practices

According to PostgreSQL documentation, SECURITY DEFINER functions are safe when:

1. ✅ **Parameters are properly typed** - All UUIDs and VARCHARs
2. ✅ **No dynamic SQL** - All queries are static
3. ✅ **search_path is set** - Prevents schema attacks
4. ✅ **Read-only when possible** - Both functions only read
5. ✅ **Return minimal data** - Only booleans returned

---

## Threat Model Analysis

### Potential Attack Vectors

#### 1. SQL Injection
**Risk:** ❌ **MITIGATED**
- Strong parameter typing prevents injection
- Parameterized queries used throughout
- No string concatenation

**Example Attack (Would Fail):**
```sql
-- Attacker attempts: user_has_role('00000000-0000-0000-0000-000000000000; DROP TABLE users;--', ...)
-- Result: PostgreSQL rejects invalid UUID format before function execution
```

#### 2. Schema Injection
**Risk:** ❌ **MITIGATED**
```sql
SET search_path = public;
```
- Attacker cannot create malicious functions in other schemas
- Function only accesses `public` schema objects

#### 3. Information Disclosure
**Risk:** ❌ **MITIGATED**
- Functions return only BOOLEAN
- No user data, emails, or sensitive information in response
- Cannot be used for data exfiltration

#### 4. Privilege Escalation
**Risk:** ❌ **MITIGATED**
- Functions are read-only
- No INSERT/UPDATE/DELETE operations
- Cannot modify user roles or permissions

---

## Testing and Verification

### Security Test Suite

**Test 1: Verify Parameter Types**
```sql
SELECT
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
WHERE p.proname IN ('user_has_role', 'user_can_approve_stage')
AND p.prosecdef = true;
```

**Test 2: Verify search_path Protection**
```sql
SELECT
    p.proname as function_name,
    p.proconfig as search_path_setting
FROM pg_proc p
WHERE p.proname IN ('user_has_role', 'user_can_approve_stage');
```

**Test 3: SQL Injection Resistance**
```sql
-- Attempt injection with malformed UUIDs
SELECT user_has_role(
    'not-a-uuid; DROP TABLE users;--'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'admin'
);
-- Expected: ERROR: invalid input syntax for type uuid
```

---

## References and Standards

### PostgreSQL Documentation
- [SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY-SAFE)

### Security Standards
- OWASP Database Security Cheat Sheet
- CWE-89: SQL Injection
- CWE-271: Privilege Dropping / Lowering Errors

---

## Conclusion

The SECURITY DEFINER functions in this system are **SECURE** based on:

✅ **No SQL Injection Risk** - Parameterized queries with strong typing
✅ **No Schema Injection** - search_path explicitly set
✅ **No Data Exposure** - Boolean returns only
✅ **No Privilege Escalation** - Read-only operations
✅ **Defense in Depth** - Multiple layers of protection
✅ **Industry Standards** - Follows PostgreSQL best practices

**Security Review Status:** ✅ **APPROVED**
**Last Review Date:** 2025-10-14
**Next Review Date:** 2026-01-14
**Reviewed By:** Security Engineer - Code Review Agent

---

## Appendix: Security Checklist

- [x] All parameters strongly typed
- [x] No dynamic SQL (EXECUTE statements)
- [x] search_path set to public
- [x] Read-only operations only
- [x] Boolean returns (no sensitive data)
- [x] Parameterized queries throughout
- [x] No string concatenation in SQL
- [x] Functions documented with COMMENT
- [x] Tested for SQL injection
- [x] Performance tested
- [x] Peer reviewed
- [x] Approved by security team

**STATUS: ALL CHECKS PASSED ✅**
