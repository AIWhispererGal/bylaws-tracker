# 🚀 Render Deployment Recovery Guide

**Date:** 2025-10-28
**Issue:** 502 Bad Gateway + Schema Mismatch
**Status:** IN PROGRESS

---

## 🎯 Current Situation

**Git Status:** ✅ Code successfully pushed to `main` branch (ba26321..f34a244)

**Render Status:** ❌ Showing 502 errors with schema mismatch

**Root Causes:**
1. Render may need manual redeploy trigger
2. Production Supabase has OLD schema (bylaw_sections)
3. Environment variables may not be set

---

## 📋 Step 1: Verify and Trigger Render Deployment

### Check Branch Configuration:
1. Go to Render Dashboard: https://dashboard.render.com
2. Select your service: "bylaws-amendment-tracker"
3. Go to **Settings** tab
4. Scroll to **Build & Deploy** section
5. Check **Branch**: Should be set to `main`

### Manual Redeploy (CRITICAL):
1. In Render Dashboard, go to your service
2. Click **Manual Deploy** button (top right)
3. Select **"Deploy latest commit"**
4. Click **Deploy**
5. Wait 2-3 minutes for build to complete

**Why This Works:**
- Render sometimes doesn't auto-deploy immediately after git push
- Manual deploy forces fresh build from latest `main` branch commit
- This will pick up your f34a244 commit

---

## 🔐 Step 2: Verify Environment Variables in Render

Go to Render Dashboard → Your Service → **Environment** tab

**Required Variables (6 total):**

```env
# 1. Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# 2. Application Configuration
APP_URL=https://bylaws-amendment-tracker.onrender.com
NODE_ENV=production
SESSION_SECRET=generate-random-32-char-string-here

# Optional (if using email invites)
# RESEND_API_KEY=re_your_api_key_here
# FROM_EMAIL=noreply@yourdomain.com
```

**To Add/Edit Variables:**
1. Click **Add Environment Variable**
2. Enter Key and Value
3. Click **Save Changes**
4. Render will auto-redeploy when you save

**Session Secret Generator:**
```bash
# Run this locally to generate secure session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🗄️ Step 3: Fix Database Schema Mismatch

**The Problem:**
```
Error: Could not find the table 'public.organizations' in the schema cache
Hint: Perhaps you meant the table 'public.bylaw_sections'
```

Your production Supabase has the **OLD single-tenant schema**. Your code expects the **NEW multi-tenant schema**.

### Option A: Use Dev Database Temporarily (QUICKEST)

**Step 1:** Find your local dev Supabase credentials
```bash
# Look in your .env file
cat .env | grep SUPABASE
```

**Step 2:** Set these in Render Environment Variables
- Use your LOCAL/DEV Supabase URL and keys temporarily
- This will work immediately while you migrate production

**Pros:**
- ✅ Works immediately
- ✅ Can test deployment right away

**Cons:**
- ❌ Dev and prod share same database (not ideal long-term)
- ❌ Dev data will be visible in production

---

### Option B: Create New Production Supabase (RECOMMENDED)

**Step 1:** Create new Supabase project
1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Name it: "bylaws-tracker-prod" or similar
4. Wait for provisioning (~2 minutes)

**Step 2:** Run ALL migrations
```bash
# Connect to your new production project
# In Supabase Dashboard → SQL Editor

# Run these migrations IN ORDER:
# 1. database/migrations/001_initial_schema.sql
# 2. database/migrations/002_...sql
# ... (run all files in order)
# Up to latest migration
```

**Step 3:** Copy NEW credentials to Render
1. Supabase Dashboard → Project Settings → API
2. Copy:
   - Project URL → SUPABASE_URL
   - anon/public key → SUPABASE_ANON_KEY
   - service_role key → SUPABASE_SERVICE_ROLE_KEY
3. Paste into Render Environment Variables

**Pros:**
- ✅ Clean production database
- ✅ Proper dev/prod separation
- ✅ Fresh start with correct schema

**Cons:**
- ⏱️ Takes 10-15 minutes to set up
- 📝 Need to run all migrations

---

### Option C: Migrate Existing Production Database

**Step 1:** Identify which migrations are missing
```bash
# In Supabase SQL Editor, check what exists:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Step 2:** Run missing migrations
- If you see `bylaw_sections` but NOT `organizations`, you need to run migrations starting from the multi-tenant refactor
- Look for the migration that creates `organizations` table
- Run that and all subsequent migrations

**Pros:**
- ✅ Keeps existing production database
- ✅ No data loss

**Cons:**
- ⚠️ Risk of migration conflicts if old data exists
- 🧩 More complex than fresh start

---

## 🧪 Step 4: Test Deployment

After completing Steps 1-3:

### Check Build Logs:
1. Render Dashboard → Your Service → **Logs** tab
2. Look for:
   ```
   ✅ Server running on port 3000
   ✅ Supabase connected
   ```
3. Should NOT see:
   ```
   ❌ PGRST205 error
   ❌ Could not find table 'organizations'
   ```

### Test Application:
1. Visit: https://bylaws-amendment-tracker.onrender.com
2. Should see setup wizard (if no orgs exist)
3. Create test organization
4. Upload test document
5. Verify dashboard loads

---

## 🚨 Common Issues and Fixes

### Issue: "Still showing 502 after redeploy"
**Fix:** Check Render logs for specific error. Likely environment variables still not set.

### Issue: "Build succeeds but crashes on startup"
**Fix:** Missing SESSION_SECRET or invalid Supabase credentials.

### Issue: "Organizations table not found"
**Fix:** Database schema mismatch. Use Option A (dev database) or Option B (new production database).

### Issue: "Render says 'Deploy failed'"
**Fix:**
1. Check build logs for npm errors
2. Verify package.json has correct start script: `"start": "node server.js"`
3. Check for missing dependencies

---

## 📝 Verification Checklist

Before declaring success:

- [ ] Render Manual Deploy triggered and completed successfully
- [ ] All 6 environment variables set in Render
- [ ] Build logs show "Server running on port 3000"
- [ ] Application loads at https://bylaws-amendment-tracker.onrender.com
- [ ] No PGRST205 errors in logs
- [ ] Setup wizard loads OR dashboard loads (depending on org state)
- [ ] Can create new organization
- [ ] Can upload document
- [ ] Database queries work

---

## 🎯 Recommended Path Forward

**For FASTEST deployment (5 minutes):**
1. ✅ Manual Deploy in Render (Step 1)
2. ✅ Set all 6 environment variables (Step 2)
3. ✅ Use dev database temporarily (Step 3, Option A)
4. ✅ Test deployment (Step 4)

**For PRODUCTION-READY deployment (15 minutes):**
1. ✅ Manual Deploy in Render (Step 1)
2. ✅ Set all 6 environment variables (Step 2)
3. ✅ Create new production Supabase and run migrations (Step 3, Option B)
4. ✅ Test deployment (Step 4)

---

## 📞 Next Steps if Still Broken

If after following all steps you still get errors:

1. **Check Render logs** - Look for the FIRST error that appears
2. **Verify Supabase connection** - Try querying organizations table in Supabase SQL Editor
3. **Test locally** - Verify app works with production credentials on your machine:
   ```bash
   # Temporarily edit .env to use production Supabase
   npm start
   # Visit http://localhost:3000
   ```

---

**Current Status:** Ready to execute Step 1 (Manual Deploy)

**Next Action:** Go to Render Dashboard and click "Manual Deploy"
