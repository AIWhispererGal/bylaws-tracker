# Setup Wizard Implementation Guide

## Overview

This guide explains how to implement the graphical setup wizard designed in `GRAPHICAL_SETUP_UX_DESIGN.md`. The wizard transforms the Bylaws Amendment Tracker from a developer tool into a consumer product that anyone can deploy and configure.

## Quick Start

### For Users (Non-Technical)

1. Click the "Deploy to Render" button on the landing page
2. Wait 2 minutes for deployment
3. Visit your new app URL
4. Follow the 5-step setup wizard
5. Start using your tracker!

### For Developers (Implementation)

```bash
# 1. Install dependencies
npm install multer express-session mammoth pdf-parse

# 2. Run database migrations
npm run migrate

# 3. Start development server
npm run dev

# 4. Visit http://localhost:3000/setup
```

## Architecture

### File Structure

```
src/setup/
├── routes/
│   ├── setup.routes.js              # Main setup routes
│   └── setup.api.routes.js          # API endpoints
├── controllers/
│   ├── welcome.controller.js        # Screen 1: Welcome
│   ├── organization.controller.js   # Screen 2: Organization info
│   ├── document.controller.js       # Screen 3: Document type
│   ├── workflow.controller.js       # Screen 4: Workflow config
│   ├── import.controller.js         # Screen 5: Document import
│   └── finalize.controller.js       # Screens 6-7: Setup & success
├── middleware/
│   ├── setup-guard.middleware.js    # Redirect logic
│   ├── session.middleware.js        # Session management
│   └── validation.middleware.js     # Form validation
├── services/
│   ├── supabase.service.js          # Supabase integration
│   ├── parser.service.js            # Document parsing
│   ├── migration.service.js         # Database migrations
│   └── import.service.js            # Document import
├── views/
│   ├── setup-welcome.ejs            # All setup screens
│   ├── setup-organization.ejs
│   ├── setup-document.ejs
│   ├── setup-workflow.ejs
│   ├── setup-import.ejs
│   ├── setup-finalize.ejs
│   └── setup-complete.ejs
└── public/
    ├── css/
    │   └── setup-wizard.css         # Wizard styles
    └── js/
        ├── setup-navigation.js      # Navigation
        ├── setup-validation.js      # Client validation
        └── setup-progress.js        # Progress tracking
```

## Implementation Checklist

### Phase 1: Core Infrastructure ✅

- [x] Create directory structure
- [x] Set up routes and controllers
- [x] Create middleware (guards, session, validation)
- [x] Build welcome screen (Screen 1)
- [x] Create CSS framework for wizard
- [x] Update render.yaml for one-click deploy

### Phase 2: Organization Setup (Screen 2)

- [ ] Create organization form view
- [ ] Implement file upload for logo
- [ ] Add client-side validation
- [ ] Create organization data model
- [ ] Save organization to session
- [ ] Add analytics tracking

### Phase 3: Document Type Selection (Screen 3)

- [ ] Create document type selection cards
- [ ] Build terminology customization UI
- [ ] Implement custom structure modal
- [ ] Define document type templates
- [ ] Save document config to session

### Phase 4: Workflow Configuration (Screen 4)

- [ ] Create workflow template cards
- [ ] Build visual workflow preview
- [ ] Implement stage editor modal
- [ ] Add custom workflow builder
- [ ] Save workflow to session

### Phase 5: Document Import (Screen 5)

- [ ] Create file upload interface
- [ ] Implement document parser service
  - [ ] DOCX parsing (mammoth)
  - [ ] PDF parsing (pdf-parse)
  - [ ] TXT parsing
- [ ] Build structure preview UI
- [ ] Add edit structure modal
- [ ] Handle Google Docs import (optional)

### Phase 6: Database Setup (Screen 6)

- [ ] Implement Supabase project creation
- [ ] Create migration runner service
- [ ] Build real-time progress UI (SSE/WebSocket)
- [ ] Import document structure
- [ ] Configure workflows
- [ ] Error handling and retry logic

