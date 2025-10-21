# Parsing Unification Recommendations
**Blacksmith Implementation Guide**

## Quick Summary

✅ **Good news:** Both flows already use the same parsing code!
🚨 **Problem:** Setup wizard stores config in wrong format.
🔧 **Fix:** Convert user choices to 10-level schema format.
⏱️ **Effort:** ~30 minutes to implement and test.

---

## The Fix: Step-by-Step

### File to Change

**Location:** `/src/routes/setup.js`
**Lines:** 612-622
**Function:** `processSetupData()` → case 'organization'

### Current Code (BROKEN)

```javascript
// Line 612-622
const hierarchyConfig = setupData.documentType ? {
  structure_type: setupData.documentType.structure_type || 'standard',
  level1_name: setupData.documentType.level1_name || 'Article',
  level2_name: setupData.documentType.level2_name || 'Section',
  numbering_style: setupData.documentType.numbering_style || 'roman'
} : {
  structure_type: 'standard',
  level1_name: 'Article',
  level2_name: 'Section',
  numbering_style: 'roman'
};
```

### New Code (FIXED)

```javascript
// Import the organization config module for defaults
const organizationConfig = require('../config/organizationConfig');

// Build complete 10-level hierarchy from user choices
const hierarchyConfig = (() => {
  // Get user choices from setup wizard
  const level1Name = setupData.documentType?.level1_name || 'Article';
  const level2Name = setupData.documentType?.level2_name || 'Section';
  const numberingStyle = setupData.documentType?.numbering_style || 'roman';

  // Get default 10-level hierarchy
  const defaultHierarchy = organizationConfig.getDefaultConfig().hierarchy;

  // Customize first 2 levels with user choices, keep defaults for levels 3-10
  return {
    levels: [
      // Level 0: Customize with user's choice
      {
        name: level1Name,
        type: 'article',
        numbering: numberingStyle,
        prefix: `${level1Name} `,
        depth: 0
      },
      // Level 1: Customize with user's choice
      {
        name: level2Name,
        type: 'section',
        numbering: 'numeric',
        prefix: `${level2Name} `,
        depth: 1
      },
      // Levels 2-9: Use defaults
      ...defaultHierarchy.levels.slice(2)
    ],
    maxDepth: 10,
    allowNesting: true
  };
})();
```

### Full Context in File

```javascript
// Line 583-646 (complete organization creation block)
case 'organization':
  console.log('[SETUP-DEBUG] 🏢 Processing organization step');

  const orgData = setupData.organization;
  const adminUser = setupData.adminUser;

  // IDEMPOTENCY CHECK: Skip if organization already created
  if (setupData.organizationId) {
    console.log('[SETUP-DEBUG] ⏭️  Organization already created');
    break;
  }

  if (orgData && adminUser) {
    // Generate unique slug
    const baseSlug = orgData.organization_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const timestamp = Date.now().toString(36);
    const slug = `${baseSlug}-${timestamp}`;

    // ✅ FIX: Build 10-level hierarchy from user choices
    const organizationConfig = require('../config/organizationConfig');

    const hierarchyConfig = (() => {
      const level1Name = setupData.documentType?.level1_name || 'Article';
      const level2Name = setupData.documentType?.level2_name || 'Section';
      const numberingStyle = setupData.documentType?.numbering_style || 'roman';
      const defaultHierarchy = organizationConfig.getDefaultConfig().hierarchy;

      return {
        levels: [
          {
            name: level1Name,
            type: 'article',
            numbering: numberingStyle,
            prefix: `${level1Name} `,
            depth: 0
          },
          {
            name: level2Name,
            type: 'section',
            numbering: 'numeric',
            prefix: `${level2Name} `,
            depth: 1
          },
          ...defaultHierarchy.levels.slice(2)
        ],
        maxDepth: 10,
        allowNesting: true
      };
    })();

    console.log('[SETUP-DEBUG] 📋 hierarchy_config to save:',
      JSON.stringify(hierarchyConfig, null, 2));

    // Insert organization with correct schema
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: orgData.organization_name,
        slug: slug,
        organization_type: orgData.organization_type,
        state: orgData.state,
        country: orgData.country,
        contact_email: orgData.contact_email,
        logo_url: orgData.logo_path,
        hierarchy_config: hierarchyConfig,  // ← Now correct format!
        is_configured: true
      })
      .select()
      .single();

    if (error) throw error;

    setupData.organizationId = data.id;

    // ... rest of organization creation (workflow, user linking)
  }
  break;
```

---

## Why This Fix Works

### Before Fix

1. User chooses: "Chapter", "Clause", "roman"
2. Setup wizard stores:
   ```json
   {
     "structure_type": "standard",
     "level1_name": "Chapter",
     "level2_name": "Clause",
     "numbering_style": "roman"
   }
   ```
