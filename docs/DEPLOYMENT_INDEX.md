# Bylaws Amendment Tracker - Deployment Documentation Index

Complete documentation for deploying and managing the Bylaws Amendment Tracker application on Render.

---

## 📚 Documentation Structure

### Quick Start

- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** ⭐ **START HERE** - 5-minute deployment guide
  - What you need
  - Step-by-step setup
  - Environment variables cheat sheet
  - Troubleshooting common issues
  - Success checklist

### Deployment Guides

1. **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Complete deployment checklist
   - Pre-deployment steps
   - Render deployment process
   - Post-deployment verification
   - Ongoing maintenance
   - Rollback procedures

2. **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** - Comprehensive Render guide
   - Deployment methods (one-click vs manual)
   - Health check configuration
   - File storage strategy
   - Auto-deploy setup
   - Performance optimization
   - Cost estimation

3. **[ENV_SETUP.md](ENV_SETUP.md)** - Environment variables guide
   - Required vs optional variables
   - Security best practices
   - Platform-specific setup
   - Validation and testing
   - Troubleshooting

4. **[DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md)** - Database setup guide
   - Migration strategies
   - Execution methods
   - Validation procedures
   - Rollback strategies
   - Best practices

### Configuration Files

- **`/render.yaml`** - Render Blueprint configuration
  - One-click deploy setup
  - Environment variable definitions
  - Inline documentation

---

## 🚀 Getting Started

### For First-Time Deployment

**Start here**: [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)

Follow this order:
1. Read DEPLOYMENT_SUMMARY.md (5 min)
2. Create Supabase project
3. Deploy to Render
4. Complete setup wizard
5. Verify with checklist

### For Detailed Setup

**Start here**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

This comprehensive guide covers:
- All pre-deployment requirements
- Detailed deployment steps
- Verification procedures
- Monitoring setup
- Security hardening

### For Environment Issues

**Start here**: [ENV_SETUP.md](ENV_SETUP.md)

Covers:
- All environment variables explained
- How to obtain credentials
- Security considerations
- Platform-specific configuration
- Validation methods

### For Database Setup

**Start here**: [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md)

Includes:
- Migration file descriptions
- Execution methods
- Validation queries
- Rollback procedures
- Best practices

---

## 📋 Quick Reference

### Essential URLs

- **Render Dashboard**: https://dashboard.render.com
- **Supabase Dashboard**: https://app.supabase.com
- **Render Docs**: https://render.com/docs
- **Supabase Docs**: https://supabase.com/docs

### Required Environment Variables

| Variable | Source | Required |
|----------|--------|----------|
| `SUPABASE_URL` | Supabase Dashboard | ✅ |
| `SUPABASE_ANON_KEY` | Supabase Dashboard | ✅ |
| `SESSION_SECRET` | Auto-generated | ✅ |
| `NODE_ENV` | Set to `production` | ✅ |

See [ENV_SETUP.md](ENV_SETUP.md) for complete list and details.

### Health Check

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

---

## 🔍 Common Tasks

### Deploy New Version

```bash
git add .
git commit -m "Your changes"
git push origin main  # Auto-deploys to Render
```

### Update Environment Variables

1. Render Dashboard → Your Service → Environment
2. Add/Edit variable
3. Save (auto-redeploys)

### Run Database Migration

1. Supabase Dashboard → SQL Editor
2. Copy migration SQL
3. Run query
4. Verify results

