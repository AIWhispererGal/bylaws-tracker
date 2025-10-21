# 🚀 QUICK START GUIDE - Bylaws Amendment Tracker

**For:** Getting the system running after recent fixes
**Updated:** 2025-10-13

---

## ⚡ 3-Minute Setup

### 1. Run Database Migration (REQUIRED)
```bash
# In Supabase SQL Editor:
# Copy and run: /database/migrations/010_fix_first_user_admin.sql

# Or via psql:
psql -U your_user -d your_database -f database/migrations/010_fix_first_user_admin.sql
```

**This makes the first user of each org an 'owner' with admin access.**

### 2. Start the Server
```bash
npm start
```

### 3. Login Fresh
```bash
# Clear your browser session:
# Go to: http://localhost:3000/auth/logout
# Then login again at: http://localhost:3000/auth/login
```

---

## ✅ Verify It Works

### Test 1: Admin Access
```
Visit: http://localhost:3000/admin/organization
Expected: Page loads (not 403)
```

### Test 2: Suggestion Filtering
```
1. Open any document
2. Click on Section 1
3. Look at suggestions shown
4. Click on Section 2
5. Suggestions should change (different ones)
```

### Test 3: Diff View
```
1. Open any document with suggestions
2. Click "Show Changes" button on a suggestion
3. Should see RED strikethrough for deletions
4. Should see GREEN highlights for additions
```

---

## 🐛 Quick Fixes

### "Still Getting 403"
```sql
-- Manually make yourself admin:
UPDATE user_organizations
SET role = 'owner', is_admin = true
WHERE user_id = 'YOUR_USER_ID'
AND organization_id = 'YOUR_ORG_ID';
```

### "Suggestions Still Showing for All Sections"
```bash
# Restart server to apply code changes
npm start
```

### "Diff View Not Working"
```bash
# Check browser console for errors
# Press F12 → Console tab
```

---

## 📚 Full Documentation

- `/docs/HIVE_SESSION_MEMORY.md` - Complete session memory
- `/docs/ADMIN_ACCESS_FIX.md` - Admin access fix details
- `/docs/EMERGENCY_FIXES.md` - All emergency fixes
- `/docs/DIFF_VIEW_IMPLEMENTATION.md` - Diff view details

---

## 🆘 Need Help?

1. Check `/docs/HIVE_SESSION_MEMORY.md` - has all the fixes documented
2. Check browser console (F12) for JavaScript errors
3. Check server console for backend errors
4. Review test results: `npm test`

---

**Status:** ✅ System Ready
**Next:** Login and test the three features above
