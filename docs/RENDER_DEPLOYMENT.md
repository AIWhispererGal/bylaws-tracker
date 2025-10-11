# Render Deployment Guide

## Overview

This application is optimized for deployment on Render with:
- ✅ Zero-configuration database (uses Supabase)
- ✅ One-click deployment via `render.yaml`
- ✅ Auto-deploy on Git push
- ✅ Built-in health checks
- ✅ Free tier compatible

---

## Deployment Methods

### Method 1: One-Click Deploy (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. **Click Deploy Button** (add to README.md):
   ```markdown
   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
   ```

2. **Configure Supabase**:
   - Create project at https://supabase.com
   - Get URL and anon key from Settings → API
   - Run database migrations (see below)

3. **Fill in Render Form**:
   - **SUPABASE_URL**: `https://xxxxx.supabase.co`
   - **SUPABASE_ANON_KEY**: Your anon key
   - **SESSION_SECRET**: Auto-generated
   - Click "Apply"

4. **Wait for Deploy** (~3-5 minutes)

5. **Complete Setup Wizard**:
   - Visit your app URL
   - Follow setup wizard steps
   - Upload organization logo and bylaws document

### Method 2: Manual Deployment

1. **Create New Web Service**:
   - Go to https://render.com/dashboard
   - Click "New +" → "Web Service"
   - Connect your Git repository

2. **Configure Build**:
   ```
   Name: bylaws-amendment-tracker
   Environment: Node
   Region: Oregon (or closest to you)
   Branch: main
   Build Command: npm install
   Start Command: npm start
   ```

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SESSION_SECRET=[Generate Value]
   SETUP_MODE=enabled
   ```

4. **Configure Advanced Settings**:
   - Health Check Path: `/api/health`
   - Auto-Deploy: Yes

5. **Deploy**

---

## Database Setup (Supabase)

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: Bylaws Tracker Production
   - **Database Password**: Strong password (save it!)
   - **Region**: Same as Render region (Oregon → US West)
4. Wait for project to initialize (~2 minutes)

### 2. Run Migrations

**Option A: Via Supabase SQL Editor** (Recommended)

1. In Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste each migration file in order:

   **Migration 1: Core Schema**
   ```sql
   -- Copy contents of: database/migrations/001_generalized_schema.sql
   -- Run this first
   ```

   **Migration 2: Data Migration (if upgrading)**
   ```sql
   -- Copy contents of: database/migrations/002_migrate_existing_data.sql
   -- Run only if migrating from old schema
   ```

4. Click "Run" for each

**Option B: Via psql CLI**

```bash
# Get connection string from Supabase → Settings → Database
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f database/migrations/001_generalized_schema.sql

psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f database/migrations/002_migrate_existing_data.sql
```

### 3. Verify Migrations

Run this query in Supabase SQL Editor:

```sql
-- Should return all created tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- - organizations
-- - users
-- - user_organizations
-- - documents
-- - document_sections
-- - amendments
-- - amendment_sections
-- - comments
-- - workflows
-- - workflow_stages
-- - stage_transitions
```

### 4. Enable Row Level Security (RLS)

For production, enable RLS on all tables:

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE amendment_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;

-- Example policy (customize for your needs)
CREATE POLICY "Users can view their org data"
ON organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id
    FROM user_organizations
    WHERE user_id = auth.uid()
  )
);

-- Add more policies as needed for INSERT, UPDATE, DELETE
```

---

## Health Check Configuration

### Current Health Check Endpoint

Location: `/api/health` (already implemented in `server.js`)

**What it checks**:
- ✅ Server is running
- ✅ Database connection (via Supabase)
- ✅ Returns JSON status

**Endpoint Code** (lines 240-269 in `server.js`):
```javascript
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection by querying a simple table
    const { data, error } = await supabase
      .from('bylaw_sections')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Health check failed:', error);
      return res.status(500).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message
      });
    }

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### Health Check Configuration in Render

**In render.yaml** (already configured):
```yaml
services:
  - type: web
    healthCheckPath: /api/health