See [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md#migration-execution-methods) for details.

### View Logs

1. Render Dashboard → Your Service → Logs
2. Filter by type (deploy, runtime, error)
3. Search for specific errors

### Rollback Deployment

1. Render Dashboard → Your Service → Settings
2. Manual Deploy → Select previous version
3. Deploy

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md#rollback-plan) for full procedure.

---

## 🛠️ Troubleshooting Guide

### Issue: Deployment Fails

**Check**:
- Build logs in Render
- package.json syntax
- Node.js version compatibility

**See**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md#build-failures)

### Issue: Database Connection Error

**Check**:
- SUPABASE_URL format
- SUPABASE_ANON_KEY validity
- Supabase project status

**See**: [ENV_SETUP.md](ENV_SETUP.md#troubleshooting)

### Issue: Health Check Fails

**Check**:
- /api/health endpoint
- Database connectivity
- Environment variables

**See**: [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md#health-check-configuration)

### Issue: File Upload Fails

**Check**:
- File size (< 10MB)
- File type (.docx)
- Disk space

**See**: [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#problem-file-upload-fails)

### Issue: Setup Wizard Missing

**Check**:
- SETUP_MODE=enabled
- Organizations table empty
- Browser cookies

**See**: [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#problem-setup-wizard-doesnt-appear)

---

## 📊 Architecture Overview

### Application Stack

```
┌─────────────────────────────────────┐
│         Render (Hosting)            │
│  - Node.js + Express                │
│  - Ephemeral disk storage           │
│  - HTTPS + Auto-deploy              │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│       Supabase (Database)           │
│  - PostgreSQL                       │
│  - Row Level Security               │
│  - Real-time subscriptions          │
└─────────────────────────────────────┘
```

### Data Flow

```
User Request
    │
    ▼
Render (Express Server)
    │
    ├──> Health Check (/api/health)
    │
    ├──> Setup Wizard (/setup)
    │    ├──> File Upload (local disk)
    │    ├──> Document Parsing (Mammoth.js)
    │    └──> Save to Supabase
    │
    └──> Main App (/bylaws)
         ├──> Fetch Sections (Supabase)
         ├──> Create Suggestions
         └──> Lock Sections
```

### File Storage

```
Setup Process:
1. Upload .docx → uploads/setup/
2. Parse with Mammoth.js → Extract text
3. Save to Supabase → Document sections
4. Optional: Delete file → Free space
```

**Note**: Files are temporary and lost on redeploy (ephemeral disk).

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md#file-storage-strategy) for details.

---

## 🔒 Security Considerations

### Credentials

- ✅ **Use SUPABASE_ANON_KEY** (public key)
- ❌ **Never use service_role key** (admin access)
- ✅ **Generate strong SESSION_SECRET** (32+ bytes)
- ✅ **Enable HTTPS** (automatic on Render)

### Database Security

- ✅ Enable Row Level Security (RLS)
- ✅ Create appropriate RLS policies
- ✅ Use strong database password
- ✅ Enable 2FA on Supabase

### Application Security

- ✅ Secure cookies in production
- ✅ CSRF protection enabled
- ✅ Input validation
- ✅ File upload restrictions

See [ENV_SETUP.md](ENV_SETUP.md#security-best-practices) for complete guide.

---

## 💰 Cost Planning

### Free Tier (Development/Testing)
- **Render**: $0/month
  - 750 hours/month
  - Spins down after 15 min
- **Supabase**: $0/month
  - 500 MB database
- **Total**: $0/month

### Production (Small Organization)
- **Render Starter**: $7/month
  - Always-on
  - 1 GB RAM
- **Supabase Free**: $0/month
- **Total**: $7/month

### Production (Large Organization)
- **Render Standard**: $25/month
- **Supabase Pro**: $25/month
- **Total**: $50/month

See [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md#cost-breakdown) for detailed breakdown.

---

## 📞 Support Resources

### Documentation
- [Deployment Summary](DEPLOYMENT_SUMMARY.md) - Quick start
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Complete guide
- [Environment Setup](ENV_SETUP.md) - Configuration
- [Database Migrations](DATABASE_MIGRATIONS.md) - Database setup
- [Render Deployment](RENDER_DEPLOYMENT.md) - Platform guide

### External Resources
- **Render**: https://render.com/docs
- **Supabase**: https://supabase.com/docs
- **Node.js**: https://nodejs.org/docs
- **Express.js**: https://expressjs.com

### Community
- **Render Community**: https://community.render.com
- **Supabase Discord**: https://discord.supabase.com
- **Stack Overflow**: Tag with `render` or `supabase`

### Getting Help

1. **Check Documentation**: Start with relevant doc file above
2. **Search Logs**: Render Dashboard → Logs
3. **Community Forums**: Post in Render or Supabase community
4. **GitHub Issues**: Create issue in repository
5. **Support Tickets**: Render/Supabase paid plans

---

## ✅ Documentation Checklist

Use this to verify your deployment documentation:

### Pre-Deployment
- [x] Read DEPLOYMENT_SUMMARY.md
- [ ] Understand environment variables (ENV_SETUP.md)
- [ ] Review database setup (DATABASE_MIGRATIONS.md)
- [ ] Check Render configuration (render.yaml)

### During Deployment
- [ ] Follow DEPLOYMENT_CHECKLIST.md
- [ ] Set all required env vars
- [ ] Run database migrations
- [ ] Configure health checks

### Post-Deployment
- [ ] Complete setup wizard
- [ ] Verify health endpoint
- [ ] Test all features
- [ ] Set up monitoring
- [ ] Configure backups

---

**Last Updated**: October 9, 2025
**Documentation Version**: 1.0.0
**Application Version**: 2.0.0