3. organizationConfig.loadConfig() validates:
   - ❌ Missing `levels` array
   - ❌ Missing `type` field
   - ❌ Missing `depth` field
   - ⚠️  **Falls back to defaults**
4. Parser uses: "Article" and "Section" (**wrong!**)

### After Fix

1. User chooses: "Chapter", "Clause", "roman"
2. Setup wizard stores:
   ```json
   {
     "levels": [
       {
         "name": "Chapter",
         "type": "article",
         "depth": 0,
         "numbering": "roman",
         "prefix": "Chapter "
       },
       {
         "name": "Clause",
         "type": "section",
         "depth": 1,
         "numbering": "numeric",
         "prefix": "Clause "
       },
       // ... 8 more default levels
     ],
     "maxDepth": 10,
     "allowNesting": true
   }
   ```
3. organizationConfig.loadConfig() validates:
   - ✅ Has `levels` array
   - ✅ Each level has `type`, `depth`, `numbering`
   - ✅ **Validation passes**
4. Parser uses: "Chapter" and "Clause" (**correct!**)

---

## Additional Changes (Optional but Recommended)

### 1. Add Helper Function for Reusability

**File:** `/src/config/organizationConfig.js`
**Add after line 240:**

```javascript
/**
 * Build 10-level hierarchy from user's top 2 level choices
 * @param {string} level1Name - User's name for level 1 (default: 'Article')
 * @param {string} level2Name - User's name for level 2 (default: 'Section')
 * @param {string} numberingStyle - Numbering style (roman/numeric/alpha)
 * @returns {Object} Complete 10-level hierarchy config
 */
buildHierarchyFromUserChoices(level1Name = 'Article', level2Name = 'Section', numberingStyle = 'roman') {
  const defaultHierarchy = this.getDefaultConfig().hierarchy;

  return {
    levels: [
      {
        name: level1Name,
        type: 'article',
        numbering: numberingStyle,
        prefix: `${level1Name} `,
        depth: 0
      },
      {
        name: level2Name,
        type: 'section',
        numbering: 'numeric',
        prefix: `${level2Name} `,
        depth: 1
      },
      ...defaultHierarchy.levels.slice(2)
    ],
    maxDepth: 10,
    allowNesting: true
  };
}
```

**Then in setup.js:**

```javascript
const organizationConfig = require('../config/organizationConfig');

const hierarchyConfig = organizationConfig.buildHierarchyFromUserChoices(
  setupData.documentType?.level1_name,
  setupData.documentType?.level2_name,
  setupData.documentType?.numbering_style
);
```

### 2. Add Migration for Existing Organizations

**File:** `/database/migrations/021_fix_old_hierarchy_schemas.sql`

```sql
-- Migration: Convert old 2-level hierarchy schemas to new 10-level format
-- Date: 2025-10-18
-- Purpose: Fix organizations created with old setup wizard

-- Find organizations with old schema format
DO $$
DECLARE
  org RECORD;
  new_hierarchy JSONB;
  level1_name TEXT;
  level2_name TEXT;
  numbering_style TEXT;
BEGIN
  FOR org IN
    SELECT id, hierarchy_config
    FROM organizations
    WHERE hierarchy_config IS NOT NULL
      AND hierarchy_config->>'structure_type' IS NOT NULL
      AND hierarchy_config->'levels' IS NULL
  LOOP
    -- Extract old values
    level1_name := COALESCE(org.hierarchy_config->>'level1_name', 'Article');
    level2_name := COALESCE(org.hierarchy_config->>'level2_name', 'Section');
    numbering_style := COALESCE(org.hierarchy_config->>'numbering_style', 'roman');

    -- Build new 10-level schema
    new_hierarchy := jsonb_build_object(
      'levels', jsonb_build_array(
        -- Level 0: User's choice
        jsonb_build_object(
          'name', level1_name,
          'type', 'article',
          'numbering', numbering_style,
          'prefix', level1_name || ' ',
          'depth', 0
        ),
        -- Level 1: User's choice
        jsonb_build_object(
          'name', level2_name,
          'type', 'section',
          'numbering', 'numeric',
          'prefix', level2_name || ' ',
          'depth', 1
        ),
        -- Level 2-9: Defaults
        jsonb_build_object('name', 'Subsection', 'type', 'subsection', 'numbering', 'numeric', 'prefix', '', 'depth', 2),
        jsonb_build_object('name', 'Paragraph', 'type', 'paragraph', 'numbering', 'alpha', 'prefix', '(', 'depth', 3),
        jsonb_build_object('name', 'Subparagraph', 'type', 'subparagraph', 'numbering', 'numeric', 'prefix', '', 'depth', 4),
        jsonb_build_object('name', 'Clause', 'type', 'clause', 'numbering', 'alphaLower', 'prefix', '(', 'depth', 5),
        jsonb_build_object('name', 'Subclause', 'type', 'subclause', 'numbering', 'roman', 'prefix', '', 'depth', 6),
        jsonb_build_object('name', 'Item', 'type', 'item', 'numbering', 'numeric', 'prefix', '•', 'depth', 7),
        jsonb_build_object('name', 'Subitem', 'type', 'subitem', 'numbering', 'alpha', 'prefix', '◦', 'depth', 8),
        jsonb_build_object('name', 'Point', 'type', 'point', 'numbering', 'numeric', 'prefix', '-', 'depth', 9)
      ),
      'maxDepth', 10,
      'allowNesting', true
    );

    -- Update organization
    UPDATE organizations
    SET
      hierarchy_config = new_hierarchy,
      updated_at = NOW()
    WHERE id = org.id;

    RAISE NOTICE 'Migrated organization % (% → %)',
      org.id, level1_name, level2_name;
  END LOOP;
END $$;
```

