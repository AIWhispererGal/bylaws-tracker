# Render Deployment - Quick Start Guide

## 📋 What You Need

### 1. Supabase Account (Database)
- [ ] Create free account at https://supabase.com
- [ ] Create new project
- [ ] Note down:
  - **Project URL**: `https://xxxxx.supabase.co`
  - **Anon Key**: `eyJhbGci...` (long string)

### 2. Render Account (Hosting)
- [ ] Create free account at https://render.com
- [ ] Connect GitHub account

---

## 🚀 5-Minute Deployment

### Step 1: Setup Supabase Database (3 minutes)

1. **Create Project**:
   - Go to https://supabase.com
   - Click "New Project"
   - Name: "Bylaws Tracker Production"
   - Choose region close to you
   - Set strong password
   - Click "Create Project" (wait ~2 min)

2. **Run Database Migration**:
   - Click "SQL Editor" in sidebar
   - Click "New Query"
   - Copy contents of `/database/migrations/001_generalized_schema.sql`
   - Paste and click "Run"
   - ✅ Should see "Success" message

3. **Get Credentials**:
   - Click "Settings" → "API"
   - Copy **Project URL** (e.g., `https://abcd1234.supabase.co`)
   - Copy **anon public** key (starts with `eyJ...`)
   - ⚠️ **Do NOT use** the `service_role` key!

### Step 2: Deploy to Render (2 minutes)

#### Option A: One-Click Deploy
1. Click this button: [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
2. Fill in:
   - **SUPABASE_URL**: Paste from Step 1
   - **SUPABASE_ANON_KEY**: Paste from Step 1
3. Click "Apply"
4. Wait for deployment (~3-5 min)

#### Option B: Manual Deploy
1. Go to https://render.com/dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `bylaws-tracker`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables:
   ```
   NODE_ENV=production
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SESSION_SECRET=[Click "Generate Value"]
   SETUP_MODE=enabled
   ```
6. Click "Create Web Service"

### Step 3: Complete Setup Wizard (1 minute)

1. Visit your app: `https://your-app.onrender.com`
2. You'll see the setup wizard
3. Fill in:
   - **Organization name** (e.g., "Reseda Neighborhood Council")
   - **Organization type** (e.g., "Neighborhood Council")
   - **Upload logo** (optional)
4. Configure hierarchy (or use defaults)
5. Upload bylaws document (.docx file)
6. Click "Complete Setup"

### Step 4: Verify Deployment ✅

1. **Check Health**:
   ```bash
   curl https://your-app.onrender.com/api/health
   ```
   Should return:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "timestamp": "2025-10-09T..."
   }
   ```

2. **Check Setup**:
   - Visit `https://your-app.onrender.com/bylaws`
   - You should see your bylaws sections
   - Try creating a suggestion

---

## 🎯 Environment Variables Cheat Sheet

| Variable | Where to Get | Example | Required |
|----------|-------------|---------|----------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://abc123.supabase.co` | ✅ Yes |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | `eyJhbGci...` | ✅ Yes |
| `SESSION_SECRET` | Render auto-generates | Auto | ✅ Yes |
| `NODE_ENV` | Set manually | `production` | ✅ Yes |
| `PORT` | Render sets automatically | `10000` | Auto |
| `SETUP_MODE` | Set manually | `enabled` | Optional |

### How to Set in Render:

1. **During One-Click Deploy**:
   - Fill in the form that appears

2. **After Deployment**:
   - Dashboard → Your Service → Environment
   - Click "Add Environment Variable"
   - Add key and value
   - Click "Save Changes"
   - Service will automatically redeploy

---

## 🔍 Troubleshooting

### Problem: Health check fails

**Symptom**: `/api/health` returns error or 500

**Fix**:
1. Check Render logs: Dashboard → Your Service → Logs
2. Verify Supabase credentials:
   ```bash
   # Test in browser:
   https://your-project.supabase.co/rest/v1/organizations
   ```
3. Ensure `SUPABASE_ANON_KEY` is the **anon** key, not service_role
4. Confirm database migration ran successfully

### Problem: Setup wizard doesn't appear

**Symptom**: Goes to bylaws page instead of /setup

**Fix**:
1. Clear browser cookies
2. Check if organization already exists in Supabase
3. Verify `SETUP_MODE=enabled` in environment variables
4. If needed, delete test organization:
   ```sql
   -- In Supabase SQL Editor
   DELETE FROM organizations WHERE slug = 'test-org';
   ```

### Problem: File upload fails

**Symptom**: Document upload errors in setup

**Fix**:
1. Check file is .docx format (not .doc)
2. Ensure file size < 10MB
3. Check Render logs for specific error
4. Verify disk space (free tier: limited)

### Problem: Database connection error

**Symptom**: "Failed to fetch" or "Invalid API key"

**Fix**:
1. Verify `SUPABASE_URL` format:
   - Must start with `https://`
   - Must end with `.supabase.co`
   - Example: `https://abcd1234.supabase.co`

2. Verify `SUPABASE_ANON_KEY`:
   - Must be full JWT token
   - Starts with `eyJ`
   - No spaces or line breaks

3. Check Supabase project:
   - Not paused
   - No billing issues
   - API enabled

---

