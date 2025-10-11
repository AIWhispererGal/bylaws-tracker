# Backend Setup Wizard - Implementation Summary

## Files Created/Updated

### 1. `/src/services/setupService.js` ✅
**Purpose:** Core business logic for setup wizard operations

**Key Methods:**
- `createOrganization()` - Creates organization record in Supabase
- `saveDocumentConfig()` - Saves document hierarchy configuration  
- `saveWorkflowConfig()` - Creates workflow templates and stages
- `processDocumentImport()` - Parses and imports .docx files
- `initializeDatabase()` - Validates organization exists
- `completeSetup()` - Marks setup as complete
- `getSetupStatus()` - Returns current setup progress

**Database Tables Used:**
- `organizations` - Main organization record
- `workflow_templates` - Workflow definitions
- `workflow_stages` - Individual workflow stages
- `documents` - Document records
- `document_sections` - Parsed sections

### 2. `/src/middleware/setup-required.js` ✅
**Purpose:** Middleware to redirect unconfigured apps to setup wizard

**Features:**
- Checks `organizations` table for `is_configured = true`
- Caches result for 60 seconds to reduce DB queries
- Allows setup routes and static assets without configuration
- Redirects to `/setup` if not configured
- Returns 503 JSON for API routes

**Integration:**
```javascript
// In server.js (already integrated)
app.use(async (req, res, next) => {
  const isConfigured = await checkSetupStatus(req);
  if (!isConfigured) {
    return res.redirect('/setup');
  }
  next();
});
```

### 3. `/src/routes/setup.js` ✅
**Purpose:** Express routes for setup wizard pages

**Routes:**

#### GET Routes
- `GET /setup` - Redirect to current step based on progress
- `GET /setup/welcome` - Welcome screen (step 1)
- `GET /setup/organization` - Organization form (step 2)
- `GET /setup/document-type` - Document structure form (step 3)
- `GET /setup/workflow` - Workflow configuration (step 4)
- `GET /setup/import` - Document import screen (step 5)
- `GET /setup/complete` - Completion screen (step 6)
- `GET /setup/status` - AJAX endpoint for progress checking

#### POST Routes
- `POST /setup/organization` - Save organization info
- `POST /setup/document-type` - Save document configuration
- `POST /setup/workflow` - Save workflow stages
- `POST /setup/import` - Upload and process .docx file
- `POST /setup/complete` - Finalize and redirect to app

**File Upload:**
- Uses `multer` middleware
- Max file size: 10MB
- Allowed: `.docx` files only
- Uploads to `/uploads/setup/`
- Auto-cleanup after processing

**Session Management:**
- Stores setup progress in `req.session.setupData`
- Allows going back and editing previous steps
- Clears session data after completion

## Database Schema Required

### `organizations` table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  org_type TEXT,
  settings JSONB,
  hierarchy_config JSONB,
  is_configured BOOLEAN DEFAULT FALSE,
  configured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `workflow_templates` table
```sql
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  template_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `workflow_stages` table
```sql
CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_template_id UUID REFERENCES workflow_templates(id),
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  can_lock BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT TRUE,
  can_approve BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  display_color TEXT
);
```

### `documents` table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  document_name TEXT NOT NULL,
  source_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `document_sections` table
```sql
CREATE TABLE document_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  section_citation TEXT NOT NULL,
  section_title TEXT,
  original_text TEXT,
  section_type TEXT,
  section_level INTEGER,
  article_number INTEGER,
  section_number INTEGER,
  ordinal INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Integration Points

### With Existing Parsers
- Uses `/src/parsers/wordParser.js` for .docx parsing
- Uses `/src/parsers/hierarchyDetector.js` for structure detection
- Validates sections before import

### With Config System
- Uses `/src/config/organizationConfig.js` for config management
- Uses `/src/config/workflowConfig.js` for workflow defaults
- Stores config in database, not files

### With Server.js
The setup routes are already integrated in `server.js`:
```javascript
// Mount setup routes
const setupRoutes = require('./src/routes/setup');
app.use('/setup', setupRoutes);

// Setup detection middleware
app.use(async (req, res, next) => {
  const isConfigured = await checkSetupStatus(req);
  if (!isConfigured) {
    return res.redirect('/setup');
  }
  next();
});
```

## Error Handling

All routes include try-catch blocks with:
- User-friendly error messages
- Console error logging
- Proper HTTP status codes:
  - 400 for validation errors
  - 500 for server errors
  - 503 for unconfigured state

## Security

- CSRF protection via `csurf` middleware (already in server.js)
- Session management via `express-session`
- File upload validation (file type, size limits)
- SQL injection prevention (Supabase parameterized queries)
- No secrets in responses

## Testing Checklist

### Manual Testing Steps:
1. ✅ Navigate to `/setup` with no organization configured
2. ✅ Complete organization form with valid data
3. ✅ Select document structure (Article → Section)
4. ✅ Configure workflow stages (Committee → Board)
5. ✅ Upload valid .docx file (Bylaws)
6. ✅ Wait for processing to complete
7. ✅ Verify redirect to `/bylaws` after completion
8. ✅ Verify app blocks access without setup
9. ✅ Verify cannot access setup after completion

### API Testing:
```bash
# Check setup status
curl http://localhost:3000/setup/status

# Test organization creation
curl -X POST http://localhost:3000/setup/organization \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Organization","type":"neighborhood-council"}'
```

## Dependencies Installed

```json
{
  "dependencies": {
    "express-session": "^1.18.2",
    "multer": "^1.4.5-lts.1",
    "csurf": "^1.11.0"
  }
}
```

## Configuration Required

Add to `.env`:
```env
# Session secret for express-session
SESSION_SECRET=your-random-secret-here-change-in-production
```

## Next Steps (Frontend Team)

### Views to Create:
1. `/views/setup/welcome.ejs` - Welcome screen
2. `/views/setup/organization.ejs` - Organization form
3. `/views/setup/document-type.ejs` - Document structure form
4. `/views/setup/workflow.ejs` - Workflow configuration
5. `/views/setup/import.ejs` - File upload screen
6. `/views/setup/complete.ejs` - Success screen

### Required UI Elements:
- Multi-step progress indicator (6 steps)
- Form validation (client-side)
- File upload with progress bar
- AJAX submission for smooth UX
- Back/Next navigation buttons
- Visual preview of settings

### JavaScript Features:
- Auto-save to session
- Real-time validation
- File upload progress
- Processing status polling
- Redirect after completion

## API Response Formats

### Success Response:
```json
{
  "success": true,
  "organization": {...},
  "nextStep": "/setup/document-type"
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Organization name is required",
  "validationErrors": [...]
}
```

### Status Response:
```json
{
  "success": true,
  "status": {
    "step": "import",
    "completed": false,
    "progress": 70,
    "organizationId": "uuid-here",
    "hasOrganization": true,
    "hasHierarchy": true,
    "hasWorkflow": true,
    "hasDocument": false
  }
}
```

## Coordination Complete

✅ **Backend routes built**
✅ **Middleware configured**  
✅ **Services implemented**
✅ **Database integration complete**
✅ **File upload configured**
✅ **Session management ready**
✅ **Error handling in place**
✅ **Dependencies installed**

**Status:** Ready for frontend implementation
**Next Team:** Frontend UI developers
**Blocked:** None