### 3. Add Validation Test

**File:** `/tests/unit/setup-hierarchy-config.test.js`

```javascript
const organizationConfig = require('../../src/config/organizationConfig');

describe('Setup Wizard Hierarchy Config', () => {
  test('buildHierarchyFromUserChoices creates valid 10-level schema', () => {
    const hierarchy = organizationConfig.buildHierarchyFromUserChoices(
      'Chapter',
      'Clause',
      'roman'
    );

    // Check structure
    expect(hierarchy).toHaveProperty('levels');
    expect(hierarchy.levels).toHaveLength(10);
    expect(hierarchy.maxDepth).toBe(10);
    expect(hierarchy.allowNesting).toBe(true);

    // Check first level (user's choice)
    expect(hierarchy.levels[0].name).toBe('Chapter');
    expect(hierarchy.levels[0].type).toBe('article');
    expect(hierarchy.levels[0].numbering).toBe('roman');
    expect(hierarchy.levels[0].prefix).toBe('Chapter ');
    expect(hierarchy.levels[0].depth).toBe(0);

    // Check second level (user's choice)
    expect(hierarchy.levels[1].name).toBe('Clause');
    expect(hierarchy.levels[1].type).toBe('section');
    expect(hierarchy.levels[1].numbering).toBe('numeric');
    expect(hierarchy.levels[1].prefix).toBe('Clause ');
    expect(hierarchy.levels[1].depth).toBe(1);

    // Check remaining levels are defaults
    expect(hierarchy.levels[2].name).toBe('Subsection');
    expect(hierarchy.levels[2].depth).toBe(2);

    // Validate all levels have required fields
    hierarchy.levels.forEach((level, i) => {
      expect(level).toHaveProperty('name');
      expect(level).toHaveProperty('type');
      expect(level).toHaveProperty('numbering');
      expect(level).toHaveProperty('prefix');
      expect(level.depth).toBe(i);
    });
  });

  test('defaults work when user choices not provided', () => {
    const hierarchy = organizationConfig.buildHierarchyFromUserChoices();

    expect(hierarchy.levels[0].name).toBe('Article');
    expect(hierarchy.levels[1].name).toBe('Section');
    expect(hierarchy.levels[0].numbering).toBe('roman');
  });

  test('validator accepts new schema format', () => {
    const hierarchy = organizationConfig.buildHierarchyFromUserChoices(
      'Part',
      'Division',
      'numeric'
    );

    // Simulate what loadConfig() does
    const hasValidHierarchy =
      hierarchy &&
      hierarchy.levels &&
      Array.isArray(hierarchy.levels) &&
      hierarchy.levels.length > 0 &&
      hierarchy.levels.every(level =>
        level.type !== undefined &&
        level.depth !== undefined &&
        level.numbering !== undefined
      );

    expect(hasValidHierarchy).toBe(true);
  });
});
```

---

## Testing Checklist

### Manual Testing

- [ ] **Test 1: Fresh Setup with Default Names**
  1. Clear database
  2. Run setup wizard
  3. Use defaults ("Article", "Section", "Roman")
  4. Upload bylaws document
  5. Verify sections parsed with "Article" and "Section"

- [ ] **Test 2: Fresh Setup with Custom Names**
  1. Clear database
  2. Run setup wizard
  3. Choose custom names ("Chapter", "Clause", "Numeric")
  4. Upload bylaws document
  5. **Expected:** Sections parsed with "Chapter" and "Clause"
  6. **Bug if:** Falls back to "Article" and "Section"

- [ ] **Test 3: Document Upload After Setup**
  1. Complete setup (with custom names)
  2. Upload second document via admin panel
  3. Verify same hierarchy used

- [ ] **Test 4: Migration of Existing Organizations**
  1. Run migration script
  2. Check organizations table
  3. Verify old schemas converted to new format
  4. Upload new document to migrated org
  5. Verify correct hierarchy used

