# Graphical Setup Wizard - UX Design Document

## Executive Summary

Transform the Bylaws Amendment Tracker from a developer tool into a consumer product that anyone can deploy and configure in 5 minutes, no technical knowledge required.

**Target User:** HOA president, club secretary, nonprofit administrator - someone who uses Google Docs but doesn't know what "CLI" means.

**Core Principle:** If Squarespace and Notion had a baby that tracked bylaw amendments.

---

## Complete User Journey

### Phase 1: Discovery → Deployment (2 minutes)

#### Landing Page (Pre-Deploy)

**URL:** `https://bylaws-tracker.onrender.com` (marketing site)

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        📋 Bylaws Amendment Tracker                        ║
║        Track, Review, and Approve Document Changes        ║
║                                                           ║
║        Stop using Google Docs comment threads for         ║
║        your bylaw amendments. Get a real system.          ║
║                                                           ║
║        ┌─────────────────────────────────────────┐        ║
║        │  🚀 Deploy Your Own Tracker (Free)      │        ║
║        │     Takes 2 minutes, no credit card     │        ║
║        └─────────────────────────────────────────┘        ║
║                                                           ║
║        ✓ No technical skills needed                       ║
║        ✓ Free hosting on Render                          ║
║        ✓ Your own private instance                       ║
║        ✓ Full control of your data                       ║
║                                                           ║
║        [See How It Works ▼]                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

           ↓ Scroll to see 3-step process ↓

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   How It Works: 3 Simple Steps                           ║
║                                                           ║
║   [1. Deploy]        [2. Configure]      [3. Use]        ║
║   ┌──────────┐      ┌──────────┐       ┌──────────┐     ║
║   │ Click the│      │  Upload  │       │  Start   │     ║
║   │  Deploy  │  →   │   your   │   →   │ tracking │     ║
║   │  button  │      │ document │       │ changes  │     ║
║   └──────────┘      └──────────┘       └──────────┘     ║
║   2 minutes         3 minutes           Instant          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

        ┌─────────────────────────────────────────┐
        │  💜 Deploy to Render                    │
        │     (Creates your personal tracker)     │
        └─────────────────────────────────────────┘

        Questions? [Watch 2-min Video] | [Read FAQ]
```

**Copy Details:**

- **Headline:** "Bylaws Amendment Tracker"
- **Subheadline:** "Track, Review, and Approve Document Changes"
- **Hero Copy:** "Stop using Google Docs comment threads for your bylaw amendments. Get a real system."
- **CTA Button:** "🚀 Deploy Your Own Tracker (Free)"
- **Trust Signals:**
  - "No technical skills needed"
  - "Free hosting on Render"
  - "Your own private instance"
  - "Full control of your data"

**Technical Implementation:**
- Static landing page (can be GitHub Pages or simple HTML)
- "Deploy to Render" button links to: `https://render.com/deploy?repo=https://github.com/YOUR_REPO`
- Includes `render.yaml` in repo root for one-click deploy

---

#### Render Deployment Flow

**User Experience:**
1. User clicks "Deploy to Render" button
2. Redirected to Render.com (purple branding, professional)
3. Render shows: "Deploy Bylaws Tracker from GitHub"
4. User creates Render account OR logs in (Render handles this)
5. Render shows deployment configuration:

```
╔═══════════════════════════════════════════════════════════╗
║  Render: Deploy Bylaws Amendment Tracker                 ║
║                                                           ║
║  Service Name: [your-org-bylaws]                         ║
║  Region: [Oregon (US West)]                              ║
║  Instance Type: [Free] (Upgradeable later)               ║
║                                                           ║
║  ℹ️  This app will sleep after 15 min of inactivity      ║
║     (Free plan limitation - upgrade to prevent)          ║
║                                                           ║
║  ┌─────────────────────────────────────┐                ║
║  │  Deploy Service (Takes ~2 minutes)  │                ║
║  └─────────────────────────────────────┘                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

6. Render deploys app (shows build logs - user can watch or close)
7. After ~2 minutes: "✓ Deploy successful!"
8. Shows app URL: `https://your-org-bylaws.onrender.com`
9. Big button: "Open Service" → Takes to their new app

**What We Provide (render.yaml):**
```yaml
services:
  - type: web
    name: bylaws-tracker
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SESSION_SECRET
        generateValue: true
      - key: SUPABASE_URL
        value: # Will be set during setup wizard
      - key: SUPABASE_KEY
        value: # Will be set during setup wizard
```

---

### Phase 2: First-Launch Setup Wizard (3-5 minutes)

#### Route: `/setup` (Automatically shown on first visit)

**Detection Logic:**
```javascript
// On app load (server.js)
app.use(async (req, res, next) => {
  // Check if organization exists in database
  const orgExists = await db.query('SELECT COUNT(*) FROM organization');

  if (orgExists.count === 0 && req.path !== '/setup') {
    // First launch - redirect to setup wizard
    return res.redirect('/setup');
  }

  if (orgExists.count > 0 && req.path === '/setup') {
    // Already configured - redirect to dashboard
    return res.redirect('/dashboard');
  }

  next();
});
```

---

### Screen 1: Welcome 🎉

**Route:** `/setup/welcome`

