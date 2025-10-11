# Current System Analysis - Bylaws Amendment Tracker

**Research Agent Analysis**
**Date:** 2025-10-07
**Scope:** Complete inventory of hardcoded assumptions and generalization opportunities

---

## Executive Summary

The current Bylaws Amendment Tracker is a **single-tenant, domain-specific application** designed for Reseda Neighborhood Council with hardcoded assumptions about:
- Document structure (Article/Section hierarchy)
- Approval workflow (Committee → Board two-stage)
- Terminology ("Bylaws", "Committee", "Board")
- Document source (Google Docs only)

**Generalization Complexity:** Medium-High
**Primary Barriers:** Database schema, business logic in controllers, UI assumptions
**Recommended Approach:** Phased migration with configuration-driven architecture

---

## Part 1: Hardcoded Assumptions Inventory

### 1.1 Document Hierarchy Structure

**Location:** `database/schema.sql`, `database/migration_001_multi_section.sql`

**Hardcoded Elements:**
```sql
-- Assumes Article/Section two-level hierarchy
article_number VARCHAR(20)  -- "III", "IV", etc.
section_number INTEGER      -- 1, 2, 3 within article

-- Citation format assumes specific structure
section_citation VARCHAR(255)  -- "Article V, Section 6"
```

**Business Logic Dependencies:**
- `server.js:82-87` - Validates sections must be from same article
- `server.js:104-107` - Generates "Article X" and "Section Y-Z" ranges
- `server.js:63` - Queries by `article_number` and `section_number`
- `google-apps-script/Code.gs:82-96` - Parses headers expecting "ARTICLE" and "Section" keywords

**Impact:** High - Entire validation and display logic assumes this structure

**Generalization Need:**
- Replace fixed schema with flexible tree structure
- Support arbitrary depth (Chapter → Article → Section → Subsection → Paragraph)
- Allow custom numbering schemes (1.1.1, A.1.a, Roman numerals, etc.)

### 1.2 Approval Workflow (Committee → Board)

**Location:** `database/schema.sql`, `server.js`

**Hardcoded Elements:**
```sql
-- Two-stage workflow hardcoded
locked_by_committee BOOLEAN DEFAULT FALSE
locked_at TIMESTAMP
locked_by VARCHAR(255)
committee_notes TEXT

board_approved BOOLEAN DEFAULT FALSE
board_approved_at TIMESTAMP
```

**Business Logic Dependencies:**
- `server.js:224-320` - Lock/unlock logic assumes single committee stage
- `server.js:350-378` - Export endpoint expects "committee_approved" status
- `server.js:627-655` - Separate board approval export
- `views/bylaws-improved.ejs:48-50` - UI displays "🔒 Locked" for committee status

**Impact:** High - Workflow stages are table columns, not configurable

**Generalization Need:**
- N-stage configurable workflows (e.g., Drafting → Review → Legal → Board → Membership)
- Dynamic status tracking per stage
- Configurable role permissions per stage
- Flexible state machine instead of boolean flags

### 1.3 Terminology ("Bylaws", "Committee", "Board")

**Location:** Throughout UI, server responses, database fields

**Hardcoded Elements:**
```javascript
// UI Labels
"Bylaws Amendment Tracker"
"Committee User"
"Board Approved"
"🔧 Bylaws Sync" (Google Docs menu)

// Database field names
locked_by_committee
board_approved
committee_notes

// Export filenames
`bylaws-committee-${date}.json`
`bylaws-board-${date}.json`

// API endpoints
/bylaws/api/sections
/bylaws/api/export/committee
/bylaws/api/export/board
```

**Impact:** Medium - Mostly UI/UX, but some field names are structural

**Generalization Need:**
- Configuration-based terminology system
- Internationalization support (i18n)
- Custom labels per organization
- Maintain semantic meaning while allowing display customization

### 1.4 Single Organization Model

**Location:** Database schema, environment configuration

