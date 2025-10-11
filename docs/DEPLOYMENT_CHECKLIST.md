# Render Deployment Checklist

## Pre-Deployment Steps

### 1. Supabase Database Setup
- [ ] Create Supabase project at https://supabase.com
- [ ] Run database migrations in order:
  - [ ] `database/migrations/001_generalized_schema.sql`
  - [ ] `database/migrations/002_migrate_existing_data.sql` (if migrating)
- [ ] Note down from Supabase Dashboard → Settings → API:
  - [ ] Project URL (e.g., `https://xxxxx.supabase.co`)
  - [ ] Anonymous Key (public key)
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Verify database connection with a test query

### 2. Environment Variables Configuration
- [ ] Prepare all required environment variables (see ENV_SETUP.md)
- [ ] Generate secure SESSION_SECRET (use `openssl rand -hex 32`)
- [ ] Verify SUPABASE_URL and SUPABASE_ANON_KEY
- [ ] Set NODE_ENV=production
- [ ] Configure APP_URL (will be auto-assigned by Render)

### 3. Code Repository
- [ ] Ensure code is pushed to GitHub/GitLab
- [ ] Verify `render.yaml` is in repository root
- [ ] Check `.gitignore` excludes:
  - [ ] `.env` file
  - [ ] `node_modules/`
  - [ ] `uploads/` directory (local uploads only)
- [ ] Verify `package.json` has correct start script: `node server.js`

### 4. File Upload Strategy
- [ ] Decision: Keep local file storage (Render ephemeral disk)
  - ✅ Pro: Simple, no additional services
  - ⚠️ Con: Files lost on restart/redeploy
  - 📝 Note: Current setup uses `uploads/setup/` for document parsing
  - 💡 Files are processed immediately, not stored long-term
- [ ] Alternative: Implement cloud storage (future enhancement)
  - Consider Supabase Storage, AWS S3, or Cloudinary
  - Update `src/routes/setup.js` to use cloud storage

## Render Deployment Steps

### 5. Create New Web Service on Render
1. **Connect Repository**
   - [ ] Log in to https://render.com
   - [ ] Click "New +" → "Web Service"
   - [ ] Connect GitHub/GitLab account
   - [ ] Select repository: `BYLAWSTOOL_Generalized`

2. **Configure Service**
   - [ ] Name: `bylaws-amendment-tracker` (or custom)
   - [ ] Environment: `Node`
   - [ ] Region: `Oregon` (or preferred, free tier available)
   - [ ] Branch: `main`
   - [ ] Build Command: `npm install`
   - [ ] Start Command: `npm start`

3. **Set Environment Variables** (in Render Dashboard)
   ```
   NODE_ENV=production
   PORT=10000
   SESSION_SECRET=[auto-generate or use: openssl rand -hex 32]
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SETUP_MODE=enabled
   ```

4. **Configure Settings**
   - [ ] Health Check Path: `/api/health`
   - [ ] Auto-Deploy: ✅ Enable (auto-deploy on git push)
   - [ ] Instance Type: `Free` or `Starter` ($7/month for persistent disk)

### 6. Deploy
- [ ] Click "Create Web Service"
- [ ] Monitor build logs for errors
- [ ] Wait for deployment to complete (~2-5 minutes)

## Post-Deployment Verification

### 7. Health Checks
- [ ] Visit `https://your-app.onrender.com/api/health`
- [ ] Expected response:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "timestamp": "2025-10-09T..."
  }
  ```
- [ ] Verify logs show: `Bylaws Amendment Tracker running on https://your-app.onrender.com`

### 8. Setup Wizard Test
- [ ] Navigate to `https://your-app.onrender.com`
- [ ] Should redirect to `/setup` (first time)
- [ ] Complete setup wizard:
  - [ ] Step 1: Welcome screen
  - [ ] Step 2: Organization info (with logo upload)
  - [ ] Step 3: Hierarchy configuration
  - [ ] Step 4: Document import (.docx upload)
  - [ ] Step 5: Review and complete
- [ ] Verify organization created in Supabase
- [ ] Test redirect to main app after setup

### 9. Database Connection
- [ ] Check Render logs for Supabase connection
- [ ] Verify no connection errors in logs
- [ ] Test a few API endpoints:
  - [ ] GET `/bylaws/api/sections/:docId` → Returns sections
  - [ ] POST `/bylaws/api/suggestions` → Creates suggestion
  - [ ] GET `/bylaws/api/export/committee` → Exports data

### 10. File Upload Functionality
- [ ] Test document upload in setup wizard
- [ ] Verify .docx file parsing works
- [ ] Check logo upload in organization setup
- [ ] Note: Files stored in ephemeral disk (`/opt/render/project/src/uploads/`)
- [ ] ⚠️ Warning: Files will be lost on restart (acceptable for setup wizard)