```
╔═══════════════════════════════════════════════════════════╗
║                    🎉 Welcome!                            ║
║                                                           ║
║        Your Bylaws Amendment Tracker is deployed!         ║
║                                                           ║
║        Let's get you set up in just 5 steps              ║
║        (Takes about 5 minutes)                           ║
║                                                           ║
║        ┌─────────────────────────────────────┐           ║
║        │                                     │           ║
║        │   [Progress Bar: ○────────────]    │           ║
║        │   Step 1 of 5                      │           ║
║        │                                     │           ║
║        │   What we'll do together:          │           ║
║        │                                     │           ║
║        │   1️⃣  Tell us about your org       │           ║
║        │   2️⃣  Choose your document type    │           ║
║        │   3️⃣  Set up approval workflow     │           ║
║        │   4️⃣  Upload your document         │           ║
║        │   5️⃣  Finalize setup               │           ║
║        │                                     │           ║
║        └─────────────────────────────────────┘           ║
║                                                           ║
║            ┌─────────────────────────┐                   ║
║            │    Let's Get Started    │                   ║
║            └─────────────────────────┘                   ║
║                                                           ║
║            Don't worry - you can change                  ║
║            any of this later!                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Design Details:**
- Large emoji at top (🎉)
- Friendly, encouraging tone
- Clear progress indicator
- Preview of what's coming
- No jargon ("org" not "tenant", "document" not "corpus")
- Reassurance: "you can change any of this later"

**Technical Notes:**
- Session storage to save progress (in case they close browser)
- Big, centered "Let's Get Started" button
- No "Skip" option - we need this info
- Analytics event: `setup_started`

---

### Screen 2: Organization Info 🏢

**Route:** `/setup/organization`

```
╔═══════════════════════════════════════════════════════════╗
║  [Logo]  Bylaws Tracker Setup                            ║
║  [Progress: ●●○○○○○○○○] Step 2 of 5                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   🏢 Tell us about your organization                      ║
║                                                           ║
║   Organization Name *                                     ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │ Riverside Homeowners Association                │    ║
║   └─────────────────────────────────────────────────┘    ║
║   This will appear in the header and reports             ║
║                                                           ║
║   Organization Type *                                     ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │ Homeowners Association (HOA)            [▼]     │    ║
║   └─────────────────────────────────────────────────┘    ║
║   ▾ Dropdown options:                                    ║
║     • Homeowners Association (HOA)                       ║
║     • Condominium Association (COA)                      ║
║     • Property Owners Association (POA)                  ║
║     • Social Club                                        ║
║     • Professional Organization                          ║
║     • Nonprofit Corporation                              ║
║     • For-Profit Corporation                             ║
║     • Government Agency                                  ║
║     • School/University                                  ║
║     • Religious Organization                             ║
║     • Other                                              ║
║                                                           ║
║   Contact Email *                                         ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │ president@riversidehoa.org                      │    ║
║   └─────────────────────────────────────────────────┘    ║
║   We'll send important notifications here                ║
║                                                           ║
║   Organization Logo (Optional)                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  📤 Drag & drop or click to upload             │    ║
║   │     Accepted: PNG, JPG (Max 2MB)                │    ║
║   └─────────────────────────────────────────────────┘    ║
║   This will appear in the header and PDFs                ║
║                                                           ║
║                                                           ║
║   ┌──────────────┐            ┌──────────────┐           ║
║   │   ← Back     │            │   Continue → │           ║
║   └──────────────┘            └──────────────┘           ║
║                                                           ║
║   * Required fields                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Form Validation:**
- **Organization Name:**
  - Required
  - Min 2 characters, max 100
  - Real-time validation
  - Error: "Please enter your organization name"

- **Organization Type:**
  - Required
  - Dropdown selection
  - Affects terminology in later steps

- **Contact Email:**
  - Required
  - Email format validation
  - Real-time check
  - Error: "Please enter a valid email address"

- **Logo Upload:**
  - Optional
  - Image preview on upload
  - File size check (max 2MB)
  - Format check (PNG, JPG only)
  - Error: "Please upload a PNG or JPG under 2MB"

**UX Enhancements:**
- Auto-focus on first field when page loads
- Tab order follows visual order
- Help text under each field (not tooltips)
- Green checkmark appears when field is valid
- Continue button disabled until required fields valid
- Smooth transitions between validation states

**Technical Implementation:**
```javascript
// Client-side validation
const organizationForm = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&',\.]+$/,
    errorMsg: "Please enter your organization name"
  },
  type: {
    required: true,
    errorMsg: "Please select your organization type"
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    errorMsg: "Please enter a valid email address"
  },
  logo: {
    required: false,
    maxSize: 2097152, // 2MB
    allowedTypes: ['image/png', 'image/jpeg'],
    errorMsg: "Please upload a PNG or JPG under 2MB"
  }
};

// Save to session on continue
async function saveOrganizationInfo(formData) {
  // Store in session
  sessionStorage.setItem('setup_org', JSON.stringify(formData));

  // Also save to backend (partial save)
  await fetch('/api/setup/organization', {
    method: 'POST',
    body: JSON.stringify(formData),
    headers: { 'Content-Type': 'application/json' }
  });

  // Navigate to next step
  window.location.href = '/setup/document-type';
}
```

**Mobile Responsive:**
- Single column layout
- Large touch targets (min 44px)
- File upload shows camera option on mobile
- Native select dropdown on mobile

---

### Screen 3: Document Setup 📄

**Route:** `/setup/document-type`