**Hardcoded Elements:**
```javascript
// .env - No organization concept
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
GOOGLE_DOC_ID=...

// No organization_id in any table
// No multi-tenancy support
// Single database = single organization
```

**Impact:** Critical - Foundation of architecture

**Generalization Need:**
- Add `organization_id` to all tables
- Implement Row-Level Security (RLS) for tenant isolation
- Organization management (create, configure, delete)
- User-to-organization membership mapping

### 1.5 Google Docs Integration Only

**Location:** `google-apps-script/Code.gs`, `server.js`

**Hardcoded Elements:**
```javascript
// Google Apps Script parsing
function parseSections(body) {
  const paragraphs = body.getParagraphs();
  // Assumes Google Docs paragraph API
  const heading = para.getHeading();
  if (heading !== DocumentApp.ParagraphHeading.NORMAL) {
    // Parse section header
  }
}

// Server expects Google Doc format
app.post('/bylaws/api/initialize', async (req, res) => {
  const { docId, sections } = req.body;
  // Sections must come from Google Docs parser
});
```

**Impact:** Medium - Limits document sources

**Generalization Need:**
- Support Microsoft Word .docx import (via mammoth.js or docx library)
- PDF import with OCR (via pdf-parse or tesseract.js)
- Markdown/HTML input
- Manual section creation UI
- Template-based document creation

### 1.6 Section Locking Mechanism

**Location:** `server.js:224-320`

**Hardcoded Elements:**
```javascript
// Assumes sections lock with suggestion selection
locked_by_committee: true,
selected_suggestion_id: suggestionId,
new_text: newText  // From selected suggestion
```

**Impact:** Medium - Tightly couples locking with suggestion approval

**Generalization Need:**
- Decouple "locking" (stage progression) from "approval decision"
- Support various decision types (approve, reject, defer, modify)
- Allow locking without suggestion selection (keep original)
- Configurable lock behavior per workflow stage

---

## Part 2: Database Schema Limitations

### 2.1 Current Schema Structure

```sql
-- bylaw_sections: Fixed hierarchy
CREATE TABLE bylaw_sections (
  id UUID PRIMARY KEY,
  doc_id VARCHAR(255) NOT NULL,  -- Should be UUID FK to documents table
  section_citation VARCHAR(255),  -- Hardcoded format
  section_title TEXT,
  original_text TEXT,
  new_text TEXT,
  final_text TEXT,

  -- Fixed two-stage workflow
  locked_by_committee BOOLEAN,
  committee_notes TEXT,
  board_approved BOOLEAN,

  -- Added in migration, but still assumes two-level hierarchy
  article_number VARCHAR(20),
  section_number INTEGER
);

-- bylaw_suggestions: Tied to sections
CREATE TABLE bylaw_suggestions (
  id UUID PRIMARY KEY,
  section_id UUID REFERENCES bylaw_sections(id),
  google_suggestion_id VARCHAR(255),  -- Google Docs specific

  -- Metadata
  suggested_text TEXT,
  rationale TEXT,
  author_email VARCHAR(255),
  author_name VARCHAR(255),

  status VARCHAR(50) DEFAULT 'open',  -- No workflow integration

  -- Multi-section support (added in migration)
  is_multi_section BOOLEAN,
  article_scope VARCHAR(255),  -- Still assumes articles
  section_range VARCHAR(255)
);

-- bylaw_votes: Simple voting
CREATE TABLE bylaw_votes (
  id UUID PRIMARY KEY,
  suggestion_id UUID REFERENCES bylaw_suggestions(id),
  user_email VARCHAR(255) NOT NULL,  -- No user table
  vote_type VARCHAR(20),
  is_preferred BOOLEAN
);

-- suggestion_sections: Junction for multi-section
CREATE TABLE suggestion_sections (
  id UUID PRIMARY KEY,
  suggestion_id UUID NOT NULL,
  section_id UUID REFERENCES bylaw_sections(id),
  ordinal INTEGER NOT NULL  -- Ordering
);
```

