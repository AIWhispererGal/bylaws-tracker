# 🚀 Deployment to Render - Complete Technical Guide

**App:** Bylaws Amendment Tracker (Generalized Multi-Tenant Version)
**Status:** Production Ready
**Last Updated:** 2025-10-09
**Target Platform:** Render.com

> **Note:** For a user-friendly guide, see [`INSTALLATION_GUIDE.md`](./INSTALLATION_GUIDE.md)

---

## Overview

This guide covers deploying the Bylaws Amendment Tracker to Render.com with:
- ✅ Free tier hosting (with upgrade path)
- ✅ Automatic deploys from Git
- ✅ Supabase PostgreSQL database
- ✅ Environment variable management
- ✅ Health checks and monitoring
- ✅ Google Docs integration

**Architecture:**
- **Web Service**: Node.js/Express on Render
- **Database**: Supabase PostgreSQL (managed)
- **Files**: Supabase Storage (optional)
- **Auth**: Supabase Auth (optional)

---

## Prerequisites

### Accounts Required
- ✅ GitHub account (for code hosting)
- ✅ Render account (for web hosting)
- ✅ Supabase account (for database)

### Repository Ready
- ✅ Code committed to Git
- ✅ `package.json` with correct `start` script
- ✅ `render.yaml` configured (optional but recommended)
- ✅ Database schema ready (`/database/migrations/001_generalized_schema.sql`)

### Environment Variables Prepared
- ✅ All required variables documented (see [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md))
- ✅ Supabase credentials collected
- ✅ Session secret generated

---

## Pre-Deployment Steps

### 1. Set Up Supabase Database

**See full guide:** [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)

**Quick steps:**
1. Create Supabase project
2. Run schema: `/database/migrations/001_generalized_schema.sql`
3. Collect credentials:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_DB_PASSWORD`

### 2. Prepare Environment Variables

Create a secure location to store these values (password manager recommended):

```env
# Required
NODE_ENV=production
PORT=3000
SESSION_SECRET=[generate with: openssl rand -hex 32]
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_DB_PASSWORD=your-db-password
APP_URL=[will update after deployment]

# Optional
GOOGLE_DOC_ID=your-doc-id
LOG_LEVEL=warn
```

### 3. Commit Latest Code

```bash
# Verify working directory is clean
git status

# Add any pending changes
git add .

# Commit
git commit -m "Production ready: Setup wizard and multi-tenant support

- Generalized schema with organizations and workflows
- Setup wizard for easy installation
- Multi-stage approval workflows
- Google Docs integration
- Render deployment configuration"

# Push to main branch
git push origin main
```

---

## 🔧 STEP 1: Fix Existing Organization Record

**Before deploying**, update your existing organization in Supabase:

### Option A: Via Supabase Dashboard (Easiest)
1. Go to Supabase Dashboard → Table Editor
2. Open `organizations` table
3. Find organization: **RNC BASR** (ID: `9fe79740-323c-4678-a1e1-b1fee60157c9`)
4. Click to edit the row
5. Set `is_configured` = `TRUE`
6. Set `logo_url` = `NULL` (or leave as-is, won't affect functionality)
7. Save

### Option B: Via SQL Editor
```sql
-- Update existing organization
UPDATE organizations
SET
  is_configured = TRUE,
  logo_url = NULL,  -- Clear local file path
  updated_at = NOW()
WHERE id = '9fe79740-323c-4678-a1e1-b1fee60157c9';

-- Verify update
SELECT id, name, is_configured, logo_url
FROM organizations
WHERE id = '9fe79740-323c-4678-a1e1-b1fee60157c9';
```

### Optional: Clean Up Test Organizations
```sql
-- View all organizations
SELECT id, name, is_configured, created_at
FROM organizations
ORDER BY created_at DESC;

-- Delete test organizations (CAREFUL!)
DELETE FROM organizations
WHERE name LIKE '%test%' OR is_configured = FALSE;

-- Keep only the latest one
DELETE FROM organizations
WHERE id != '9fe79740-323c-4678-a1e1-b1fee60157c9';
```

---

## 🚀 STEP 2: Commit Your Code

```bash
# Check what's changed
git status

# Add all changes
git add src/routes/setup.js views/setup/success.ejs

# Commit with descriptive message
git commit -m "Production ready: Fix setup hang and redirect

