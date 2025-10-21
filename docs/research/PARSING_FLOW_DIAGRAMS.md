# Parsing Flow Diagrams
**Visual Guide to Document Processing**

## 1️⃣ Setup Wizard Flow (Initial Organization Creation)

```
┌─────────────────────────────────────────────────────────────┐
│                    SETUP WIZARD FLOW                        │
└─────────────────────────────────────────────────────────────┘

USER ACTION:
  Upload document in /setup/import
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /setup/import                                          │
│ File: src/routes/setup.js:314                              │
│                                                             │
│ • multer.single('document') processes upload               │
│ • Stores file in /uploads/setup/                           │
│ • Saves importData to req.session.setupData.import         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ ASYNC PROCESSING via setImmediate()                        │
│ File: src/routes/setup.js:362-388                          │
│                                                             │
│ • User sees "Processing..." screen                         │
│ • Polling /setup/status for updates                        │
│ • Errors stored in session                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ processSetupData(setupData, supabase)                      │
│ File: src/routes/setup.js:554-843                          │
│                                                             │
│ Step 1: Create organization (line 583-740)                 │
│   • Insert into organizations table                        │
│   • 🚨 STORES OLD 2-LEVEL SCHEMA:                          │
│     {                                                       │
│       structure_type: 'standard',                          │
│       level1_name: 'Article',                              │
│       level2_name: 'Section',                              │
│       numbering_style: 'roman'                             │
│     }                                                       │
│   • Create workflow template                               │
│   • Link user to organization                              │
│                                                             │
│ Step 2: Process import (line 754-814)                      │
│   ├─→ Check if file uploaded                               │
│   ├─→ Call setupService.processDocumentImport()           │
│   └─→ Store sections in database                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ setupService.processDocumentImport()                        │
│ File: src/services/setupService.js:176-292                 │
│                                                             │
│ STEP 1: Load organization config (line 179)                │
│   organizationConfig.loadConfig(orgId, supabase)           │
│         │                                                   │
│         ▼                                                   │
│   ┌──────────────────────────────────────┐                 │
│   │ organizationConfig.js:309-376        │                 │
│   │                                      │                 │
│   │ • Query organizations table          │                 │
│   │ • Read hierarchy_config field        │                 │
│   │ • Validate schema:                   │                 │
│   │   ❌ FAILS: Missing type, depth      │                 │
│   │ • Fall back to defaults              │                 │
│   │                                      │                 │
│   │ RESULT: 10-level default hierarchy   │                 │
│   └──────────────┬───────────────────────┘                 │
│                  │                                          │
│                  ▼                                          │
│ STEP 2: Parse document (line 192)                          │
│   wordParser.parseDocument(filePath, config)               │
│         │                                                   │
│         ▼                                                   │
│   ┌──────────────────────────────────────┐                 │
│   │ wordParser.js:18-88                  │                 │
│   │                                      │                 │
│   │ • Read .docx with mammoth            │                 │
│   │ • Detect hierarchy patterns          │                 │
│   │ • 🚨 USES DEFAULT HIERARCHY          │                 │
│   │   (ignores user's level names!)      │                 │
│   │ • Parse sections                     │                 │
│   │ • Return sections array              │                 │
│   └──────────────┬───────────────────────┘                 │
│                  │                                          │
│                  ▼                                          │
│ STEP 3: Validate sections (line 202)                       │
│   wordParser.validateSections(sections, config)            │
│                                                             │
│ STEP 4: Create document record (line 214-228)              │
│   INSERT INTO documents (...)                              │
│                                                             │
│ STEP 5: Store sections (line 239-244)                      │
│   sectionStorage.storeSections(orgId, docId, sections)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

RESULT:
  ✅ Document parsed successfully
  ✅ Sections stored in database
  ⚠️  User's custom level names IGNORED
  ⚠️  Default names used instead
```

---

## 2️⃣ Document Upload Flow (After Setup)

