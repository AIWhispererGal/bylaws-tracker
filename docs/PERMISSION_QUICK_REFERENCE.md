# 🔐 Permission System Quick Reference

**Last Updated**: 2025-10-19
**Investigation**: DETECTIVE Case #AUDIT-001

---

## 🎯 6 CRITICAL GATES (Never Let These Break!)

### 1. Global Admin Database Check
- **File**: `src/middleware/globalAdmin.js:11-35`
- **Test**: `SELECT is_global_admin('user-uuid'::uuid);`
- **Break Impact**: Global admins locked out entirely

### 2. Admin Dashboard Gate
- **File**: `src/routes/admin.js:142` + `src/routes/auth.js:1427`
- **Middleware**: `requireGlobalAdmin`
- **Break Impact**: 403 error on admin panel access

### 3. RLS Global Admin Bypass
- **File**: `database/migrations/013_fix_global_admin_rls.sql`
- **Count**: 25 policies across all tables
- **Break Impact**: Silent data filtering, queries return empty

### 4. Global Admin Bypass in Role Checks
- **File**: `src/middleware/roleAuth.js:18-21`
- **Code**: `if (await isGlobalAdmin(req)) return true;`
- **Break Impact**: Global admins treated as regular users

### 5. Workflow Approval Permission
- **File**: `src/middleware/roleAuth.js:148-193`
- **Function**: `canApproveStage(req, stageId)`
- **Break Impact**: Wrong people can approve stages

### 6. Section Lock Enforcement
- **File**: `src/middleware/sectionValidation.js:50-59`
- **Check**: `if (section.is_locked)`
- **Break Impact**: Concurrent edits, data corruption

---

## 📊 Permission Architecture

```
┌─────────────────────────────────────────┐
│         LAYER 1: DATABASE (RLS)         │
│  ✓ 262 auth.uid() checks                │
│  ✓ 25+ policies with global admin OR    │
│  ✓ 15+ SECURITY DEFINER functions       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      LAYER 2: MIDDLEWARE (Guards)       │
│  ✓ globalAdmin.js (4 functions)         │
│  ✓ roleAuth.js (9 functions)            │
│  ✓ sectionValidation.js (3 functions)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      LAYER 3: ROUTES (Enforcement)      │
│  ✓ 50+ protected endpoints              │
│  ✓ Dynamic permission calculations      │
│  ✓ Workflow state checks                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      LAYER 4: VIEWS (UI Visibility)     │
│  ✓ 44+ permission checks                │
│  ⚠️  NOT A SECURITY BOUNDARY            │
└─────────────────────────────────────────┘
```

---

## 🔍 Role Hierarchy

```
owner (4)
  ↓ Can do everything in organization
admin (3)
  ↓ Can manage users, workflows, documents
member (2)
  ↓ Can edit, suggest, participate in workflows
viewer (1)
  ↓ Read-only access

GLOBAL ADMIN (bypasses all checks)
```

---

## 🛠️ Common Debugging Commands

### Check if user is global admin:
```bash
# In database
SELECT is_global_admin('USER-UUID'::uuid);

# In code (req object)
console.log('Is Global Admin:', req.isGlobalAdmin);
```

### Verify RLS policies exist:
```bash
psql -c "SELECT schemaname, tablename, policyname
         FROM pg_policies
         WHERE policyname LIKE '%global_admin%';"
```

### Check user's role in organization:
```sql
SELECT uo.role, uo.is_global_admin, uo.is_active
FROM user_organizations uo
WHERE user_id = 'USER-UUID'
  AND organization_id = 'ORG-UUID';
```

### Test permission middleware:
```javascript
// In route handler
console.log('Session:', req.session);
console.log('Global Admin:', req.isGlobalAdmin);
console.log('User Role:', req.userRole);
```

---

## 📁 File Reference Matrix

| Component | File | Key Functions | Priority |
|-----------|------|---------------|----------|
| Global Admin | `src/middleware/globalAdmin.js` | isGlobalAdmin, requireGlobalAdmin | CRITICAL |
| Role Auth | `src/middleware/roleAuth.js` | hasRole, requireAdmin, canApproveStage | CRITICAL |
| Section Validation | `src/middleware/sectionValidation.js` | validateSectionEditable | HIGH |
| Admin Routes | `src/routes/admin.js` | requireAdmin middleware | HIGH |
| Workflow Routes | `src/routes/workflow.js` | Custom permission logic | HIGH |
| Approval Routes | `src/routes/approval.js` | requireMember, stage checks | HIGH |
| User Routes | `src/routes/users.js` | requireAdmin, requireOwner | MEDIUM |
| RLS Foundation | `database/migrations/013_*.sql` | 25 policies | CRITICAL |
| RLS Functions | `database/migrations/012_*.sql` | 10 SECURITY DEFINER functions | CRITICAL |

---

## 🚨 Common Permission Issues

### Issue 1: "Global admin can't see organizations"
**Symptom**: Empty organization list
**Likely Cause**: Migration 013 not applied
**Fix**: Apply `013_fix_global_admin_rls.sql`

### Issue 2: "403 Forbidden on admin dashboard"
**Symptom**: Admin panel access denied
**Likely Cause**: `req.isGlobalAdmin` not set
**Fix**: Check `attachGlobalAdminStatus` middleware order in server.js:233

### Issue 3: "User can edit locked sections"
**Symptom**: Lock enforcement not working
**Likely Cause**: Missing `validateSectionEditable` middleware
**Fix**: Add middleware to route: `router.put('/sections/:id', validateSectionEditable, ...)`

### Issue 4: "Wrong users can approve workflow stages"
**Symptom**: Approval permission too broad
**Likely Cause**: `workflow_stages.required_roles` not set
**Fix**: Set required_roles array: `['owner', 'admin']`

### Issue 5: "Views show buttons user can't use"
**Symptom**: UI confusion
**Likely Cause**: View permissions don't match backend
**Fix**: Sync view checks with backend middleware

---

## ✅ Pre-Deployment Checklist

Before deploying permission changes:

- [ ] All migrations applied (check `psql \d+ user_organizations`)
- [ ] `is_global_admin` column exists and indexed
- [ ] `is_global_admin(user_id)` function exists
- [ ] RLS policies include global admin bypass
- [ ] Middleware order correct in server.js
- [ ] Test global admin access
- [ ] Test regular admin access
- [ ] Test viewer restrictions
- [ ] Test workflow approvals
- [ ] Test section locks
- [ ] Verify SECURITY DEFINER functions secure

---

## 📞 Emergency Contacts

**If permissions break in production:**

1. Check database: `SELECT * FROM user_organizations WHERE is_global_admin = true;`
2. Check logs: `grep -i "permission\|403\|forbidden" /var/log/app.log`
3. Verify middleware: `console.log(req.isGlobalAdmin)` in routes
4. Test RLS: Run test query as user
5. Fallback: Temporarily disable RLS (DANGER!) or grant temporary superuser

**DO NOT**:
- Remove permission checks without replacement
- Modify SECURITY DEFINER functions in production
- Skip migration testing
- Deploy during business hours

---

## 📚 Full Documentation

For complete investigation results, see:
- **Full Report**: `docs/reports/DETECTIVE_PERMISSION_AUDIT.md`
- **Migration Docs**: `database/migrations/README_RLS_FIX.md`
- **Security Analysis**: `docs/DATABASE_SECURITY_ANALYSIS.md`
- **Testing Guide**: `docs/TESTING_CHECKLIST.md`

---

*Generated by DETECTIVE - Case #AUDIT-001*
*Last Investigation: 2025-10-19*