- Add session.save() to persist setup completion status
- Fix success page redirect from /dashboard to /bylaws
- Add is_configured flag to organization creation
- Ready for Render deployment

Fixes:
- Setup processing no longer hangs indefinitely
- Success page redirects to correct route
- Organization properly marked as configured"

# Push to main branch
git push origin main
```

---

## 🌐 STEP 3: Deploy to Render

### Create New Web Service

1. **Go to Render Dashboard**
   - Visit https://render.com
   - Click **"New +"** → **"Web Service"**

2. **Connect Repository**
   - Connect your GitHub/GitLab repository
   - Select: `BYLAWSTOOL_Generalized` repository
   - Branch: `main`

3. **Configure Service**

   **Basic Settings:**
   - **Name:** `bylaws-tracker` (or your preferred name)
   - **Region:** Choose closest to your users (e.g., Oregon, Ohio)
   - **Branch:** `main`
   - **Root Directory:** (leave blank)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

4. **Environment Variables**

   Click **"Advanced"** → **"Add Environment Variable"** for each:

   ```
   Key: APP_URL
   Value: https://bylaws-tracker.onrender.com (will be generated)

   Key: SUPABASE_URL
   Value: https://auuzurghrjokbqzivfca.supabase.co

   Key: SUPABASE_ANON_KEY
   Value: [your anon key]

   Key: SUPABASE_DB_PASSWORD
   Value: [your db password]

   Key: GOOGLE_DOC_ID
   Value: 1LdE2NGMOJ7BgV19V3Qb-hnN5VTmB5C_Hh6heemqxviA

   Key: PORT
   Value: 3000

   Key: SESSION_SECRET
   Value: [your session secret]

   Key: NODE_ENV
   Value: production
   ```

5. **Instance Type**
   - **Free tier:** Start with free
   - **Paid:** Upgrade later if needed ($7/month for Starter)

6. **Create Service**
   - Click **"Create Web Service"**
   - Render will start deploying automatically

---

## ⏱️ STEP 4: Monitor Deployment

### Watch Build Logs
- Render will show real-time logs
- Look for:
  ```
  ==> Installing dependencies
  ==> Build successful
  ==> Starting service
  Server running on port 3000
  ```

### Deployment Timeline
- **Build:** 2-5 minutes (installing dependencies)
- **Start:** 30 seconds (starting Node.js)
- **Total:** ~3-6 minutes

### Deployment URL
- Render will assign: `https://bylaws-tracker.onrender.com`
- Or your custom domain if configured

---

## ✅ STEP 5: Post-Deployment Verification

### Test 1: Health Check
```bash
# Check app is running
curl https://your-app.onrender.com/api/health

# Should return:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-09T..."
}
```

### Test 2: Visit App
1. Open: `https://your-app.onrender.com`
2. Should redirect to `/bylaws`
3. You should see: "RNC BASR" organization name
4. Should show: "No sections loaded yet"

### Test 3: Setup Flow (Optional - Create New Org)
1. Delete/disable your current organization in Supabase
2. Visit app - should redirect to `/setup`
3. Complete setup wizard
4. Verify no hang, success page appears
5. Click "Go to Bylaws Tracker" - should work

---

## 📥 STEP 6: Import Your Bylaws Sections

### Option A: Google Docs Sync (Recommended)

**Requirements:**
- Google Apps Script add-on installed
- Google Doc with your bylaws

**Steps:**
1. Open your Google Doc with bylaws
2. Go to **Extensions** → **Apps Script**
3. Update script with your Render URL:
   ```javascript
   const APP_URL = 'https://your-app.onrender.com';
   ```
4. Save and deploy
5. Return to Google Doc
6. Menu: **🔧 Bylaws Sync** → **Parse into Small Sections**
7. Wait for processing (may take 30-60 seconds)
8. Refresh your Render app - sections should appear!

### Option B: Manual API Import

If you have sections in JSON format:

```bash
# Upload sections via API
curl -X POST https://your-app.onrender.com/api/sections \
  -H "Content-Type: application/json" \
  -d '{
    "sections": [
      {
        "article": "Article I",
        "section": "Section 1",
        "text": "Your bylaw text here"
      }
    ]
  }'
```

### Option C: Direct Database Insert

