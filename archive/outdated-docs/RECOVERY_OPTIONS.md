# 🚨 DATA RECOVERY OPTIONS

## What Happened
All data appears to be missing from the database after running migrations.

## Migration 022 Analysis
**Migration 022 is INNOCENT** - it only:
- Drops/recreates RLS policy (doesn't delete data)
- Creates helper function
- Adds indexes

**No DELETE, TRUNCATE, or DROP TABLE commands present.**

## Possible Causes
1. **RLS Policy Issue** - New policy might be hiding data
2. **Different Supabase Project** - Connected to wrong project
3. **Manual deletion** - Data deleted outside of migrations
4. **Supabase issue** - Platform problem

## Immediate Recovery Options

### Option 1: Supabase Point-in-Time Recovery (Recommended)
Supabase Pro plans have automatic backups with point-in-time recovery.

**Steps:**
1. Go to https://supabase.com/dashboard
2. Select your project: `auuzurghrjokbqzivfca`
3. Go to **Database** → **Backups**
4. Look for **Point-in-Time Recovery** option
5. Select a restore point from BEFORE the migrations (e.g., 1 hour ago)
6. Follow Supabase's recovery wizard

**Note**: Free tier has daily backups, Pro tier has PITR.

### Option 2: Check RLS Policies
The data might still be there but hidden by RLS policies.

**Test:**
```sql
-- Run this in Supabase SQL Editor
-- This bypasses RLS to see if data exists
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM user_organizations;
SELECT COUNT(*) FROM documents;
```

If you see counts > 0, the data exists but is hidden by RLS.

**Fix:**
```sql
-- Temporarily disable RLS to verify
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;

-- Check data again
SELECT * FROM organizations LIMIT 5;

-- Re-enable RLS after verification
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
```

### Option 3: Rollback Migration 022
If you suspect migration 022 (though analysis shows it's safe):

```sql
-- Rollback migration 022
DROP POLICY IF EXISTS "Users can access their organizations" ON user_organizations;
DROP FUNCTION IF EXISTS get_user_organizations(UUID);
DROP INDEX IF EXISTS idx_user_organizations_user_id;
DROP INDEX IF EXISTS idx_user_organizations_org_id;
DROP INDEX IF EXISTS idx_user_organizations_active;

-- Re-create the old policy (check migration 021 or earlier for original)
```

### Option 4: Restore from Your Local Backup
If you have a pg_dump or SQL backup:

```bash
# Restore from SQL dump
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < backup.sql
```

## Prevention for Future

1. **Always backup before migrations**:
```bash
# Create backup before running migrations
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Test migrations on staging first**

3. **Enable Supabase Pro** for point-in-time recovery

4. **Review migrations carefully** for destructive commands:
   - DELETE
   - TRUNCATE
   - DROP TABLE
   - ALTER TABLE DROP COLUMN

## Contact Supabase Support
If backups don't work, contact Supabase support:
- https://supabase.com/dashboard/support
- Provide project ref: `auuzurghrjokbqzivfca`
- Mention time of data loss
- They may be able to recover from internal backups

## Next Steps
1. ✅ Check Supabase Dashboard → Backups
2. ✅ Try point-in-time recovery
3. ✅ If no backups, run RLS check SQL
4. ✅ Contact Supabase support if needed