```

**In Render Dashboard**:
- Settings → Health & Alerts
- Health Check Path: `/api/health`
- Health Check Interval: 30 seconds (default)
- Unhealthy Threshold: 3 failures (default)

### Testing Health Check

```bash
# Local testing
curl http://localhost:3000/api/health

# Production testing
curl https://your-app.onrender.com/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-09T12:34:56.789Z"
}
```

### Enhanced Health Check (Optional)

For more comprehensive monitoring, enhance the health check:

```javascript
// Enhanced health check (add to server.js)
app.get('/api/health', async (req, res) => {
  const checks = {
    server: 'healthy',
    database: 'unknown',
    setup: 'unknown',
    timestamp: new Date().toISOString()
  };

  try {
    // Check database connection
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      checks.database = 'disconnected';
      checks.server = 'unhealthy';
    } else {
      checks.database = 'connected';
      checks.setup = data && data.length > 0 ? 'complete' : 'pending';
    }

    const statusCode = checks.server === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);

  } catch (error) {
    console.error('Health check error:', error);
    checks.server = 'unhealthy';
    checks.error = error.message;
    res.status(503).json(checks);
  }
});
```

---

## File Storage Strategy

### Current Implementation: Local Ephemeral Storage

**Location**: `uploads/setup/` (created by multer)

**Pros**:
- ✅ Simple, no external dependencies
- ✅ Works out-of-box on Render
- ✅ No additional costs
- ✅ Fast local access

**Cons**:
- ⚠️ Files lost on restart/redeploy
- ⚠️ Not shared across multiple instances
- ⚠️ Limited to instance disk space

**Current Usage**:
1. **Logo Upload** (`src/routes/setup.js:79`):
   - Uploaded to `uploads/setup/setup-[timestamp]-[random].png`
   - Stored path in database
   - ⚠️ File reference breaks on restart

2. **Document Upload** (`src/routes/setup.js:240`):
   - Uploaded to `uploads/setup/setup-[timestamp]-[random].docx`
   - Immediately parsed by Mammoth.js
   - File can be deleted after parsing (not currently done)

### Recommendation for Production

**For Setup Wizard** (current use case):
- ✅ **Keep local storage** - files are temporary
- ✅ **Parse immediately** - extract text, then delete file
- ✅ **Store logo in database** - convert to base64 or URL

**Implementation**:
```javascript
// After parsing document
const { data: documentData } = await parseDocument(filePath);

// Store parsed content in database
await supabase.from('documents').insert(documentData);

// Delete file immediately (free up space)
await fs.unlink(filePath);
```

**For User-Uploaded Content** (future):
- 🎯 **Migrate to Supabase Storage**:
  - Built-in with Supabase
  - CDN delivery
  - Access control with RLS

- 📝 **Migration Steps**:
  ```javascript
  // Replace multer with Supabase Storage
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(`${orgId}/${filename}`, file);

  // Get public URL
  const { publicURL } = supabase.storage
    .from('documents')
    .getPublicUrl(data.path);
  ```

### Render Disk Storage Plans

| Plan | Disk | Cost | Persistence |
|------|------|------|-------------|
| Free | Ephemeral | $0 | ❌ Lost on restart |
| Starter | Ephemeral | $7/mo | ❌ Lost on restart |
| Standard | Persistent | $25/mo | ✅ Persistent disk available |

**Note**: Even paid plans use ephemeral disk by default. Add persistent disk separately.

---

## Auto-Deploy Configuration

### Current Setup (render.yaml)

```yaml
services:
  - type: web
    autoDeploy: true  # ✅ Already enabled
```

### How It Works

1. **Git Push Triggers Deploy**:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   # Render automatically starts build & deploy
   ```

2. **Build Process**:
   - Render pulls latest code
   - Runs `npm install`
   - Starts with `npm start`
   - Runs health check
   - Switches traffic to new version

3. **Zero-Downtime Deploy**:
   - Old version keeps running
   - New version tested with health check
   - Traffic switched only if healthy
   - Old version terminated

### Manual Deploy

**When to use**:
- Testing without git push
- Deploying specific commit
- Rollback to previous version

**Steps**:
1. Render Dashboard → Your Service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Or: "Manual Deploy" → Select specific commit

### Deploy Triggers