```
╔═══════════════════════════════════════════════════════════╗
║  [Logo]  Bylaws Tracker Setup                            ║
║  [Progress: ●●●●○○○○○○] Step 3 of 5                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   📄 What kind of document are you tracking?              ║
║                                                           ║
║   Choose the structure that matches your document:       ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  📜 Bylaws (HOA/Club/Nonprofit)             │ ✓      ║
║   │                                             │        ║
║   │  Structure: Articles → Sections             │        ║
║   │  Example: Article IV, Section 3             │        ║
║   │                                             │        ║
║   │  [Customize Terms ▼]                        │        ║
║   │  ┌─────────────────────────────────────┐   │        ║
║   │  │ Call top level: [Articles      ▼]  │   │        ║
║   │  │ Call subdivisions: [Sections   ▼]  │   │        ║
║   │  │ Numbering: [Roman numerals     ▼]  │   │        ║
║   │  └─────────────────────────────────────┘   │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  📋 Corporate Policy Manual                 │        ║
║   │                                             │        ║
║   │  Structure: Chapters → Articles → Sections  │        ║
║   │  Example: Chapter 2, Article A, Section 1   │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  🏛️ Government Code/Ordinances              │        ║
║   │                                             │        ║
║   │  Structure: Titles → Chapters → Sections    │        ║
║   │  Example: Title 21, Chapter 3, Section 45   │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  🎯 Club Constitution                        │        ║
║   │                                             │        ║
║   │  Structure: Articles → Sections             │        ║
║   │  Example: Article 5, Section B              │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  ⚙️ Custom Structure                         │        ║
║   │                                             │        ║
║   │  I'll define my own hierarchy and terms     │        ║
║   │  [Set Up Custom →]                          │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║                                                           ║
║   ┌──────────────┐            ┌──────────────┐           ║
║   │   ← Back     │            │   Continue → │           ║
║   └──────────────┘            └──────────────┘           ║
║                                                           ║
║   ℹ️  Don't worry if none match exactly -                ║
║       you can customize terminology!                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Interaction Design:**

1. **Card Selection:**
   - Click any card to select (radio button behavior)
   - Selected card gets blue border, checkmark appears
   - Other cards fade slightly
   - Smooth animation (200ms)

2. **Customize Terms (Expandable):**
   - Shows when card is selected
   - Slide-down animation
   - Pre-filled with defaults for that document type
   - Dropdowns for:
     - Top-level name (Article, Chapter, Title, Part)
     - Subdivision name (Section, Article, Paragraph, Clause)
     - Numbering style (Roman, Arabic, Letters)

3. **Custom Structure Modal:**
   - Opens modal/overlay when "Custom" card clicked
   - Allows defining:
     - Number of hierarchy levels (2-4)
     - Name for each level
     - Numbering format for each
     - Preview as they build

**Presets Configuration:**

```javascript
const documentTypes = {
  bylaws: {
    name: "Bylaws (HOA/Club/Nonprofit)",
    icon: "📜",
    structure: "Articles → Sections",
    example: "Article IV, Section 3",
    defaults: {
      level1Name: "Article",
      level2Name: "Section",
      level1Numbering: "roman",
      level2Numbering: "arabic"
    }
  },
  corporate: {
    name: "Corporate Policy Manual",
    icon: "📋",
    structure: "Chapters → Articles → Sections",
    example: "Chapter 2, Article A, Section 1",
    defaults: {
      level1Name: "Chapter",
      level2Name: "Article",
      level3Name: "Section",
      level1Numbering: "arabic",
      level2Numbering: "letters",
      level3Numbering: "arabic"
    }
  },
  government: {
    name: "Government Code/Ordinances",
    icon: "🏛️",
    structure: "Titles → Chapters → Sections",
    example: "Title 21, Chapter 3, Section 45",
    defaults: {
      level1Name: "Title",
      level2Name: "Chapter",
      level3Name: "Section",
      level1Numbering: "arabic",
      level2Numbering: "arabic",
      level3Numbering: "arabic"
    }
  },
  club: {
    name: "Club Constitution",
    icon: "🎯",
    structure: "Articles → Sections",
    example: "Article 5, Section B",
    defaults: {
      level1Name: "Article",
      level2Name: "Section",
      level1Numbering: "arabic",
      level2Numbering: "letters"
    }
  },
  custom: {
    name: "Custom Structure",
    icon: "⚙️",
    structure: "Define your own",
    showModal: true
  }
};
```

**Continue Button Logic:**
- Disabled until a document type is selected
- If "Bylaws" selected with default terms → Save and continue
- If customizations made → Validate terms (not empty, unique names)
- Store in session: `setup_doctype`

---

### Screen 4: Workflow Configuration ⚙️

**Route:** `/setup/workflow`

```
╔═══════════════════════════════════════════════════════════╗
║  [Logo]  Bylaws Tracker Setup                            ║
║  [Progress: ●●●●●●○○○○] Step 4 of 5                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   ⚙️ How should amendments be reviewed?                   ║
║                                                           ║
║   Choose a workflow template or build your own:          ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  ⚡ Single Stage Approval (Fastest)          │ ✓      ║
║   │                                             │        ║
║   │  [Suggestion] → [Board Vote] → [Approved]   │        ║
║   │                                             │        ║
║   │  Best for: Small clubs, simple changes      │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  🏢 Two-Stage (Committee + Board)            │        ║
║   │                                             │        ║
║   │  [Suggestion] → [Committee Review]          │        ║
║   │              → [Board Vote] → [Approved]    │        ║
║   │                                             │        ║
║   │  Best for: HOAs, standard bylaws            │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  🏛️ Three-Stage (Full Governance)            │        ║
║   │                                             │        ║
║   │  [Suggestion] → [Committee Review]          │        ║
║   │              → [Board Approval]             │        ║
║   │              → [Member Vote] → [Approved]   │        ║
║   │                                             │        ║
║   │  Best for: Large orgs, major changes        │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌─────────────────────────────────────────────┐        ║
║   │  ⚙️ Custom Workflow                          │        ║
║   │                                             │        ║
║   │  Build your own approval stages             │        ║
║   │  [Customize →]                              │        ║
║   └─────────────────────────────────────────────┘        ║
║                                                           ║
║   ┌───────────────────────────────────────────────────┐  ║
║   │  Preview: Two-Stage Workflow                     │  ║
║   │                                                   │  ║
║   │  Stage 1: Committee Review                       │  ║
║   │  • Members can suggest changes                   │  ║
║   │  • Committee reviews and votes                   │  ║
║   │  • Requires: 50% committee approval              │  ║
║   │                                                   │  ║
║   │  Stage 2: Board Approval                         │  ║
║   │  • Board reviews committee recommendations       │  ║
║   │  • Board votes on final approval                 │  ║
║   │  • Requires: 2/3 board majority                  │  ║
║   │                                                   │  ║
║   │  [Edit Stage Settings]                           │  ║
║   └───────────────────────────────────────────────────┘  ║
║                                                           ║
║   ┌──────────────┐            ┌──────────────┐           ║
║   │   ← Back     │            │   Continue → │           ║
║   └──────────────┘            └──────────────┘           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Interaction Design:**

1. **Template Selection:**
   - Cards work like previous screen
   - Selecting a template shows preview panel below
   - Preview shows:
     - Visual flow diagram
     - Stage names
     - Who participates in each stage
     - Approval thresholds
   - "Edit Stage Settings" button opens detailed config

2. **Edit Stage Settings Modal:**
   ```
   ┌─────────────────────────────────────────┐
   │  Edit Stage 1: Committee Review         │
   ├─────────────────────────────────────────┤
   │                                         │
   │  Stage Name                             │
   │  [Committee Review            ]         │
   │                                         │
   │  Who can participate?                   │
   │  ☑ Committee members                    │
   │  ☐ Board members                        │
   │  ☐ All members                          │
   │                                         │
   │  Approval requirement                   │
   │  [Simple Majority (50%+1)    ▼]         │
   │                                         │
   │  Time limit (optional)                  │
   │  [14] days                              │
   │                                         │
   │  Auto-advance if approved?              │
   │  ☑ Yes, move to next stage              │
   │                                         │
   │         [Cancel]    [Save Stage]        │
   │                                         │
   └─────────────────────────────────────────┘
   ```

3. **Custom Workflow Builder:**
   - Opens full-screen workflow designer
   - Drag-and-drop stages
   - Connect stages with arrows
   - Add stage by clicking "+"
   - Preview updates in real-time
   - Sample stages to choose from:
     - Committee Review
     - Legal Review
     - Board Approval
     - Member Vote
     - Expert Review
     - Public Comment Period
     - Executive Approval

**Workflow Templates:**

```javascript
const workflowTemplates = {
  single: {
    name: "Single Stage Approval",
    icon: "⚡",
    description: "Fast approval for simple changes",
    stages: [
      {
        name: "Board Vote",
        participants: ["board"],
        threshold: "2/3",
        autoAdvance: true
      }
    ]
  },
  twoStage: {
    name: "Two-Stage (Committee + Board)",
    icon: "🏢",
    description: "Standard process for most organizations",
    stages: [
      {
        name: "Committee Review",
        participants: ["committee"],
        threshold: "simple_majority",
        autoAdvance: true,
        timeLimit: 14
      },
      {
        name: "Board Approval",
        participants: ["board"],
        threshold: "2/3",
        autoAdvance: false
      }
    ]
  },
  threeStage: {
    name: "Three-Stage (Full Governance)",
    icon: "🏛️",
    description: "Complete review process",
    stages: [
      {
        name: "Committee Review",
        participants: ["committee"],
        threshold: "simple_majority",
        autoAdvance: true,
        timeLimit: 14
      },
      {
        name: "Board Approval",
        participants: ["board"],
        threshold: "2/3",
        autoAdvance: true,
        timeLimit: 7
      },
      {
        name: "Member Vote",
        participants: ["all_members"],
        threshold: "simple_majority",
        autoAdvance: false,
        timeLimit: 30
      }
    ]
  }
};
```