```
┌─────────────────────────────────────────────────────────────┐
│                  DOCUMENT UPLOAD FLOW                       │
└─────────────────────────────────────────────────────────────┘

USER ACTION:
  Upload document in admin dashboard
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /admin/documents/upload                                │
│ File: src/routes/admin.js:461-600                          │
│                                                             │
│ • multer.single('document') processes upload               │
│ • Stores file in /uploads/documents/                       │
│ • Validates organization access                            │
│ • Checks user role (admin/owner/superuser)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ SYNCHRONOUS PROCESSING (user waits)                        │
│ File: src/routes/admin.js:507-599                          │
│                                                             │
│ • Direct await - no async processing                       │
│ • Response sent immediately                                │
│ • Error handling inline                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ setupService.processDocumentImport()                        │
│ File: src/services/setupService.js:176-292                 │
│                                                             │
│ STEP 1: Load organization config (line 179)                │
│   organizationConfig.loadConfig(orgId, supabase)           │
│         │                                                   │
│         ▼                                                   │
│   ┌──────────────────────────────────────┐                 │
│   │ organizationConfig.js:309-376        │                 │
│   │                                      │                 │
│   │ • Query organizations table          │                 │
│   │ • Read hierarchy_config field        │                 │
│   │ • Validate schema:                   │                 │
│   │   ✅ IF admin edited via Phase 2 UI: │                 │
│   │      Valid 10-level schema found     │                 │
│   │   ❌ IF never edited:                │                 │
│   │      Still has old 2-level schema    │                 │
│   │      Falls back to defaults          │                 │
│   │                                      │                 │
│   │ RESULT: Organization-specific config │                 │
│   │         OR defaults if schema invalid│                 │
│   └──────────────┬───────────────────────┘                 │
│                  │                                          │
│                  ▼                                          │
│ STEP 2: Parse document (line 192)                          │
│   wordParser.parseDocument(filePath, config)               │
│         │                                                   │
│         ▼                                                   │
│   ┌──────────────────────────────────────┐                 │
│   │ wordParser.js:18-88                  │                 │
│   │                                      │                 │
│   │ • Read .docx with mammoth            │                 │
│   │ • Detect hierarchy patterns          │                 │
│   │ • ✅ Uses org config if valid        │                 │
│   │ • ⚠️  Uses defaults if invalid       │                 │
│   │ • Parse sections                     │                 │
│   │ • Return sections array              │                 │
│   └──────────────┬───────────────────────┘                 │
│                  │                                          │
│                  ▼                                          │
│ STEP 3: Validate sections (line 202)                       │
│   wordParser.validateSections(sections, config)            │
│                                                             │
│ STEP 4: Create document record (line 214-228)              │
│   INSERT INTO documents (...)                              │
│                                                             │
│ STEP 5: Store sections (line 239-244)                      │
│   sectionStorage.storeSections(orgId, docId, sections)     │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Response to User                                            │
│                                                             │
│ SUCCESS:                                                    │
│   {                                                         │
│     success: true,                                          │
│     document: { id, title, sectionsCount },                │
│     warnings: [...]                                         │
│   }                                                         │
│                                                             │
│ ERROR:                                                      │
│   {                                                         │
│     success: false,                                         │
│     error: "...",                                           │
│     validationErrors: [...],                               │
│     warnings: [...]                                         │
│   }                                                         │
└─────────────────────────────────────────────────────────────┘

RESULT:
  ✅ Document parsed successfully
  ✅ Sections stored in database
  ✅ Uses org config if admin edited hierarchy
  ⚠️  Falls back to defaults if never edited
```

---

## 3️⃣ Configuration Flow: Where Does Hierarchy Come From?

