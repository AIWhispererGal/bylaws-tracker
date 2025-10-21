# Quick Start - Enable RLS for 99 Councils

## ✅ 5-Minute Deployment Checklist

### **Step 1: Get Service Role Key** (2 minutes)
```
1. Go to: https://app.supabase.com/project/auuzurghrjokbqzivfca/settings/api
2. Find "Project API keys" section
3. Copy the "service_role" key (starts with eyJhbGc...)
```

### **Step 2: Update .env File** (1 minute)
```bash
# Open .env and find this line:
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Replace with your actual key:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Save the file
```

### **Step 3: Run Migration** (1 minute)
```
1. Go to: https://app.supabase.com/project/auuzurghrjokbqzivfca/sql/new
2. Open: /database/migrations/005_implement_proper_rls_FIXED.sql
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run"
6. Wait for success message
```

### **Step 4: Restart Server** (30 seconds)
```bash
# Stop server (Ctrl+C)
# Start server:
node server.js
```

### **Step 5: Test** (30 seconds)
```
1. Go to: https://3eed1324c595.ngrok-free.app/setup
2. Create test organization
3. Complete setup wizard
4. Should work without errors!
```

---

## 🎯 What You Get

✅ **Complete data isolation** between all 99 councils
✅ **No infinite recursion** errors
✅ **Service role bypass** for setup wizard
✅ **Production-ready security** with proper RLS
✅ **Zero performance impact** on regular operations

---

## 🚨 Common Issues

### "Service role key is undefined"
**Fix**: Add key to .env, restart server

### "Row violates row-level security policy"
**Fix**: Run migration, verify service key in .env

### "Infinite recursion detected"
**Fix**: Use FIXED migration (005_implement_proper_rls_FIXED.sql)

---

## 📚 Full Documentation

- **Detailed Guide**: `/docs/RLS_DEPLOYMENT_GUIDE.md`
- **Code Changes**: `/docs/CODE_CHANGES_RLS_FIX.md`
- **Security Review**: `/docs/reports/RLS_SECURITY_REVIEW.md`
- **Migration File**: `/database/migrations/005_implement_proper_rls_FIXED.sql`

---

## ✅ Success Checklist

- [ ] Got service role key from Supabase
- [ ] Added key to `.env` file
- [ ] Ran migration in SQL Editor
- [ ] Saw success message with no errors
- [ ] Restarted server
- [ ] Setup wizard works without RLS errors
- [ ] Can create multiple test organizations
- [ ] Each organization sees only its own data

**All checked?** 🎉 **You're ready for 99 councils!**