### Phase 7: Success & Polish (Screen 7)

- [ ] Create success screen
- [ ] Add team invitation feature
- [ ] Build guided tour/tooltips
- [ ] Implement email notifications
- [ ] Clean up session data
- [ ] Redirect to dashboard

### Phase 8: Testing & QA

- [ ] Unit tests for parsers
- [ ] Integration tests for setup flow
- [ ] E2E tests (Playwright)
- [ ] Mobile responsive testing
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance optimization

### Phase 9: Documentation

- [ ] User documentation
- [ ] Video tutorial (2-3 min)
- [ ] FAQ page
- [ ] Troubleshooting guide
- [ ] Developer documentation

### Phase 10: Deployment

- [ ] Set up GitHub repository
- [ ] Create landing page
- [ ] Add "Deploy to Render" button
- [ ] Configure analytics
- [ ] Set up error monitoring
- [ ] Launch! 🚀

## Key Components

### 1. Setup Guard Middleware

Protects routes based on setup completion:

```javascript
// Redirect to dashboard if already configured
app.use('/setup', setupGuard.redirectIfConfigured);

// Redirect to setup if not configured
app.use('/dashboard', setupGuard.requireComplete);
```

### 2. Session Management

Store setup progress across steps:

```javascript
req.session.setupProgress = {
  setupId: 'uuid',
  currentStep: 2,
  data: {
    organization: {...},
    documentType: {...},
    workflow: {...},
    document: {...}
  }
};
```

### 3. Document Parser

Intelligent parsing based on document type:

```javascript
const parser = new DocumentParser(file, documentType);
const structure = await parser.parse();
// Returns: [{ article: 'I', title: '...', sections: [...] }]
```

### 4. Real-Time Progress

Server-Sent Events for live updates:

```javascript
// Server
res.writeHead(200, { 'Content-Type': 'text/event-stream' });
progress.on('update', (data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
});

// Client
const eventSource = new EventSource('/setup/finalize');
eventSource.onmessage = (event) => {
  updateProgressUI(JSON.parse(event.data));
};
```

## Environment Variables

Required for setup wizard:

```bash
# Enable setup wizard
SETUP_MODE=enabled

# Session management
SESSION_SECRET=auto-generated-by-render

# Supabase (configured during setup)
SUPABASE_URL=will-be-set-during-setup
SUPABASE_KEY=will-be-set-during-setup

# Optional: Supabase Management API
SUPABASE_MANAGEMENT_TOKEN=your-token
```

## Database Schema

Setup tracking table:

```sql
CREATE TABLE setup_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  current_step INTEGER DEFAULT 1,
  data JSONB,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add to organization table
ALTER TABLE organization
ADD COLUMN setup_completed BOOLEAN DEFAULT false,
ADD COLUMN setup_completed_at TIMESTAMPTZ;
```

## API Endpoints

### Setup Wizard Routes

```
GET  /setup                    # Detect and redirect
GET  /setup/welcome            # Screen 1
GET  /setup/organization       # Screen 2
POST /setup/organization       # Save org
GET  /setup/document-type      # Screen 3
POST /setup/document-type      # Save doc type
GET  /setup/workflow           # Screen 4
POST /setup/workflow           # Save workflow
GET  /setup/import             # Screen 5
POST /setup/import/upload      # Upload file
POST /setup/import/parse       # Parse doc
GET  /setup/finalize           # Screen 6 (SSE)
GET  /setup/complete           # Screen 7
```

### API Endpoints

```
POST /api/setup/validate-org    # Validate org form
POST /api/setup/upload-logo     # Upload logo
POST /api/setup/parse-document  # Parse doc
GET  /api/setup/progress        # Get progress
DELETE /api/setup/session       # Clear session
```

## Render Deployment

### Deploy Button

Add to your README or landing page:

```html
<a href="https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/BYLAWSTOOL_Generalized">
  <img src="https://render.com/images/deploy-to-render-button.svg"
       alt="Deploy to Render">
</a>
```

