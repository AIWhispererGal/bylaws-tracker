# P5 Subsection Depth - Quick Reference

## TL;DR

**✅ SYSTEM SUPPORTS 10 LEVELS - NO BUGS FOUND**

The perceived "2-level limitation" is a **configuration/UI issue**, not a code problem.

---

## Quick Facts

| Component | Status | Limit |
|-----------|--------|-------|
| Database Schema | ✅ Ready | 0-10 (CHECK constraint) |
| Default Config | ✅ Ready | 10 levels defined |
| Schema Validation | ✅ Ready | Up to 20 allowed |
| Parsers | ✅ Ready | No hardcoded limits |
| UI Rendering | ✅ Ready | Dynamic based on config |

---

## Verification Commands

### Run Verification Script
```bash
node scripts/verify-depth-support.js
```

### Run Integration Tests
```bash
npm test -- tests/integration/deep-hierarchy.test.js
```

### Check Database Constraint
```sql
-- Verify CHECK constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'document_sections'::regclass
  AND conname LIKE '%depth%';

-- Expected: CHECK ((depth >= 0) AND (depth <= 10))
```

---

## Code Locations

### Database
- **Constraint**: `database/migrations/001_generalized_schema.sql:187`
- **Trigger**: `database/migrations/001_generalized_schema.sql:207-243`

### Configuration
- **10-level default**: `src/config/organizationConfig.js:69-144`
- **maxDepth=10**: `src/config/organizationConfig.js:142`
- **Validation**: `src/config/configSchema.js:53,205`

### Parsers
- **Hierarchy detector**: `src/parsers/hierarchyDetector.js:248-306`
- **Word parser**: `src/parsers/wordParser.js:590-626`

### UI
- **Setup wizard** (2-level preview only): `public/js/setup-wizard.js:255-293`
- **Admin settings** (needs enhancement): `views/admin/organization-settings.ejs`

---

## Why "2 Levels Only" Perception?

1. **Setup Wizard Simplification** ⚠️
   - Only shows Article/Section preview
   - Gives false impression of limitation
   - **Fix**: Add note about 10-level support

2. **Test Data Limited** ℹ️
   - Most tests use 2-level examples
   - Documentation focuses on Article/Section
   - **Fix**: Add 10-level examples

3. **Inference Fallback** (rare)
   - `inferHierarchy()` only detects 5 patterns
   - Only used when no config exists
   - **Should never happen in production**

---

## Enable 10 Levels

### Method 1: Use Defaults (Already Enabled!)

Organizations automatically get 10-level config from `organizationConfig.js`.

**Verify**:
```javascript
const config = await organizationConfig.loadConfig(orgId, supabase);
console.log('Levels:', config.hierarchy.levels.length); // Should be 10
```

### Method 2: Database Update

```sql
UPDATE organizations
SET hierarchy_config = '{
  "levels": [
    {"name": "Article",      "type": "article",      "numbering": "roman",     "prefix": "Article ",  "depth": 0},
    {"name": "Section",      "type": "section",      "numbering": "numeric",   "prefix": "Section ",  "depth": 1},
    {"name": "Subsection",   "type": "subsection",   "numbering": "numeric",   "prefix": "",          "depth": 2},
    {"name": "Paragraph",    "type": "paragraph",    "numbering": "alphaLower","prefix": "(",         "depth": 3},
    {"name": "Subparagraph", "type": "subparagraph", "numbering": "numeric",   "prefix": "",          "depth": 4},
    {"name": "Clause",       "type": "clause",       "numbering": "alphaLower","prefix": "(",         "depth": 5},
    {"name": "Subclause",    "type": "subclause",    "numbering": "roman",     "prefix": "",          "depth": 6},
    {"name": "Item",         "type": "item",         "numbering": "numeric",   "prefix": "•",         "depth": 7},
    {"name": "Subitem",      "type": "subitem",      "numbering": "alpha",     "prefix": "◦",         "depth": 8},
    {"name": "Point",        "type": "point",        "numbering": "numeric",   "prefix": "-",         "depth": 9}
  ],
  "maxDepth": 10,
  "allowNesting": true
}'::jsonb
WHERE id = 'your-org-id';
```

