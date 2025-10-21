# RLS Deployment Guide - Multi-Tenant Security for 99 LA Neighborhood Councils

## 🎯 What This Guide Accomplishes

This guide will enable **proper Row Level Security (RLS)** for your bylaws amendment tracking system, ensuring complete data isolation between **all 99 Los Angeles neighborhood councils** during bylaws year.

---

## ✅ Changes Already Applied

The following code changes have been completed and are ready to use:

### 1. **Server.js Updated** ✅
- Created two Supabase clients:
  - `supabase` - Anon client for regular operations (RLS enabled)
  - `supabaseService` - Service role client for setup wizard (bypasses RLS)
- Updated setup status check to use service client

### 2. **Setup Routes Updated** ✅
- Changed `processSetupData()` to use `req.supabaseService` instead of `req.supabase`
- Setup wizard will now bypass RLS during organization creation

### 3. **Environment Template Updated** ✅
- Added `SUPABASE_SERVICE_ROLE_KEY` placeholder to `.env`

### 4. **Fixed Migration Created** ✅
- `/database/migrations/005_implement_proper_rls_FIXED.sql` is ready to deploy
- Removes problematic `deleted_at` column reference
- Implements layer-based security model with NO recursion

---

## 📋 Required Actions (YOU MUST DO THESE)

### **Step 1: Get Your Supabase Service Role Key** 🔑

1. Go to your Supabase dashboard: https://app.supabase.com/
2. Select your project: **amendment-tracker** (auuzurghrjokbqzivfca)
3. Click on **Settings** (gear icon) in the left sidebar
4. Click on **API** under Project Settings
5. Scroll down to **Project API keys**
6. Find the **service_role** key (it starts with `eyJhbGc...`)
7. Click **Copy** to copy it to your clipboard

⚠️ **SECURITY WARNING**: The service role key has **complete database access**. Never commit it to Git or share it publicly!

### **Step 2: Add Service Role Key to .env** 📝

1. Open your `.env` file in the project root
2. Find the line that says:
   ```
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
   ```
3. Replace `YOUR_SERVICE_ROLE_KEY_HERE` with the key you copied
4. Save the file

**Example:**
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1dXp1cmdocmpva2Jxeml2ZmNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg3ODI1OCwiZXhwIjoyMDc1NDU0MjU4fQ...
```

### **Step 3: Run the RLS Migration** 🗄️

1. Go to Supabase dashboard: https://app.supabase.com/
2. Select your project: **amendment-tracker**
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Open the migration file:
   ```
   /database/migrations/005_implement_proper_rls_FIXED.sql
   ```
6. Copy **ALL contents** of the file
7. Paste into the SQL Editor
8. Click **Run** (or press Ctrl+Enter)

**Expected Output:**
```
✅ RLS PROPERLY IMPLEMENTED!
========================================
Changes made:
  ✅ Dropped all existing policies
  ✅ Enabled RLS on 12 tables
  ✅ Created 48 policies (layer-based model)
  ✅ Created performance indexes
  ✅ Service role bypass enabled
  ✅ Verification function created
  🔧 FIX APPLIED: Removed reference to deleted_at column

⚠️  CRITICAL: Add SUPABASE_SERVICE_ROLE_KEY to .env
The setup wizard REQUIRES service role key to bypass RLS

✅ SECURITY MODEL:
  ✅ Layer 1 (user_organizations): Direct auth.uid() check
  ✅ Layer 2+ (organizations, documents, etc.): Reference Layer 1
  ✅ NO RECURSION - infinite loop fixed!
  ✅ Service role can bypass for setup operations

🎉 99-COUNCIL ISOLATION ENABLED!
Each neighborhood council will have completely isolated data.
========================================
```

⚠️ **If you see ANY errors**: Stop and report them immediately. Do NOT proceed.

### **Step 4: Restart Your Server** 🔄

The code changes require a server restart to load the new environment variable.

```bash
# Stop the server (Ctrl+C if running)
# Then restart it:
node server.js
```

**Expected startup output:**
```
Bylaws Amendment Tracker running on https://3eed1324c595.ngrok-free.app

Current Configuration:
- App URL: https://3eed1324c595.ngrok-free.app
- Supabase: Connected
```

---

## 🧪 Testing & Verification

### **Test 1: Setup Wizard Should Work** ✅

1. Clear your browser cookies (to reset session)
2. Go to: `https://3eed1324c595.ngrok-free.app/setup`
3. Complete the setup wizard:
   - Organization Name: **Test Council 1**
   - Organization Type: **Neighborhood Council**
   - Complete all steps through document import

