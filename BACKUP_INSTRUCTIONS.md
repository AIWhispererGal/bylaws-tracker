# 🔒 Database Backup & Recovery Guide

## Preventing Data Loss

### Automatic Backups (Recommended)

#### Option 1: Supabase Dashboard
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click "Settings" → "Database"
4. Enable "Point-in-Time Recovery" (PITR)
5. This creates automatic backups every 24 hours

#### Option 2: Local Backup Script

Run backups manually or set up a cron job:

```bash
# Manual backup
node scripts/backup-database.js

# Automatic backup (add to crontab or Task Scheduler)
# Daily at 2 AM:
0 2 * * * cd /path/to/project && node scripts/backup-database.js
```

---

## Recovery from Data Loss

### Scenario 1: Supabase Has Backups

**Best Option:**
1. Go to Supabase Dashboard
2. Database → Backups
3. Select recent backup
4. Click "Restore"
5. Wait for completion
6. Restart your server

### Scenario 2: No Supabase Backup, Have Local Backup

**Use local backup files:**
```bash
# If you have backup files in database/backups/
node scripts/restore-database.js [timestamp]
```

### Scenario 3: No Backups Available

**Re-run setup wizard:**
1. Go to http://localhost:3000/setup
2. Create organization
3. Create admin user
4. Upload original bylaws document
5. Takes 5-10 minutes

---

## What We Found Today

You have a backup from **October 27** with:
- Full Reseda Neighborhood Council bylaws
- All sections and metadata
- Located at: `database/migrations/document_sections_rows.json`

---

## Likely Cause of Data Loss

Based on the evidence:
1. ❌ NOT from our code changes (only added DOCX export)
2. ❌ NOT from migrations (no new migrations run)
3. ✅ LIKELY: Manual action in Supabase dashboard
4. ✅ POSSIBLE: Wrong environment/project selected

---

## Immediate Next Steps

**Option A: Check Supabase for backups**
- Visit: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca
- Check: Database → Backups
- Restore if available

**Option B: Re-run setup (fastest)**
- Visit: http://localhost:3000/setup
- Follow wizard
- Upload bylaws document
- Takes 10 minutes

---

## Future Prevention

### Enable Supabase PITR
1. Upgrade to Pro plan ($25/month)
2. Enables point-in-time recovery
3. Can restore to any moment in last 7 days

### Weekly Local Backups
```bash
# Add to crontab (Linux/Mac)
0 0 * * 0 cd /path/to/project && node scripts/backup-database.js

# Add to Task Scheduler (Windows)
# Action: node scripts/backup-database.js
# Trigger: Weekly, Sunday, 12:00 AM
```

### Git Commit Database Exports
```bash
# After major changes, export and commit:
node scripts/backup-database.js
git add database/backups/
git commit -m "Backup: After major document changes"
git push
```

---

## Support

If you need help recovering your data:
1. Check Supabase dashboard first
2. Look for backup files in `database/backups/`
3. Re-run setup as last resort

**The good news:** Your DOCX export feature is ready and will work immediately after recovery!