### Automated Testing

```bash
# Run the new test
npm test -- tests/unit/setup-hierarchy-config.test.js

# Run existing parser tests (should all still pass)
npm test -- tests/unit/wordParser.edge-cases.test.js

# Run setup integration tests
npm test -- tests/integration/setup-flow.test.js
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code review: Verify fix in `/src/routes/setup.js`
- [ ] Run unit tests: All tests pass
- [ ] Run integration tests: Setup flow works
- [ ] Test locally: Fresh setup with custom names
- [ ] Test locally: Document upload after setup

### Deployment

- [ ] Merge fix to main branch
- [ ] Deploy to staging environment
- [ ] Run migration script on staging
- [ ] Test on staging: Fresh setup
- [ ] Test on staging: Document upload
- [ ] Deploy to production
- [ ] Run migration script on production
- [ ] Monitor logs for errors

### Post-Deployment

- [ ] Verify existing organizations work
- [ ] Create test organization with custom names
- [ ] Upload test document
- [ ] Check sections in database
- [ ] Verify hierarchy config format

---

## Rollback Plan

If the fix causes issues:

### Immediate Rollback

```sql
-- Revert hierarchy_config to old format (emergency only!)
UPDATE organizations
SET hierarchy_config = jsonb_build_object(
  'structure_type', 'standard',
  'level1_name', hierarchy_config->'levels'->0->>'name',
  'level2_name', hierarchy_config->'levels'->1->>'name',
  'numbering_style', hierarchy_config->'levels'->0->>'numbering'
)
WHERE hierarchy_config->'levels' IS NOT NULL;
```

### Code Rollback

```bash
# Revert the commit
git revert <commit-hash>

# Or roll back to previous version
git reset --hard <previous-commit>
git push --force
```

---

## Success Metrics

After deployment, verify:

1. **No more default fallbacks**
   - Check logs for: `[CONFIG-DEBUG] ⚠️  Database hierarchy incomplete`
   - Should not appear for new organizations

2. **User choices respected**
   - Create org with "Chapter" / "Clause"
   - Verify parsed sections use those names

3. **No parsing errors**
   - Monitor error logs
   - Should not see validation failures

4. **Backward compatibility**
   - Existing organizations still work
   - Migrated organizations use custom names

---

## Communication Plan

### Developer Team

```
SETUP WIZARD FIX DEPLOYED

WHAT CHANGED:
- Setup wizard now stores hierarchy config in correct format
- User's custom level names now respected immediately
- Migration script updates existing organizations

IMPACT:
- No breaking changes
- Existing code still works
- New organizations get better hierarchy support

TESTING:
- All existing tests pass
- New test added for hierarchy config
- Manual testing completed

ROLLBACK:
- SQL script available if needed
- Git revert ready
```

### User-Facing

```
IMPROVEMENT: Custom Document Structure Names

We've improved how the setup wizard handles your custom
document structure choices.

BEFORE:
- Custom names sometimes ignored during initial setup
- Fell back to "Article" and "Section"

NOW:
- Your custom names (e.g., "Chapter", "Clause") are used
  immediately when parsing your first document
- More consistent experience throughout the application

NO ACTION NEEDED:
- Existing organizations will continue working
- New setups will automatically benefit from this fix
```

---

## FAQ

### Q: Will this break existing organizations?

**A:** No. The config loader has a validation step that gracefully falls back to defaults if the schema is invalid. After the migration, all organizations will have valid schemas.

### Q: Do we need to reparse existing documents?

**A:** No. The sections are already stored correctly in the database. This fix only affects **new** documents uploaded after setup.

### Q: What if a user created an org yesterday with the old schema?

**A:** The migration script will convert it to the new format. They can then upload new documents with their custom names respected.

### Q: Can users still edit hierarchy after setup?

**A:** Yes! The Phase 2 UI (hierarchy editor) allows admins to customize all 10 levels. This fix just ensures the **initial** setup choices are stored correctly.

### Q: Does this affect the document upload flow?

**A:** No. Document upload already used the same `processDocumentImport()` method. It will just get better config from the database after this fix.

---

## Summary

**The Fix:**
- Change 10 lines of code in `/src/routes/setup.js`
- Build 10-level schema instead of 2-level schema
- Map user's choices to new format

**The Benefit:**
- User's custom names respected immediately
- No more silent fallback to defaults
- Consistent behavior across all flows

**The Impact:**
- Minimal code change
- No breaking changes
- Improves user experience

**The Effort:**
- ~30 minutes to implement
- ~15 minutes to test
- ~10 minutes to deploy

**Next Steps:**
1. Review this recommendation
2. Implement the fix in `/src/routes/setup.js`
3. Add helper function (optional)
4. Run tests
5. Deploy to staging
6. Deploy to production
7. Run migration script