**Expected Result:**
- ✅ No RLS errors
- ✅ Organization created successfully
- ✅ Document imported successfully

### **Test 2: Multi-Tenant Isolation** 🔒

**Create a second organization:**

1. **IMPORTANT**: You need to manually clear the session first
   - Option A: Use a different browser (e.g., if you used Chrome, now use Firefox)
   - Option B: Clear cookies for your ngrok URL
   - Option C: Use incognito/private window

2. Go to setup wizard again: `https://3eed1324c595.ngrok-free.app/setup`
3. Create a second organization:
   - Organization Name: **Test Council 2**
   - Complete setup

**Expected Result:**
- ✅ Second organization created successfully
- ✅ No access to Test Council 1's data

**Verify Isolation:**

Run this SQL query in Supabase SQL Editor:

```sql
-- Check that both organizations exist
SELECT id, name, slug FROM organizations;

-- Check that documents are properly isolated
SELECT
  d.id,
  d.title,
  o.name as organization_name
FROM documents d
JOIN organizations o ON d.organization_id = o.id;
```

You should see:
- 2 organizations
- Documents linked to their respective organizations
- NO shared data between councils

---

## 🚨 Troubleshooting

### Issue: "Service role key is undefined"
**Cause**: Server started before .env was updated
**Fix**:
1. Add service role key to .env
2. Restart server with `node server.js`

### Issue: "Row violates row-level security policy"
**Cause**: Migration not run, or using anon key instead of service key
**Fix**:
1. Verify migration ran successfully in Supabase
2. Check that `.env` has `SUPABASE_SERVICE_ROLE_KEY`
3. Restart server
4. Clear browser cookies and try again

### Issue: "Infinite recursion detected"
**Cause**: Old RLS policies still active
**Fix**:
1. Run this in SQL Editor to drop ALL policies:
   ```sql
   DROP POLICY IF EXISTS "users_see_own_memberships" ON user_organizations;
   DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
   -- (Add any other policy names that appear in error)
   ```
2. Re-run the FIXED migration
3. Restart server

### Issue: "Column deleted_at does not exist"
**Cause**: Running old migration instead of FIXED version
**Fix**: Use `/database/migrations/005_implement_proper_rls_FIXED.sql`

---

## 🎉 Success Criteria

You'll know everything is working correctly when:

1. ✅ Setup wizard completes without RLS errors
2. ✅ Can create multiple organizations (99 councils ready!)
3. ✅ Each organization sees only its own data
4. ✅ No infinite recursion errors
5. ✅ SQL verification query shows proper isolation

---

## 🔐 Security Architecture Summary

### **Layer-Based Model (NO RECURSION)**

**Layer 1**: `user_organizations`
- Uses **direct** `auth.uid()` comparison
- NO subqueries = NO recursion
- Foundation for all other layers

**Layer 2**: `organizations`
- References Layer 1 via subquery
- Inherits user access from memberships

**Layer 3**: `documents`, `workflow_templates`
- Filters by `organization_id`
- References Layer 2 (organizations)

**Layer 4**: `document_sections`, `suggestions`, etc.
- Filters by parent document's organization
- Inherits isolation from Layer 3

### **Service Role Bypass**
- Setup wizard uses `supabaseService` client
- Bypasses RLS with service_role key
- Creates organizations, then adds user membership
- After setup: regular operations use RLS-enabled `supabase` client

---

## 📞 Next Steps

After completing this guide:

1. ✅ Test with 2-3 test organizations
2. ✅ Verify complete data isolation
3. ✅ Run `/database/tests/rls_isolation_test.sql` for comprehensive testing
4. ✅ Document any council-specific configuration needs
5. ✅ Prepare for rollout to all 99 LA neighborhood councils

---

## 📚 Additional Documentation

- **RLS Security Review**: `/docs/reports/RLS_SECURITY_REVIEW.md`
- **Architecture Decision Record**: `/docs/ADR-001-RLS-SECURITY-MODEL.md`
- **Comprehensive Tests**: `/database/tests/rls_isolation_test.sql`
- **Migration File**: `/database/migrations/005_implement_proper_rls_FIXED.sql`

---

**Questions or Issues?** Check the troubleshooting section above, or review the detailed technical reports in `/docs/reports/`.

**Ready for 99 Councils!** 🎉