**Validation:**
- At least one stage required
- Each stage must have:
  - Non-empty name
  - At least one participant type
  - Valid threshold value
- No circular dependencies in custom workflows

---

### Screen 5: Document Import 📤

**Route:** `/setup/import`

```
╔═══════════════════════════════════════════════════════════╗
║  [Logo]  Bylaws Tracker Setup                            ║
║  [Progress: ●●●●●●●●○○] Step 5 of 5                      ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   📤 Upload your existing document                        ║
║                                                           ║
║   We'll automatically detect all your articles and       ║
║   sections. You can review and edit before importing.    ║
║                                                           ║
║   ┌────────────────────────────────────────────┐         ║
║   │ [Google Docs]      [Upload File]         │         ║
║   └────────────────────────────────────────────┘         ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │                                                 │    ║
║   │         📄 Drag & drop your file here          │    ║
║   │              or click to browse                 │    ║
║   │                                                 │    ║
║   │      Accepted formats: .docx, .pdf, .txt       │    ║
║   │            Maximum size: 10 MB                  │    ║
║   │                                                 │    ║
║   │   ℹ️  We support Microsoft Word documents       │    ║
║   │      formatted with headings and numbering      │    ║
║   │                                                 │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   Or start with a blank document:                        ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  📝 Create from scratch                         │    ║
║   │                                                 │    ║
║   │  I'll add articles and sections manually        │    ║
║   │  [Start with Blank Document]                    │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║                                                           ║
║   ┌──────────────┐            ┌──────────────┐           ║
║   │   ← Back     │            │   Continue → │           ║
║   └──────────────┘            └──────────────┘           ║
║                                                           ║
║   🔒 Your document is private and secure                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Tab 1: Google Docs (if implemented)**

```
╔═══════════════════════════════════════════════════════════╗
║   [Google Docs] Tab                                      ║
║                                                           ║
║   Connect your Google account to import directly         ║
║   from Google Docs:                                      ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │   🔗 Connect Google Account                     │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   After connecting:                                      ║
║   1. Select your document from Google Drive              ║
║   2. We'll import the current version                    ║
║   3. Changes in Google Docs won't auto-sync              ║
║                                                           ║
║   ℹ️  This is a one-time import, not continuous sync     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**After File Upload:**

```
╔═══════════════════════════════════════════════════════════╗
║   ✓ Document uploaded successfully!                      ║
║                                                           ║
║   ┌───────────────────────────────────────────┐          ║
║   │  📄 riverside_hoa_bylaws.docx             │          ║
║   │  45 KB • Uploaded 2 seconds ago           │          ║
║   │                            [Remove] [Edit] │          ║
║   └───────────────────────────────────────────┘          ║
║                                                           ║
║   🔍 Analyzing document...                               ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  [Progress bar: ████████████░░░░░░░░] 65%      │    ║
║   │                                                 │    ║
║   │  Detecting structure...                         │    ║
║   │  ✓ Found 12 articles                            │    ║
║   │  ✓ Found 45 sections                            │    ║
║   │  → Parsing content...                           │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**After Analysis Complete:**

```
╔═══════════════════════════════════════════════════════════╗
║   ✅ Document analyzed! Review before importing           ║
║                                                           ║
║   We found: 12 articles, 45 sections                     ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  Article I: Name and Purpose              [✓]  │    ║
║   │    Section 1: Name                         [✓]  │    ║
║   │    Section 2: Purpose                      [✓]  │    ║
║   │                                                 │    ║
║   │  Article II: Membership                    [✓]  │    ║
║   │    Section 1: Eligibility                  [✓]  │    ║
║   │    Section 2: Application Process          [✓]  │    ║
║   │    Section 3: Dues and Assessments         [✓]  │    ║
║   │                                                 │    ║
║   │  Article III: Board of Directors           [✓]  │    ║
║   │    Section 1: Composition                  [✓]  │    ║
║   │    Section 2: Powers and Duties            [✓]  │    ║
║   │    Section 3: Term of Office               [✓]  │    ║
║   │    ...                                          │    ║
║   │                                                 │    ║
║   │  [Show All 45 Sections]                         │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ⚠️  Something look wrong?                               ║
║   [Edit Structure]  [Re-upload Document]                 ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │     Import Document (45 sections)           │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌──────────────┐                                       ║
║   │   ← Back     │                                       ║
║   └──────────────┘                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Edit Structure Modal:**