```
┌─────────────────────────────────────────────────────────────┐
│          HIERARCHY CONFIGURATION PRIORITY                   │
└─────────────────────────────────────────────────────────────┘

organizationConfig.loadConfig(orgId, supabase)
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│ PRIORITY 1: Check Cache                                     │
│   • Has this org ID been loaded before?                     │
│   • Yes → Return cached config                              │
│   • No → Continue loading                                   │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ PRIORITY 2: Load Defaults                                   │
│   getDefaultConfig()                                         │
│                                                              │
│   Returns 10-level hierarchy:                               │
│   • Article (depth 0, roman)                                │
│   • Section (depth 1, numeric)                              │
│   • Subsection (depth 2, numeric)                           │
│   • Paragraph (depth 3, alpha)                              │
│   • ... up to depth 9                                       │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ PRIORITY 3: Load from File (if exists)                      │
│   • Check: config/{orgId}.json                              │
│   • Check: config/organization.json                         │
│   • Merge with defaults                                     │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ PRIORITY 4: Load from Environment Variables                 │
│   • ORG_NAME, ORG_TYPE                                      │
│   • WORKFLOW_STAGES                                         │
│   • Merge with existing config                              │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ PRIORITY 5: Load from Database (HIGHEST PRIORITY)           │
│   Query: SELECT hierarchy_config FROM organizations         │
│          WHERE id = {orgId}                                  │
│                                                              │
│   🔍 VALIDATION:                                            │
│   ├─→ Is hierarchy_config present?                          │
│   ├─→ Is it a valid array of levels?                        │
│   ├─→ Does each level have:                                 │
│   │     • type field?                                       │
│   │     • depth field?                                      │
│   │     • numbering field?                                  │
│   │                                                          │
│   ✅ VALID SCHEMA:                                          │
│   {                                                          │
│     levels: [                                                │
│       { name: 'Chapter', type: 'article',                   │
│         depth: 0, numbering: 'roman', prefix: 'Chapter ' }, │
│       { name: 'Clause', type: 'section',                    │
│         depth: 1, numbering: 'numeric', prefix: 'Clause ' } │
│       // ... up to 10 levels                                │
│     ],                                                       │
│     maxDepth: 10                                             │
│   }                                                          │
│   → USE THIS CONFIG                                         │
│                                                              │
│   ❌ INVALID SCHEMA (OLD FORMAT):                           │
│   {                                                          │
│     structure_type: 'standard',                             │
│     level1_name: 'Article',                                 │
│     level2_name: 'Section',                                 │
│     numbering_style: 'roman'                                │
│   }                                                          │
│   → VALIDATION FAILS (missing type, depth)                  │
│   → FALL BACK TO DEFAULTS                                   │
│                                                              │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│ RESULT: Merged Configuration                                │
│                                                              │
│ Hierarchy used for parsing:                                 │
│ • Database config (if valid)                                │
│ • OR defaults (if invalid/missing)                          │
│                                                              │
│ Cached for future requests                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ Schema Comparison: Old vs New

```
┌─────────────────────────────────────────────────────────────┐
│            SETUP WIZARD: WHAT IT STORES                     │
│                    (OLD FORMAT)                             │
└─────────────────────────────────────────────────────────────┘

File: src/routes/setup.js:612-622

hierarchy_config = {
  structure_type: 'standard',      ← ❌ Not used by parser
  level1_name: 'Article',          ← User's choice
  level2_name: 'Section',          ← User's choice
  numbering_style: 'roman'         ← User's choice
}

✅ STORES: User choices
❌ PROBLEM: Wrong format for parser
❌ MISSING: type, depth, numbering fields per level
❌ MISSING: Levels 3-10


┌─────────────────────────────────────────────────────────────┐
│             PARSER: WHAT IT EXPECTS                         │
│                    (NEW FORMAT)                             │
└─────────────────────────────────────────────────────────────┘

File: src/config/organizationConfig.js:69-143

hierarchy = {
  levels: [
    {
      name: 'Article',           ← Level display name
      type: 'article',           ← ✅ Type identifier (REQUIRED)
      depth: 0,                  ← ✅ Nesting level (REQUIRED)
      numbering: 'roman',        ← ✅ Numbering style (REQUIRED)
      prefix: 'Article '         ← Display prefix
    },
    {
      name: 'Section',
      type: 'section',
      depth: 1,
      numbering: 'numeric',
      prefix: 'Section '
    },
    // ... 8 more levels (depth 2-9)
  ],
  maxDepth: 10,                  ← Max nesting allowed
  allowNesting: true             ← Enable hierarchical parsing
}

