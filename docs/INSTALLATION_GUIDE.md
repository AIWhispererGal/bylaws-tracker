# Complete Installation Guide - Bylaws Amendment Tracker

**For Non-Technical Users**

This guide will walk you through deploying your own instance of the Bylaws Amendment Tracker, even if you've never deployed a web application before.

---

## Table of Contents

1. [Overview](#overview)
2. [What You'll Need](#what-youll-need)
3. [Step 1: Create Accounts](#step-1-create-accounts)
4. [Step 2: Set Up Supabase Database](#step-2-set-up-supabase-database)
5. [Step 3: Fork the Repository](#step-3-fork-the-repository)
6. [Step 4: Deploy to Render](#step-4-deploy-to-render)
7. [Step 5: Complete Setup Wizard](#step-5-complete-setup-wizard)
8. [Step 6: Connect Google Docs (Optional)](#step-6-connect-google-docs-optional)
9. [Troubleshooting](#troubleshooting)
10. [Next Steps](#next-steps)

---

## Overview

The Bylaws Amendment Tracker is a web application that helps organizations:
- Track amendments to bylaws, policies, and procedures
- Manage multi-stage approval workflows
- Collaborate on suggested changes
- Export approved amendments

**Hosting Architecture:**
- **Frontend & Backend**: Hosted on Render.com (Free tier available)
- **Database**: Supabase PostgreSQL (Free tier available)
- **Document Source**: Google Docs integration (Optional)

**Total Time Required**: 30-45 minutes

---

## What You'll Need

### Required Accounts (All Free)
1. **GitHub Account** - To store your code
   - Sign up: https://github.com/signup

2. **Supabase Account** - For database hosting
   - Sign up: https://supabase.com/dashboard/sign-up

3. **Render Account** - For web hosting
   - Sign up: https://render.com/register

### Optional Accounts
4. **Google Account** - For Google Docs integration
   - Already have one? Use your existing account

### Required Skills
- ✅ Ability to copy and paste
- ✅ Ability to click through web forms
- ✅ Basic computer literacy
- ❌ **No coding required!**

---

## Step 1: Create Accounts

### 1.1 Create GitHub Account

1. Visit https://github.com/signup
2. Enter your email address
3. Create a password
4. Choose a username
5. Verify your email
6. Complete the setup wizard

**Time Required**: 5 minutes

### 1.2 Create Supabase Account

1. Visit https://supabase.com/dashboard/sign-up
2. Click "Sign in with GitHub" (easier) or use email
3. Authorize Supabase to access your GitHub
4. Complete profile setup

**Time Required**: 2 minutes

### 1.3 Create Render Account

1. Visit https://render.com/register
2. Click "Sign in with GitHub" (recommended)
3. Authorize Render to access your GitHub
4. Complete account setup

**Time Required**: 2 minutes

---

## Step 2: Set Up Supabase Database

### 2.1 Create a New Project

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Click "New Project"

2. **Fill in Project Details**
   - **Organization**: Select or create your organization
   - **Name**: `bylaws-tracker` (or any name you prefer)
   - **Database Password**: Click "Generate a password" or create a strong password
     - ⚠️ **IMPORTANT**: Copy and save this password! You'll need it later
   - **Region**: Choose closest to your location (e.g., "US West")
   - **Pricing Plan**: Select "Free" tier

3. **Create Project**
   - Click "Create new project"
   - Wait 2-3 minutes for setup to complete
   - You'll see "Setting up project..." status

### 2.2 Collect Your Supabase Credentials

Once your project is ready:

1. **Get Project URL**
   - Go to: Settings → API (left sidebar)
   - Find "Project URL" section
   - Copy the URL (looks like: `https://abcdefgh.supabase.co`)
   - Save it in a text file as: `SUPABASE_URL`

2. **Get Anon Key**
   - Same page (Settings → API)
   - Find "Project API keys" section
   - Copy the `anon` `public` key
   - Save it in your text file as: `SUPABASE_ANON_KEY`

3. **Get Database Password**
   - You saved this when creating the project
   - If you forgot it, go to: Settings → Database → Reset database password
   - Save it in your text file as: `SUPABASE_DB_PASSWORD`

**Example credentials file:**
```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...very-long-string...
SUPABASE_DB_PASSWORD=YourPassword123!
```

### 2.3 Run Database Schema

1. **Open SQL Editor**
   - In Supabase dashboard, click "SQL Editor" (left sidebar)
   - Click "New query"

2. **Copy and Paste Schema**
   - Open this file in the repository: `/database/migrations/001_generalized_schema.sql`
   - Copy ALL the SQL code
   - Paste into Supabase SQL Editor

3. **Run the Query**
   - Click "Run" (or press Ctrl+Enter)
   - Wait for completion (15-30 seconds)
   - You should see: "Success. No rows returned"

4. **Verify Tables Created**
   - Click "Table Editor" (left sidebar)
   - You should see these tables:
     - `organizations`
     - `documents`
     - `document_sections`
     - `suggestions`
     - `workflow_templates`
     - And several others

**Time Required**: 10 minutes

---

## Step 3: Fork the Repository

### 3.1 Fork on GitHub

1. **Go to the Repository**
   - Visit: https://github.com/YOUR-ORG/BYLAWSTOOL_Generalized
   - (Replace with actual repository URL)

2. **Click Fork**
   - Click the "Fork" button (top right)
   - Select your personal account
   - Keep the repository name as-is
   - Click "Create fork"

3. **Wait for Fork to Complete**
   - GitHub will copy the repository to your account
   - Takes 10-20 seconds

**Your forked repository will be at:**
`https://github.com/YOUR-USERNAME/BYLAWSTOOL_Generalized`

**Time Required**: 2 minutes

---

## Step 4: Deploy to Render

### 4.1 Create Web Service

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Click "New +" (top right)
   - Select "Web Service"

2. **Connect Your Repository**
   - Click "Connect account" if not already connected
   - Authorize Render to access GitHub
   - Find your forked repository: `BYLAWSTOOL_Generalized`
   - Click "Connect"

### 4.2 Configure Service

**Basic Configuration:**

| Field | Value |
|-------|-------|
| **Name** | `bylaws-tracker` (or your preferred name) |
| **Region** | Oregon (US West) - Free tier available |
| **Branch** | `main` |
| **Root Directory** | (leave blank) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

**Environment Variables:**

Click "Advanced" → "Add Environment Variable" and add these:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `3000` | Required |
| `SESSION_SECRET` | (click "Generate") | Auto-generated for security |
| `SUPABASE_URL` | Your Supabase URL | From Step 2.2 |
| `SUPABASE_ANON_KEY` | Your Supabase Anon Key | From Step 2.2 |
| `SUPABASE_DB_PASSWORD` | Your DB Password | From Step 2.2 |
| `APP_URL` | (leave blank for now) | Will update after deployment |

**Instance Type:**
- Select **Free** tier
- Provides 750 hours/month (always-on for free!)

### 4.3 Deploy

1. **Click "Create Web Service"**
2. **Wait for Deployment**
   - Render will:
     - Build your application (2-5 minutes)
     - Install dependencies
     - Start the server
   - Watch the logs in real-time

3. **Get Your URL**
   - Once deployed, you'll see: "Your service is live at..."
   - Copy the URL (e.g., `https://bylaws-tracker.onrender.com`)

### 4.4 Update APP_URL

1. **Go to Environment Variables**
   - In Render dashboard, click your service
   - Go to "Environment" tab
   - Find `APP_URL` variable

2. **Set the Value**
   - Click "Edit"
   - Paste your Render URL: `https://bylaws-tracker.onrender.com`
   - Click "Save Changes"

3. **Redeploy**
   - Render will automatically redeploy (1-2 minutes)

**Time Required**: 10 minutes

---

## Step 5: Complete Setup Wizard

### 5.1 Access Your Application

1. Open your Render URL in a browser: `https://bylaws-tracker.onrender.com`
2. You should be redirected to: `/setup`
3. You'll see the Setup Wizard welcome screen

### 5.2 Organization Information (Step 1)

Fill in your organization details:

| Field | Description | Example |
|-------|-------------|---------|
| **Organization Name** | Your organization's full name | "Reseda Neighborhood Council" |
| **Organization Type** | Type of organization | "Neighborhood Council" |
| **State** | Your state (if USA) | "California" |
| **Country** | Your country | "United States" |
| **Contact Email** | Admin contact email | "admin@resedacouncil.org" |
| **Logo** | Upload logo (optional) | PNG, JPG, SVG up to 10MB |

Click "Continue"

### 5.3 Document Structure (Step 2)

Choose how your documents are structured:

**Option 1: Two-Level Hierarchy** (Most Common)
- Level 1: Articles (I, II, III...)
- Level 2: Sections (1, 2, 3...)

**Option 2: Custom Structure**
- Define your own hierarchy levels
- Choose numbering schemes (Roman, numeric, alphabetic)

**Example Bylaws Structure:**
```
Article I: Name
  Section 1: Official Name
  Section 2: Abbreviation
Article II: Purpose
  Section 1: Mission
  Section 2: Goals
```

Click "Continue"

### 5.4 Approval Workflow (Step 3)

Define your amendment approval process:

**Default Workflow (2-Stage):**
1. **Committee Review** → Bylaws committee reviews and selects amendments
2. **Board Approval** → Board of directors gives final approval

**Custom Workflow:**
Add or remove stages as needed:
- Legal Review
- Public Comment
- Committee Vote
- Board Vote

For each stage, configure:
- Stage name
- Who can approve (roles)
- Can edit text at this stage?
- Required for progression?

Click "Continue"

### 5.5 Import Bylaws (Step 4)

Choose how to import your existing bylaws:

**Option A: Google Docs** (Recommended)
1. Paste your Google Docs URL
2. Choose import options:
   - ☑️ Auto-detect structure
   - ☑️ Preserve formatting
   - ☑️ Create initial version

**Option B: Upload Word Document**
1. Click "Choose File"
2. Select your .docx file
3. Same import options as above

**Option C: Skip Import**
- Start with an empty tracker
- Add sections manually later

Click "Import & Process"

### 5.6 Processing

Wait while the system:
1. ✅ Creates organization
2. ✅ Sets up document structure
3. ✅ Configures workflow
4. ✅ Imports sections (if provided)
5. ✅ Initializes database

**Time**: 5-15 seconds

### 5.7 Success!

You'll see a success screen with:
- ✅ Organization name
- ✅ Document structure
- ✅ Workflow stages created
- ✅ Sections imported (if any)

Click "Go to Bylaws Tracker"

**Time Required**: 5-10 minutes

---

## Step 6: Connect Google Docs (Optional)

If you want to sync changes from Google Docs to your tracker:

### 6.1 Create Apps Script

1. **Open Your Google Doc**
   - Go to your bylaws Google Doc

2. **Open Script Editor**
   - Click: Extensions → Apps Script

3. **Create New Script**
   - Delete any default code
   - Copy the script from: `/scripts/google-apps-script/Code.gs` in the repository
   - Paste into the Apps Script editor

4. **Update Configuration**
   - Find the line: `const APP_URL = 'http://localhost:3000';`
   - Replace with your Render URL: `const APP_URL = 'https://bylaws-tracker.onrender.com';`

5. **Save and Deploy**
   - Click: File → Save
   - Click: Deploy → New deployment
   - Type: "Add-on"
   - Click "Deploy"
   - Authorize the script (allow all permissions)

### 6.2 Use the Add-on

1. **Refresh Your Google Doc**
   - Close and reopen the document

2. **Find the Menu**
   - Look for: "🔧 Bylaws Sync" in the menu bar

3. **Sync Sections**
   - Click: 🔧 Bylaws Sync → Parse into Small Sections
   - Wait 30-60 seconds for processing
   - Check your Bylaws Tracker - sections should appear!

**Time Required**: 10 minutes

---

## Troubleshooting

### Issue: Setup Wizard Doesn't Load

**Symptoms:**
- Redirects to error page
- Shows "Setup not found"

**Solution:**
1. Check Render logs: Dashboard → Logs
2. Verify environment variables are set correctly
3. Ensure Supabase is running (check Supabase dashboard)
4. Try restarting the Render service: Settings → "Manual Deploy" → Deploy

### Issue: Database Connection Failed

**Symptoms:**
- "Database connection error"
- "ECONNREFUSED" in logs

**Solution:**
1. Verify `SUPABASE_URL` is correct (no trailing slash)
2. Verify `SUPABASE_ANON_KEY` is the full key (very long string)
3. Check Supabase project is active (not paused)
4. Test connection: Supabase Dashboard → API Docs → "Test connection"

### Issue: Organization Already Exists

**Symptoms:**
- Setup wizard shows "already configured"
- Can't access setup

**Solution:**

**Option 1: Clear Existing Organization (Fresh Start)**
1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
```sql
-- Clear all organizations (CAREFUL - deletes all data!)
DELETE FROM organizations;
```
3. Refresh your app - setup wizard should appear

**Option 2: Use Existing Organization**
1. The app is already configured
2. Skip setup wizard
3. Go directly to: `/bylaws`

### Issue: Sections Not Importing

**Symptoms:**
- Import completes but no sections appear
- Shows "0 sections imported"

**Solution:**
1. **Check Document Structure**
   - Ensure your document has clear Article/Section headers
   - Use consistent formatting (bold for headers)

2. **Manual Verification**
   - Go to Supabase → Table Editor → `document_sections`
   - Check if any rows exist

3. **Re-import**
   - Use Google Apps Script to re-parse
   - Or upload document again via API

### Issue: Google Docs Sync Fails

**Symptoms:**
- Apps Script shows error
- "Failed to connect to server"

**Solution:**
1. **Verify APP_URL in Script**
   - Must be your Render URL (with https://)
   - No trailing slash

2. **Check Authorization**
   - Re-authorize the script
   - Apps Script → Run → Authorize

3. **Test Connection**
   - Apps Script → Run → testConnection()
   - Check logs for errors

### Issue: App is Slow or Unresponsive

**Symptoms:**
- Pages take >10 seconds to load
- Render shows "sleeping"

**Solution:**
1. **Free Tier Limitation**
   - Render free tier sleeps after 15 minutes of inactivity
   - First request after sleep takes 30-60 seconds

2. **Upgrade Options**
   - Upgrade to Render "Starter" plan ($7/month) for always-on
   - Or accept the sleep behavior for free tier

3. **Keep-Alive Service** (Advanced)
   - Set up external ping service (UptimeRobot) to keep app awake
   - Free tier: https://uptimerobot.com

### Issue: Environment Variables Missing

**Symptoms:**
- App crashes on start
- Logs show "SUPABASE_URL is not defined"

**Solution:**
1. Go to Render Dashboard → Your Service → Environment
2. Verify ALL required variables are present:
   - `NODE_ENV`
   - `PORT`
   - `SESSION_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_DB_PASSWORD`
   - `APP_URL`
3. If missing, add them and save
4. Service will auto-redeploy

### Getting More Help

1. **Check Application Logs**
   - Render Dashboard → Logs
   - Look for red error messages

2. **Check Database Logs**
   - Supabase Dashboard → Logs
   - Look for connection errors

3. **GitHub Issues**
   - Post issue on repository
   - Include error messages and steps to reproduce

---

## Next Steps

### 1. Configure User Access

**Create User Accounts:**
1. Currently, setup wizard creates organization only
2. For user authentication, integrate Supabase Auth (see `AUTH_SETUP.md`)
3. Or use simple email-based access control

**Set User Roles:**
```sql
-- Example: Grant admin role to user
INSERT INTO user_organizations (user_id, organization_id, role, permissions)
VALUES (
  'user-uuid',
  'org-uuid',
  'admin',
  '{"can_manage_users": true, "can_approve_stages": ["all"]}'::jsonb
);
```

### 2. Customize Your Instance

**Branding:**
- Update organization logo (via setup or SQL)
- Customize colors in `/public/css/`
- Update organization name

**Workflow:**
- Modify workflow stages (Supabase → `workflow_stages` table)
- Add custom approval steps
- Configure notifications

### 3. Import Your Bylaws

**Via Google Docs:**
- Set up Apps Script (Step 6)
- Run "Parse into Small Sections"
- Sections auto-import

**Via API:**
```bash
curl -X POST https://your-app.onrender.com/bylaws/api/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "docId": "your-doc-id",
    "sections": [...]
  }'
```

**Via Database:**
```sql
-- Direct insert (for testing)
INSERT INTO document_sections (document_id, section_number, section_title, original_text)
VALUES ('doc-uuid', 'Article I, Section 1', 'Name', 'The name of this organization...');
```

### 4. Train Your Team

**For Committee Members:**
- How to view suggestions
- How to lock sections with selected amendments
- How to add notes

**For Board Members:**
- How to review committee selections
- How to approve final amendments
- How to export approved changes

**For Members:**
- How to submit suggestions
- How to vote on suggestions
- How to track progress

### 5. Set Up Backups

**Supabase Automatic Backups:**
- Free tier: 7 days of point-in-time recovery
- Paid tier: 30 days
- Go to: Dashboard → Database → Backups

**Manual Export:**
```bash
# Export all data
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  > backup.sql
```

### 6. Monitor Usage

**Render Metrics:**
- Dashboard → Metrics
- Monitor: CPU, Memory, Requests

**Supabase Metrics:**
- Dashboard → Reports
- Monitor: Database size, API requests

**Set Up Alerts:**
- Configure email alerts for errors
- Set up uptime monitoring

---

## Security Best Practices

### 1. Protect Your Credentials

- ✅ Never commit `.env` file to Git
- ✅ Use strong database passwords (20+ characters)
- ✅ Rotate SESSION_SECRET periodically
- ✅ Enable 2FA on all accounts (GitHub, Render, Supabase)

### 2. Configure Row-Level Security (RLS)

Supabase RLS is already enabled in the schema. Verify:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`

### 3. Limit API Access

**Supabase:**
- Use `anon` key for public access (read-only)
- Use `service_role` key only in backend (never expose to frontend)
- Configure RLS policies for user access

**Render:**
- Enable HTTPS only (default)
- Set CORS headers appropriately
- Rate limit API endpoints (future enhancement)

### 4. Regular Updates

```bash
# Update dependencies monthly
npm update
npm audit fix

# Check for security vulnerabilities
npm audit
```

---

## Cost Estimate

### Free Tier (Forever Free)

| Service | Free Tier Limits | Cost |
|---------|-----------------|------|
| **Render** | 750 hours/month, sleeps after 15min inactivity | $0 |
| **Supabase** | 500MB database, 2GB bandwidth, 50MB file storage | $0 |
| **GitHub** | Unlimited public repositories | $0 |

**Total Monthly Cost: $0**

**Limitations:**
- App sleeps after 15 minutes (30-60 second cold start)
- 500MB database limit (stores ~50,000 sections)
- No custom domain (use yourapp.onrender.com)

### Paid Tier (Recommended for Production)

| Service | Paid Tier | Cost |
|---------|-----------|------|
| **Render Starter** | Always-on, custom domain, more resources | $7/month |
| **Supabase Pro** | 8GB database, 50GB bandwidth, daily backups | $25/month |
| **Custom Domain** | yourorganization.com | $12/year |

**Total Monthly Cost: ~$32/month**

**Benefits:**
- No sleep/downtime
- Custom domain
- More storage and bandwidth
- Better support
- Advanced features

---

## Success Checklist

After completing this guide, verify:

- [ ] Supabase project created and database schema applied
- [ ] Repository forked to your GitHub account
- [ ] Render service deployed and running
- [ ] Environment variables configured correctly
- [ ] Setup wizard completed successfully
- [ ] Organization created in database
- [ ] Can access main bylaws tracker page
- [ ] (Optional) Google Docs integration working
- [ ] (Optional) Sample sections imported

**Congratulations! Your Bylaws Amendment Tracker is live!** 🎉

---

## Additional Resources

- **Deployment Guide**: `/docs/DEPLOYMENT_TO_RENDER.md`
- **Architecture Overview**: `/database/ARCHITECTURE_DESIGN.md`
- **API Documentation**: `/docs/API_REFERENCE.md`
- **Configuration Guide**: `/CONFIGURATION_GUIDE.md`
- **Troubleshooting**: `/docs/TROUBLESHOOTING.md`

---

**Version**: 1.0.0
**Last Updated**: 2025-10-09
**Estimated Setup Time**: 30-45 minutes
**Difficulty**: Beginner-Friendly

**Questions or Issues?** Open an issue on GitHub or contact your administrator.