```
┌─────────────────────────────────────────────────────────┐
│  Edit Document Structure                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Article I: Name and Purpose                    [Edit]  │
│    ├─ Section 1: Name                           [Edit]  │
│    └─ Section 2: Purpose                        [Edit]  │
│                                                 [Add §] │
│                                                         │
│  Article II: Membership                         [Edit]  │
│    ├─ Section 1: Eligibility                    [Edit]  │
│    ├─ Section 2: Application Process            [Edit]  │
│    └─ Section 3: Dues and Assessments           [Edit]  │
│                                                 [Add §] │
│                                                         │
│  [Add Article]                                          │
│                                                         │
│  Click [Edit] to fix titles or merge/split sections    │
│                                                         │
│            [Cancel]        [Save Changes]               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

1. **File Upload:**
   - Use `multer` for file handling
   - Validate file type and size
   - Store temporarily during setup
   - Move to permanent storage after completion

2. **Document Parsing:**
   - Use `mammoth` for .docx files
   - Use `pdf-parse` for PDFs
   - Simple text parsing for .txt
   - Detect hierarchy based on:
     - Heading styles (Heading 1, Heading 2)
     - Numbering patterns (Article I, Section 1)
     - Indentation
     - Keywords (Article, Section, Chapter)

3. **Parser Algorithm:**
   ```javascript
   async function parseDocument(file, documentType) {
     // Extract text with formatting
     const content = await extractContent(file);

     // Apply pattern matching based on document type
     const patterns = {
       article: /^Article\s+([IVXLCDM]+|[0-9]+)[:.\s]+(.+)$/i,
       section: /^Section\s+([0-9]+|[A-Z])[:.\s]+(.+)$/i
     };

     // Build hierarchy
     const structure = [];
     let currentArticle = null;

     for (const line of content.lines) {
       if (patterns.article.test(line)) {
         currentArticle = {
           number: extractNumber(line),
           title: extractTitle(line),
           sections: []
         };
         structure.push(currentArticle);
       } else if (patterns.section.test(line) && currentArticle) {
         currentArticle.sections.push({
           number: extractNumber(line),
           title: extractTitle(line),
           content: extractParagraph(line)
         });
       }
     }

     return structure;
   }
   ```

4. **Error Handling:**
   - File too large → "Please upload a file under 10 MB"
   - Wrong format → "Please upload a .docx, .pdf, or .txt file"
   - Parse failure → "We couldn't detect the structure. [Try again] or [Create manually]"
   - Empty document → "This document appears empty. [Try again] or [Start blank]"

---

### Screen 6: Database Setup 🗄️ (Auto-magic)

**Route:** `/setup/finalize`

This screen shows WHILE the backend is working. User sees progress, not a spinner.

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🗄️ Setting up your database...               ║
║                                                           ║
║        This takes about 30-60 seconds                     ║
║        Please don't close this window                     ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │                                                 │    ║
║   │  ✓ Creating your Supabase project...           │    ║
║   │     • Database provisioned                      │    ║
║   │     • Authentication configured                 │    ║
║   │                                                 │    ║
║   │  ⏳ Running database migrations...              │    ║
║   │     • Creating tables... [████████░░] 80%       │    ║
║   │     • Setting up relationships...               │    ║
║   │                                                 │    ║
║   │  ⏺️  Importing your document...                 │    ║
║   │     Pending (45 sections to import)             │    ║
║   │                                                 │    ║
║   │  ⏺️  Configuring workflows...                   │    ║
║   │     Pending                                     │    ║
║   │                                                 │    ║
║   │  ⏺️  Finalizing setup...                        │    ║
║   │     Pending                                     │    ║
║   │                                                 │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║              [Overall Progress: 35%]                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Progress States:**
- ⏺️ Pending (gray)
- ⏳ In Progress (blue, animated)
- ✓ Complete (green)
- ✗ Failed (red)

**Real-Time Updates:**
Each step sends progress events to the frontend via WebSocket or SSE:

```javascript
// Backend sends events
setupProgress.on('step', (step) => {
  websocket.send({
    step: step.name,
    status: step.status, // pending, in_progress, complete, failed
    progress: step.progress, // 0-100
    substeps: step.substeps
  });
});

