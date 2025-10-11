# Generalized Amendment Tracker - Core Implementation

## Overview

This directory contains the core implementation of the generalized multi-tenant amendment tracking system. The system has been refactored from a single-organization Bylaws tracker to a flexible, configurable platform supporting diverse organizational governance structures.

## Directory Structure

```
src/
├── config/              # Configuration management
│   ├── organizationConfig.js    # Organization settings loader
│   ├── workflowConfig.js        # Workflow stage definitions
│   ├── hierarchyConfig.js       # Document hierarchy templates
│   └── configSchema.js          # Validation schemas
│
├── parsers/             # Document parsing engines
│   ├── wordParser.js            # Word (.docx) document parser
│   ├── googleDocsParser.js      # Google Docs integration
│   ├── hierarchyDetector.js     # Intelligent structure detection
│   └── numberingSchemes.js      # Numbering pattern support
│
├── services/            # Business logic (TO BE IMPLEMENTED)
│   ├── documentService.js       # Document operations
│   ├── workflowService.js       # Workflow state management
│   └── hierarchyService.js      # Hierarchy operations
│
└── utils/               # Utility functions (TO BE IMPLEMENTED)
    └── validators.js            # Input validation helpers
```

## Configuration System

### Organization Configuration (`/src/config/organizationConfig.js`)

**Purpose**: Load and manage organization-specific settings from multiple sources.

**Configuration Priority** (highest to lowest):
1. Database (`organizations` table)
2. Environment variables
3. Configuration files (`/config/organization.json`)
4. Default configuration

**Key Features**:
- Multi-source configuration loading
- Configuration caching for performance
- Validation and error handling
- Hot-reload support (cache clearing)

**Usage Example**:
```javascript
const orgConfig = require('./src/config/organizationConfig');

// Load configuration for an organization
const config = await orgConfig.loadConfig('org-id-123', supabase);

// Access hierarchy levels
const levels = config.hierarchy.levels;

// Access workflow stages
const stages = config.workflow.stages;

// Validate configuration
const validation = orgConfig.validateConfig(config);
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
}
```

**Supported Configuration**:
- Organization identity and metadata
- Custom terminology (Article/Section/Chapter names)
- Hierarchy structure (levels, depths, numbering)
- Workflow stages and permissions
- Suggestion settings (voting, multi-section)
- Export formats
- Integration settings (Google Docs, email)
- Security policies
- Display preferences
- Feature flags

### Workflow Configuration (`/src/config/workflowConfig.js`)

**Purpose**: Manage workflow stages and state transitions.

**Key Features**:
- Load workflow templates from database
- Track current stage for sections
- Validate stage transitions
- Check user permissions for actions
- Calculate document-wide progress

**Usage Example**:
```javascript
const workflowConfig = require('./src/config/workflowConfig');

// Load workflow for organization
const workflow = await workflowConfig.loadWorkflow('org-id', supabase);

// Get current stage for a section
const currentStage = await workflowConfig.getCurrentStage('section-id', supabase);

// Check if transition is allowed
const canTransition = await workflowConfig.canTransition(
  'section-id',
  'next-stage-id',
  'user-id',
  supabase
);

// Transition to next stage
const result = await workflowConfig.transitionStage(
  'section-id',
  'stage-id',
  'user-id',
  'Approval notes',
  supabase
);
```

### Hierarchy Configuration (`/src/config/hierarchyConfig.js`)

**Purpose**: Handle document hierarchy templates and numbering schemes.

**Key Features**:
- Format section numbers (Roman, numeric, alpha)
- Build section paths (breadcrumbs)
- Generate citations
- Validate hierarchy structure
- Flatten/traverse hierarchy trees

**Usage Example**:
```javascript
const hierarchyConfig = require('./src/config/hierarchyConfig');

// Format section number
const formatted = hierarchyConfig.formatSectionNumber(5, 'roman', 'Article ');
// Returns: "Article V"

// Convert Roman to number
const num = hierarchyConfig.fromRoman('XIV'); // Returns: 14

// Build section path
const path = hierarchyConfig.buildSectionPath(section, allSections);
// Returns: [{ id, number, title, type }, ...]

// Validate hierarchy
const validation = hierarchyConfig.validateHierarchy(sections, orgConfig);
```