**Automatic triggers**:
- ✅ Push to `main` branch
- ✅ Merge pull request to `main`
- ✅ Update environment variable (optional, can disable)

**Configure in Render**:
- Settings → Build & Deploy
- Auto-Deploy: On/Off
- Branch: `main` (or custom)

### Deploy Notifications

**Set up alerts**:
1. Render Dashboard → Your Service → Settings
2. Notifications → Add Integration
3. Options:
   - Email notifications
   - Slack webhook
   - Discord webhook
   - Custom webhook

**Events to monitor**:
- Deploy started
- Deploy succeeded
- Deploy failed
- Service suspended (payment issue)

---

## Build & Start Scripts

### Current Configuration

**In package.json**:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

**In render.yaml**:
```yaml
buildCommand: npm install
startCommand: npm start
```

### Build Optimization

**Add build script** (optional):
```json
{
  "scripts": {
    "start": "node server.js",
    "build": "npm ci --only=production",
    "postinstall": "npm run build"
  }
}
```

**Benefits**:
- Faster installs with `npm ci`
- Removes dev dependencies in production
- Smaller deployment footprint

### Production Dependencies Only

**Update render.yaml**:
```yaml
buildCommand: npm ci --only=production
startCommand: npm start
```

**In package.json**, move dev dependencies:
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "express": "^4.18.2",
    // ... production deps only
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^30.2.0"
    // ... dev/test tools
  }
}
```

---

## Monitoring & Logging

### Render Logs

**View logs**:
1. Dashboard → Your Service → Logs
2. Real-time streaming
3. Filter by:
   - Deploy logs
   - Runtime logs
   - Error logs

**Log retention**:
- Free tier: 7 days
- Paid plans: 30 days
- Export logs for longer retention

### Log to Console

The app uses `console.log()` which Render captures:

```javascript
// Current logging in server.js
console.log(`Bylaws Amendment Tracker running on ${APP_URL}`);
console.log('Current Configuration:');
console.log(`- App URL: ${APP_URL}`);
console.log(`- Supabase: ${SUPABASE_URL ? 'Connected' : 'Not configured'}`);
```

### Structured Logging (Recommended)

For production, use structured logging:

```javascript
// Install: npm install winston
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Use in code
logger.info('Server started', { port: PORT, env: NODE_ENV });
logger.error('Database error', { error: error.message });
```

### External Monitoring (Optional)

**Options**:
1. **Uptime Monitoring**:
   - Uptime Robot (free)
   - Pingdom
   - StatusCake

2. **APM (Application Performance Monitoring)**:
   - New Relic (free tier)
   - DataDog
   - Sentry (error tracking)

3. **Log Aggregation**:
   - Papertrail
   - Logtail
   - Logflare

---

## Performance Optimization

### Current Performance

**Render Free Tier**:
- 512 MB RAM
- 0.1 CPU
- Spins down after 15 min inactivity
- Cold start: 30-60 seconds

### Optimization Strategies

#### 1. Keep-Alive (Not Recommended)
❌ Against Render's ToS to ping your own service

#### 2. Upgrade to Starter Plan ($7/mo)
✅ Always-on (no cold starts)
✅ 1 GB RAM
✅ Faster response times

#### 3. Enable Compression
```javascript
// Add to server.js
const compression = require('compression');
app.use(compression());
```

#### 4. Cache Static Assets
```javascript
// Add to server.js
app.use(express.static('public', {
  maxAge: '1d', // Cache for 1 day
  etag: true
}));
```

#### 5. Database Connection Pooling
Already handled by Supabase client

#### 6. Optimize Database Queries
```javascript
// Use select() to limit columns
const { data } = await supabase
  .from('organizations')
  .select('id, name') // Only needed columns
  .limit(10); // Limit results