// Frontend updates UI
socket.on('setup:progress', (data) => {
  updateStepUI(data.step, data.status, data.progress);
});
```

**Steps Breakdown:**

1. **Create Supabase Project (15 seconds):**
   - Call Supabase Management API
   - Create new project
   - Get database credentials
   - Store credentials in environment

2. **Run Database Migrations (20 seconds):**
   - Execute SQL schema files
   - Create tables: organization, sections, suggestions, votes, etc.
   - Set up indexes and constraints
   - Configure RLS policies

3. **Import Document (20 seconds):**
   - Insert organization record
   - Insert all articles
   - Insert all sections with content
   - Link relationships
   - Show progress: "Imported 12 of 45 sections..."

4. **Configure Workflows (10 seconds):**
   - Insert workflow stages
   - Set up approval thresholds
   - Configure permissions
   - Create default roles

5. **Finalize Setup (5 seconds):**
   - Mark setup as complete
   - Clear setup session
   - Generate admin credentials
   - Send welcome email

**If Error Occurs:**

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              ⚠️ Setup encountered an issue                ║
║                                                           ║
║   ✓ Creating your Supabase project... Complete           ║
║   ✓ Running database migrations... Complete              ║
║   ✗ Importing your document... Failed                    ║
║                                                           ║
║   Error: Could not parse section numbering               ║
║                                                           ║
║   What would you like to do?                             ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🔄 Try Again                                   │    ║
║   │     Re-attempt the import with same file        │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  📤 Upload Different File                       │    ║
║   │     Go back and try another document            │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  📝 Skip Import & Add Manually                  │    ║
║   │     Start with blank and add sections manually  │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  💬 Get Help                                    │    ║
║   │     Contact support or see troubleshooting      │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Technical Implementation:**

```javascript
// Backend setup controller
async function finalizeSetup(req, res) {
  const setupId = req.session.setupId;
  const setupData = await getSetupData(setupId);

  // Create event emitter for progress
  const progress = new EventEmitter();

  // Stream progress to client
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  progress.on('update', (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  try {
    // Step 1: Create Supabase project
    progress.emit('update', { step: 'supabase', status: 'in_progress' });
    const supabase = await createSupabaseProject(setupData.org.name);
    progress.emit('update', { step: 'supabase', status: 'complete' });

    // Step 2: Run migrations
    progress.emit('update', { step: 'migrations', status: 'in_progress' });
    await runMigrations(supabase);
    progress.emit('update', { step: 'migrations', status: 'complete' });

    // Step 3: Import document
    progress.emit('update', { step: 'import', status: 'in_progress' });
    const totalSections = setupData.document.structure.length;
    let imported = 0;

    for (const article of setupData.document.structure) {
      await importArticle(supabase, article);
      imported += article.sections.length;
      const percent = Math.floor((imported / totalSections) * 100);
      progress.emit('update', {
        step: 'import',
        status: 'in_progress',
        progress: percent,
        message: `Imported ${imported} of ${totalSections} sections`
      });
    }
    progress.emit('update', { step: 'import', status: 'complete' });

    // Step 4: Configure workflows
    progress.emit('update', { step: 'workflows', status: 'in_progress' });
    await setupWorkflows(supabase, setupData.workflow);
    progress.emit('update', { step: 'workflows', status: 'complete' });

    // Step 5: Finalize
    progress.emit('update', { step: 'finalize', status: 'in_progress' });
    await markSetupComplete(setupId);
    await clearSetupSession(req);
    progress.emit('update', { step: 'finalize', status: 'complete' });

    // Send success event
    progress.emit('update', { status: 'success', redirect: '/setup/complete' });

  } catch (error) {
    progress.emit('update', {
      status: 'error',
      step: currentStep,
      error: error.message
    });
  }
}
```

---

### Screen 7: Success! 🎊

**Route:** `/setup/complete`

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                    🎊 You're all set!                     ║
║                                                           ║
║        Your Bylaws Amendment Tracker is ready to use      ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │                                                 │    ║
║   │  ✓ Database configured                          │    ║
║   │  ✓ 45 sections imported                         │    ║
║   │  ✓ Workflows set up                             │    ║
║   │  ✓ Organization profile created                 │    ║
║   │                                                 │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║                                                           ║
║   Quick tips to get started:                             ║
║                                                           ║
║   ┌──────────────────────────────────────┐               ║
║   │  🔒 Lock sections for review         │               ║
║   │                                      │               ║
║   │  Mark sections as "Under Review"    │               ║
║   │  to start collecting suggestions    │               ║
║   └──────────────────────────────────────┘               ║
║                                                           ║
║   ┌──────────────────────────────────────┐               ║
║   │  📝 Collect suggestions              │               ║
║   │                                      │               ║
║   │  Team members can suggest changes    │               ║
║   │  with side-by-side comparison        │               ║
║   └──────────────────────────────────────┘               ║
║                                                           ║
║   ┌──────────────────────────────────────┐               ║
║   │  ✅ Vote on changes                  │               ║
║   │                                      │               ║
║   │  Track approvals through your        │               ║
║   │  committee and board stages          │               ║
║   └──────────────────────────────────────┘               ║
║                                                           ║
║   ┌──────────────────────────────────────┐               ║
║   │  📄 Export approved changes          │               ║
║   │                                      │               ║
║   │  Generate clean PDFs with only       │               ║
║   │  approved amendments                 │               ║
║   └──────────────────────────────────────┘               ║
║                                                           ║
║                                                           ║
║            ┌─────────────────────────┐                   ║
║            │  Go to Dashboard →      │                   ║
║            └─────────────────────────┘                   ║
║                                                           ║
║                                                           ║
║   Need to add team members?                              ║
║   [Invite People]  [Setup Guide]  [Watch Video]          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Additional Actions:**

1. **Invite People:**
   - Opens modal to send email invites
   - Assigns roles (Admin, Committee, Board, Member)
   - Generates invite links

2. **Setup Guide:**
   - Links to documentation
   - Video tutorials
   - Common workflows

3. **Watch Video:**
   - 3-minute walkthrough
   - Shows key features
   - Demo of workflow

**Auto-Actions on Success:**
- Clear all setup session data
- Mark organization as configured
- Send welcome email to contact email
- Log setup completion event
- Redirect to dashboard after 5 seconds (auto or manual)

---

## Technical Architecture

### File Structure

```
src/
├── setup/
│   ├── routes/
│   │   ├── setup.routes.js           # All setup routes
│   │   └── setup.api.routes.js       # API endpoints for setup
│   ├── controllers/
│   │   ├── welcome.controller.js     # Screen 1
│   │   ├── organization.controller.js # Screen 2
│   │   ├── document.controller.js    # Screen 3
│   │   ├── workflow.controller.js    # Screen 4
│   │   ├── import.controller.js      # Screen 5
│   │   └── finalize.controller.js    # Screens 6-7
│   ├── middleware/
│   │   ├── setup-guard.middleware.js # Redirect if configured
│   │   ├── session.middleware.js     # Session management
│   │   └── validation.middleware.js  # Form validation
│   ├── services/
│   │   ├── supabase.service.js       # Supabase API integration
│   │   ├── parser.service.js         # Document parsing
│   │   ├── migration.service.js      # Database migrations
│   │   └── import.service.js         # Document import logic
│   ├── views/
│   │   ├── setup-welcome.ejs         # Screen 1
│   │   ├── setup-organization.ejs    # Screen 2
│   │   ├── setup-document.ejs        # Screen 3
│   │   ├── setup-workflow.ejs        # Screen 4
│   │   ├── setup-import.ejs          # Screen 5
│   │   ├── setup-finalize.ejs        # Screen 6
│   │   └── setup-complete.ejs        # Screen 7
│   └── public/
│       ├── css/
│       │   └── setup-wizard.css      # Wizard-specific styles
│       └── js/
│           ├── setup-navigation.js   # Navigation logic
│           ├── setup-validation.js   # Client-side validation
│           └── setup-progress.js     # Progress tracking
│
├── landing/
│   ├── views/
│   │   └── landing.ejs               # Marketing landing page
│   └── public/
│       └── css/
│           └── landing.css
│
└── config/
    ├── render.yaml                   # Render deploy config
    └── setup-templates.json          # Workflow & doc templates
```

### Database Schema Changes

```sql
-- Add setup tracking table
CREATE TABLE setup_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  current_step INTEGER DEFAULT 1,
  data JSONB,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add organization configuration flag
ALTER TABLE organization
ADD COLUMN setup_completed BOOLEAN DEFAULT false,
ADD COLUMN setup_completed_at TIMESTAMPTZ;
```

### Session Storage Schema

```javascript
{
  setupId: 'uuid',
  currentStep: 2,
  data: {
    organization: {
      name: 'Riverside HOA',
      type: 'hoa',
      email: 'president@riverside.org',
      logo: 'uploads/logo-uuid.png'
    },
    documentType: {
      template: 'bylaws',
      level1Name: 'Article',
      level2Name: 'Section',
      level1Numbering: 'roman',
      level2Numbering: 'arabic'
    },
    workflow: {
      template: 'twoStage',
      stages: [...]
    },
    document: {
      filename: 'bylaws.docx',
      path: 'uploads/setup-uuid/bylaws.docx',
      structure: [...]
    }
  },
  startedAt: '2025-10-07T10:00:00Z',
  lastActivity: '2025-10-07T10:05:00Z'
}
```

### API Endpoints

```javascript
// Setup routes
GET  /setup                    # Detect and redirect to appropriate step
GET  /setup/welcome            # Screen 1
GET  /setup/organization       # Screen 2
POST /setup/organization       # Save org info
GET  /setup/document-type      # Screen 3
POST /setup/document-type      # Save doc type
GET  /setup/workflow           # Screen 4
POST /setup/workflow           # Save workflow
GET  /setup/import             # Screen 5
POST /setup/import/upload      # Handle file upload
POST /setup/import/parse       # Parse document
POST /setup/import/confirm     # Confirm structure
GET  /setup/finalize           # Screen 6 (SSE endpoint)
GET  /setup/complete           # Screen 7

// API endpoints
POST /api/setup/validate-org    # Validate org form
POST /api/setup/validate-email  # Check email format
POST /api/setup/upload-logo     # Upload logo
POST /api/setup/parse-document  # Parse uploaded doc
GET  /api/setup/progress        # Get setup progress
DELETE /api/setup/session       # Clear setup session
```

### Render Configuration

**render.yaml:**
```yaml
services:
  - type: web
    name: bylaws-amendment-tracker
    env: node
    region: oregon
    plan: free
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: SESSION_SECRET
        generateValue: true
      - key: PORT
        value: 10000
      - key: SETUP_MODE
        value: enabled
    autoDeploy: true
```

**Deploy Button (for landing page):**
```html
<a href="https://render.com/deploy?repo=https://github.com/yourusername/bylaws-tracker">
  <img src="https://render.com/images/deploy-to-render-button.svg"
       alt="Deploy to Render">
</a>
```

---

## Error Handling & Edge Cases

### Network Errors

**Scenario:** User loses internet connection during setup

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                  ⚠️ Connection Lost                       ║
║                                                           ║
║   We lost connection to the server.                      ║
║   Your progress has been saved automatically.            ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🔄 Reconnect & Continue                        │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  💾 Save Progress & Come Back Later             │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   We'll email you a link to continue where you left off  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Browser Closed Mid-Setup

**Solution:**
- Save progress to session on every step
- On return, detect incomplete setup
- Show "Continue Setup" button on welcome screen
- Resume from last completed step

### File Parse Failures

**Common Issues:**
1. Unrecognized format
2. Missing structure
3. Corrupt file
4. Empty sections

**User-Friendly Errors:**
- "We couldn't find any articles or sections in this file"
- "This file appears to be in an unsupported format"
- "The document structure doesn't match the selected type"
- Offer: Try different file, manual entry, or contact support

### Supabase API Failures

**Scenario:** Supabase API is down or rate-limited

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              ⚠️ Service Temporarily Unavailable           ║
║                                                           ║
║   We're having trouble connecting to our database        ║
║   service. This is usually temporary.                    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🔄 Try Again                                   │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  ⏸️  Pause Setup (We'll email you)              │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   If this persists, please contact support:              ║
║   support@bylawstracker.com                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Validation Errors

**Organization Email Invalid:**
```
┌─────────────────────────────────────────────────┐
│ Contact Email *                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ president.riverside                         │ │
│ └─────────────────────────────────────────────┘ │
│ ⚠️ Please enter a valid email address           │
│    (e.g., president@riverside.org)             │
└─────────────────────────────────────────────────┘
```

**Organization Name Too Short:**
```
┌─────────────────────────────────────────────────┐
│ Organization Name *                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ H                                           │ │
│ └─────────────────────────────────────────────┘ │
│ ⚠️ Please enter at least 2 characters            │
└─────────────────────────────────────────────────┘
```

### Document Too Large

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                  ⚠️ File Too Large                        ║
║                                                           ║
║   The file you uploaded is 15 MB.                        ║
║   Maximum file size is 10 MB.                            ║
║                                                           ║
║   Tips:                                                   ║
║   • Remove images from the document                      ║
║   • Save as .txt instead of .docx                        ║
║   • Split into multiple uploads                          ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  📤 Try Different File                          │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  📝 Enter Manually Instead                      │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Mobile Responsiveness

### Key Principles

1. **Touch-First Design:**
   - Buttons min 44×44px
   - Generous padding
   - No hover-dependent features
   - Swipe gestures for navigation

2. **Simplified Layouts:**
   - Single column on mobile
   - Collapsible sections
   - Bottom navigation
   - Sticky headers

3. **File Upload:**
   - Show camera option on mobile
   - Support photo capture
   - Compress images client-side

4. **Form Inputs:**
   - Native keyboards (email, number)
   - Autocomplete support
   - Clear button in inputs
   - Floating labels

### Mobile-Specific Screens

**Screen 2 (Organization) - Mobile:**
```
┌─────────────────────────┐
│ [<]  Setup  [2 of 5]    │
├─────────────────────────┤
│                         │
│ 🏢 Organization         │
│                         │
│ Name *                  │
│ ┌─────────────────────┐ │
│ │ Riverside HOA       │ │
│ └─────────────────────┘ │
│                         │
│ Type *                  │
│ ┌─────────────────────┐ │
│ │ HOA             [v] │ │
│ └─────────────────────┘ │
│                         │
│ Email *                 │
│ ┌─────────────────────┐ │
│ │ president@...       │ │
│ └─────────────────────┘ │
│                         │
│ Logo (Optional)         │
│ ┌─────────────────────┐ │
│ │  📸  📤             │ │
│ │  Camera  Gallery    │ │
│ └─────────────────────┘ │
│                         │
│                         │
│ ╔═══════════════════╗   │
│ ║   Continue →      ║   │
│ ╚═══════════════════╝   │
│                         │
└─────────────────────────┘
```

**Navigation:**
- Swipe right = Back
- Swipe left = Continue (if valid)
- Top back button always visible
- Progress bar sticky at top

---

## Accessibility (WCAG 2.1 AA)

### Requirements

1. **Keyboard Navigation:**
   - All interactive elements focusable
   - Logical tab order
   - Skip links for long forms
   - Enter/Space for buttons

2. **Screen Readers:**
   - Semantic HTML (form, nav, main)
   - ARIA labels for icons
   - Live regions for progress updates
   - Descriptive error messages

3. **Visual:**
   - 4.5:1 contrast ratio
   - Focus indicators (3px outline)
   - Large text (16px minimum)
   - No color-only information

4. **Error Handling:**
   - Associate errors with fields
   - Announce errors to screen readers
   - Clear instructions
   - Multiple ways to fix

### Implementation

```html
<!-- Example accessible form field -->
<div class="form-field">
  <label for="org-name" class="form-label">
    Organization Name
    <span class="required" aria-label="required">*</span>
  </label>
  <input
    type="text"
    id="org-name"
    name="orgName"
    class="form-input"
    aria-required="true"
    aria-invalid="false"
    aria-describedby="org-name-help org-name-error"
  >
  <p id="org-name-help" class="form-help">
    This will appear in the header and reports
  </p>
  <p id="org-name-error" class="form-error" role="alert" aria-live="polite">
    <!-- Error message appears here when invalid -->
  </p>
</div>
```

```javascript
// Announce progress to screen readers
function updateProgress(step, status) {
  const announcement = document.getElementById('progress-announcement');
  announcement.textContent = `${step} ${status}`;
  // Live region will announce to screen readers
}
```

---

## Performance Optimization

### Key Metrics

- **First Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **File Upload:** 50ms per MB
- **Document Parse:** < 5s for typical document
- **Database Setup:** 30-60s total

### Optimization Strategies

1. **Code Splitting:**
   - Load setup wizard separately
   - Lazy load document parser
   - Defer non-critical CSS/JS

2. **Image Optimization:**
   - Compress logo uploads client-side
   - Use WebP with fallback
   - Lazy load illustrations

3. **Caching:**
   - Cache static assets (1 year)
   - Session storage for form data
   - Service worker for offline capability

4. **API Optimization:**
   - Debounce validation requests
   - Batch progress updates
   - Use WebSockets for real-time updates

---

## Analytics & Monitoring

### Key Events to Track

1. **Funnel Analysis:**
   - `setup_started`
   - `setup_step_1_complete`
   - `setup_step_2_complete`
   - ...
   - `setup_completed`
   - `setup_abandoned` (>24h inactive)

2. **Error Tracking:**
   - `setup_error_parse_failed`
   - `setup_error_upload_failed`
   - `setup_error_db_failed`
   - `setup_error_network`

3. **User Behavior:**
   - `setup_back_clicked`
   - `setup_template_selected`
   - `setup_custom_workflow`
   - `setup_help_viewed`

4. **Performance:**
   - `setup_parse_duration`
   - `setup_import_duration`
   - `setup_total_duration`

### Implementation

```javascript
// Analytics wrapper
function trackSetupEvent(eventName, properties = {}) {
  // Send to your analytics service
  analytics.track(eventName, {
    ...properties,
    setupId: sessionStorage.getItem('setupId'),
    timestamp: new Date().toISOString()
  });
}

// Usage
trackSetupEvent('setup_step_2_complete', {
  organizationType: 'hoa',
  hasLogo: true
});
```

---

## Testing Strategy

### Unit Tests

```javascript
// Test document parser
describe('Document Parser', () => {
  it('should parse Article I from bylaws', () => {
    const content = 'Article I: Name and Purpose\nSection 1: Name...';
    const result = parseDocument(content, 'bylaws');
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe('Name and Purpose');
  });

  it('should handle Roman numerals', () => {
    const content = 'Article IV: Membership\nSection 3: Dues...';
    const result = parseDocument(content, 'bylaws');
    expect(result.articles[0].number).toBe(4);
  });
});
```

### Integration Tests

```javascript
// Test setup flow
describe('Setup Wizard Flow', () => {
  it('should complete full setup', async () => {
    // Step 1: Welcome
    await request(app).get('/setup/welcome');

    // Step 2: Organization
    const org = await request(app)
      .post('/setup/organization')
      .send({ name: 'Test HOA', type: 'hoa', email: 'test@hoa.org' });
    expect(org.status).toBe(200);

    // Step 3: Document type
    const docType = await request(app)
      .post('/setup/document-type')
      .send({ template: 'bylaws' });
    expect(docType.status).toBe(200);

    // ... continue through all steps
  });
});
```

### E2E Tests (Playwright)

```javascript
test('user can complete setup wizard', async ({ page }) => {
  // Navigate to setup
  await page.goto('/setup/welcome');
  await page.click('text=Let\'s Get Started');

  // Fill organization info
  await page.fill('[name="orgName"]', 'Test HOA');
  await page.selectOption('[name="orgType"]', 'hoa');
  await page.fill('[name="email"]', 'test@hoa.org');
  await page.click('text=Continue');

  // Select document type
  await page.click('text=Bylaws');
  await page.click('text=Continue');

  // ... continue through wizard

  // Verify completion
  await expect(page).toHaveURL('/setup/complete');
  await expect(page.locator('text=You\'re all set!')).toBeVisible();
});
```

---

## Security Considerations

### Input Validation

1. **File Uploads:**
   - Validate MIME type
   - Check file signature (magic bytes)
   - Scan for malware
   - Limit file size
   - Sanitize filenames

2. **Form Data:**
   - Escape HTML in user input
   - Validate email format
   - Sanitize organization names
   - Prevent SQL injection

3. **Session Security:**
   - Use secure, httpOnly cookies
   - Generate unique session IDs
   - Expire after 24 hours
   - Clear on completion

### Rate Limiting

```javascript
// Limit setup attempts
const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 setups per hour per IP
  message: 'Too many setup attempts. Please try again later.'
});