### 2.2 Key Limitations

1. **No Organizations Table**
   - Cannot support multiple organizations
   - No tenant isolation

2. **No Users/Roles Table**
   - Authentication not implemented
   - Permissions hardcoded in code
   - Vote tracking by email (unreliable)

3. **No Documents Table**
   - `doc_id` is VARCHAR, not FK to documents
   - No document metadata (title, version, status)
   - No document-level permissions

4. **Fixed Hierarchy Fields**
   - `article_number` and `section_number` cannot represent:
     - Three or more levels (Chapter → Article → Section)
     - Different numbering (1.1.1 vs I.A.1)
     - Non-numeric schemes (alphabetic sections)

5. **Workflow as Boolean Columns**
   - Cannot add third approval stage without migration
   - No audit trail of stage transitions
   - No configurable workflow states

6. **No Configuration Storage**
   - Organization settings stored in .env (server-side only)
   - No runtime configuration changes
   - Cannot customize per-organization

---

## Part 3: API Endpoint Analysis

### 3.1 Current Endpoints

```javascript
// Hardcoded "bylaws" namespace
GET  /bylaws
GET  /bylaws/api/sections/:docId
POST /bylaws/api/initialize
POST /bylaws/api/sections/:sectionId/lock
POST /bylaws/api/sections/:sectionId/unlock
GET  /bylaws/api/export/committee  // Hardcoded workflow stage
GET  /bylaws/api/export/board      // Hardcoded workflow stage
POST /bylaws/api/suggestions
GET  /bylaws/api/sections/:sectionId/suggestions
GET  /bylaws/api/sections/multiple/suggestions
PUT  /bylaws/api/suggestions/:id
DELETE /bylaws/api/suggestions/:id
```

### 3.2 Generalization Needs

**New Endpoint Structure:**
```javascript
// Multi-tenant namespace
GET  /api/v1/organizations/:orgId/documents
GET  /api/v1/organizations/:orgId/documents/:docId/sections
POST /api/v1/organizations/:orgId/documents/:docId/sections/:sectionId/transition
    // Generic state transition, replaces lock/unlock

// Configurable workflow stages
GET  /api/v1/organizations/:orgId/documents/:docId/export?stage=review
GET  /api/v1/organizations/:orgId/documents/:docId/export?stage=approval

// Generic terminology
POST /api/v1/organizations/:orgId/documents/:docId/amendments
GET  /api/v1/organizations/:orgId/documents/:docId/sections/:sectionId/amendments
```

---

## Part 4: UI Patterns to Preserve

### 4.1 Successful UX Elements

1. **Side-by-Side Document View**
   - Sidebar with section list
   - Main area for document display (currently removed in improved version)
   - ✅ Keep: Split-pane layout is intuitive

2. **Expandable Section Cards**
   - Collapsed view shows summary
   - Click to expand shows suggestions
   - ✅ Keep: Reduces cognitive load

3. **Visual Lock Status**
   - Yellow highlight for locked sections
   - 🔒/🔓 badges
   - ✅ Keep: Clear visual feedback

4. **Multi-Select Mode**
   - Checkbox selection
   - Range selection with Shift-click
   - Validation warnings for cross-article selection
   - ✅ Keep: Efficient bulk operations

5. **Change Tracking UI**
   - Toggle "Show All Changes" button
   - Per-suggestion change view
   - Diff highlighting (red strikethrough, green additions)
   - ✅ Keep: Essential for amendment review

6. **Suggestion Count Badges**
   - Shows number of suggestions per section
   - Helps identify active discussion areas
   - ✅ Keep: Quick scanning

### 4.2 UI Components Needing Generalization

1. **Hardcoded Labels**
   ```javascript
   // Replace with i18n keys
   "Bylaws Amendment Tracker" → config.documentType + " Tracker"
   "Committee User" → config.roles[currentStage].displayName
   "Board Approved" → config.workflow.stages[finalStage].label
   ```

