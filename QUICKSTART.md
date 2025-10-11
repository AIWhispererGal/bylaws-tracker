# Quick Start Guide - Generalized Amendment Tracker

## Getting Started with the New Configuration System

### Installation

Dependencies have already been installed:
```bash
npm install
```

Dependencies added:
- `mammoth` - Word document parsing
- `joi` - Schema validation
- `ajv` - JSON schema validation

### Basic Usage

#### 1. Import the Modules

```javascript
// Import everything
const tracker = require('./src');

// Or import specific modules
const { organizationConfig, wordParser } = require('./src');

// Or import from subdirectories
const organizationConfig = require('./src/config/organizationConfig');
const wordParser = require('./src/parsers/wordParser');
```

#### 2. Load Organization Configuration

```javascript
const { createClient } = require('@supabase/supabase-js');
const { organizationConfig } = require('./src');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load configuration
const config = await organizationConfig.loadConfig('org-id', supabase);

console.log('Organization:', config.organizationName);
console.log('Hierarchy levels:', config.hierarchy.levels);
console.log('Workflow stages:', config.workflow.stages);
```

#### 3. Parse a Document

##### Parse Word Document

```javascript
const { wordParser } = require('./src');

const result = await wordParser.parseDocument(
  '/path/to/document.docx',
  config // organization config from step 2
);

if (result.success) {
  console.log(`Parsed ${result.sections.length} sections`);

  // Preview first 5 sections
  const preview = wordParser.generatePreview(result.sections, 5);
  console.log('Preview:', preview);

  // Validate
  const validation = wordParser.validateSections(result.sections, config);
  if (validation.valid) {
    console.log('All sections valid!');
  } else {
    console.log('Errors:', validation.errors);
    console.log('Warnings:', validation.warnings);
  }
}
```

##### Parse Google Docs

```javascript
const { googleDocsParser } = require('./src');

// Assume you've fetched Google Docs content via API
const result = await googleDocsParser.parseDocument(
  googleDocsContent,
  config
);

console.log('Metadata:', result.metadata);
console.log('Sections:', result.sections);
```

#### 4. Work with Hierarchy

```javascript
const { hierarchyDetector, numberingSchemes } = require('./src');

// Detect hierarchy from text
const detected = hierarchyDetector.detectHierarchy(text, config);

// Convert numbering
const roman = numberingSchemes.toRoman(14);  // "XIV"
const num = numberingSchemes.fromRoman('XIV'); // 14

// Format hierarchical number
const formatted = numberingSchemes.formatHierarchical([1, 2, 3], '.'); // "1.2.3"
```

#### 5. Manage Workflow

```javascript
const { workflowConfig } = require('./src');

// Load workflow for organization
const workflow = await workflowConfig.loadWorkflow('org-id', supabase);

// Get current stage for a section
const currentStage = await workflowConfig.getCurrentStage('section-id', supabase);

// Check if can transition
const canTransition = await workflowConfig.canTransition(
  'section-id',
  'next-stage-id',
  'user-id',
  supabase
);

if (canTransition.allowed) {
  // Transition to next stage
  await workflowConfig.transitionStage(
    'section-id',
    'stage-id',
    'user-id',
    'Approval notes',
    supabase
  );
}
```

#### 6. Validate Configuration

```javascript
const { configSchema } = require('./src');

// Validate organization config
const result = configSchema.validateOrganizationConfig(configData);

if (result.valid) {
  console.log('Config is valid:', result.value);
} else {
  console.log('Validation errors:');
  result.errors.forEach(err => {
    console.log(`  - ${err.field}: ${err.message}`);
  });
}
```

### Using Example Configurations

Three example configurations are provided:

#### 1. Default Organization
```javascript
const fs = require('fs');
const config = JSON.parse(
  fs.readFileSync('./config/examples/organization.example.json', 'utf-8')
);
```

#### 2. Corporate Bylaws
```javascript
const config = JSON.parse(
  fs.readFileSync('./config/examples/corporate-bylaws.json', 'utf-8')
);
```

#### 3. Academic Policy
```javascript
const config = JSON.parse(
  fs.readFileSync('./config/examples/academic-policy.json', 'utf-8')
);
```

### Creating a Custom Configuration

#### Option 1: JSON File

Create `/config/organization.json`:
```json
{
  "organizationName": "My Organization",
  "organizationType": "custom",
  "hierarchy": {
    "levels": [
      {
        "name": "Chapter",
        "type": "chapter",
        "numbering": "numeric",
        "prefix": "Chapter ",
        "depth": 0
      },
      {
        "name": "Section",
        "type": "section",
        "numbering": "alpha",
        "prefix": "",
        "depth": 1
      }
    ]
  },
  "workflow": {
    "stages": [
      {
        "name": "Draft",
        "order": 1,
        "color": "#87CEEB"
      },
      {
        "name": "Review",
        "order": 2,
        "color": "#FFD700"
      },
      {
        "name": "Approved",
        "order": 3,
        "color": "#90EE90"
      }
    ]
  }
}
```

#### Option 2: Environment Variables

Set in `.env`:
```bash
ORG_NAME=My Organization
ORG_TYPE=custom
WORKFLOW_STAGES='[{"name":"Draft","order":1}]'
```

#### Option 3: Database

Store in Supabase `organizations` table:
```sql
INSERT INTO organizations (name, settings, hierarchy_config)
VALUES (
  'My Organization',
  '{"display": {"theme": "dark"}}'::jsonb,
  '{"levels": [...]}'::jsonb
);
```