```

---

## Security Checklist

### Pre-Deployment Security

- [ ] **Environment Variables**:
  - [ ] SESSION_SECRET is strong (32+ bytes random)
  - [ ] No secrets in code or Git
  - [ ] SUPABASE_ANON_KEY (not service_role)

- [ ] **Database Security**:
  - [ ] Row Level Security (RLS) enabled
  - [ ] Appropriate RLS policies
  - [ ] Database password is strong
  - [ ] No public tables without RLS

- [ ] **Application Security**:
  - [ ] HTTPS enforced (Render automatic)
  - [ ] Secure cookies in production
  - [ ] CSRF protection enabled
  - [ ] Input validation on all forms
  - [ ] File upload size limits

### Post-Deployment Security

- [ ] **Testing**:
  - [ ] Test HTTPS redirect
  - [ ] Verify secure cookies
  - [ ] Test CSRF protection
  - [ ] Validate file upload restrictions

- [ ] **Monitoring**:
  - [ ] Set up error alerts
  - [ ] Monitor failed login attempts
  - [ ] Review security logs

- [ ] **Updates**:
  - [ ] Enable Dependabot (GitHub)
  - [ ] Review npm audit regularly
  - [ ] Update dependencies monthly

### Security Headers (Recommended)

Add helmet.js for security headers:

```bash
npm install helmet
```

```javascript
// Add to server.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

---

## Troubleshooting

### Common Deploy Issues

#### 1. Build Fails
**Error**: `npm install` fails

**Solutions**:
- Check Node.js version compatibility
- Verify package.json syntax
- Review build logs for specific error
- Try `npm ci` instead of `npm install`

#### 2. Health Check Fails
**Error**: Service marked as unhealthy

**Solutions**:
- Check `/api/health` returns 200
- Verify SUPABASE_URL and ANON_KEY
- Review runtime logs for errors
- Check database connection

#### 3. Environment Variables Not Loading
**Error**: `undefined` values in app

**Solutions**:
- Verify variables set in Render dashboard
- Check spelling of variable names
- Restart service after adding variables
- Review logs for `process.env` values

#### 4. File Upload Fails
**Error**: Cannot upload files

**Solutions**:
- Check file size < 10MB
- Verify file type is allowed
- Check disk space (free tier limited)
- Review multer configuration

#### 5. Session Issues
**Error**: Users logged out frequently

**Solutions**:
- Check SESSION_SECRET is set
- Verify cookie settings (secure: true)
- Check session store configuration
- Review browser cookie policies

---

## Cost Estimation

### Free Tier (Current)
- **Cost**: $0/month
- **Includes**:
  - 750 hours/month (enough for 1 service)
  - 512 MB RAM
  - Ephemeral disk
  - Spin down after 15 min inactivity
  - HTTPS & custom domain
- **Best For**: Testing, low-traffic apps

### Starter Plan
- **Cost**: $7/month per service
- **Includes**:
  - Always-on (no spin down)
  - 1 GB RAM
  - Ephemeral disk
  - Email support
- **Best For**: Small production apps

### Standard Plan
- **Cost**: $25/month per service
- **Includes**:
  - 2 GB RAM
  - Persistent disk option (+$1/GB/month)
  - Priority support
  - Horizontal scaling
- **Best For**: Production apps with traffic

### External Services
- **Supabase**: $0-$25/month
  - Free: 500 MB database, 1 GB file storage
  - Pro: $25/month for more resources

- **Total Cost Estimate**:
  - **Development**: $0 (free tiers)
  - **Small Production**: $7-32/month (Render Starter + Supabase)
  - **Full Production**: $25-50/month (Render Standard + Supabase Pro)

---

## Quick Reference

### Essential Commands

```bash
# Deploy to Render
git push origin main  # Auto-deploys if configured

# Check logs
# Visit: Dashboard → Your Service → Logs

# Test health check
curl https://your-app.onrender.com/api/health

# Run migrations
# Visit: Supabase → SQL Editor → Run SQL
```

### Essential URLs

- **Render Dashboard**: https://dashboard.render.com
- **Supabase Dashboard**: https://app.supabase.com
- **Application URL**: `https://your-app.onrender.com`
- **Health Check**: `https://your-app.onrender.com/api/health`

### Support Resources

- **Render Docs**: https://render.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Node.js on Render**: https://render.com/docs/deploy-node-express-app
- **Community**: https://community.render.com

---

**Last Updated**: October 9, 2025
**Render Version**: Blueprint v1
**Node.js Version**: 18.x (LTS)