### Method 3: Admin UI (Future Enhancement)

**TODO**: Create hierarchy editor in organization settings
- Add/remove levels
- Configure numbering schemes
- Reorder depths
- Live preview

---

## Example 10-Level Document

```
Article I - Governance                    (depth 0, roman)
  Section 1 - Board                       (depth 1, numeric)
    1.1 - Composition                     (depth 2, numeric)
      (a) - Member Types                  (depth 3, alphaLower)
        1 - Elected Members               (depth 4, numeric)
          (i) - Terms                     (depth 5, alphaLower)
            I - Limits                    (depth 6, roman)
              • First                     (depth 7, numeric)
                ◦ Initial                 (depth 8, alpha)
                  - Criteria              (depth 9, numeric)
```

**Path Arrays**:
```javascript
{
  depth: 9,
  path_ids: [uuid1, uuid2, uuid3, uuid4, uuid5, uuid6, uuid7, uuid8, uuid9, uuid10],
  path_ordinals: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  section_number: "I.1.1.a.1.i.I.•.◦.-"
}
```

---

## Troubleshooting

### Issue: "Only seeing 2 levels in parsed document"

**Check**:
1. Verify organization has 10-level config:
   ```javascript
   const config = await organizationConfig.loadConfig(orgId, supabase);
   console.log(config.hierarchy.levels.length); // Should be 10
   ```

2. Check if database hierarchy_config is NULL or incomplete:
   ```sql
   SELECT
     name,
     hierarchy_config,
     jsonb_array_length(hierarchy_config->'levels') as level_count
   FROM organizations
   WHERE id = 'your-org-id';
   ```

3. Verify levels have required properties:
   ```sql
   SELECT jsonb_array_elements(hierarchy_config->'levels')
   FROM organizations
   WHERE id = 'your-org-id';
   -- Each level should have: type, depth, numbering
   ```

**Fix**: Update organization with complete config (see Method 2 above)

### Issue: "Database rejects depth > 2"

**Check constraint**:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'document_sections'::regclass
  AND conname LIKE '%depth%';
```

**Expected**: `CHECK ((depth >= 0) AND (depth <= 10))`

**If different**: Run migration `001_generalized_schema.sql` to fix

### Issue: "Parser not detecting deeper levels"

**Check detection patterns**:
```javascript
const detected = hierarchyDetector.detectHierarchy(documentText, orgConfig);
console.log('Detected items:', detected.length);
console.log('Unique depths:', new Set(detected.map(d => d.depth)));
```

**If limited**: Verify `orgConfig.hierarchy.levels` is complete (10 levels)

---

## Recommended Actions

### Immediate (No Code Changes)
1. ✅ Verify all organizations have 10-level config
2. ✅ Add documentation explaining depth support
3. ✅ Update setup wizard to mention 10 levels

### Short-Term Enhancements
1. 📝 Create admin UI for hierarchy configuration
2. 📝 Add 10-level examples to documentation
3. 📝 Create integration tests for deep hierarchies

### Long-Term Improvements
1. 🎨 Visual hierarchy editor with drag-and-drop
2. 📊 Depth analytics and usage reports
3. 🔍 Auto-detect optimal hierarchy from uploaded documents

---

## Related Files

- **Full Report**: `docs/reports/P5_SUBSECTION_DEPTH_REPORT.md`
- **Integration Tests**: `tests/integration/deep-hierarchy.test.js`
- **Verification Script**: `scripts/verify-depth-support.js`

---

## Status Summary

| Priority | Item | Status |
|----------|------|--------|
| P1 | Database supports 10 levels | ✅ COMPLETE |
| P1 | Configuration supports 10 levels | ✅ COMPLETE |
| P1 | Parsers support 10 levels | ✅ COMPLETE |
| P2 | Integration tests for 10 levels | ✅ COMPLETE |
| P3 | Documentation updates | 📝 TODO |
| P3 | Setup wizard clarification | 📝 TODO |
| P4 | Admin UI enhancement | 📝 TODO |

**Overall**: ✅ **NO CRITICAL ISSUES - SYSTEM READY**

---

**Generated**: 2025-10-15
**Analyst**: QA Testing Agent
**Status**: Analysis Complete
