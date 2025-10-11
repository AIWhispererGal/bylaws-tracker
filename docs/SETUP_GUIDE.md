# Bylaws Amendment Tracker: Setup Guide

## Quick Start (< 30 Minutes)

This guide will help you deploy the Bylaws Amendment Tracker for a new organization in under 30 minutes.

## Prerequisites

### Required Software
- Node.js v16+ ([Download](https://nodejs.org))
- npm v8+
- Git
- Web browser (Chrome, Firefox, Safari, or Edge)

### Required Services
- Supabase account (free tier works) - [Sign up](https://supabase.com)
- Google Workspace account (optional, for Google Docs integration)

## Step-by-Step Setup

### Step 1: Clone Repository (2 minutes)

```bash
git clone https://github.com/your-org/bylaws-amendment-tracker.git
cd bylaws-amendment-tracker

# Install dependencies
npm install
```

### Step 2: Database Setup (5 minutes)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization and project name
   - Select region closest to your users
   - Wait for project creation (~2 minutes)

2. **Get Connection Details**
   - Copy Project URL: `https://xxxxx.supabase.co`
   - Copy Anon/Public Key from Settings → API

3. **Run Database Schema**
   - Go to Supabase Dashboard → SQL Editor
   - Copy contents from `/database/schema.sql`
   - Paste and click "Run"
   - Verify tables created in Table Editor

### Step 3: Configuration (10 minutes)

1. **Create Environment File**

Create `.env` file in project root:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Application Settings
APP_URL=http://localhost:3000
PORT=3000

# Organization Settings
DEFAULT_ORG_ID=your-org-identifier
ORG_NAME=Your Organization Name
ORG_TYPE=neighborhood_council

# Workflow Configuration (1-5 stages, comma-separated)
WORKFLOW_STAGES=Community Input,Committee Review,Board Approval

# Document Hierarchy (optional, defaults to Article/Section)
HIERARCHY_LEVEL1=Article
HIERARCHY_LEVEL2=Section
NUMBERING_LEVEL1=roman
NUMBERING_LEVEL2=decimal

# Optional: Google Docs Integration
GOOGLE_DOC_ID=your-google-doc-id-here
```

2. **Configure Workflow Stages**

Choose your workflow (1-5 stages):

**Option A: Simple Approval (1 stage)**
```env
WORKFLOW_STAGES=Approval
```

**Option B: Committee & Board (2 stages) - DEFAULT**
```env
WORKFLOW_STAGES=Committee Review,Board Approval
```

**Option C: Community Process (3 stages)**
```env
WORKFLOW_STAGES=Community Input,Committee Review,Board Approval
```

**Option D: Corporate (4 stages)**
```env
WORKFLOW_STAGES=Draft,Legal Review,Executive Review,Board Vote
```

**Option E: Academic (5 stages - MAXIMUM)**
```env
WORKFLOW_STAGES=Faculty Draft,Department Review,Legal Review,Senate Review,President Approval
```

3. **Configure Document Hierarchy**

Choose your document structure:

**Option A: Traditional Bylaws (default)**
```env
HIERARCHY_LEVEL1=Article
HIERARCHY_LEVEL2=Section
NUMBERING_LEVEL1=roman    # I, II, III, IV
NUMBERING_LEVEL2=decimal  # 1, 2, 3, 4
```

**Option B: Chapter-Based**
```env
HIERARCHY_LEVEL1=Chapter
HIERARCHY_LEVEL2=Article
HIERARCHY_LEVEL3=Section
NUMBERING_LEVEL1=decimal
NUMBERING_LEVEL2=roman
NUMBERING_LEVEL3=decimal
```

**Option C: Simple Numbered**
```env
HIERARCHY_LEVEL1=Section
NUMBERING_LEVEL1=decimal  # 1, 2, 3, 4
```

**Option D: Corporate Documents**
```env
HIERARCHY_LEVEL1=Part
HIERARCHY_LEVEL2=Section
HIERARCHY_LEVEL3=Subsection
NUMBERING_LEVEL1=alpha    # A, B, C, D
NUMBERING_LEVEL2=decimal  # 1, 2, 3, 4
NUMBERING_LEVEL3=decimal  # 1, 2, 3, 4
```

### Step 4: Initialize Database (5 minutes)

Run the migration script:

```bash
# Install UUID package if not present
npm install uuid

# Run migration
node database/migrations/001-generalize-schema.js

# Or if using Knex/migration tool
npm run migrate
```

This creates:
- Organizations table
- Adds `organization_id` to all tables
- Creates default organization
- Migrates any existing data

### Step 5: Parse Initial Document (5 minutes)

If you have existing bylaws document:

```bash
# Place your bylaws text file in project root
# Example: MYBYLAWS.txt

# Update parse_bylaws.js with your file path
# Then run:
node parse_bylaws.js
```

This generates `parsed_sections.json` which can be imported via the UI.

### Step 6: Start Application (1 minute)

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

Open browser to [http://localhost:3000](http://localhost:3000)

### Step 7: Test Everything (5 minutes)

1. **Verify Section Loading**
   - Go to `/bylaws`
   - Sections should load if imported
   - Check hierarchy displays correctly

2. **Test Suggestion Creation**
   - Click on any section
   - Create a test suggestion
   - Verify it appears

3. **Test Workflow**
   - Select a suggestion
   - Lock section (moves to first workflow stage)
   - Verify workflow stage is correct

4. **Test Export**
   - Click "Export Committee Selections"
   - Verify JSON downloads correctly

## Google Docs Integration (Optional)

### Setup Google Apps Script

1. **Open Your Google Doc**
   - The document containing your bylaws

2. **Open Script Editor**
   - Extensions → Apps Script

3. **Add Code**
   - Copy from `/google-apps-script/Code.gs`
   - Paste into script editor
   - Save with name "Bylaws Sync"

4. **Configure**
   - Update `APP_URL` in script to your deployment URL
   - For local testing: Use ngrok or similar tunnel

5. **Authorize**
   - Run any function
   - Grant permissions when prompted

6. **Add Menu**
   - Refresh Google Doc
   - See "Bylaws" menu appear
   - Click "Sync with Tracker"

## Production Deployment

### Option A: Render.com (Recommended)

1. **Create Account**: [render.com](https://render.com)

2. **New Web Service**
   - Connect GitHub repository
   - Name: `your-org-bylaws-tracker`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Environment Variables**
   - Add all variables from `.env`
   - Update `APP_URL` to Render URL

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (~3 minutes)

### Option B: Heroku

```bash
# Install Heroku CLI
# Then:
heroku create your-org-bylaws-tracker
heroku config:set SUPABASE_URL=your-url
heroku config:set SUPABASE_ANON_KEY=your-key
# ... set all environment variables
git push heroku main
```

### Option C: DigitalOcean App Platform

1. Create new app
2. Connect GitHub repository
3. Set environment variables
4. Deploy

### Option D: Self-Hosted (VPS)

```bash
# On your server:
git clone https://github.com/your-org/bylaws-amendment-tracker.git
cd bylaws-amendment-tracker
npm install
npm install -g pm2

# Create .env file with production settings
pm2 start server.js --name bylaws-tracker
pm2 save
pm2 startup
```

## Post-Deployment Checklist

- [ ] Database connected and tables created
- [ ] Environment variables configured
- [ ] Organization created in database
- [ ] Workflow stages configured (1-5 stages)
- [ ] Document hierarchy configured
- [ ] Initial sections parsed and imported
- [ ] Test suggestion creation works
- [ ] Test workflow progression works
- [ ] Test export functionality works
- [ ] Google Docs integration (if using)
- [ ] SSL certificate configured (production)
- [ ] Backup strategy implemented
- [ ] User training scheduled

## Troubleshooting

### Database Connection Errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check Supabase project is active (not paused)
- Verify database tables exist

### Sections Not Loading
- Check `doc_id` in database matches expected value
- Verify `organization_id` is set correctly
- Check browser console for errors

### Workflow Not Advancing
- Verify user role/permissions configured
- Check workflow stages in configuration
- Review server logs for errors

### Google Apps Script Issues
- Reauthorize script permissions
- Verify `APP_URL` is accessible from Google
- Use ngrok for local development testing

## Next Steps

1. **Customize UI**: Update organization name, logo, colors
2. **Configure Permissions**: Set up user roles and access
3. **Train Users**: Hold training session for committee members
4. **Import Historical Data**: Migrate old amendment records
5. **Set Up Backups**: Configure automated database backups

## Support Resources

- **Documentation**: `/docs/` directory
- **Test Suite**: Run `node tests/run-tests.js`
- **Configuration Guide**: `/docs/CONFIGURATION_GUIDE.md`
- **Migration Guide**: `/docs/MIGRATION_GUIDE.md`

## Quick Reference Commands

```bash
# Start development server
npm run dev

# Run tests
node tests/run-tests.js

# Parse bylaws document
node parse_bylaws.js

# Run database migration
node database/migrations/001-generalize-schema.js

# Check configuration
node -e "require('dotenv').config(); console.log(process.env)"
```

## Deployment Timeframes

| Task | Time Estimate |
|------|---------------|
| Clone & Install | 2 minutes |
| Database Setup | 5 minutes |
| Configuration | 10 minutes |
| Initialize Database | 5 minutes |
| Parse Document | 5 minutes |
| Test | 5 minutes |
| **Total** | **~30 minutes** |

**Production Deployment Add:** +10-15 minutes

## Success! 🎉

Your Bylaws Amendment Tracker is now ready to use. Navigate to your deployment URL and start managing your governance documents with ease.
