# Setup Wizard Quick Reference Card

## 🎯 The Goal

**Transform this:**
```
User → GitHub → Terminal → npm install → .env configuration →
Database setup → Hope it works → 2 hours later... maybe working?
```

**Into this:**
```
User → Click "Deploy" → Wait 2 min → Answer 5 questions →
Done! ✅ (5 minutes total)
```

---

## 📋 The 7 Screens

| Screen | Route | Time | What Happens | User Action |
|--------|-------|------|--------------|-------------|
| **1. Welcome** | `/setup/welcome` | 10s | Shows 5-step preview | Click "Get Started" |
| **2. Organization** | `/setup/organization` | 1m | Collect org info, upload logo | Fill form |
| **3. Document Type** | `/setup/document-type` | 30s | Choose structure template | Select card |
| **4. Workflow** | `/setup/workflow` | 1m | Configure approval stages | Select template |
| **5. Import** | `/setup/import` | 1m | Upload & parse document | Drop file |
| **6. Database** | `/setup/finalize` | 60s | Auto-setup (they just watch) | Watch progress |
| **7. Success** | `/setup/complete` | 10s | Celebration & tips | Click "Dashboard" |

**Total Time:** 5 minutes

---

## 🎨 Design Principles (The "Grandmother Test")

Every decision must pass: **"Would my grandmother be able to do this?"**

### ✅ Do This
- Use emojis and icons
- Show, don't tell
- Big obvious buttons
- Friendly encouraging copy
- Auto-save everything
- Allow going back
- Visual previews
- Real-time validation

### ❌ Not This
- Technical jargon
- Error codes
- Small text
- Hidden options
- Scary warnings
- Irreversible actions
- CLI commands
- Confusing layouts

---

## 🔑 Key Features

### 1. **Zero Configuration Required**
- No environment variables to set
- No database to provision manually
- No terminal commands
- Everything is point-and-click

### 2. **Smart Defaults**
- Pre-filled based on document type
- Common workflows as templates
- Auto-detect document structure
- Skip optional steps

### 3. **Forgiving**
- Can edit any step later
- Auto-save progress
- Resume if interrupted
- Multiple ways to fix errors

### 4. **Beautiful**
- Modern gradient background
- Smooth animations
- Card-based UI
- Professional styling

### 5. **Fast**
- Client-side validation
- Parallel processing
- Real-time previews
- No page reloads

---

## 🛠️ Technical Stack

```
Frontend:  EJS + Vanilla JS + Custom CSS
Backend:   Express.js + Node.js
Database:  Supabase (PostgreSQL)
Hosting:   Render.com (free tier)
Storage:   Local filesystem
Session:   express-session (memory)
Parsing:   mammoth (DOCX), pdf-parse (PDF)
```

---

## 📁 File Structure (Simplified)

```
src/setup/
├── routes/           # URL routing
├── controllers/      # Business logic (7 screens)
├── middleware/       # Guards, validation, session
├── services/         # Parser, Supabase, migrations
├── views/            # EJS templates (7 screens)
└── public/
    ├── css/          # Wizard styles
    └── js/           # Client-side logic
```

---

## 🔒 Security Checklist

- ✅ Sanitize all user input (XSS prevention)
- ✅ Validate file uploads (type, size, magic bytes)
- ✅ Secure session cookies (httpOnly, secure)
- ✅ Rate limiting (max 3 setups per hour per IP)
- ✅ CSRF protection
- ✅ No secrets in client-side code
- ✅ Delete temp files after import
- ✅ Encrypt uploaded documents

---

## 📊 Success Metrics

### Conversion Funnel (Target)
```
100 visitors
  → 40 click "Deploy" (40%)
    → 32 deploy successfully (80%)
      → 22 complete setup (70%)
        = 22% overall conversion
```

### User Experience (Target)
- Setup time: **< 7 min** (goal: 5 min)
- Success rate: **> 95%**
- Parse accuracy: **> 90%**
- Support tickets: **< 5%**
- Satisfaction: **> 4.5/5**

---

## 🚀 Deployment Flow

### Step 1: User Clicks "Deploy to Render"
```html
<a href="https://render.com/deploy?repo=YOUR_GITHUB_URL">
  <img src="deploy-to-render-button.svg">
</a>
```

### Step 2: Render Deploys App (2 minutes)
- Reads `render.yaml` from repo
- Installs dependencies (`npm ci`)
- Builds app (`npm run build`)
- Starts server (`npm start`)
- Assigns URL: `https://org-name.onrender.com`

### Step 3: User Visits App URL
- App detects: No organization exists
- Redirects to: `/setup/welcome`
- Wizard begins!

### Step 4: User Completes Wizard (5 minutes)
- Fills out 5 screens
- Database created automatically
- Redirects to: `/dashboard`
- App is ready to use!

---

## 🎯 Screen 2 Example (Organization Info)

**What User Sees:**
```
┌────────────────────────────────────┐
│  🏢 Tell us about your org         │
│                                    │
│  Name: [Riverside HOA          ]   │
│  Type: [HOA                ▼]      │
│  Email: [president@riverside.org]  │
│  Logo: [Drag & drop or click]      │
│                                    │
│  [← Back]         [Continue →]     │
└────────────────────────────────────┘
```