Via Supabase SQL Editor:
```sql
-- Insert test sections
INSERT INTO bylaw_sections (article, section, content, current_text)
VALUES
  ('Article I', 'Section 1', 'Name of Organization', 'The name of this organization shall be...'),
  ('Article I', 'Section 2', 'Purpose', 'The purpose of this organization is to...');

-- Verify insert
SELECT * FROM bylaw_sections ORDER BY article, section;
```

---

## 🔄 STEP 7: Update APP_URL

**IMPORTANT:** After deployment, update your environment variable:

1. In Render Dashboard → Your Service → Environment
2. Update `APP_URL` to actual Render URL
3. Example: `https://bylaws-tracker.onrender.com`
4. Save changes
5. Service will auto-redeploy

Also update in Google Apps Script:
```javascript
const APP_URL = 'https://bylaws-tracker.onrender.com';
```

---

## 🛠️ Troubleshooting

### App Won't Start
**Check Logs:**
- Render Dashboard → Logs tab
- Look for errors in red

**Common Issues:**
```bash
# Missing environment variable
Error: SUPABASE_URL is not defined
→ Solution: Add environment variable in Render

# Port binding error
Error: EADDRINUSE
→ Solution: Change PORT to 3000 or use process.env.PORT

# Module not found
Error: Cannot find module 'express'
→ Solution: Check package.json, verify npm install ran
```

### Database Connection Failed
```bash
# Test Supabase connection
curl https://auuzurghrjokbqzivfca.supabase.co/rest/v1/

# Should return API info, not error
```

**Fix:**
- Verify SUPABASE_URL is correct
- Check SUPABASE_ANON_KEY is valid
- Ensure Supabase project is active

### Setup Still Shows on Every Visit
**Cause:** Organization not marked as configured

**Fix:**
```sql
UPDATE organizations SET is_configured = TRUE;
```

### Sections Not Loading
**Cause:** No sections in database yet

**Fix:**
- Run Google Docs sectioner
- Or manually insert test sections
- Check `bylaw_sections` table has data

---

## 📊 Monitoring After Deployment

### Check These Regularly (First 24 Hours)

**Performance:**
- Response time: < 2 seconds
- Uptime: Should be 99%+
- Memory usage: Monitor in Render dashboard

**Errors:**
- Check Render logs for errors
- Monitor Supabase logs
- Test setup flow 2-3 times

**Database:**
```sql
-- Check organization is configured
SELECT name, is_configured FROM organizations;

-- Count sections loaded
SELECT COUNT(*) FROM bylaw_sections;

-- Check for errors
SELECT * FROM organizations WHERE is_configured = FALSE;
```

---

## 🎯 Success Criteria

After deployment, verify:

- [ ] App accessible at Render URL
- [ ] Health check returns "healthy"
- [ ] Organization shows on `/bylaws` page
- [ ] No redirect to `/setup` on page load
- [ ] Setup wizard works if triggered manually
- [ ] Google Docs sync connects successfully
- [ ] Sections load when imported
- [ ] No crashes or errors in logs

---

## 🔒 Production Hardening (Optional, Later)

### Security Enhancements
- [ ] Add rate limiting
- [ ] Enable CORS properly
- [ ] Add request validation
- [ ] Set up logging service (LogRocket, Sentry)

### Performance
- [ ] Add Redis for sessions (instead of in-memory)
- [ ] Enable caching
- [ ] Add CDN for static assets
- [ ] Optimize database queries

### Monitoring
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Configure error tracking (Sentry)
- [ ] Set up performance monitoring (New Relic)

---

## 📞 Support & Next Steps

**After Successful Deployment:**

1. **Import your bylaws sections** (via Google Docs or manual)
2. **Test all features** (search, suggestions, export)
3. **Share with team** (send Render URL)
4. **Monitor for issues** (first 24-48 hours)

**If Issues Occur:**
- Check Render logs first
- Verify Supabase connection
- Review environment variables
- Test locally to reproduce

---

## 🎉 You're Ready!

**Summary:**
1. Fix existing org in Supabase (`is_configured = TRUE`)
2. Commit and push code
3. Deploy to Render (6 minutes)
4. Update APP_URL environment variable
5. Import bylaws sections via Google Docs
6. Celebrate! 🎊

**Your app will be live at:** `https://bylaws-tracker.onrender.com`

---

**Questions? Check:**
- `DIAGNOSTIC_REPORT_SETUP_HANG.md` - Technical details
- `FIX_APPLIED_SUMMARY.md` - What was fixed
- `INVESTIGATION_SUMMARY.md` - Root cause analysis