2. **Workflow Stage Indicators**
   ```javascript
   // Current: Fixed "Committee" and "Board" stages
   <span class="lock-badge locked">🔒 Locked</span>

   // Generalized: Dynamic stage display
   <span class="stage-badge stage-{currentStage.id}">
     {currentStage.icon} {currentStage.label}
   </span>
   ```

3. **Export Buttons**
   ```javascript
   // Current: Two hardcoded buttons
   <button onclick="exportCommittee()">Export Committee</button>
   <button onclick="exportBoard()">Export Board</button>

   // Generalized: Dynamic stage exports
   {workflow.stages.map(stage => (
     <button onclick="exportStage('{stage.id}')">
       Export {stage.label}
     </button>
   ))}
   ```

---

## Part 5: Configuration System Recommendation

### 5.1 Recommended Approach: Three-Tier Configuration

```javascript
// Tier 1: System Defaults (in code)
const SYSTEM_DEFAULTS = {
  workflow: {
    stages: [
      { id: 'draft', label: 'Draft', icon: '📝', roles: ['author'] },
      { id: 'review', label: 'Review', icon: '👁️', roles: ['reviewer'] },
      { id: 'approved', label: 'Approved', icon: '✅', roles: ['approver'] }
    ],
    transitions: {
      draft: ['review', 'rejected'],
      review: ['approved', 'draft', 'rejected'],
      approved: ['published']
    }
  },
  hierarchy: {
    levels: [
      { id: 'chapter', label: 'Chapter', numbering: 'roman' },
      { id: 'article', label: 'Article', numbering: 'numeric' },
      { id: 'section', label: 'Section', numbering: 'numeric' }
    ]
  },
  terminology: {
    documentType: 'Bylaws',
    amendmentTerm: 'Amendment',
    sectionTerm: 'Section'
  }
};

// Tier 2: Organization Configuration (in database)
CREATE TABLE organization_config (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  config_key VARCHAR(255) NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, config_key)
);

// Example: Reseda NC overrides
INSERT INTO organization_config VALUES (
  'reseda-nc-uuid',
  'workflow',
  '{"stages": [
    {"id": "committee", "label": "Committee Review", "icon": "🔍"},
    {"id": "board", "label": "Board Approval", "icon": "✅"}
  ]}'::jsonb
);

// Tier 3: Document-Specific Overrides (in documents table)
ALTER TABLE documents ADD COLUMN custom_config JSONB;

// Example: Special document with custom workflow
UPDATE documents
SET custom_config = '{"workflow": {"requireUnanimous": true}}'::jsonb
WHERE id = 'special-doc-uuid';
```

### 5.2 Configuration Merging Strategy

```javascript
// Runtime configuration resolution
function getEffectiveConfig(orgId, docId) {
  const systemDefaults = SYSTEM_DEFAULTS;
  const orgConfig = db.query(
    'SELECT config_value FROM organization_config WHERE organization_id = $1',
    [orgId]
  );
  const docConfig = db.query(
    'SELECT custom_config FROM documents WHERE id = $1',
    [docId]
  );

  // Deep merge: System < Organization < Document
  return deepMerge(systemDefaults, orgConfig, docConfig);
}
```

---

## Part 6: Document Hierarchy Patterns Research

### 6.1 Common Patterns Identified

**Pattern 1: Article/Section (Current System)**
```
Article I: Name and Purpose
  Section 1: Official Name
  Section 2: Mission Statement
Article II: Membership
  Section 1: Eligibility
  Section 2: Classes of Members
```
- **Depth:** 2 levels
- **Numbering:** Roman numerals (Articles), Arabic (Sections)
- **Use Cases:** Non-profit bylaws, HOA documents