### render.yaml

Already configured in the repository. Key settings:

- **Region:** Oregon (free tier)
- **Plan:** Free
- **Build:** `npm ci && npm run build`
- **Start:** `npm start`
- **Health Check:** `/health`
- **Auto Deploy:** Enabled

## Testing

### Unit Tests

```bash
npm test
```

Example test:

```javascript
describe('Document Parser', () => {
  it('should parse Article I from bylaws', () => {
    const content = 'Article I: Name\nSection 1: The name...';
    const result = parseDocument(content, 'bylaws');
    expect(result.articles[0].title).toBe('Name');
  });
});
```

### E2E Tests

```bash
npm run test:e2e
```

Example test:

```javascript
test('user completes setup wizard', async ({ page }) => {
  await page.goto('/setup/welcome');
  await page.click('text=Let\'s Get Started');
  // ... continue through wizard
  await expect(page).toHaveURL('/setup/complete');
});
```

## Troubleshooting

### Common Issues

**Setup wizard not appearing:**
- Check `SETUP_MODE=enabled` in environment
- Verify no organization exists in database
- Clear session cookies

**File upload failing:**
- Check file size (max 10MB)
- Verify file type (DOCX, PDF, TXT)
- Ensure uploads directory exists and is writable

**Document parsing errors:**
- Try different file format
- Check document structure (headings, numbering)
- Use "Create manually" option as fallback

**Database setup failing:**
- Verify Supabase credentials
- Check internet connectivity
- Review migration SQL files
- Check Supabase project limits (free tier)

## Security Considerations

### Input Validation

- Sanitize all user input (XSS prevention)
- Validate file uploads (type, size, content)
- Escape HTML in organization names
- Validate email format

### Session Security

- Use secure, httpOnly cookies
- Generate unique session IDs
- Expire sessions after 24 hours
- Clear sensitive data on completion

### File Upload Security

- Validate MIME types (not just extension)
- Check file signatures (magic bytes)
- Scan for malware (if possible)
- Store uploads outside web root
- Delete temporary files after import

## Performance Optimization

### Client-Side

- Lazy load document parser
- Debounce validation requests
- Cache form data in sessionStorage
- Optimize images (logo upload)

### Server-Side

- Stream large file uploads
- Use connection pooling for database
- Cache document type templates
- Batch database inserts

## Analytics Events

Track user journey:

```javascript
// Funnel
analytics.track('setup_started');
analytics.track('setup_step_2_complete', { organizationType: 'hoa' });
analytics.track('setup_completed', { duration: 342000 });

// Errors
analytics.track('setup_error_parse_failed', { fileType: 'pdf' });

// Behavior
analytics.track('setup_back_clicked', { fromStep: 3 });
```

## Future Enhancements

### Phase 2

- [ ] Google Docs live sync
- [ ] AI-powered document parser
- [ ] Video tutorials inline
- [ ] Template gallery
- [ ] Community workflows

### Multi-Tenant SaaS

- [ ] Shared Render instance
- [ ] Per-org subdomains
- [ ] Centralized billing
- [ ] User management
- [ ] Organization switcher

## Resources

- **Design Doc:** `GRAPHICAL_SETUP_UX_DESIGN.md`
- **Landing Page:** `docs/LANDING_PAGE.html`
- **Render Deploy:** `render.yaml`
- **Database Schema:** `database/migrations/`

## Support

- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/BYLAWSTOOL_Generalized/issues)
- **Discussions:** [GitHub Discussions](https://github.com/YOUR_USERNAME/BYLAWSTOOL_Generalized/discussions)
- **Email:** support@bylawstracker.com

## Contributing

We welcome contributions! Please see `CONTRIBUTING.md` for guidelines.

---

**Remember:** The goal is to make this so easy that someone who's never used GitHub can deploy and configure their own bylaws tracker in under 10 minutes. Every decision should be made with the question: "Would my grandmother be able to do this?"