✅ EXPECTS: Complete 10-level schema
✅ REQUIRES: type, depth, numbering per level
✅ VALIDATES: All required fields present


┌─────────────────────────────────────────────────────────────┐
│              WHAT HAPPENS ON MISMATCH                       │
└─────────────────────────────────────────────────────────────┘

1. organizationConfig.loadConfig() reads old format from DB
2. Validation checks:
   ├─→ hierarchy_config.levels exists? ❌ NO
   ├─→ OR levels[0].type exists? ❌ NO
   ├─→ OR levels[0].depth exists? ❌ NO
   └─→ CONCLUSION: Invalid schema

3. Fall back to defaults:
   dbConfig.hierarchy = defaultConfig.hierarchy

4. Parser receives default 10-level hierarchy:
   • "Article" / "Section" / "Subsection" / ...
   • User's custom names ("Chapter", "Clause") IGNORED

5. Result:
   ✅ Parsing works (uses defaults)
   ❌ User choices lost
   ⚠️  Silent failure (no error, just wrong names)
```

---

## 5️⃣ Fix Flow: What Needs to Change

```
┌─────────────────────────────────────────────────────────────┐
│                  CURRENT (BROKEN)                           │
└─────────────────────────────────────────────────────────────┘

Setup Wizard:
  User chooses:
    level1_name = "Chapter"
    level2_name = "Clause"
    numbering_style = "roman"
         ↓
  Stored as:
    {
      structure_type: 'standard',
      level1_name: 'Chapter',
      level2_name: 'Clause',
      numbering_style: 'roman'
    }
         ↓
  Parser reads config:
    ❌ Validation fails
    ⚠️  Falls back to defaults
         ↓
  Result:
    Sections parsed with "Article" and "Section"
    User's choices IGNORED


┌─────────────────────────────────────────────────────────────┐
│                   FIXED (CORRECT)                           │
└─────────────────────────────────────────────────────────────┘

Setup Wizard:
  User chooses:
    level1_name = "Chapter"
    level2_name = "Clause"
    numbering_style = "roman"
         ↓
  Convert to 10-level schema:
    {
      levels: [
        {
          name: 'Chapter',         ← User's choice
          type: 'article',
          depth: 0,
          numbering: 'roman',      ← User's choice
          prefix: 'Chapter '
        },
        {
          name: 'Clause',          ← User's choice
          type: 'section',
          depth: 1,
          numbering: 'numeric',
          prefix: 'Clause '
        },
        // ... default levels 2-9
      ],
      maxDepth: 10,
      allowNesting: true
    }
         ↓
  Parser reads config:
    ✅ Validation passes
    ✅ Uses organization-specific config
         ↓
  Result:
    Sections parsed with "Chapter" and "Clause"
    User's choices RESPECTED ✅
```

---

## Summary

### ✅ What's Working

1. **Both flows use same processing logic**
   - `setupService.processDocumentImport()`
   - Same parser, same validation, same storage

2. **Configuration loader has good safety nets**
   - Validates schema before using
   - Falls back to defaults on invalid data
   - Prevents crashes from bad config

3. **Architecture is clean**
   - Single responsibility principle
   - Easy to test and maintain

### ❌ What's Broken

1. **Setup wizard stores wrong schema format**
   - Old 2-level format
   - Missing required fields (type, depth)
   - Only 2 levels instead of 10

2. **User choices ignored during setup**
   - Custom level names not used
   - Falls back to "Article" and "Section"
   - Silent failure (no error shown)

3. **Inconsistent experience**
   - Setup: Uses defaults
   - Upload after editing: Uses custom config
   - Confusing for users

### 🔧 The Fix

**File to change:** `/src/routes/setup.js:612-622`

**Change:** Convert user choices to 10-level schema format

**Result:** User's custom names used immediately during setup

**Impact:** Minimal - just reformatting existing data into correct structure