**Pattern 2: Chapter/Article/Section**
```
Chapter 1: General Provisions
  Article 1: Definitions
    Section 1.1: Interpretation
    Section 1.2: Terminology
  Article 2: Application
    Section 2.1: Scope
```
- **Depth:** 3 levels
- **Numbering:** Arabic at all levels, hierarchical (1.1, 1.2)
- **Use Cases:** Corporate policies, academic regulations

**Pattern 3: Title/Chapter/Section/Subsection**
```
Title I: Student Affairs
  Chapter 1: Admissions
    Section 101: Requirements
      (a) Academic Credentials
      (b) Test Scores
    Section 102: Application Process
```
- **Depth:** 4 levels
- **Numbering:** Roman (Title), Arabic (Chapter), Numbered sections, Lettered subsections
- **Use Cases:** Legal codes, university regulations

**Pattern 4: Flat Numbered Sections**
```
1. Purpose
2. Definitions
3. Eligibility
4. Procedures
  4.1 Application
  4.2 Review
  4.3 Approval
```
- **Depth:** 2 levels (numbered with decimal notation)
- **Numbering:** Decimal (1, 1.1, 1.1.1)
- **Use Cases:** Policies, procedures, guidelines

**Pattern 5: Part/Division/Section**
```
Part A: Administrative
  Division 1: Organization
    Section A-1-1: Board Structure
    Section A-1-2: Officer Duties
  Division 2: Operations
    Section A-2-1: Meetings
```
- **Depth:** 3 levels
- **Numbering:** Alpha-numeric hybrid
- **Use Cases:** Government regulations, technical standards

### 6.2 Recommended Flexible Schema

```sql
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Tree structure (Adjacency List)
  parent_section_id UUID REFERENCES document_sections(id),
  ordinal INTEGER NOT NULL,  -- Position among siblings
  depth INTEGER NOT NULL DEFAULT 0,  -- 0=root, 1=child, etc.

  -- Display metadata (configured per organization)
  level_type VARCHAR(50),  -- 'chapter', 'article', 'section', etc.
  display_number VARCHAR(50),  -- 'III', '1', '1.1', 'A', etc.
  display_label VARCHAR(255),  -- Human-readable label

  -- Content
  title TEXT,
  content TEXT,

  -- Workflow state (generic)
  current_stage VARCHAR(50),  -- References org workflow config
  locked_at TIMESTAMP,
  locked_by UUID REFERENCES users(id),

  -- Metadata
  custom_attributes JSONB,  -- Extensible per-org
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Path materialization for fast queries
CREATE TABLE section_paths (
  section_id UUID REFERENCES document_sections(id),
  ancestor_id UUID REFERENCES document_sections(id),
  depth INTEGER,
  PRIMARY KEY (section_id, ancestor_id)
);

-- Index for tree queries
CREATE INDEX idx_sections_parent ON document_sections(parent_section_id);
CREATE INDEX idx_sections_document ON document_sections(document_id, ordinal);
CREATE INDEX idx_paths_section ON section_paths(section_id);
```

---

## Part 7: Multi-Tenancy Architecture Recommendation

### 7.1 Recommended: Supabase Multi-Tenant with RLS

**Pros:**
- ✅ Single database to maintain
- ✅ Built-in Row-Level Security (RLS)
- ✅ Easy cross-org analytics
- ✅ Cost-effective
- ✅ Simple backup/recovery
- ✅ Fast development iteration

**Cons:**
- ⚠️ Requires careful RLS policy design
- ⚠️ Shared resource pool (less isolation)
- ⚠️ Complex queries need organization_id filtering

**Alternative Considered:** Per-Organization Database Isolation
- Rejected due to operational complexity
- N databases = N migration runs
- Connection pooling nightmares
- No cross-org features

### 7.2 Implementation Plan

