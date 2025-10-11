# Setup Wizard - Quick Reference Guide

**Last Updated:** 2025-10-07

---

## 🚀 Quick Start

```bash
# 1. Reset database (testing)
node scripts/reset-for-testing.js

# 2. Start server
npm start

# 3. Visit wizard
# WSL: http://172.x.x.x:3000
# Standard: http://localhost:3000
```

---

## 🐛 Common Errors (Fast Fixes)

### Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
npm start
```

### CSRF Token Error
Check form has:
```html
<input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

### Connection Refused (WSL)
```bash
# Get WSL IP
ip addr show eth0 | grep inet
# Use: http://[WSL-IP]:3000
```

### SetupWizard Not Defined
Wrap in:
```javascript
document.addEventListener('DOMContentLoaded', function() {
    // Your code here
});
```

---

## 📁 File Locations

| Component | File Path |
|-----------|-----------|
| **Templates** | `/views/setup/*.ejs` |
| **Routes** | `/src/routes/setup.js` |
| **Middleware** | `/src/middleware/setup-required.js` |
| **Styles** | `/public/css/setup-wizard.css` |
| **Scripts** | `/public/js/setup-wizard.js` |
| **Migrations** | `/database/migrations/001_initial_schema.sql` |
| **Test Reset** | `/scripts/reset-for-testing.js` |

---

## 🔧 Environment Variables

```bash
# Required in .env
SESSION_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

---

## ✅ Testing Checklist

- [ ] Database reset works
- [ ] Server starts on port 3000
- [ ] Welcome screen loads
- [ ] Organization form submits → redirects
- [ ] Document type form submits → redirects
- [ ] Workflow form submits → redirects
- [ ] File upload works → redirects
- [ ] Processing screen auto-redirects
- [ ] Success screen displays
- [ ] Organization created in Supabase
- [ ] No console errors
- [ ] No CSRF errors

---

## 🔐 Security Checklist

- [x] CSRF tokens on all forms
- [x] Session-based state (not URL params)
- [x] File upload validation (type, size)
- [x] Input sanitization
- [x] HTTP-only cookies
- [ ] HTTPS in production
- [ ] Rate limiting (TODO)
- [ ] Error message sanitization (TODO)

---

## 📦 Dependencies

```json
{
  "express-session": "^1.18.2",  // Session management
  "csurf": "^1.11.0",            // CSRF protection
  "multer": "^1.4.5-lts.1"       // File uploads
}
```

---

## 🚦 Wizard Steps

1. **Welcome** → Click "Get Started"
2. **Organization** → Enter name → Next
3. **Document Type** → Select type → Next
4. **Workflow** → Set config → Next
5. **Import** → Upload file → Import
6. **Processing** → Auto-redirect (3s)
7. **Success** → Go to Dashboard

---

## 🐛 Known Bugs (Need Fixing)

1. ❌ Document type form returns JSON (should redirect)
2. ❌ Workflow form returns JSON (should redirect)
3. ❌ Import form returns JSON (should redirect)
4. ❌ Organization not created in database yet
5. ❌ Error handling needs improvement

**Fix Pattern:**
```javascript
// Change from:
res.json({ success: true });

// To:
req.session.data = formData;
res.redirect('/setup/next-step');
```

---

## 🚀 Deployment (Render)

```bash
# Set environment variables in Render dashboard:
SESSION_SECRET=<new secret for production>
NODE_ENV=production
SUPABASE_URL=<production URL>
SUPABASE_KEY=<production key>
DATABASE_URL=<production DB>

# Run migration in production:
node scripts/run-migration.js

# Test:
https://[your-app].onrender.com
```

---

## 📚 Full Documentation

See `/docs/SESSION_LEARNINGS.md` for complete details:
- Architecture decisions
- Bug fixes and solutions
- Security patterns
- Testing workflows
- Swarm coordination patterns

---

## 🆘 Emergency Rollback

```bash
# 1. Render: Revert to previous deployment
# 2. Supabase: Restore from automatic backup
# 3. Verify old version works
# 4. Investigate issue in dev
```

---

## 💾 Swarm Memory

**Retrieve session knowledge:**
```bash
npx claude-flow@alpha hooks session-restore --session-id "swarm-setup-wizard"
```

**Key stored:** `hive/knowledge/setup_wizard_complete`

---

**Quick Help:** Check `/docs/SESSION_LEARNINGS.md` for detailed troubleshooting.