## 📚 Additional Resources

### Documentation Files

Created in `/docs/` directory:

1. **DEPLOYMENT_CHECKLIST.md**
   - Comprehensive pre/post deployment steps
   - Verification procedures
   - Monitoring setup

2. **ENV_SETUP.md**
   - Complete environment variable guide
   - Security best practices
   - Platform-specific setup

3. **RENDER_DEPLOYMENT.md**
   - Detailed deployment guide
   - Health check configuration
   - File storage strategy
   - Performance optimization

4. **DATABASE_MIGRATIONS.md**
   - Migration execution guide
   - Rollback procedures
   - Validation queries

### Render Configuration

Updated file: `render.yaml`
- One-click deploy configuration
- All environment variables documented
- Inline deployment instructions

### Quick Links

- **Render Dashboard**: https://dashboard.render.com
- **Supabase Dashboard**: https://app.supabase.com
- **Render Docs**: https://render.com/docs
- **Supabase Docs**: https://supabase.com/docs

---

## 🎉 Success Checklist

Your deployment is successful when:

- [x] Health check returns `status: "healthy"`
- [x] Setup wizard completes without errors
- [x] Organization saved in Supabase
- [x] Bylaws sections display correctly
- [x] Can create suggestions
- [x] Sessions persist across page refresh
- [x] HTTPS enforced (Render automatic)
- [x] Auto-deploy works on git push

---

## 🔄 Next Steps After Deployment

### Immediate Actions

1. **Test Core Features**:
   - [ ] Create test suggestion
   - [ ] Lock a section with suggestion
   - [ ] Unlock a section
   - [ ] Export committee selections
   - [ ] Test multi-section selection

2. **Configure Monitoring**:
   - [ ] Set up Render email alerts
   - [ ] Monitor logs for errors
   - [ ] Bookmark health check URL

3. **Security Review**:
   - [ ] Enable RLS policies in Supabase
   - [ ] Review Supabase security settings
   - [ ] Change default passwords
   - [ ] Set up 2FA on Supabase and Render

### Optional Enhancements

4. **Custom Domain** (optional):
   - [ ] Add custom domain in Render
   - [ ] Update DNS records
   - [ ] SSL auto-provisioned by Render

5. **Performance** (if needed):
   - [ ] Upgrade to Starter plan ($7/mo) for always-on
   - [ ] Enable compression middleware
   - [ ] Add caching headers

6. **Backup Strategy**:
   - [ ] Set up Supabase automated backups (Pro plan)
   - [ ] Document restore procedures
   - [ ] Test backup/restore process

---

## 💰 Cost Breakdown

### Current Setup (Free Tier)
- **Render**: $0/month
  - ✅ 750 hours/month
  - ⚠️ Spins down after 15 min inactivity
  - ⚠️ 512 MB RAM
- **Supabase**: $0/month
  - ✅ 500 MB database
  - ✅ 1 GB file storage
  - ✅ Row Level Security
- **Total**: $0/month

### Recommended Production (Small Org)
- **Render Starter**: $7/month
  - ✅ Always-on (no spin down)
  - ✅ 1 GB RAM
  - ✅ Better performance
- **Supabase Free**: $0/month
- **Total**: $7/month

### Full Production (Large Org)
- **Render Standard**: $25/month
  - ✅ 2 GB RAM
  - ✅ Persistent disk
  - ✅ Horizontal scaling
- **Supabase Pro**: $25/month
  - ✅ 8 GB database
  - ✅ Automated backups
  - ✅ Point-in-time recovery
- **Total**: $50/month

---

## 🆘 Getting Help

### Documentation
1. Check `/docs/DEPLOYMENT_CHECKLIST.md` for detailed steps
2. Review `/docs/ENV_SETUP.md` for environment issues
3. See `/docs/RENDER_DEPLOYMENT.md` for platform-specific help

### Support Resources
- **Render Community**: https://community.render.com
- **Supabase Discord**: https://discord.supabase.com
- **GitHub Issues**: Create issue in your repository

### Common Commands

```bash
# View Render logs
# Dashboard → Your Service → Logs

# Test health check
curl https://your-app.onrender.com/api/health

# Test Supabase connection
curl -X GET https://your-project.supabase.co/rest/v1/organizations \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Deploy via git
git add .
git commit -m "Update"
git push origin main  # Auto-deploys to Render
```

---

## 📝 Post-Deployment Checklist

Print this and check off as you complete:

### Day 1: Deployment
- [ ] Supabase project created
- [ ] Database migrations run
- [ ] Render service deployed
- [ ] Environment variables set
- [ ] Health check passing
- [ ] Setup wizard completed
- [ ] Test organization created

### Week 1: Validation
- [ ] All features tested
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Backup strategy documented
- [ ] Team trained on system
- [ ] Custom domain configured (if applicable)

### Month 1: Optimization
- [ ] Review performance metrics
- [ ] Optimize database queries
- [ ] Review and update RLS policies
- [ ] Consider plan upgrades if needed
- [ ] Document any issues encountered

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Production URL**: _________________

**Supabase Project**: _________________

**Status**: _________________

**Notes**:
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________

---

**Last Updated**: October 9, 2025
**Version**: 1.0.0
**Deployment Method**: Render + Supabase
