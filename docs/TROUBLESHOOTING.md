# Troubleshooting Guide

Complete troubleshooting guide for common issues with the Bylaws Amendment Tracker.

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Deployment Issues](#deployment-issues)
3. [Database Problems](#database-problems)
4. [Setup Wizard Issues](#setup-wizard-issues)
5. [Google Docs Integration](#google-docs-integration)
6. [Performance Issues](#performance-issues)
7. [Authentication Problems](#authentication-problems)
8. [Data Import/Export](#data-importexport)
9. [API Errors](#api-errors)
10. [Getting Help](#getting-help)

---

## Quick Diagnostics

### Run This First

**1. Check Application Health:**
```bash
curl https://your-app.onrender.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-09T..."
}
```

**2. Check Environment Variables:**
```bash
# In Render dashboard → Environment tab
# Verify all required variables are present
```

**3. Check Logs:**
- Render: Dashboard → Logs
- Supabase: Dashboard → Logs
- Browser: Developer Console (F12)

---

## Deployment Issues

### App Won't Start on Render

**Symptoms:**
- Build succeeds but app crashes
- "Application error" page
- Service shows "Deploying" indefinitely

**Solutions:**

**1. Check Build Logs**
```
Render Dashboard → Your Service → Logs → Build
```

Look for:
```
npm ERR! missing script: start
```

**Fix:** Verify `package.json` has start script:
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

**2. Check Runtime Logs**
```
Render Dashboard → Your Service → Logs → Runtime
```

Common errors and fixes:

**Error:** `Cannot find module 'express'`
```bash
# Fix: Ensure dependencies are in package.json
npm install express --save
git commit -am "Add missing dependencies"
git push
```

**Error:** `SUPABASE_URL is not defined`
```
Fix: Add environment variable in Render dashboard
Settings → Environment → Add Variable
```

**Error:** `Port binding error`
```javascript
// Fix: Use process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Build Fails

**Error:** `npm ERR! code ELIFECYCLE`

**Solutions:**

1. **Check Node version:**
```json
// package.json - specify Node version
{
  "engines": {
    "node": ">=16.0.0"
  }
}
```

2. **Clear cache and rebuild:**
```
Render Dashboard → Manual Deploy → Clear build cache & deploy
```

3. **Check for missing files:**
```bash
# Ensure these exist
ls -la package.json
ls -la server.js
ls -la package-lock.json
```

### Deployment Timeout

**Symptoms:**
- Build exceeds 15 minutes
- Render shows timeout error

**Solutions:**

1. **Optimize build:**
```json
// package.json
{
  "scripts": {
    "build": "npm ci --production"
  }
}
```

2. **Reduce dependencies:**
```bash
npm prune
npm audit fix
```

3. **Upgrade plan:**
- Free tier has limited resources
- Consider Starter plan ($7/month)

---

## Database Problems

### Connection Failed

**Error:** `Database connection error` or `ECONNREFUSED`

**Check:**

1. **Supabase URL format:**
```env
# ✅ Correct
SUPABASE_URL=https://abcdefgh.supabase.co

# ❌ Wrong
SUPABASE_URL=https://abcdefgh.supabase.co/
SUPABASE_URL=http://abcdefgh.supabase.co
```

2. **Supabase project status:**
- Dashboard → Check project is active (not paused)
- Free tier pauses after 7 days inactivity

3. **Network connectivity:**
```bash
# Test connection
curl https://abcdefgh.supabase.co/rest/v1/
# Should return API documentation, not error
```

**Fix:**
1. Verify SUPABASE_URL has no trailing slash
2. Ensure SUPABASE_ANON_KEY is complete (very long string)
3. Restart Supabase project if paused

### Tables Don't Exist

**Error:** `relation "organizations" does not exist`

**Solution:**

**1. Run database schema:**
```sql
-- In Supabase SQL Editor
-- Copy/paste from: /database/migrations/001_generalized_schema.sql
-- Click "Run"
```

**2. Verify tables:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Should show:
- organizations
- documents
- document_sections
- suggestions
- workflow_templates
- (and 6 more)

### RLS Blocking Queries

**Error:** `permission denied for table organizations`

**Symptoms:**
- Queries return empty results
- Setup wizard can't create organization

**Debug:**
```sql
-- Temporarily disable RLS (development only!)
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
```

**Permanent Fix:**

1. **Check auth setup:**
```sql
-- Verify auth.uid() returns something
SELECT auth.uid();
```

2. **Update RLS policy for anon access:**
```sql
-- Allow anonymous inserts during setup
CREATE POLICY "Allow anon insert during setup"
  ON organizations
  FOR INSERT
  WITH CHECK (true);
```

3. **Or disable RLS for setup:**
```sql
-- Only for organizations table during setup
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Re-enable after setup complete
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
```

### Data Not Persisting

**Symptoms:**
- Data inserted but disappears
- SELECT shows empty results after INSERT

**Check:**

1. **Transaction rollback:**
```sql
-- Check for uncommitted transactions
SELECT * FROM pg_stat_activity;
```

2. **RLS policies:**
```sql
-- Check policies allow SELECT
SELECT * FROM pg_policies WHERE tablename = 'organizations';
```

3. **Trigger errors:**
```sql
-- Check trigger logs
SELECT * FROM pg_stat_user_functions;
```

---

## Setup Wizard Issues

### Wizard Doesn't Load

**Symptoms:**
- Redirects to error page
- Shows "Setup not found"
- Blank screen

**Solutions:**

1. **Check if already configured:**
```sql
-- In Supabase SQL Editor
SELECT * FROM organizations WHERE is_configured = TRUE;
```

If rows exist, setup is complete. Go to `/bylaws` directly.

2. **Force setup mode:**
```env
# Add to Render environment variables
ENABLE_SETUP_WIZARD=true
```

3. **Clear database (fresh start):**
```sql
-- ⚠️ WARNING: Deletes all data!
DELETE FROM organizations;
```

### Setup Hangs on "Processing"

**Symptoms:**
- Processing screen stays forever
- Progress bar doesn't move
- No error message

**Debug:**

1. **Check browser console (F12):**
```javascript
// Look for error messages
// Typical issue: /setup/status endpoint failing
```

2. **Check /setup/status endpoint:**
```bash
curl https://your-app.onrender.com/setup/status
```

Expected:
```json
{
  "status": "complete",
  "completedSteps": ["organization", "document", "workflow", ...]
}
```

**Solutions:**

1. **Clear session:**
```javascript
// In browser console
fetch('/setup/clear-session', {method: 'POST'})
  .then(() => location.reload());
```

2. **Check server logs:**
```
Render → Logs → Look for:
[SETUP] Processing step: organization
[SETUP] Error: ...
```

3. **Manual completion:**
```sql
-- Mark organization as configured
UPDATE organizations
SET is_configured = TRUE
WHERE id = 'your-org-id';
```

### Can't Upload Logo

**Error:** `File too large` or `Invalid file type`

**Solutions:**

1. **Check file size:**
- Maximum: 10MB
- Compress image if larger

2. **Check file type:**
- Allowed: PNG, JPG, SVG
- Not allowed: GIF, BMP, TIFF

3. **Increase limit:**
```javascript
// server.js
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  }
});
```

---

## Google Docs Integration

### Menu Doesn't Appear

**Solutions:**

1. **Refresh document:**
- Close and reopen Google Doc
- Wait 5-10 seconds

2. **Check script saved:**
- Extensions → Apps Script
- Verify code is present

3. **Check onOpen() function:**
```javascript
function onOpen() {
  DocumentApp.getUi()
    .createMenu('🔧 Bylaws Sync')
    .addItem('Parse into Small Sections', 'parseBylawsIntoSections')
    .addToUi();
}
```

### "Failed to connect to server"

**Error:** `Exception: Request failed for https://... returned code 404`

**Solutions:**

1. **Verify APP_URL:**
```javascript
const APP_URL = 'https://bylaws-tracker.onrender.com'; // ← Check this
```

Must be:
- Your actual Render URL
- Include `https://`
- No trailing slash

2. **Test API manually:**
```bash
curl https://bylaws-tracker.onrender.com/api/health
```

3. **Check CORS:**
```javascript
// server.js - must allow Google Docs origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```

### Sections Not Parsing

**Symptoms:**
- Script completes but no sections in tracker
- Wrong sections detected
- Missing sections

**Solutions:**

1. **Check document structure:**
```
✅ Correct:
Article I: Name
  Section 1: Official Name
    The name shall be...

❌ Wrong:
1. Name
  1.1 Official Name
    The name shall be...
```

2. **Adjust regex patterns:**
```javascript
const CONFIG = {
  articlePattern: /Article\s+([IVXLCDM]+)/i,  // Try variations
  sectionPattern: /Section\s+(\d+)/i,
};
```

3. **Test pattern matching:**
```javascript
function testPatterns() {
  const text = "Article I: Name\nSection 1: Purpose";
  Logger.log(text.match(/Article\s+([IVXLCDM]+)/i));
  Logger.log(text.match(/Section\s+(\d+)/i));
}
```

---

## Performance Issues

### App is Slow

**Symptoms:**
- Pages take >10 seconds to load
- First request after inactivity is very slow

**Cause:** Free tier limitations

**Free tier behavior:**
- Sleeps after 15 minutes inactivity
- First request takes 30-60 seconds (cold start)
- Subsequent requests are fast

**Solutions:**

1. **Accept cold starts (free):**
- No changes needed
- First visitor each 15 minutes experiences delay

2. **Keep-alive service (free):**
```bash
# Set up external ping (e.g., UptimeRobot)
# Pings your app every 5 minutes
# Keeps it awake during business hours
```

3. **Upgrade to paid tier ($7/month):**
- Render Starter plan
- Always-on, no cold starts
- Better performance

### Database Queries Slow

**Symptoms:**
- Queries take >5 seconds
- Table scans in logs

**Solutions:**

1. **Add indexes:**
```sql
-- Index on frequently queried columns
CREATE INDEX idx_sections_doc_number
  ON document_sections(document_id, section_number);

CREATE INDEX idx_suggestions_doc_status
  ON suggestions(document_id, status);
```

2. **Analyze tables:**
```sql
VACUUM ANALYZE;
```

3. **Check query plans:**
```sql
EXPLAIN ANALYZE
SELECT * FROM document_sections WHERE document_id = 'xxx';
```

### High Memory Usage

**Symptoms:**
- Render shows high memory usage
- App crashes with out-of-memory

**Solutions:**

1. **Limit query results:**
```javascript
// Add pagination
const { data, error } = await supabase
  .from('document_sections')
  .select('*')
  .limit(100); // Don't load all at once
```

2. **Implement caching:**
```javascript
const cache = new Map();

function getCachedOrganization(id) {
  if (cache.has(id)) return cache.get(id);
  const org = await fetchOrganization(id);
  cache.set(id, org);
  return org;
}
```

3. **Upgrade plan:**
- Free: 512MB RAM
- Starter: 1GB RAM

---

## Authentication Problems

### Session Not Persisting

**Symptoms:**
- Logged out on page refresh
- Session lost randomly

**Solutions:**

1. **Check SESSION_SECRET:**
```env
# Must be set and consistent
SESSION_SECRET=your-secret-key
```

2. **Check cookie settings:**
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

3. **Check HTTPS:**
- Production must use HTTPS for secure cookies
- Render provides HTTPS automatically

### Can't Access Protected Routes

**Error:** `401 Unauthorized` or redirects to login

**Debug:**

1. **Check auth middleware:**
```javascript
app.use(async (req, res, next) => {
  console.log('Session:', req.session);
  console.log('User:', req.session?.user);
  next();
});
```

2. **Verify session storage:**
```javascript
req.session.save((err) => {
  if (err) console.error('Session save error:', err);
});
```

---

## Data Import/Export

### Import Fails

**Error:** `Invalid section format` or data not appearing

**Solutions:**

1. **Check JSON format:**
```json
// ✅ Correct
{
  "sections": [
    {
      "citation": "Article I, Section 1",
      "title": "Name",
      "text": "The name..."
    }
  ]
}
```

2. **Validate required fields:**
```javascript
// All sections must have:
- citation (string)
- title (string)
- text (string)
```

3. **Check encoding:**
```bash
# Convert to UTF-8 if needed
iconv -f ISO-8859-1 -t UTF-8 input.json > output.json
```

### Export Incomplete

**Symptoms:**
- Missing sections in export
- Export file is empty

**Debug:**

1. **Check database:**
```sql
SELECT COUNT(*) FROM document_sections
WHERE locked_by_committee = TRUE;
```

2. **Verify export endpoint:**
```bash
curl https://your-app.onrender.com/bylaws/api/export/committee
```

3. **Check logs for errors:**
```
Render → Logs → Search for "export"
```

---

## API Errors

### 404 Not Found

**Error:** `Cannot GET /bylaws/api/sections`

**Cause:** Route not defined or incorrect URL

**Solutions:**

1. **Check route exists:**
```javascript
// server.js
app.get('/bylaws/api/sections/:docId', ...);
```

2. **Verify URL:**
```bash
# ✅ Correct
curl https://app.com/bylaws/api/sections/doc-id

# ❌ Wrong
curl https://app.com/api/sections/doc-id
```

### 500 Internal Server Error

**Generic server error**

**Debug:**

1. **Check server logs:**
```
Render → Logs → Look for error stack trace
```

2. **Add error handling:**
```javascript
app.get('/api/endpoint', async (req, res) => {
  try {
    // ... code
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### CORS Errors

**Error:** `Access-Control-Allow-Origin header is missing`

**Solutions:**

1. **Enable CORS:**
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});
```

2. **Or use cors package:**
```bash
npm install cors
```

```javascript
const cors = require('cors');
app.use(cors());
```

---

## Getting Help

### Before Asking for Help

**Collect this information:**

1. **Error messages:**
   - Full error text
   - Stack traces
   - Screenshots

2. **Environment:**
   - Render URL
   - Node version: `node --version`
   - App version/commit

3. **Steps to reproduce:**
   - What you did
   - What you expected
   - What actually happened

4. **Logs:**
   - Render logs (last 50 lines)
   - Supabase logs
   - Browser console errors

### Support Resources

**Documentation:**
- Installation Guide: `/docs/INSTALLATION_GUIDE.md`
- API Reference: `/docs/API_REFERENCE.md`
- Architecture: `/database/ARCHITECTURE_DESIGN.md`

**Community:**
- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share solutions

**Professional Support:**
- Render Support: https://render.com/support
- Supabase Support: https://supabase.com/support

### Diagnostic Script

Run this to collect diagnostic information:

```bash
#!/bin/bash
# diagnostic.sh

echo "=== Bylaws Tracker Diagnostics ==="
echo ""

echo "1. Environment Variables:"
env | grep -E "(NODE_ENV|PORT|SUPABASE_URL|APP_URL)" | sed 's/=.*/=***/'

echo ""
echo "2. Health Check:"
curl -s https://your-app.onrender.com/api/health | jq .

echo ""
echo "3. Database Connection:"
curl -s "https://your-project.supabase.co/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" | head -n 5

echo ""
echo "4. Recent Logs:"
# Copy from Render dashboard

echo ""
echo "=== End Diagnostics ==="
```

---

## Quick Reference

### Common Solutions

| Issue | Quick Fix |
|-------|-----------|
| App won't start | Check `PORT` and `start` script |
| DB connection fails | Verify `SUPABASE_URL` (no trailing slash) |
| Setup wizard loops | Check `is_configured` flag in DB |
| Session not persisting | Set `SESSION_SECRET` |
| CORS errors | Add CORS headers to server |
| Slow performance | Upgrade from free tier |
| Google Docs fails | Update `APP_URL` in script |
| Import fails | Validate JSON format |

### Emergency Fixes

**Reset Everything:**
```sql
-- ⚠️ DELETES ALL DATA
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Re-run schema script
```

**Clear Sessions:**
```sql
-- If using database sessions
DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '1 day';
```

**Restart App:**
```
Render Dashboard → Manual Deploy → Deploy
```

---

**Last Updated:** 2025-10-09
**Version:** 1.0.0