### 11. Session & Security
- [ ] Verify HTTPS is enforced (Render auto-provides)
- [ ] Test session persistence across page reloads
- [ ] Verify CSRF protection is disabled for setup routes (as designed)
- [ ] Check secure cookies are enabled (`secure: true` in production)

## Ongoing Maintenance

### 12. Monitoring
- [ ] Set up Render email/Slack alerts for downtime
- [ ] Monitor Render logs: Dashboard → Your Service → Logs
- [ ] Check Supabase dashboard for database performance
- [ ] Set up log retention or external logging (optional)

### 13. Auto-Deploy Configuration
- [ ] Verify auto-deploy on `main` branch push
- [ ] Test by pushing a small change
- [ ] Monitor build and deployment logs
- [ ] Rollback plan: Render keeps deployment history

### 14. Database Migrations
- [ ] For future schema changes:
  1. Run migration SQL in Supabase SQL Editor
  2. Test in preview/staging environment first
  3. Document in `database/migrations/`
  4. Consider adding migration runner to app (future)

### 15. Scaling Considerations
- [ ] Free tier limitations:
  - ⚠️ Spins down after 15 min inactivity (cold starts)
  - ⚠️ 512 MB RAM limit
  - ⚠️ Ephemeral disk (no persistent file storage)
- [ ] Upgrade to Starter ($7/mo) for:
  - ✅ Always-on (no cold starts)
  - ✅ Persistent disk storage
  - ✅ 1 GB RAM
- [ ] For production: Consider Standard plan ($25/mo)

## Troubleshooting

### Common Issues

#### Build Failures
- **Symptom**: Build fails with npm errors
- **Solution**:
  - Check `package.json` for missing dependencies
  - Verify Node.js version compatibility
  - Review build logs for specific error

#### Database Connection Errors
- **Symptom**: Health check returns "database: disconnected"
- **Solution**:
  - Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
  - Check Supabase project is active (not paused)
  - Verify Supabase allows connections from Render IPs

#### Session Issues
- **Symptom**: Users logged out on page refresh
- **Solution**:
  - Verify SESSION_SECRET is set and persistent
  - Check cookie settings (secure: true in production)
  - Ensure session store is working

#### File Upload Failures
- **Symptom**: Document upload errors in setup wizard
- **Solution**:
  - Check file size < 10MB limit
  - Verify file type is .docx
  - Check disk space (free tier limited)
  - Review logs for multer errors

#### Cold Start Delays (Free Tier)
- **Symptom**: 30-60 second delay on first request
- **Solution**:
  - Upgrade to Starter plan for always-on
  - Or accept cold starts for low-traffic apps
  - Set up external pinger (not recommended, against ToS)

## Rollback Plan

### Quick Rollback
1. **Via Render Dashboard**:
   - Navigate to Dashboard → Your Service → Settings
   - Find "Manual Deploy" section
   - Select previous successful deployment
   - Click "Deploy"

2. **Via Git Revert**:
   ```bash
   git revert HEAD
   git push origin main
   # Auto-deploy will trigger with previous version
   ```

### Database Rollback
- **⚠️ Warning**: Database rollbacks are more complex
- Create database backups before major changes
- Use Supabase Point-in-Time Recovery (PITR) if available
- Keep migration rollback scripts in `database/migrations/rollback/`

## Success Criteria

✅ Deployment is successful when:
- [ ] Health check returns 200 OK with "status: healthy"
- [ ] Setup wizard completes without errors
- [ ] Organization data persists in Supabase
- [ ] Document upload and parsing works
- [ ] API endpoints respond correctly
- [ ] HTTPS is enforced
- [ ] Sessions persist across requests
- [ ] Auto-deploy triggers on git push
- [ ] Logs show no critical errors

## Next Steps After Deployment

1. **Custom Domain** (optional):
   - Add custom domain in Render settings
   - Update DNS records
   - Render auto-provisions SSL certificate

2. **Monitoring & Alerts**:
   - Set up Uptime Robot or similar
   - Configure Render email notifications
   - Consider APM tool (New Relic, DataDog)

3. **Backups**:
   - Set up Supabase automated backups
   - Export data regularly via API
   - Document restore procedures

4. **Performance Optimization**:
   - Enable compression middleware
   - Add caching headers
   - Consider CDN for static assets

5. **Security Hardening**:
   - Review and enable RLS policies in Supabase
   - Add rate limiting
   - Implement helmet.js security headers
   - Set up security scanning (Snyk, Dependabot)

---

**Deployment Date**: _________________
**Deployed By**: _________________
**App URL**: _________________
**Database**: _________________
**Notes**: _________________