### Configuration Schema (`/src/config/configSchema.js`)

**Purpose**: Validate organization and workflow configurations using Joi.

**Key Features**:
- Schema definitions for all config types
- Comprehensive validation rules
- Error reporting with field paths
- Default value handling
- Sequential ordering validation

**Usage Example**:
```javascript
const { validateOrganizationConfig } = require('./src/config/configSchema');

const result = validateOrganizationConfig(configData);

if (result.valid) {
  console.log('Valid config:', result.value);
} else {
  console.error('Errors:', result.errors);
}
```

## Document Parsing System

### Word Parser (`/src/parsers/wordParser.js`)

**Purpose**: Parse Microsoft Word (.docx) documents into structured sections.

**Dependencies**: `mammoth` library for .docx extraction

**Key Features**:
- Extract text and HTML from .docx files
- Detect hierarchy patterns automatically
- Parse sections with titles and content
- Validate parsed structure
- Generate previews before import

**Usage Example**:
```javascript
const wordParser = require('./src/parsers/wordParser');

// Parse a Word document
const result = await wordParser.parseDocument(
  '/path/to/bylaws.docx',
  organizationConfig
);

if (result.success) {
  console.log('Parsed sections:', result.sections.length);

  // Generate preview
  const preview = wordParser.generatePreview(result.sections, 5);

  // Validate
  const validation = wordParser.validateSections(result.sections, orgConfig);
}
```

### Google Docs Parser (`/src/parsers/googleDocsParser.js`)

**Purpose**: Parse Google Docs content via API integration.

**Key Features**:
- Extract text from Google Docs API responses
- Support for paragraphs, tables, and formatting
- Same parsing logic as Word parser
- Generate previews

**Usage Example**:
```javascript
const googleDocsParser = require('./src/parsers/googleDocsParser');

// Parse Google Docs content (already fetched via API)
const result = await googleDocsParser.parseDocument(
  googleDocsApiResponse,
  organizationConfig
);

if (result.success) {
  console.log('Metadata:', result.metadata);
  console.log('Sections:', result.sections);
}
```

### Hierarchy Detector (`/src/parsers/hierarchyDetector.js`)

**Purpose**: Intelligently detect document structure and numbering patterns.

**Key Features**:
- Pattern matching for various numbering schemes
- Automatic hierarchy inference
- Build tree structures from flat lists
- Validate numbering consistency
- Suggest configuration from detected patterns

**Usage Example**:
```javascript
const hierarchyDetector = require('./src/parsers/hierarchyDetector');

// Detect hierarchy from text
const detected = hierarchyDetector.detectHierarchy(text, orgConfig);

// Infer hierarchy when no config is available
const inferred = hierarchyDetector.inferHierarchy(text);

// Build tree structure
const tree = hierarchyDetector.buildHierarchyTree(sections);

// Validate structure
const validation = hierarchyDetector.validateHierarchy(sections, orgConfig);

// Suggest configuration
const suggested = hierarchyDetector.suggestHierarchyConfig(detectedItems);
```

### Numbering Schemes (`/src/parsers/numberingSchemes.js`)

**Purpose**: Support for various document numbering patterns.

**Supported Schemes**:
- **Roman numerals**: I, II, III, IV, V, VI, VII, VIII, IX, X...
- **Numeric**: 1, 2, 3, 4, 5...
- **Alphabetic (uppercase)**: A, B, C, D, E...
- **Alphabetic (lowercase)**: a, b, c, d, e...
- **Ordinal**: 1st, 2nd, 3rd, 4th...
- **Words**: one, two, three, four...

**Key Features**:
- Bidirectional conversion (to/from schemes)
- Hierarchical number formatting (1.2.3)
- Number increment/comparison
- Format validation
- Auto-detection from examples

**Usage Example**:
```javascript
const numberingSchemes = require('./src/parsers/numberingSchemes');

// Convert to Roman
const roman = numberingSchemes.toRoman(14); // "XIV"

// Convert from Roman
const num = numberingSchemes.fromRoman('XIV'); // 14

// Convert to alphabetic
const alpha = numberingSchemes.toAlpha(3, false); // "C"

// Hierarchical formatting
const formatted = numberingSchemes.formatHierarchical([1, 2, 3], '.'); // "1.2.3"

// Increment in scheme
const next = numberingSchemes.increment('V', 'roman'); // "VI"

// Validate
const valid = numberingSchemes.validate('XIV', 'roman'); // true

// Auto-detect scheme
const scheme = numberingSchemes.detectScheme(['I', 'II', 'III']); // "roman"
```