**What Code Does:**
```javascript
// Validate
if (!name || !type || !email) {
  showError("Please fill required fields");
  return;
}

// Save to session
session.setupData.organization = { name, type, email, logo };

// Go to next screen
redirect('/setup/document-type');
```

---

## 🔧 Common Implementations

### Auto-Redirect if Configured
```javascript
app.use('/setup', setupGuard.redirectIfConfigured);
// If org exists → redirect to /dashboard
// If org missing → continue to setup wizard
```

### Session Progress Tracking
```javascript
req.session.setupProgress = {
  currentStep: 2,
  data: { organization: {...}, documentType: {...} }
};
```

### Real-Time Progress (SSE)
```javascript
// Server
res.writeHead(200, {'Content-Type': 'text/event-stream'});
progress.on('update', (data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
});

// Client
const evtSource = new EventSource('/setup/finalize');
evtSource.onmessage = (e) => updateUI(JSON.parse(e.data));
```

---

## 🐛 Error Handling Patterns

### File Too Large
```
❌ "Error: File exceeds maximum size"
✅ "This file is 15 MB. Please upload a file under 10 MB.
    [Try Different File] [Enter Manually]"
```

### Parse Failed
```
❌ "ParseException: Invalid structure"
✅ "We couldn't detect the article structure in this file.
    Would you like to try a different file or enter sections manually?
    [Upload Different File] [Enter Manually] [Get Help]"
```

### Network Error
```
❌ "ERR_CONNECTION_TIMEOUT"
✅ "We lost connection to the server.
    Your progress has been saved automatically.
    [Reconnect & Continue] [Save & Come Back Later]"
```

---

## 📱 Mobile Responsive

```css
/* Desktop: Multi-column cards */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); }

/* Mobile: Single column, full width buttons */
@media (max-width: 768px) {
  .steps { grid-template-columns: 1fr; }
  .btn-lg { width: 100%; font-size: 16px; }
}
```

---

## ♿ Accessibility (WCAG 2.1 AA)

```html
<!-- Semantic HTML -->
<form role="form" aria-label="Organization Information">

<!-- Associated labels -->
<label for="org-name">Organization Name *</label>
<input id="org-name" aria-required="true" aria-describedby="org-help">
<p id="org-help">This will appear in headers and reports</p>

<!-- Error announcements -->
<p role="alert" aria-live="polite" id="org-error"></p>

<!-- Keyboard navigation -->
<button tabindex="0">Continue</button>
```

---

## 📚 Documentation Links

| Document | Purpose | Audience |
|----------|---------|----------|
| **GRAPHICAL_SETUP_UX_DESIGN.md** | Complete UX spec (16K words) | Designers, Developers |
| **SETUP_WIZARD_README.md** | Implementation guide | Developers |
| **LANDING_PAGE.html** | Marketing page | End Users |
| **GRAPHICAL_SETUP_SUMMARY.md** | Executive overview | Stakeholders |
| **SETUP_WIZARD_QUICK_REF.md** | This document | Everyone |

---

## 🎬 Quick Start for Developers

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/BYLAWSTOOL_Generalized.git
cd BYLAWSTOOL_Generalized

# 2. Install dependencies
npm install

# 3. Set environment
export SETUP_MODE=enabled

# 4. Run dev server
npm run dev

# 5. Open browser
open http://localhost:3000/setup
```

---

## ✅ Implementation Checklist

**Phase 1: Foundation** (Week 1)
- [ ] Set up `/src/setup` directory structure
- [ ] Create routes and middleware
- [ ] Build Screen 1 (Welcome)
- [ ] Test auto-redirect logic

**Phase 2: Data Collection** (Week 2)
- [ ] Screen 2 (Organization) with file upload
- [ ] Screen 3 (Document type) with templates
- [ ] Screen 4 (Workflow) with visual builder

**Phase 3: Import & Setup** (Week 3)
- [ ] Screen 5 (Import) with parser
- [ ] Document parser service (DOCX, PDF, TXT)
- [ ] Screen 6 (Database setup) with SSE
- [ ] Supabase integration

**Phase 4: Polish** (Week 4)
- [ ] Screen 7 (Success) with tips
- [ ] Mobile responsive testing
- [ ] Accessibility audit
- [ ] Error handling & recovery

**Launch!** 🚀

---

## 💡 Remember

> "Real humans don't use CLI. Let's idiot-proof the setup and have it nice and pretty."

The wizard must be so easy that:
- ✅ A 70-year-old HOA president can deploy it
- ✅ A non-technical club secretary can configure it
- ✅ Someone who's never used GitHub can succeed
- ✅ It feels like a $5,000 consultant product (but it's free)

**If your grandmother can't do it, it's not done yet.**

---

## 🎉 Success =

```
User journey time:     5 minutes
User technical skill:  Zero
User satisfaction:     😍
Deployments:          ∞
```

**Let's make bylaw tracking accessible to everyone!**
