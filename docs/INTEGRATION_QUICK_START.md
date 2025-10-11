# Setup Wizard Integration - Quick Start Guide

## 🚀 What Was Integrated

The setup wizard is now fully integrated into the main Bylaws Amendment Tracker application. On first run, users will be automatically redirected to a friendly setup wizard that guides them through configuration.

---

## ✅ Files Modified

```
Modified Files:
├── server.js                    # Main server with setup integration
├── package.json                 # Added session, CSRF, multer dependencies
├── .gitignore                   # Excluded uploads and .env.local
├── render.yaml                  # Updated health check and build commands
└── src/routes/setup.js          # Adapted for Supabase integration

Created Files:
├── docs/SETUP_WIZARD_INTEGRATION.md    # Detailed integration documentation
├── docs/INTEGRATION_QUICK_START.md     # This file
└── scripts/verify-integration.js       # Integration verification script
```

---

## 🔧 Quick Setup (Development)

### 1. Install Dependencies
```bash
npm install
```

**New dependencies installed:**
- `express-session` - Session management
- `csurf` - CSRF protection
- `multer` - File upload handling

### 2. Configure Environment
Create `.env` file with:
```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SESSION_SECRET=your-random-secret-here
APP_URL=http://localhost:3000
```

### 3. Start Server
```bash
npm start
```

### 4. Access Setup Wizard
Open browser to: `http://localhost:3000`

You'll be automatically redirected to: `http://localhost:3000/setup`

---

## 🎯 Setup Wizard Flow

The wizard guides users through 7 steps:

1. **Welcome** - Introduction and overview
2. **Organization** - Name, type, contact info, logo upload
3. **Document Type** - Hierarchy configuration (Articles → Sections)
4. **Workflow** - Approval process setup
5. **Import** - Upload bylaws document (.docx or Google Docs URL)
6. **Processing** - Background import and setup
7. **Success** - Summary and next steps

---

## 🧪 Verify Integration

Run the verification script:
```bash
node scripts/verify-integration.js
```

**Expected output:**
```
✅ Health Check Endpoint
✅ Setup Wizard Access
✅ Config Endpoint

🎉 All integration tests passed!
```

---

## 🔍 Key Integration Points

### 1. Setup Detection (server.js)
```javascript
// Checks if organization exists in Supabase
const isConfigured = await checkSetupStatus(req);

if (!isConfigured) {
  return res.redirect('/setup');
}
```

### 2. Session Management
```javascript
// Session stores wizard progress
req.session.setupData = {
  organization: { ... },
  documentType: { ... },
  workflow: { ... },
  completedSteps: ['organization', 'document']
};
```

### 3. CSRF Protection
```javascript
// All forms protected
<input type="hidden" name="_csrf" value="<%= csrfToken %>">
```

### 4. File Uploads
```javascript
// Multer handles logo and document uploads
upload.single('logo')
upload.single('document')
```

---

## 📊 Health Check Endpoint

New endpoint for monitoring:
```bash
curl http://localhost:3000/api/health
```

**Response (healthy):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-07T22:00:00.000Z"
}
```

**Response (unhealthy):**
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "Connection failed"
}
```

---

## 🚢 Deployment to Render.com

### 1. Push to GitHub
```bash
git add .
git commit -m "Integrate setup wizard"
git push origin main
```

### 2. Deploy to Render
- Use `render.yaml` blueprint
- Render will auto-generate `SESSION_SECRET`
- On first deploy, setup wizard will appear

### 3. Complete Setup Wizard
1. Visit your Render.com URL
2. Complete setup wizard
3. Enter Supabase credentials when prompted
4. Upload your bylaws document
5. Access main application

---

## 🛡️ Security Features

### Session Security
- HTTP-only cookies
- Secure flag in production
- 24-hour session lifetime
- Random session secret

### CSRF Protection
- All POST requests require valid token
- Token auto-injected in forms
- API endpoints excluded (use other auth)

### File Upload Security
- File type validation (.docx, images only)
- 10MB size limit
- Secure filename generation
- Isolated upload directory

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check syntax
node -c server.js

# Verify dependencies
npm install

# Check environment
cat .env
```

### Setup wizard not appearing
```bash
# Check Supabase connection
curl http://localhost:3000/api/health

# Clear session cache
# Delete session cookies in browser
```

### File uploads failing
```bash
# Create uploads directory
mkdir -p uploads/setup

# Check permissions
chmod 755 uploads/setup
```

### CSRF token errors
```bash
# Verify session middleware is before CSRF
# Check that csrfToken is passed to views
# Ensure _csrf field is in forms
```

---

## 📚 Related Documentation

- **[SETUP_WIZARD_INTEGRATION.md](./SETUP_WIZARD_INTEGRATION.md)** - Detailed technical documentation
- **[SETUP_GUIDE.md](../SETUP_GUIDE.md)** - User setup instructions
- **[DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)** - Deployment instructions
- **[README.md](../README.md)** - Project overview

---

## ✨ What's Next?

### Immediate Testing
- [ ] Test setup wizard with real Supabase instance
- [ ] Upload a sample bylaws document
- [ ] Verify organization creation
- [ ] Test main app access after setup

### Future Enhancements
- [ ] Replace deprecated `csurf` with `csrf-csrf`
- [ ] Upgrade `multer` to 2.x
- [ ] Add email verification
- [ ] Add setup wizard reset feature (admin only)
- [ ] Add multi-instance session storage (Redis)

---

## 🎉 Success Criteria

Integration is successful when:

1. ✅ Server starts without errors
2. ✅ Health check returns "healthy"
3. ✅ Setup wizard accessible at `/setup`
4. ✅ First-time users redirected to setup
5. ✅ Organization creation works
6. ✅ Main app accessible after setup
7. ✅ Session persists across requests
8. ✅ File uploads work correctly

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review detailed documentation in `SETUP_WIZARD_INTEGRATION.md`
3. Check server logs for error messages
4. Verify environment variables are set correctly

---

**Integration Complete!** 🎊

The setup wizard is now seamlessly integrated into the main application, providing a smooth first-run experience for new users.