app.post('/setup/organization', setupLimiter, organizationController);
```

### Data Privacy

- Encrypt uploaded documents at rest
- Delete temporary files after import
- Don't log sensitive data
- GDPR-compliant data retention

---

## Future Enhancements

### Phase 2 Features

1. **Google Docs Live Sync:**
   - OAuth integration
   - Webhook for changes
   - Conflict resolution

2. **AI-Powered Parser:**
   - Better structure detection
   - Suggest section titles
   - Auto-categorize changes

3. **Multi-Tenant SaaS:**
   - Shared Render instance
   - Per-org subdomains
   - Centralized billing

4. **Setup Wizard v2:**
   - Video tutorials inline
   - Interactive tour
   - Template gallery
   - Community-contributed workflows

### A/B Testing Ideas

- Button copy variations
- Progress indicator styles
- Error message tone
- Help text placement
- Illustration vs. no illustration

---

## Success Metrics

### Conversion Funnel

- **Landing → Deploy:** 40%
- **Deploy → Setup Started:** 80%
- **Setup Started → Completed:** 70%
- **Overall (Landing → Complete):** 22%

### User Satisfaction

- Setup completion time: < 7 minutes (target: 5 min)
- Support tickets during setup: < 5%
- User satisfaction score: > 4.5/5

### Technical

- Setup success rate: > 95%
- Parse accuracy: > 90%
- Zero data loss
- < 1% error rate

---

## Appendix: Copy Style Guide

### Tone

- Friendly, not corporate
- Confident, not pushy
- Helpful, not condescending
- Clear, not jargony

### Examples

**Good:**
- "Let's get you set up in just 5 steps"
- "We'll automatically detect all your articles and sections"
- "Don't worry - you can change any of this later"

**Bad:**
- "Configure tenant parameters"
- "Initiating database provisioning sequence"
- "Error: Null reference exception"

### Button Text

- Action-oriented: "Continue", "Import Document", "Go to Dashboard"
- Avoid: "OK", "Submit", "Next"

### Error Messages

- Say what happened: "We couldn't read this file"
- Say why: "This file appears to be corrupted"
- Say what to do: "[Try again] or [Upload different file]"

---

## Appendix: Color Palette

```css
/* Primary Colors */
--primary-blue: #0066CC;
--primary-hover: #0052A3;
--primary-light: #E6F2FF;

/* Success */
--success-green: #00A86B;
--success-light: #E6F9F0;

/* Warning */
--warning-yellow: #FFB020;
--warning-light: #FFF8E6;

/* Error */
--error-red: #D92D20;
--error-light: #FFE6E6;

/* Neutral */
--gray-900: #1A1A1A;
--gray-700: #4A4A4A;
--gray-500: #7A7A7A;
--gray-300: #CACACA;
--gray-100: #F5F5F5;
--white: #FFFFFF;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

---

## Appendix: Animation Timing

```css
/* Transitions */
--transition-fast: 150ms ease-in-out;
--transition-normal: 250ms ease-in-out;
--transition-slow: 400ms ease-in-out;

/* Animations */
@keyframes slideIn {
  from { transform: translateX(-10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

**End of UX Design Document**

This design prioritizes user experience above all else. Every decision is made with the question: "Would my grandmother be able to do this?"

The answer should always be: "Yes, and she'd enjoy it."
