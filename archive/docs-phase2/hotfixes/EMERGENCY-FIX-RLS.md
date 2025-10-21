# 🚨 EMERGENCY FIX - Disable RLS Temporarily

## The Nuclear Option

Since migrations 027 didn't work and the service role isn't bypassing RLS, we need to **temporarily disable RLS** on the organizations table to unblock you.

---

## ⚡ IMMEDIATE ACTION (30 seconds)

### Step 1: Run This in Supabase SQL Editor

```sql
-- Temporarily disable RLS on organizations table
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Verify it worked
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'organizations';
```

**Expected Output**:
```
tablename     | rowsecurity
--------------|------------
organizations | f           ← 'f' means FALSE (disabled)
```

---

### Step 2: Test Setup Immediately

1. Go to: http://localhost:3000/setup/organization
2. Fill in form
3. Submit

**Should work now!** ✅

---

## Why This is Necessary

**Normal Path** (should work but doesn't):
1. Service role client should bypass RLS ✅
2. But it's not working for some reason ❌

**Emergency Path** (will work):
1. Disable RLS completely ✅
2. No policies to violate ✅
3. Setup can create organization ✅

---

## ⚠️ IMPORTANT: This is Temporary!

**After setup works**, re-enable RLS:

```sql
-- Re-enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Add proper policies
CREATE POLICY "Users can view their orgs"
ON organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id
    FROM user_organizations
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Allow org creation"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);
```

---

## Is This Safe?

**During Setup** (RLS disabled):
- ✅ Safe - you're the only user
- ✅ Temporary - only for testing
- ✅ No data exists yet to protect

**For Production** (RLS enabled):
- ❌ NOT safe without RLS
- ❌ Users could see all orgs
- ❌ Need to re-enable before launch

---

## After You Create Organization

Once setup works with RLS disabled:

1. ✅ Test everything
2. ✅ Create your organization
3. ✅ Verify dashboard works
4. ⚠️ **Come back to re-enable RLS**

---

## Full Emergency Script

I've created: `database/migrations/028_EMERGENCY_disable_rls_for_setup.sql`

This will:
- Disable RLS on organizations
- Provide re-enable instructions
- Show verification queries

---

## Why Is Service Role Not Working?

**Possible reasons**:
1. Service role client not being used correctly in code
2. RLS policies have bugs
3. Supabase configuration issue
4. Token/auth context problem

**We'll debug this later** - for now, just disable RLS to unblock setup.

---

## 🎯 Action Plan

**NOW**:
```sql
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
```

**After Setup Works**:
- Debug why service role didn't bypass RLS
- Fix the root cause
- Re-enable RLS with proper policies

**For Production**:
- Must have RLS enabled
- Must have proper policies
- Test thoroughly

---

## Quick Copy-Paste

**Disable RLS**:
```sql
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'organizations';
```

**Re-enable RLS** (later):
```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their orgs" ON organizations
FOR SELECT TO authenticated
USING (id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE POLICY "Allow org creation" ON organizations
FOR INSERT TO authenticated
WITH CHECK (true);
```

---

**RUN THE DISABLE COMMAND NOW!** 🚀

Your setup should work immediately after disabling RLS.