### Integration with Express/Server.js

#### Add Middleware

```javascript
const { organizationConfig } = require('./src');

// Load organization config for each request
app.use(async (req, res, next) => {
  const orgId = req.headers['x-organization-id'] || 'default';
  req.orgConfig = await organizationConfig.loadConfig(orgId, req.supabase);
  next();
});
```

#### Add Parser Endpoint

```javascript
const { wordParser } = require('./src');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/api/documents/parse', upload.single('file'), async (req, res) => {
  try {
    const result = await wordParser.parseDocument(
      req.file.path,
      req.orgConfig
    );

    if (result.success) {
      res.json({
        success: true,
        sections: result.sections,
        preview: wordParser.generatePreview(result.sections, 5)
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### Add Workflow Endpoint

```javascript
const { workflowConfig } = require('./src');

app.get('/api/workflow/stages', async (req, res) => {
  const workflow = await workflowConfig.loadWorkflow(
    req.orgConfig.organizationId,
    req.supabase
  );

  res.json({ stages: workflow.stages });
});

app.post('/api/sections/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { stageId, notes } = req.body;

  const result = await workflowConfig.transitionStage(
    id,
    stageId,
    req.user.id,
    notes,
    req.supabase
  );

  res.json(result);
});
```

### Common Tasks

#### Task: Detect Document Structure

```javascript
const { hierarchyDetector } = require('./src');

// Read document text
const text = fs.readFileSync('document.txt', 'utf-8');

// Infer hierarchy (no config needed)
const detected = hierarchyDetector.inferHierarchy(text);

// Suggest configuration
const suggested = hierarchyDetector.suggestHierarchyConfig(detected);

console.log('Suggested levels:', suggested.levels);
```

#### Task: Convert Between Numbering Schemes

```javascript
const { numberingSchemes } = require('./src');

// Roman to numeric
const num = numberingSchemes.fromRoman('XLII'); // 42

// Numeric to alpha
const alpha = numberingSchemes.toAlpha(3, false); // "C"

// Validate format
const valid = numberingSchemes.validate('XIV', 'roman'); // true
```

#### Task: Build Section Tree

```javascript
const { hierarchyDetector } = require('./src');

// Flat list of sections
const sections = [ /* parsed sections */ ];

// Build tree
const tree = hierarchyDetector.buildHierarchyTree(sections);

// Tree now has parent-child relationships
console.log(tree[0].children);
```

#### Task: Cache Management

```javascript
const { organizationConfig, workflowConfig } = require('./src');

// Clear specific organization cache
organizationConfig.clearCache('org-id');

// Clear all organization caches
organizationConfig.clearCache();

// Clear workflow cache
workflowConfig.clearCache('org-id');
```

### Error Handling

All modules include comprehensive error handling:

```javascript
try {
  const result = await wordParser.parseDocument(filePath, config);

  if (!result.success) {
    console.error('Parse failed:', result.error);
    // Handle parsing error
  }
} catch (error) {
  console.error('Unexpected error:', error);
  // Handle unexpected error
}
```

### Testing

#### Unit Test Example

```javascript
const { numberingSchemes } = require('./src');
const assert = require('assert');

describe('Numbering Schemes', () => {
  it('should convert Roman numerals', () => {
    assert.strictEqual(numberingSchemes.toRoman(14), 'XIV');
    assert.strictEqual(numberingSchemes.fromRoman('XIV'), 14);
  });

  it('should handle alphabetic', () => {
    assert.strictEqual(numberingSchemes.toAlpha(1, false), 'A');
    assert.strictEqual(numberingSchemes.fromAlpha('A', false), 1);
  });
});
```

#### Integration Test Example

```javascript
const { wordParser, organizationConfig } = require('./src');

describe('Word Parser Integration', () => {
  it('should parse a real document', async () => {
    const config = await organizationConfig.loadConfig('test-org', supabase);
    const result = await wordParser.parseDocument('./test/sample.docx', config);

    assert(result.success);
    assert(result.sections.length > 0);
  });
});
```

### Debugging

Enable detailed logging:

```javascript
process.env.DEBUG = 'tracker:*';

// Or set specific debug levels
process.env.DEBUG_LEVEL = 'verbose';
```

### Performance Tips

1. **Cache configurations**: Configurations are automatically cached
2. **Batch operations**: Parse multiple sections together
3. **Lazy validation**: Skip validation in production if performance is critical
4. **Pre-compile patterns**: Reuse regex patterns for large documents

### Security Checklist

- [ ] Validate all user input
- [ ] Sanitize file paths
- [ ] Use Supabase RLS policies
- [ ] Validate configuration before saving
- [ ] Check user permissions before transitions
- [ ] Audit configuration changes

### Next Steps

1. Review `/src/README.md` for detailed documentation
2. Check `IMPLEMENTATION_SUMMARY.md` for architecture details
3. Review example configurations in `/config/examples/`
4. Run tests to verify installation
5. Integrate with your Express server

### Support

For questions or issues:
1. Check `/src/README.md` for detailed docs
2. Review `IMPLEMENTATION_SUMMARY.md` for architecture
3. Examine example configurations
4. Look at inline JSDoc comments in source files

---

**Version**: 2.0.0
**Last Updated**: 2025-10-07
**Status**: Ready for Integration