```sql
-- Step 1: Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,  -- URL-friendly identifier
  name VARCHAR(255) NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Add organization_id to all tables
ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE document_sections ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE amendments ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Step 3: Create user management
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_organizations (
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  role VARCHAR(50) NOT NULL,  -- 'admin', 'editor', 'viewer'
  PRIMARY KEY (user_id, organization_id)
);

-- Step 4: Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users see own org documents"
  ON documents FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can modify"
  ON documents FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

---

## Part 8: Document Parsing Strategy

### 8.1 Current Limitation: Google Docs Only

The current system only supports Google Docs via Apps Script:
```javascript
function parseSections(body) {
  const paragraphs = body.getParagraphs();
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const heading = para.getHeading();
    if (heading !== DocumentApp.ParagraphHeading.NORMAL) {
      // Parse section header
    }
  }
}
```

### 8.2 Recommended: Multi-Format Parser

**Library Recommendations:**

1. **Microsoft Word (.docx)**
   - Library: `mammoth` or `docx`
   - Strategy: Convert to HTML, parse headings
   ```javascript
   const mammoth = require('mammoth');
   const result = await mammoth.convertToHtml({ path: "document.docx" });
   const sections = parseHtmlHeadings(result.value);
   ```

2. **PDF**
   - Library: `pdf-parse` + `pdf-lib`
   - Strategy: Extract text, identify sections by font size/style
   - Limitation: Complex formatting may be lost
   ```javascript
   const pdfParse = require('pdf-parse');
   const dataBuffer = fs.readFileSync('document.pdf');
   const data = await pdfParse(dataBuffer);
   const sections = parseTextBySections(data.text);
   ```

3. **Markdown**
   - Library: `marked` or `remark`
   - Strategy: Parse heading hierarchy
   ```javascript
   const marked = require('marked');
   const tokens = marked.lexer(markdownText);
   const sections = buildTreeFromHeadings(tokens);
   ```

4. **HTML**
   - Library: `cheerio`
   - Strategy: Parse `<h1>`, `<h2>`, `<h3>` tags
   ```javascript
   const cheerio = require('cheerio');
   const $ = cheerio.load(htmlContent);
   const sections = parseHeadingHierarchy($);
   ```

### 8.3 Generic Section Parser Architecture

```javascript
class DocumentParser {
  async parse(file, format, config) {
    // Delegate to format-specific parser
    const parser = this.getParser(format);
    const rawSections = await parser.extract(file);

    // Apply organization's hierarchy configuration
    const hierarchy = config.hierarchy.levels;
    const sections = this.mapToHierarchy(rawSections, hierarchy);

    return sections;
  }

  getParser(format) {
    const parsers = {
      'google-docs': new GoogleDocsParser(),
      'docx': new WordDocxParser(),
      'pdf': new PdfParser(),
      'markdown': new MarkdownParser(),
      'html': new HtmlParser()
    };
    return parsers[format];
  }