## Example Configurations

### Default Organization (`/config/examples/organization.example.json`)

- Neighborhood council template
- Article/Section hierarchy
- Two-stage workflow (Committee/Board)
- Public suggestions enabled
- JSON/PDF export

### Corporate Bylaws (`/config/examples/corporate-bylaws.json`)

- Article/Section/Subsection hierarchy
- Three-stage workflow (Executive/Legal/Board)
- Restricted suggestions
- Sequential approval required

### Academic Policy (`/config/examples/academic-policy.json`)

- Chapter/Section/Subsection hierarchy
- Three-stage workflow (Faculty/Department/Senate)
- Custom terminology
- Voting-based suggestions

## Integration with Existing Code

### Server.js Integration

To use the new configuration system in `server.js`:

```javascript
const organizationConfig = require('./src/config/organizationConfig');
const workflowConfig = require('./src/config/workflowConfig');
const wordParser = require('./src/parsers/wordParser');

// Load organization config
app.use(async (req, res, next) => {
  const orgId = req.headers['x-organization-id'] || 'default';
  req.orgConfig = await organizationConfig.loadConfig(orgId, req.supabase);
  next();
});

// Parse uploaded document
app.post('/api/documents/parse', async (req, res) => {
  const { filePath, fileType } = req.body;

  let result;
  if (fileType === 'docx') {
    result = await wordParser.parseDocument(filePath, req.orgConfig);
  }

  res.json(result);
});

// Use workflow configuration
app.get('/api/workflow/stages', async (req, res) => {
  const workflow = await workflowConfig.loadWorkflow(req.orgConfig.organizationId, req.supabase);
  res.json({ stages: workflow.stages });
});
```

## Next Steps

### Immediate Tasks

1. **Create Service Layer**:
   - `documentService.js` - CRUD operations for documents
   - `workflowService.js` - Workflow state management
   - `hierarchyService.js` - Section tree operations

2. **Update Server.js**:
   - Replace hardcoded values with config loading
   - Use new parsers for document import
   - Integrate workflow service for approvals

3. **Testing**:
   - Unit tests for each module
   - Integration tests with Supabase
   - End-to-end parsing tests

4. **Documentation**:
   - API documentation
   - Configuration guide
   - Migration guide from old schema

### Future Enhancements

- Real-time configuration updates
- Configuration import/export
- Template marketplace
- Advanced permissions system
- Audit logging
- Version control integration

## Architecture Benefits

1. **Flexibility**: Support any organizational structure
2. **Maintainability**: Clear separation of concerns
3. **Extensibility**: Easy to add new features
4. **Performance**: Configuration caching
5. **Security**: Validation and sanitization
6. **Testability**: Modular design

## Dependencies

```json
{
  "mammoth": "^1.11.0",     // Word document parsing
  "joi": "^18.0.1",         // Schema validation
  "ajv": "^8.17.1"          // JSON schema validation (alternative)
}
```

## Configuration File Locations

- **Production**: `/config/organization.json`
- **Examples**: `/config/examples/*.json`
- **Environment**: `.env` file
- **Database**: `organizations.settings` and `organizations.hierarchy_config`

## Error Handling

All modules include comprehensive error handling:
- Try/catch blocks for async operations
- Validation before processing
- Meaningful error messages
- Fallback to defaults when appropriate
- Error logging to console

## Performance Considerations

- **Caching**: Configuration cached in memory
- **Lazy Loading**: Load on demand
- **Batch Operations**: Process multiple sections together
- **Validation**: Optional for performance-critical paths
- **Database**: Minimize queries with proper joins

## Security

- **Input Validation**: All user input validated
- **SQL Injection**: Using Supabase parameterized queries
- **XSS Prevention**: Sanitizing text content
- **Path Traversal**: Validating file paths
- **Configuration**: Read-only for non-admin users

---

**Built with**: Node.js, Express, Supabase, Mammoth, Joi
**Version**: 2.0.0 (Generalized)
**Last Updated**: 2025-10-07
