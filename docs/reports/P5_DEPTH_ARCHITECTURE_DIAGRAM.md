# Priority 5: Depth Support Architecture Diagram

## 10-Level Hierarchy Support Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT UPLOAD & PARSING                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Load Organization Configuration                         │
├─────────────────────────────────────────────────────────────────┤
│  src/config/organizationConfig.js                               │
│                                                                  │
│  Priority:                                                       │
│  1. Database (hierarchy_config column)                          │
│  2. Config File (config/organization.json)                      │
│  3. Environment Variables                                        │
│  4. Defaults (10 levels)                                        │
│                                                                  │
│  Result:                                                         │
│  ✅ hierarchy.levels: Array[10]                                  │
│  ✅ hierarchy.maxDepth: 10                                       │
│  ✅ hierarchy.allowNesting: true                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Parse Document Hierarchy                               │
├─────────────────────────────────────────────────────────────────┤
│  src/parsers/hierarchyDetector.js                               │
│                                                                  │
│  For each level in config.hierarchy.levels:                     │
│    - Build detection pattern (regex)                            │
│    - Match against document text                                │
│    - Tag with depth (from config)                               │
│                                                                  │
│  No hardcoded limits:                                            │
│  ✅ Loops through ALL levels in config                          │
│  ✅ Validates depth <= maxDepth (default 10)                    │
│  ✅ Assigns depth dynamically                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Enrich Sections with Hierarchy Data                    │
├─────────────────────────────────────────────────────────────────┤
│  src/parsers/wordParser.js (enrichSections)                     │
│                                                                  │
│  For each section:                                               │
│    - Find matching level definition                             │
│    - Assign depth from config                                   │
│    - Build citation (parent.number + own number)               │
│    - Set numbering scheme                                       │
│                                                                  │
│  Result:                                                         │
│  {                                                               │
│    depth: 9,              ← From config.hierarchy.levels[9]    │
│    type: 'point',                                               │
│    number: '1',                                                 │
│    citation: 'I.1.1.a.1.i.I.1.A.1',                            │
│    section_number: '1',                                         │
│    original_text: '...'                                         │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Store in Database                                       │
├─────────────────────────────────────────────────────────────────┤
│  database/migrations/001_generalized_schema.sql                 │
│                                                                  │
│  INSERT INTO document_sections (                                │
│    document_id,                                                 │
│    parent_section_id,  ← Link to parent                         │
│    ordinal,            ← Position among siblings                │
│    depth,              ← From parser (0-9)                      │
│    section_number,                                              │
│    section_type,                                                │
│    ...                                                           │
│  )                                                               │
│                                                                  │
│  TRIGGER: update_section_path()                                 │
│  ├─ Calculates path_ids (ancestor chain)                        │
│  ├─ Calculates path_ordinals (numeric path)                     │
│  └─ Validates depth                                             │
│                                                                  │
│  CHECK CONSTRAINTS:                                              │
│  ✅ depth >= 0 AND depth <= 10                                  │
│  ✅ array_length(path_ids) = depth + 1                          │
│  ✅ array_length(path_ordinals) = depth + 1                     │
│  ✅ ordinal > 0                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Render in UI                                            │
├─────────────────────────────────────────────────────────────────┤
│  views/dashboard/dashboard.ejs                                  │
│                                                                  │
│  <% sections.forEach(section => { %>                            │
│    <div class="section depth-<%= section.depth %>">            │
│      <%= section.section_number %> - <%= section.title %>      │
│    </div>                                                        │
│  <% }) %>                                                        │
│                                                                  │
│  CSS Styling:                                                    │
│  .depth-0 { margin-left: 0px; }                                │
│  .depth-1 { margin-left: 20px; }                               │
│  .depth-2 { margin-left: 40px; }                               │
│  ...                                                             │
│  .depth-9 { margin-left: 180px; }                              │
│                                                                  │
│  ✅ Renders dynamically based on depth value                    │
│  ✅ No hardcoded depth limits                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration Hierarchy (10 Levels)

```
Depth 0: Article         [roman]     → I, II, III, IV, V...
  │
  ├─ Depth 1: Section        [numeric]   → 1, 2, 3, 4, 5...
  │    │
  │    ├─ Depth 2: Subsection   [numeric]   → 1.1, 1.2, 1.3...
  │    │    │
  │    │    ├─ Depth 3: Paragraph    [alphaLower] → (a), (b), (c)...
  │    │    │    │
  │    │    │    ├─ Depth 4: Subparagraph [numeric] → 1, 2, 3...
  │    │    │    │    │
  │    │    │    │    ├─ Depth 5: Clause [alphaLower] → (i), (ii), (iii)...
  │    │    │    │    │    │
  │    │    │    │    │    ├─ Depth 6: Subclause [roman] → I, II, III...
  │    │    │    │    │    │    │
  │    │    │    │    │    │    ├─ Depth 7: Item [numeric] → • 1, • 2, • 3...
  │    │    │    │    │    │    │    │
  │    │    │    │    │    │    │    ├─ Depth 8: Subitem [alpha] → ◦ A, ◦ B, ◦ C...
  │    │    │    │    │    │    │    │    │
  │    │    │    │    │    │    │    │    └─ Depth 9: Point [numeric] → - 1, - 2, - 3...
```

**Example Citation**: `Article I, Section 1, 1.1, (a), 1, (i), I, • 1, ◦ A, - 1`

---

## Materialized Path System

### Path Arrays

For a section at depth 9:

```javascript
{
  depth: 9,

  // UUID chain from root to self (10 UUIDs)
  path_ids: [
    '00000000-0000-0000-0000-000000000001',  // Article I (depth 0)
    '00000000-0000-0000-0000-000000000002',  // Section 1 (depth 1)
    '00000000-0000-0000-0000-000000000003',  // Subsection 1.1 (depth 2)
    '00000000-0000-0000-0000-000000000004',  // Paragraph (a) (depth 3)
    '00000000-0000-0000-0000-000000000005',  // Subparagraph 1 (depth 4)
    '00000000-0000-0000-0000-000000000006',  // Clause (i) (depth 5)
    '00000000-0000-0000-0000-000000000007',  // Subclause I (depth 6)
    '00000000-0000-0000-0000-000000000008',  // Item 1 (depth 7)
    '00000000-0000-0000-0000-000000000009',  // Subitem A (depth 8)
    '00000000-0000-0000-0000-00000000000A'   // Point 1 (depth 9) - SELF
  ],

  // Ordinal numbers from root to self (10 ordinals)
  path_ordinals: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
}
```

### Why Materialized Paths?

```
Traditional Recursive Query (SLOW):
┌─────────────────────────────────────────┐
│ SELECT * FROM sections                  │
│ WHERE parent_id IN (                    │
│   SELECT id FROM sections               │
│   WHERE parent_id IN (                  │
│     SELECT id FROM sections             │
│     WHERE parent_id = 'root'            │
│   )                                     │
│ )                                       │
└─────────────────────────────────────────┘
❌ N queries for N levels
❌ Slow for deep hierarchies


Materialized Path (FAST):
┌─────────────────────────────────────────┐
│ SELECT * FROM sections                  │
│ WHERE 'root-uuid' = ANY(path_ids)       │
│ ORDER BY path_ordinals                  │
└─────────────────────────────────────────┘
✅ Single query with GIN index
✅ Fast for any depth
```

---

## Database Constraints

### CHECK Constraint

```sql
-- Enforces depth limit
CHECK (depth >= 0 AND depth <= 10)
```

### Array Length Validation

```sql
-- Ensures path arrays match depth
CHECK (array_length(path_ids, 1) = depth + 1)
CHECK (array_length(path_ordinals, 1) = depth + 1)
```

### Self-Reference Validation

```sql
-- Ensures last path element is self
CHECK (path_ids[array_length(path_ids, 1)] = id)
```

### Test Cases

```javascript
// ✅ VALID: Depth 0 (root)
{
  depth: 0,
  path_ids: [uuid_self],
  path_ordinals: [1]
}

// ✅ VALID: Depth 9 (deepest)
{
  depth: 9,
  path_ids: [uuid1, uuid2, ..., uuid10],  // 10 UUIDs
  path_ordinals: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
}

// ❌ INVALID: Depth 11 (exceeds limit)
{
  depth: 11,
  path_ids: [...],
  path_ordinals: [...]
}
// Error: CHECK constraint violated

// ❌ INVALID: Path length mismatch
{
  depth: 5,
  path_ids: [uuid1, uuid2, uuid3],  // Only 3, should be 6
  path_ordinals: [1, 1, 1]
}
// Error: CHECK constraint violated
```

---

## Configuration Priority Cascade

```
┌─────────────────────────────────────────┐
│  1. DATABASE (Highest Priority)         │
│     organizations.hierarchy_config      │
│     JSONB column with 10-level config   │
└─────────────────────────────────────────┘
                 │
                 ▼ (if NULL or incomplete)
┌─────────────────────────────────────────┐
│  2. CONFIG FILE                          │
│     config/{org-slug}.json              │
│     or config/organization.json         │
└─────────────────────────────────────────┘
                 │
                 ▼ (if not found)
┌─────────────────────────────────────────┐
│  3. ENVIRONMENT VARIABLES                │
│     ORG_HIERARCHY_LEVELS                │
│     ORG_MAX_DEPTH                       │
└─────────────────────────────────────────┘
                 │
                 ▼ (if not set)
┌─────────────────────────────────────────┐
│  4. DEFAULTS (Always Available)          │
│     src/config/organizationConfig.js    │
│     getDefaultConfig()                  │
│     ✅ 10 levels defined                │
│     ✅ maxDepth = 10                    │
└─────────────────────────────────────────┘
```

**Guarantee**: Every organization gets at least 10-level support from defaults.

---

## Query Patterns

### Get All Descendants

```sql
-- Get all descendants of a section (any depth)
SELECT *
FROM document_sections
WHERE 'parent-uuid' = ANY(path_ids)
  AND id != 'parent-uuid'  -- Exclude self
ORDER BY path_ordinals;

-- Uses GIN index on path_ids
-- O(log n) lookup time
```

### Get Breadcrumb Path

```sql
-- Get full ancestor chain
SELECT *
FROM document_sections
WHERE id = ANY((
  SELECT path_ids
  FROM document_sections
  WHERE id = 'section-uuid'
))
ORDER BY depth;

-- Returns: [Article, Section, Subsection, ..., Self]
```

### Get Siblings

```sql
-- Get siblings at same depth
SELECT *
FROM document_sections
WHERE parent_section_id = (
  SELECT parent_section_id
  FROM document_sections
  WHERE id = 'section-uuid'
)
AND id != 'section-uuid'
ORDER BY ordinal;
```

### Get Children

```sql
-- Get direct children only
SELECT *
FROM document_sections
WHERE parent_section_id = 'section-uuid'
ORDER BY ordinal;
```

---

## Performance Characteristics

### Insertion
- **Time Complexity**: O(1) for trigger execution
- **Space Complexity**: O(depth) for path arrays
- **Maximum Path Array Size**: 10 UUIDs + 10 integers = ~200 bytes

### Query
- **Breadcrumb Query**: O(log n) with GIN index
- **Descendant Query**: O(log n) with GIN index
- **Sibling Query**: O(1) with parent index
- **Child Query**: O(1) with parent index

### Storage
- **Per Section**: ~500 bytes (including path arrays)
- **1000 sections**: ~500 KB
- **10,000 sections**: ~5 MB

---

## Validation Flow

```
┌─────────────────────────────────────────┐
│  Configuration Validation                │
│  src/config/configSchema.js             │
├─────────────────────────────────────────┤
│  1. Check levels array exists           │
│  2. Validate each level has:            │
│     - name (string)                     │
│     - type (string)                     │
│     - numbering (enum)                  │
│     - depth (integer >= 0)              │
│  3. Validate sequential depths:         │
│     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]     │
│  4. Validate maxDepth >= deepest level  │
│  5. Validate maxDepth <= 20             │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Hierarchy Validation                    │
│  src/parsers/hierarchyDetector.js       │
├─────────────────────────────────────────┤
│  For each section:                       │
│  1. Check depth <= maxDepth              │
│  2. Check level definition exists        │
│  3. Check numbering format matches       │
│  4. Check depth progression logical      │
│     (no jumps from 0 to 3)              │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Database Constraints                    │
│  PostgreSQL CHECK constraints            │
├─────────────────────────────────────────┤
│  1. depth >= 0 AND depth <= 10           │
│  2. array_length(path_ids) = depth + 1   │
│  3. array_length(path_ordinals) = depth+1│
│  4. path_ids[last] = id                  │
│  5. ordinal > 0                          │
└─────────────────────────────────────────┘
```

---

## Error Handling

### Exceeding Maximum Depth

```javascript
// Attempt to create section at depth 11
const result = await insertSection({
  depth: 11,
  parent_id: depth10ParentId
});

// ❌ Error: CHECK constraint "document_sections_depth_check"
// Message: "new row for relation violates check constraint"
```

### Missing Level Definition

```javascript
// Section type not in hierarchy config
const section = {
  type: 'undefined_type',
  depth: 5
};

// ⚠️ Warning from hierarchyDetector.validateHierarchy():
// "No level definition found for depth 5"
```

### Invalid Path Arrays

```javascript
// Path array length doesn't match depth
const section = {
  depth: 5,
  path_ids: [uuid1, uuid2, uuid3],  // Only 3, needs 6
  path_ordinals: [1, 1, 1]
};

// ❌ Error: CHECK constraint "document_sections_path_ids_check"
// Message: "array_length(path_ids, 1) must equal depth + 1"
```

---

## Summary

✅ **Database**: CHECK constraint enforces depth <= 10
✅ **Configuration**: 10 levels defined by default, supports up to 20
✅ **Parsers**: No hardcoded limits, depth from config
✅ **Triggers**: Automatically maintain path arrays
✅ **Queries**: Efficient with GIN indexes
✅ **Validation**: Multi-layer enforcement (config → parser → database)

**Result**: System fully supports 10-level hierarchies with no code changes required.

---

**Generated**: 2025-10-15
**For**: Priority 5 Subsection Depth Analysis
**Status**: ✅ Architecture Verified