  mapToHierarchy(rawSections, hierarchyConfig) {
    // Convert raw headings to configured hierarchy
    // Example: H1 → Chapter, H2 → Article, H3 → Section
    return rawSections.map(section => ({
      level_type: hierarchyConfig[section.level].id,
      display_number: this.generateNumber(section, hierarchyConfig),
      title: section.title,
      content: section.content,
      depth: section.level,
      parent_id: section.parentId
    }));
  }
}
```

---

## Part 9: Migration Complexity Assessment

### 9.1 Phased Migration Plan

**Phase 1: Foundation (Low Risk)**
- Add `organizations` and `users` tables
- Add `organization_id` to existing tables
- Implement RLS policies
- Create default organization for existing data
- Estimated effort: 2-3 days

**Phase 2: Configuration System (Medium Risk)**
- Create `organization_config` table
- Implement configuration merging logic
- Move hardcoded values to configuration
- Update UI to read from configuration
- Estimated effort: 5-7 days

**Phase 3: Flexible Hierarchy (High Risk)**
- Create new `document_sections` table
- Migrate data from `bylaw_sections`
- Update all queries to use tree structure
- Refactor validation logic
- Update UI for dynamic levels
- Estimated effort: 10-14 days

**Phase 4: Generic Workflow (High Risk)**
- Replace boolean columns with state table
- Implement state machine logic
- Update API endpoints
- Refactor UI for dynamic stages
- Estimated effort: 7-10 days

**Phase 5: Multi-Format Parsing (Medium Risk)**
- Implement document parser factory
- Add format-specific parsers
- Update upload UI
- Testing across formats
- Estimated effort: 5-7 days

**Phase 6: UI Generalization (Low-Medium Risk)**
- Implement i18n system
- Update all labels to use config
- Test with multiple configurations
- Estimated effort: 3-5 days

**Total Estimated Effort:** 32-46 days (6-9 weeks)

### 9.2 Risk Mitigation

1. **Backward Compatibility**
   - Keep existing API endpoints during migration
   - Use feature flags for new functionality
   - Dual-write to old and new schemas temporarily

2. **Data Migration**
   - Create rollback SQL scripts
   - Test migration on copy of production database
   - Implement data validation checks

3. **Performance Testing**
   - Benchmark RLS policy performance
   - Test with 100+ organizations
   - Optimize tree queries with path materialization

---

## Part 10: Recommendations Summary

### 10.1 Immediate Actions

1. **Create Configuration System**
   - Start with simple key-value store in database
   - Move terminology to configuration
   - Test with two different configurations

2. **Add Organization Concept**
   - Create minimal `organizations` table
   - Add foreign keys to existing tables
   - Implement basic RLS

3. **Document Current Workflows**
   - Map existing two-stage workflow
   - Identify decision points
   - Design generic state machine

### 10.2 Long-Term Architecture

**Target State:**
- Multi-tenant SaaS platform
- Support 100+ organizations
- 5+ document hierarchy patterns
- 10+ workflow templates
- Multiple document import formats
- White-label UI customization

**Core Principles:**
- Configuration over code
- Extensibility via JSON metadata
- Security via RLS
- Performance via materialized paths
- Usability via sensible defaults

---

## Appendices

### Appendix A: Files Analyzed

**Core Application:**
- `/server.js` (679 lines) - Express server, all API endpoints
- `/views/bylaws-improved.ejs` (1014 lines) - Main UI
- `/google-apps-script/Code.gs` (233 lines) - Google Docs integration
- `/package.json` - Dependencies

**Database:**
- `/database/schema.sql` (66 lines) - Original schema
- `/database/migration_001_multi_section.sql` (93 lines) - Multi-section support
- `/database/ARCHITECTURE_DESIGN.md` (100+ lines) - Architecture proposal

**Configuration:**
- `.env` files (not found in repo, referenced in code)

### Appendix B: Key Dependencies

```json
{
  "@supabase/supabase-js": "^2.39.0",  // Database client
  "dotenv": "^17.2.2",                 // Environment config
  "ejs": "^3.1.9",                     // Templating
  "express": "^4.18.2"                 // Web framework
}
```

**Missing Dependencies for Generalization:**
- User authentication library (passport, supabase auth)
- Document parsing libraries (mammoth, pdf-parse, marked)
- Internationalization (i18next)
- Configuration validation (joi, yup)

### Appendix C: Terminology Mapping

| Current (Reseda NC) | Generic Term | Alternative Examples |
|---------------------|--------------|----------------------|
| Bylaws | Governance Document | Policy, Constitution, Charter |
| Committee | Review Stage | Editorial Review, Legal Review |
| Board | Approval Stage | Executive Approval, Membership Vote |
| Section | Structural Unit | Clause, Provision, Paragraph |
| Article | Structural Group | Chapter, Title, Part |
| Suggestion | Amendment Proposal | Change Request, Revision, Edit |
| Lock | Stage Transition | Advance, Promote, Progress |
| Vote | Support Indicator | Endorsement, Preference, Rating |

---

**Research completed by:** Researcher Agent
**Next steps:** Share findings with Architect Agent for schema design
**Coordination:** Store in hive memory for swarm access
