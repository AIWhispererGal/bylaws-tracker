# Setup Wizard Implementation Guide

## Overview

The Setup Wizard is a beautiful, user-friendly 5-step onboarding experience that guides non-technical users through the initial configuration of their organization's governance tool.

## Architecture

### Frontend Components

**Views** (`/views/setup/`):
- `layout.ejs` - Master layout with progress stepper
- `welcome.ejs` - Step 1: Welcome screen with feature overview
- `organization.ejs` - Step 2: Organization information form
- `document-type.ejs` - Step 3: Document structure selection
- `workflow.ejs` - Step 4: Approval workflow configuration
- `import.ejs` - Step 5: Document upload/import
- `processing.ejs` - Loading screen during setup processing
- `success.ejs` - Completion celebration screen

**Assets**:
- `/public/css/setup-wizard.css` - Custom styles
- `/public/js/setup-wizard.js` - Client-side interactions

### Backend Components

**Routes** (`/src/routes/setup.js`):
- `GET /setup` - Welcome screen
- `GET/POST /setup/organization` - Organization info
- `GET/POST /setup/document-type` - Document structure
- `GET/POST /setup/workflow` - Workflow configuration
- `GET/POST /setup/import` - Document import
- `GET /setup/processing` - Processing screen
- `GET /setup/status` - AJAX status endpoint
- `GET /setup/success` - Success screen
- `POST /setup/clear-session` - Clean up session

**Middleware** (`/src/middleware/setup-required.js`):
- `requireSetupComplete()` - Redirect to setup if not configured
- `preventSetupIfConfigured()` - Prevent setup access if complete
- `initializeSetupStatus()` - Check setup status on app start

## Data Flow

### 1. Session-Based State Management

Setup progress is stored in `req.session.setupData`:

```javascript
{
    organization: {
        organization_name: "Sunset Hills HOA",
        organization_type: "hoa",
        state: "California",
        country: "USA",
        contact_email: "board@example.com",
        logo_path: "/uploads/setup/logo.png"
    },
    documentType: {
        structure_type: "article-section",
        level1_name: "Article",
        level2_name: "Section",
        numbering_style: "roman"
    },
    workflow: {
        template: "committee",
        stages: [
            {
                name: "Committee Review",
                approvalType: "majority",
                approvers: ["member1@example.com", "member2@example.com"],
                skipIfAuthor: false
            }
        ],
        notifications: {
            onSubmit: true,
            onApproval: true,
            onRejection: true,
            onComplete: true
        }
    },
    import: {
        source: "file_upload",
        file_path: "/uploads/setup/bylaws.docx",
        auto_detect_structure: true,
        preserve_formatting: false,
        create_initial_version: true
    },
    completedSteps: ["organization", "document", "workflow", "import"],
    status: "processing"
}
```

### 2. Form Submission Flow

Each step follows this pattern:

1. **User fills form** → Client-side validation
2. **Submit button clicked** → Form validated
3. **AJAX POST request** → Data sent to server
4. **Server validates** → Saves to session
5. **Success response** → Redirect to next step
6. **Error handling** → Display friendly message

### 3. Processing Flow

When user completes import step:

1. Document uploaded/URL provided
2. Session data validated
3. User redirected to `/setup/processing`
4. Async processing begins (triggered by `setImmediate`)
5. Client polls `/setup/status` every 1 second
6. Processing updates `completedSteps` array
7. When complete, redirect to `/setup/success`

## User Interface Features

### Progress Stepper

Visual indicator showing current step (1-5):
- **Pending**: Gray circle with number
- **Active**: Purple gradient circle with pulse animation
- **Completed**: Green circle with checkmark

### Form Validation

**Client-side** (JavaScript):
- Real-time field validation on blur/input
- Custom validation messages
- Visual feedback (green/red borders)
- Submit button disabled until valid

**Server-side** (Express):
- Required field checks
- Data type validation
- File size/type validation
- Error responses with specific messages

### File Upload Features

**Logo Upload** (Organization step):
- Drag-and-drop zone
- Click to browse
- Image preview
- File type validation (PNG, JPG, SVG)
- Size limit: 2MB
- Remove and re-upload

**Document Upload** (Import step):
- Drag-and-drop zone
- Click to browse
- File info preview (name, size)
- File type validation (.docx, .doc)
- Size limit: 10MB
- Alternative: Google Docs URL

### Interactive Components

**Structure Selection**:
- Card-based UI
- Visual examples of each structure
- Hover effects
- Selection indicator (checkmark)
- Customization options
- Live preview

**Workflow Builder**:
- Template selection (cards)
- Dynamic stage addition/removal
- Drag-to-reorder (via handle)
- Per-stage configuration
- Visual workflow diagram
- Email notification toggles

### Accessibility

- **Keyboard navigation**: Tab through all fields
- **ARIA labels**: Screen reader friendly
- **Focus indicators**: Clear visual focus
- **Color contrast**: WCAG AA compliant
- **Error messages**: Descriptive and helpful
- **Alt text**: All images described

### Mobile Responsive

**Breakpoints**:
- Desktop: 992px+
- Tablet: 768px - 991px
- Mobile: < 768px

**Mobile adaptations**:
- Stacked progress stepper
- Full-width buttons
- Touch-friendly targets (44px min)
- Simplified animations
- Responsive grids

## Security Features

### CSRF Protection

All POST requests require CSRF token:

```javascript
// In layout.ejs
<meta name="csrf-token" content="<%= csrfToken %>">

// In setup-wizard.js
headers: {
    'X-CSRF-Token': this.csrfToken
}
```

