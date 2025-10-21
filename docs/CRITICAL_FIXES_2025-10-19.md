# 🚨 CRITICAL FIXES - October 19, 2025

## Summary
After fresh database setup, found and fixed 5 critical bugs.

---

## ✅ FIX #1: RLS Infinite Recursion (CRITICAL - REQUIRES MIGRATION)

**Problem**: Dashboard showing 500 errors, all users appearing as "View-Only"

**Root Cause**: Migration 022 created RLS policy with infinite recursion:
```sql
-- BAD: This queries user_organizations WHILE checking policy ON user_organizations
EXISTS (SELECT 1 FROM user_organizations WHERE user_id = auth.uid() AND is_global_admin = true)
```

**Error**: `infinite recursion detected in policy for relation "user_organizations"`

**Solution**: Run migration 023 immediately

**Steps**:
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/sql
2. Copy contents of: `database/migrations/023_fix_rls_infinite_recursion.sql`
3. Paste and run
4. Refresh dashboard - should work now

**What the fix does**:
- Moves `is_global_admin` to `users` table (avoids recursion)
- Creates separate policies for regular users and global admins
- No more infinite recursion

---

## ✅ FIX #2: Organization Logo - No Popup

**Problem**: Clicking to upload logo did nothing

**Root Cause**: JavaScript looked for `#browseBtn` but HTML didn't have it

**Solution**: Added "Browse Files" button to upload area

**File Modified**: `views/setup/organization.ejs` line 118-120

**Code Added**:
```html
<button type="button" class="btn btn-primary btn-sm mt-2" id="browseBtn">
    <i class="bi bi-folder2-open"></i> Browse Files
</button>
```

**Status**: ✅ Fixed

---

## ✅ FIX #3: Document Type - Only 2 Levels Shown

**Problem**: Setup wizard only showed Level 1 and Level 2 inputs, not all 10

**Root Cause**: UI was hardcoded to 2 levels

**Solution**: Added all 10 hierarchy level inputs

**File Modified**: `views/setup/document-type.ejs` lines 143-197

**Added**:
- Level 1 (Top) - e.g., Article
- Level 2 - e.g., Section
- Level 3 - e.g., Subsection
- Level 4 - e.g., Paragraph
- Level 5 - e.g., Subparagraph
- Level 6 - e.g., Item
- Level 7 - e.g., Subitem
- Level 8 - e.g., Detail
- Level 9 - e.g., Subdetail
- Level 10 (Deepest) - e.g., Component

**Note added**: "Leave levels blank if you don't need all 10 levels"

**Status**: ✅ Fixed

---

## ✅ FIX #4: Import File Selection - Double Popup

**Problem**: File picker appeared twice, had to select file twice

**Root Cause**: Two event listeners on same element causing double-trigger

**Solution**: Already fixed in previous session (FIX-2 in setup-wizard.js)

**File**: `public/js/setup-wizard.js` lines 79-90

**How it works**:
- Only `#browseBtn` triggers file picker
- Removed listener from `#uploadPrompt` area
- Single event = single popup

**Status**: ✅ Already Fixed

---

## ✅ FIX #5: Dashboard Permissions & 500 Errors

**Problem**:
- New admin showing as "View-Only Access"
- "Error loading documents" message
- Console errors: `GET /api/dashboard/overview 500`

**Root Cause**: Same as FIX #1 - RLS infinite recursion

**Solution**: Run migration 023 (see FIX #1)

**After migration**:
- Users will have correct permissions
- Dashboard will load properly
- No more 500 errors

**Status**: ⏳ Waiting for migration 023

---

## 📋 ACTION ITEMS

### IMMEDIATE (Required for app to work):

1. **Run Migration 023**:
   ```
   Location: database/migrations/023_fix_rls_infinite_recursion.sql
   Action: Copy to Supabase SQL Editor and run
   Impact: Fixes dashboard, permissions, all RLS errors
   ```

### COMPLETED (No action needed):

2. ✅ Logo upload button - Fixed
3. ✅ 10-level hierarchy UI - Fixed
4. ✅ Double file picker - Already fixed
5. ✅ Startup routing - Fixed (goes to /auth/select)

---

## 🔄 Restart Server

After migration 023, restart your server:
```bash
# Kill current server
pkill -f "node server.js"

# Start fresh
npm start
```

---

## ✅ VERIFICATION CHECKLIST

After running migration 023:

- [ ] Dashboard loads without 500 errors
- [ ] User shows correct role (admin/owner, not view-only)
- [ ] Can view documents
- [ ] Can create suggestions
- [ ] Logo upload works (has Browse button)
- [ ] Document type setup shows all 10 levels
- [ ] Import file picker works (only appears once)
- [ ] No console errors about "infinite recursion"

---

## 📊 FILES MODIFIED

1. `database/migrations/023_fix_rls_infinite_recursion.sql` - NEW
2. `views/setup/organization.ejs` - Modified (added browse button)
3. `views/setup/document-type.ejs` - Modified (added 10 levels)
4. `public/js/setup-wizard.js` - Already fixed (FIX-2)
5. `server.js` - Already fixed (startup routing)

---

## 🎯 ROOT CAUSE ANALYSIS

**Why did this happen?**

Migration 022 tried to check if a user is a global admin by querying the `user_organizations` table INSIDE a policy that protects the `user_organizations` table. This created infinite recursion.

**Prevention**:
- Don't query a table inside its own RLS policy
- Use separate tables for permission flags
- Test migrations on fresh database before production

---

**Status**: 4/5 fixes deployed, 1/5 requires user action (migration 023)

**Priority**: **CRITICAL** - Run migration 023 immediately to restore functionality
