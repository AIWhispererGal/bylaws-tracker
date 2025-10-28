# URGENT BUG FIXES - QUICK ACTION GUIDE

**Date**: 2025-10-27
**Status**: READY FOR IMPLEMENTATION

---

## BUG #1: EXIT ADMIN MODE BUTTON - 403 ERROR

### Quick Fix (5 minutes)

**Edit**: `views/admin/dashboard.ejs`

**Remove lines 131-133**:
```ejs
<!-- DELETE THIS -->
<a href="/auth/admin" class="btn btn-outline-light">
  <i class="bi bi-box-arrow-right"></i> Exit Admin Mode
</a>
```

**Why**: Button calls `/auth/admin` which requires global admin status, but the admin dashboard is accessible to organization admins who don't have global admin status. This causes a 403 error.

**Alternative**: Keep "Back to Selection" button - it does the same thing without errors.

---

## BUG #2: PROFILE UPDATE 500 ERROR

### Quick Fix (10 minutes)

#### Step 1: Create Migration File

**File**: `database/migrations/027_add_users_updated_at.sql`

```sql
-- Add updated_at column to users table for consistency with other tables
-- Bug: Profile update fails because code tries to set updated_at but column doesn't exist

-- Add column with default value
ALTER TABLE users
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Set existing rows to created_at value
UPDATE users
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Create trigger function to auto-update timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Migration 027: Added updated_at column to users table';
  RAISE NOTICE 'Trigger created: trg_users_updated_at';
END $$;
```

#### Step 2: Apply Migration

```bash
# Connect to your Supabase database
psql postgresql://[YOUR_CONNECTION_STRING]

# Run migration
\i database/migrations/027_add_users_updated_at.sql
```

#### Step 3: Verify Fix

Test profile update:
```bash
curl -X POST http://localhost:3000/auth/profile/update \
  -H "Content-Type: application/json" \
  -H "Cookie: [your-session-cookie]" \
  -d '{"name":"Test User"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "...",
    "name": "Test User",
    "email": "..."
  }
}
```

---

## ROOT CAUSES EXPLAINED

### Bug #1: Permission Mismatch
- **Button visible to**: Organization admins + Global admins
- **Route accessible by**: Global admins ONLY
- **Result**: 403 error for org admins

### Bug #2: Missing Column
- **Code expects**: `users.updated_at` column
- **Database has**: NO `updated_at` column
- **Result**: Supabase PostgREST error PGRST204

---

## VERIFICATION TESTS

### After Bug #1 Fix:
1. Login as organization admin (NOT global admin)
2. Go to http://localhost:3000/admin/dashboard
3. Verify: "Exit Admin Mode" button is gone
4. Verify: "Back to Selection" button still works
5. Click "Back to Selection" - should redirect to /auth/select

### After Bug #2 Fix:
1. Login to application
2. Go to http://localhost:3000/auth/profile
3. Change your name
4. Click "Update Profile"
5. Verify: Success message appears
6. Verify: No 500 error
7. Check database: `SELECT name, updated_at FROM users WHERE email = 'your@email.com';`
8. Verify: `updated_at` timestamp is recent

---

## QUICK REFERENCE

### File Locations

**Bug #1**:
- Fix file: `views/admin/dashboard.ejs`
- Lines to delete: 131-133

**Bug #2**:
- Migration file: `database/migrations/027_add_users_updated_at.sql` (create this)
- Affected code: `src/routes/auth.js` line 617 (no changes needed after migration)

### Code References

**Exit Admin Route** (`src/routes/auth.js:1525-1528`):
```javascript
router.get('/auth/admin', attachGlobalAdminStatus, requireGlobalAdmin, (req, res) => {
  req.session.isAdmin = !req.session.isAdmin;
  res.redirect('/auth/select');
});
```

**Profile Update** (`src/routes/auth.js:615-620`):
```javascript
const { data: updatedUser, error: updateError } = await supabaseService
  .from('users')
  .update({ name: trimmedName, updated_at: new Date().toISOString() })
  .eq('id', req.session.userId)
  .select()
  .single();
```

---

## ESTIMATED TIME

- **Bug #1 Fix**: 5 minutes
- **Bug #2 Fix**: 10 minutes (including migration)
- **Testing**: 10 minutes
- **Total**: ~25 minutes

---

## PRIORITY

**Bug #1**: Medium (causes user confusion, but has workaround)
**Bug #2**: HIGH (blocks core functionality - users can't update profiles)

**Recommended Order**:
1. Fix Bug #2 first (blocks functionality)
2. Fix Bug #1 second (UI polish)

---

## DEPLOYMENT NOTES

### Development
- Apply migration locally
- Test both fixes
- Commit changes

### Production
- Run migration on production database
- Deploy frontend changes
- Monitor error logs

### Rollback Plan

**Bug #1**: Re-add button if needed (just revert commit)

**Bug #2**:
```sql
-- If migration causes issues (unlikely)
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_users_updated_at();
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
```

---

## FULL ANALYSIS

See complete analysis in: `docs/analysis/EXIT_ADMIN_BUTTON_AND_PROFILE_UPDATE_BUGS.md`