### File Upload Security

- MIME type validation
- File size limits
- Unique filenames (timestamp + random)
- Isolated upload directory
- Server-side validation

### Session Security

- HttpOnly cookies
- Secure flag in production
- Session expiration
- CSRF tokens

## Error Handling

### User-Friendly Messages

Instead of technical errors, show helpful messages:

**File upload errors**:
- "This file couldn't be read. Try .docx format"
- "File size must be less than 10MB"
- "Please select a Word document"

**Network errors**:
- "Something went wrong, please try again"
- "Connection lost. Check your internet."

**Validation errors**:
- Inline, specific guidance
- "Please enter your organization's name"
- "At least one workflow stage is required"

### Error Recovery

- Save progress in session (survives page reload)
- Allow going back and editing previous steps
- Show which step failed
- Provide retry options
- Contact support link

## Performance Optimizations

### CSS & JavaScript

- **Minification**: Minify in production
- **CDN**: Bootstrap and icons from CDN
- **Lazy loading**: Images load on demand
- **Debouncing**: Real-time validation debounced

### File Uploads

- **Chunked uploads**: For large files (future)
- **Progress indicators**: Show upload progress
- **Background processing**: Async document parsing
- **Compression**: Compress uploaded files

### AJAX Requests

- **Status polling**: 1-second intervals
- **Timeout handling**: Retry with backoff
- **Request cancellation**: Cancel on navigation
- **Error retry**: Automatic retry on failure

## Database Schema (To Be Implemented)

### organization table
```sql
CREATE TABLE organization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    state TEXT,
    country TEXT DEFAULT 'USA',
    contact_email TEXT,
    logo_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### document_config table
```sql
CREATE TABLE document_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    structure_type TEXT NOT NULL,
    level1_name TEXT DEFAULT 'Article',
    level2_name TEXT DEFAULT 'Section',
    numbering_style TEXT DEFAULT 'roman',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organization(id)
);
```

### workflow_stages table
```sql
CREATE TABLE workflow_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    stage_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    approval_type TEXT NOT NULL,
    approvers TEXT NOT NULL, -- JSON array
    quorum_percentage INTEGER,
    skip_if_author BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organization(id)
);
```

## Integration with Main App

### 1. App Startup

```javascript
// In app.js or server.js
const setupMiddleware = require('./src/middleware/setup-required');
const setupRoutes = require('./src/routes/setup');

// Initialize setup status
await setupMiddleware.initializeSetupStatus(app, db);

// Apply middleware
app.use(setupMiddleware.preventSetupIfConfigured);
app.use(setupMiddleware.requireSetupComplete);

// Register routes
app.use('/setup', setupRoutes);
```

### 2. First-Time Access

```
User visits http://localhost:3000
    ↓
App checks isConfigured flag
    ↓
isConfigured = false
    ↓
Redirect to /setup
    ↓
Show welcome screen
```

### 3. After Setup Complete

```
processSetupData() completes
    ↓
Database tables created
    ↓
app.locals.isConfigured = true
    ↓
User redirected to /dashboard
    ↓
Normal app access
```

## Testing Checklist

### Functional Testing
- [ ] All 5 steps display correctly
- [ ] Form validation works (client & server)
- [ ] File uploads work (logo, document)
- [ ] Google Docs import validates URL
- [ ] Session persists across page reloads
- [ ] Back button works (can edit previous steps)
- [ ] Processing screen updates in real-time
- [ ] Success screen shows correct data
- [ ] Setup blocks app access until complete
- [ ] Can't access setup after completion

### Security Testing
- [ ] CSRF tokens validated on all POST requests
- [ ] File uploads reject invalid types
- [ ] File size limits enforced
- [ ] SQL injection prevented
- [ ] XSS attacks prevented
- [ ] Session hijacking prevented

### UI/UX Testing
- [ ] Progress stepper updates correctly
- [ ] Animations smooth (60fps)
- [ ] Loading states clear
- [ ] Error messages helpful
- [ ] Success celebration delightful
- [ ] Mobile layout works
- [ ] Tablet layout works
- [ ] Desktop layout works
- [ ] Keyboard navigation works
- [ ] Screen reader accessible

### Performance Testing
- [ ] Page load < 2 seconds
- [ ] File upload shows progress
- [ ] No memory leaks
- [ ] AJAX requests don't block UI
- [ ] Images optimized
- [ ] CSS/JS minified

## Future Enhancements

### Phase 2
- Import from more sources (Dropbox, OneDrive)
- PDF document support
- OCR for scanned documents
- Multi-language support
- Video tutorial on welcome screen

### Phase 3
- AI-powered document parsing
- Auto-detect workflow from document
- Template marketplace (pre-built configs)
- Dark mode
- Advanced customization options

## Troubleshooting

### Setup won't start
- Check `isConfigured` flag in database
- Clear session: `req.session.destroy()`
- Delete organization record to reset

### File upload fails
- Check disk space
- Verify upload directory permissions
- Check file size/type
- Review server logs

### Processing hangs
- Check `req.session.setupData.status`
- Review async processing logs
- Ensure database accessible
- Check for thrown errors

### Success screen shows wrong data
- Verify session data structure
- Check formatting helpers
- Review database inserts

## Support

For implementation questions:
1. Review this documentation
2. Check `/docs/SETUP_WIZARD_SCREENSHOTS.md` for visual guide
3. Examine code comments in source files
4. Create issue on GitHub repository

---

**Last Updated**: 2025-10-07
**Version**: 1.0.0
**Author**: Frontend Developer Agent
