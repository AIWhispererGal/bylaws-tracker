# Normalization Pipeline - Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENT NORMALIZATION PIPELINE                   │
│                                                                           │
│  Input: DOCX File                                    Output: Clean Sections│
│                                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐ │
│  │   Stage 1   │───>│   Stage 2   │───>│   Stage 3   │───>│ Stage 4  │ │
│  │Pre-Extract  │    │Post-Extract │    │ Pre-Parsing │    │ During   │ │
│  │             │    │             │    │             │    │ Parsing  │ │
│  │ - Mammoth   │    │ - Whitespace│    │ - Line trim │    │ - Fuzzy  │ │
│  │   config    │    │ - TOC detect│    │ - Headers   │    │   match  │ │
│  │ - Unicode   │    │ - Encoding  │    │ - Filter    │    │ - Dedup  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────────┘ │
│                                                                           │
│  Each stage preserves metadata and can be individually disabled          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Pre-Extraction (DOCX Binary Level)

```
┌──────────────────────────────────────────────────────────────┐
│                    STAGE 1: PRE-EXTRACTION                   │
│                                                              │
│  Input: DOCX File Buffer                                    │
│     ↓                                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PreExtractionNormalizer                           │    │
│  │                                                     │    │
│  │  1. Configure Mammoth.js Options                   │    │
│  │     - Style mappings                               │    │
│  │     - Image handling (skip)                        │    │
│  │     - Whitespace rules                             │    │
│  │                                                     │    │
│  │  2. Transform Document Structure (Optional)        │    │
│  │     - Normalize Unicode whitespace                 │    │
│  │       (U+00A0 → space, U+200B → delete, etc.)     │    │
│  │     - Convert tabs to spaces                       │    │
│  │       (\t → 4 spaces)                              │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│     ↓                                                        │
│  Output: Configured Mammoth Options                         │
│                                                              │
│  Metadata: None (configuration stage)                       │
└──────────────────────────────────────────────────────────────┘

Key Decision: Operate on DOCX structure before text extraction
Rationale: Catch formatting issues at source (earliest point)
```

---

## Stage 2: Post-Extraction (Text Level)

```
┌──────────────────────────────────────────────────────────────────┐
│                   STAGE 2: POST-EXTRACTION                       │
│                                                                  │
│  Input: Raw extracted text from Mammoth                         │
│     ↓                                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostExtractionNormalizer                                │  │
│  │                                                           │  │
│  │  Strategy 1: Whitespace Normalization                    │  │
│  │    - Collapse multiple spaces: "  " → " "                │  │
│  │    - Convert tabs: "\t" → " "                            │  │
│  │    - Remove trailing whitespace per line                 │  │
│  │                                                           │  │
│  │  Strategy 2: Line Ending Normalization                   │  │
│  │    - CRLF → LF: "\r\n" → "\n"                            │  │
│  │    - CR → LF: "\r" → "\n"                                │  │
│  │                                                           │  │
│  │  Strategy 3: TOC Detection & Marking ⭐                   │  │
│  │    ┌──────────────────────────────────────────────┐     │  │
│  │    │  Hybrid TOC Detection                        │     │  │
│  │    │                                               │     │  │
│  │    │  Method 1: Explicit Headers                  │     │  │
│  │    │    /^TABLE OF CONTENTS$/i                    │     │  │
│  │    │                                               │     │  │
│  │    │  Method 2: Page Number Clustering            │     │  │
│  │    │    Pattern: [\s\t]+(\d+)\s*$                 │     │  │
│  │    │    Cluster if: 3+ consecutive lines          │     │  │
│  │    │                                               │     │  │
│  │    │  Method 3: Front Matter (first 100 lines)   │     │  │
│  │    │    If >30% have page numbers                 │     │  │
│  │    │                                               │     │  │
│  │    │  Confidence Scoring:                         │     │  │
│  │    │    - High: Header + Clusters                 │     │  │
│  │    │    - Medium: Clusters only                   │     │  │
│  │    │    - Low: Front matter heuristic             │     │  │
│  │    │                                               │     │  │
│  │    │  Output: Mark TOC lines with [TOC] prefix    │     │  │
│  │    └──────────────────────────────────────────────┘     │  │
│  │                                                           │  │
│  │  Strategy 4: Page Artifacts Removal                      │  │
│  │    - Remove "Page X of Y"                                │  │
│  │    - Remove header/footer separators                     │  │
│  │                                                           │  │
│  │  Strategy 5: Encoding Fixes                              │  │
│  │    - "â€™" → "'"  (smart apostrophe)                     │  │
│  │    - "â€œ" → '"'  (smart quotes)                          │  │
│  │    - "â€"" → '—'  (em dash)                               │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│     ↓                                                            │
│  Output: Normalized text with [TOC] markers                     │
│                                                                  │
│  Metadata:                                                       │
│    - tocRanges: [{ start: 0, end: 53, confidence: 'high' }]    │
│    - tocConfidence: 'high'                                      │
│    - changes: [{ type: 'toc-mark', line: 5, ... }]             │
│    - diff: { originalLength: 15420, difference: -220 }         │
└──────────────────────────────────────────────────────────────────┘

Key Decision: TOC detection at text level (not line level)
Rationale: Clustering requires full document view
```

---

## Stage 3: Pre-Parsing (Line Level)

```
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 3: PRE-PARSING                          │
│                                                                  │
│  Input: Normalized text from Stage 2                            │
│     ↓ Split into lines                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PreParsingNormalizer                                    │  │
│  │                                                           │  │
│  │  For each line:                                          │  │
│  │                                                           │  │
│  │  1. Filter TOC Lines                                     │  │
│  │     If line.startsWith('[TOC]'):                         │  │
│  │       → Skip (don't include in output)                   │  │
│  │       → Log: "Filtered TOC entry at line X"              │  │
│  │                                                           │  │
│  │  2. Smart Trim                                           │  │
│  │     - Remove trailing whitespace                         │  │
│  │     - Preserve intentional indentation                   │  │
│  │     - Normalize leading tabs to spaces                   │  │
│  │                                                           │  │
│  │     Example:                                             │  │
│  │       "  ARTICLE  I  " → "  ARTICLE I"                   │  │
│  │       "\tSection 1" → "    Section 1"                    │  │
│  │                                                           │  │
│  │  3. Header Standardization                               │  │
│  │     - Collapse multiple spaces in headers                │  │
│  │     - Normalize tab separators to single space           │  │
│  │                                                           │  │
│  │     Patterns:                                            │  │
│  │       "ARTICLE  I"     → "ARTICLE I"                     │  │
│  │       "Article\tI"     → "ARTICLE I"                     │  │
│  │       "SectionA"       → "Section A"                     │  │
│  │                                                           │  │
│  │  4. Empty Line Handling (Optional)                       │  │
│  │     If config.removeEmptyLines:                          │  │
│  │       → Skip empty lines                                 │  │
│  │     Else:                                                │  │
│  │       → Keep for context                                 │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│     ↓                                                            │
│  Output: Array of clean lines (no TOC, standardized headers)    │
│                                                                  │
│  Metadata:                                                       │
│    - originalLineCount: 150                                     │
│    - normalizedLineCount: 140 (10 TOC lines removed)           │
│    - changes: [                                                 │
│        { type: 'toc-filter', line: 5 },                        │
│        { type: 'header-standardization', line: 12 }            │
│      ]                                                          │
└──────────────────────────────────────────────────────────────────┘

Key Decision: Filter TOC here (not in Stage 2)
Rationale: Preserve line numbers in Stage 2 for debugging
```

---

## Stage 4: During-Parsing (Pattern Level)

```
┌──────────────────────────────────────────────────────────────────┐
│                   STAGE 4: DURING-PARSING                        │
│                                                                  │
│  Input: Lines from Stage 3 + Detected hierarchy patterns        │
│     ↓                                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DuringParsingNormalizer                                 │  │
│  │                                                           │  │
│  │  Operation 1: Fuzzy Pattern Matching                     │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  For each detected pattern:                     │    │  │
│  │  │    For each line:                                │    │  │
│  │  │                                                  │    │  │
│  │  │      1. Normalize for matching:                 │    │  │
│  │  │         - Lowercase                              │    │  │
│  │  │         - Collapse whitespace to single space    │    │  │
│  │  │         - Remove punctuation (: - – —)           │    │  │
│  │  │                                                  │    │  │
│  │  │      2. Try exact match first (fast path)       │    │  │
│  │  │         If exact: confidence = 1.0               │    │  │
│  │  │                                                  │    │  │
│  │  │      3. Try fuzzy match (Levenshtein distance)  │    │  │
│  │  │         similarity = (len - distance) / len      │    │  │
│  │  │         If similarity >= threshold (0.9):        │    │  │
│  │  │           → Match with confidence = similarity   │    │  │
│  │  │                                                  │    │  │
│  │  │  Example:                                        │    │  │
│  │  │    Pattern: "ARTICLE I"                          │    │  │
│  │  │    Line:    "Article  I:"                        │    │  │
│  │  │    Normalized: "article i" vs "article i"        │    │  │
│  │  │    Result: ✓ Match (confidence: 0.95)           │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  Operation 2: Enhanced Deduplication                     │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  For each section:                               │    │  │
│  │  │                                                  │    │  │
│  │  │    1. Create normalized key:                    │    │  │
│  │  │       key = normalize(citation) + "|" +          │    │  │
│  │  │             normalize(title)                     │    │  │
│  │  │                                                  │    │  │
│  │  │    2. Check if seen before:                     │    │  │
│  │  │       If first occurrence:                       │    │  │
│  │  │         → Keep section                           │    │  │
│  │  │         → Store in map                           │    │  │
│  │  │       If duplicate:                              │    │  │
│  │  │         → Compare content length                 │    │  │
│  │  │         → Keep section with MORE content         │    │  │
│  │  │         → Discard section with LESS content      │    │  │
│  │  │                                                  │    │  │
│  │  │    3. Log decision:                              │    │  │
│  │  │       "Kept ARTICLE I (450 chars)"               │    │  │
│  │  │       "Discarded ARTICLE I (25 chars, TOC)"      │    │  │
│  │  │                                                  │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│     ↓                                                            │
│  Output: Unique, matched sections with confidence scores        │
│                                                                  │
│  Metadata:                                                       │
│    - duplicatesRemoved: 36                                      │
│    - duplicateCitations: ['ARTICLE I', 'ARTICLE II', ...]      │
│    - matchConfidence: { avg: 0.97, min: 0.85, max: 1.0 }       │
│    - changes: [                                                 │
│        { type: 'duplicate-replacement', citation: 'ARTICLE I' } │
│      ]                                                          │
└──────────────────────────────────────────────────────────────────┘

Key Decision: Fuzzy matching + deduplication at pattern level
Rationale: Final safety net, catches variations that slipped through
```

---

## Data Flow Diagram

```
DOCX File
   ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 1: Pre-Extraction                                    │
│                                                            │
│  mammothOptions = {                                        │
│    styleMap: [...],                                        │
│    transformDocument: (doc) => normalizeUnicode(doc)       │
│  }                                                         │
└────────────────────────────────────────────────────────────┘
   ↓ Extract with options
Raw Text (tabs, weird whitespace, TOC, encoding issues)
   ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 2: Post-Extraction                                   │
│                                                            │
│  text = "ARTICLE\tI\tNAME\t4\nARTICLE  I\nCONTENT..."     │
│                                                            │
│  1. Normalize whitespace                                   │
│     → "ARTICLE I NAME 4\nARTICLE I\nCONTENT..."           │
│                                                            │
│  2. Detect TOC (lines 0-1 have page numbers)              │
│     → "[TOC]ARTICLE I NAME 4\nARTICLE I\nCONTENT..."      │
│                                                            │
│  3. Fix encoding (if any)                                  │
│                                                            │
│  Metadata: tocRanges = [{ start: 0, end: 1 }]             │
└────────────────────────────────────────────────────────────┘
   ↓ Split to lines
Lines Array: ["[TOC]ARTICLE I NAME 4", "ARTICLE I", "CONTENT..."]
   ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 3: Pre-Parsing                                       │
│                                                            │
│  Line 0: "[TOC]ARTICLE I NAME 4"                          │
│    → Starts with [TOC] → SKIP (filter out)                │
│                                                            │
│  Line 1: "ARTICLE I"                                       │
│    → Not TOC → Standardize → "ARTICLE I" (no change)      │
│                                                            │
│  Line 2: "CONTENT..."                                      │
│    → Smart trim → "CONTENT..."                            │
│                                                            │
│  Output: ["ARTICLE I", "CONTENT..."]                      │
│  Metadata: filtered 1 TOC line                            │
└────────────────────────────────────────────────────────────┘
   ↓ Hierarchy detection
Detected Patterns: [{ type: 'article', pattern: 'ARTICLE I', ... }]
   ↓
┌────────────────────────────────────────────────────────────┐
│ STAGE 4: During-Parsing                                    │
│                                                            │
│  Pattern: "ARTICLE I"                                      │
│  Line 0: "ARTICLE I"                                       │
│    → Fuzzy match → confidence: 1.0 → ✓ MATCH              │
│                                                            │
│  Build sections → ARTICLE I: { text: "CONTENT..." }       │
│                                                            │
│  Deduplication:                                            │
│    - Only one ARTICLE I found (TOC was filtered)          │
│    - No duplicates to remove                              │
│                                                            │
│  Output: [{ citation: 'ARTICLE I', text: 'CONTENT...' }]  │
└────────────────────────────────────────────────────────────┘
   ↓
Final Sections (Clean, deduplicated, with metadata)
```

---

## Configuration Flow

```
┌─────────────────────────────────────────────────────────┐
│  Organization Config (from database/setup)              │
│                                                         │
│  {                                                      │
│    hierarchy: { ... },                                 │
│    normalization: {                                    │
│      enabled: true,                                    │
│      preExtraction: {                                  │
│        normalizeUnicode: true,                         │
│        tabsToSpaces: true,                             │
│        tabWidth: 4                                     │
│      },                                                │
│      postExtraction: {                                 │
│        detectTOC: true,                                │
│        normalizeWhitespace: true                       │
│      },                                                │
│      preParsing: {                                     │
│        filterTOC: true,                                │
│        standardizeHeaders: true                        │
│      },                                                │
│      duringParsing: {                                  │
│        fuzzyMatching: true,                            │
│        fuzzyThreshold: 0.9                             │
│      }                                                 │
│    }                                                   │
│  }                                                     │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  NormalizationPipeline.constructor(config)              │
│                                                         │
│  1. Merge with defaults                                │
│  2. Check feature flags (env vars)                     │
│  3. Initialize stage normalizers:                      │
│     - this.stage1 = new PreExtractionNormalizer()      │
│     - this.stage2 = new PostExtractionNormalizer()     │
│     - this.stage3 = new PreParsingNormalizer()         │
│     - this.stage4 = new DuringParsingNormalizer()      │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  wordParser.parseDocument(file, config)                 │
│                                                         │
│  const pipeline = new NormalizationPipeline(config);    │
│  const options = pipeline.stage1.getMammothOptions();   │
│  const text = await mammoth.extract(file, options);    │
│  const normalized = await pipeline.normalize({ text });│
│  const sections = parseSections(normalized.data.text); │
└─────────────────────────────────────────────────────────┘
```

---

## Error Handling & Fallback Flow

```
┌──────────────────────────────────────────────────────────┐
│  NormalizationPipeline.normalizeWithFallback(input)      │
│                                                          │
│  Try:                                                    │
│    ┌────────────────────────────────────────────┐      │
│    │  1. Run normalization                      │      │
│    │  2. Validate result:                       │      │
│    │     - Text exists                          │      │
│    │     - Length >= 80% of original            │      │
│    │     - No corruption detected               │      │
│    │  3. Return normalized result               │      │
│    └────────────────────────────────────────────┘      │
│                                                          │
│  Catch Error OR Validation Failed:                      │
│    ┌────────────────────────────────────────────┐      │
│    │  1. Log error/failure                      │      │
│    │  2. Return original input                  │      │
│    │  3. Add metadata:                          │      │
│    │     { normalizationFailed: true,           │      │
│    │       error: "Validation failed" }         │      │
│    └────────────────────────────────────────────┘      │
│                                                          │
│  Result: Parser always gets valid input                 │
│          (either normalized or original)                │
└──────────────────────────────────────────────────────────┘
```

---

## A/B Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  NormalizationABTest                                        │
│                                                             │
│  ┌───────────────────┐         ┌───────────────────────┐  │
│  │   Baseline Path   │         │  Normalized Path      │  │
│  │                   │         │                       │  │
│  │  config = {       │         │  config = {           │  │
│  │    normalization: │         │    normalization: {   │  │
│  │      enabled:false│         │      enabled: true    │  │
│  │  }                │         │    }                  │  │
│  │                   │         │  }                    │  │
│  │  ↓                │         │  ↓                    │  │
│  │  Parse document   │         │  Parse document       │  │
│  │  ↓                │         │  ↓                    │  │
│  │  sections: [...]  │         │  sections: [...]      │  │
│  └───────────────────┘         └───────────────────────┘  │
│           ↓                              ↓                 │
│           └──────────────┬───────────────┘                 │
│                          ↓                                 │
│              ┌─────────────────────────┐                   │
│              │  Compare Results        │                   │
│              │                         │                   │
│              │  - Section count        │                   │
│              │  - Content length       │                   │
│              │  - Empty sections       │                   │
│              │  - Duplicates           │                   │
│              │  - Quality score        │                   │
│              └─────────────────────────┘                   │
│                          ↓                                 │
│              ┌─────────────────────────┐                   │
│              │  Verdict:               │                   │
│              │  - SUCCESS              │                   │
│              │  - REGRESSION           │                   │
│              │  - NO_CHANGE            │                   │
│              │  - MIXED                │                   │
│              └─────────────────────────┘                   │
│                          ↓                                 │
│              ┌─────────────────────────┐                   │
│              │  Generate Report        │                   │
│              │  - Metrics              │                   │
│              │  - Recommendations      │                   │
│              │  - Deploy decision      │                   │
│              └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Flow with Feature Flags

```
┌──────────────────────────────────────────────────────────┐
│  Environment Variables (Feature Flags)                   │
│                                                          │
│  ENABLE_NORMALIZATION=true/false         [Master]       │
│  ENABLE_NORMALIZATION_STAGE1=true/false  [Stage 1]      │
│  ENABLE_NORMALIZATION_STAGE2=true/false  [Stage 2]      │
│  ENABLE_NORMALIZATION_STAGE3=true/false  [Stage 3]      │
│  ENABLE_NORMALIZATION_STAGE4=true/false  [Stage 4]      │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Deployment Phases                                       │
│                                                          │
│  Week 1: Infrastructure (all flags = false)             │
│    - Code deployed but disabled                         │
│    - Unit tests running                                 │
│    - No user impact                                     │
│                                                          │
│  Week 2: Stage 1 Only (STAGE1 = true)                   │
│    - Enable pre-extraction normalization                │
│    - Monitor mammoth extraction quality                 │
│    - Check for content loss                             │
│                                                          │
│  Week 2.5: Stage 2 Only (STAGE2 = true)                 │
│    - Enable TOC detection                               │
│    - Monitor section count changes                      │
│    - Validate TOC filtering accuracy                    │
│                                                          │
│  Week 3: Stages 1+2+3 (STAGE1,2,3 = true)               │
│    - Enable line-level normalization                    │
│    - Monitor header standardization                     │
│    - Check for false positives                          │
│                                                          │
│  Week 3.5: All Stages (ENABLE_NORMALIZATION = true)     │
│    - Enable fuzzy matching & deduplication              │
│    - Full A/B testing                                   │
│    - Final validation                                   │
│                                                          │
│  Week 4: Production (all flags = true)                  │
│    - Roll out to all users                              │
│    - Monitor metrics                                    │
│    - Emergency rollback available                       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Rollback Strategy                                       │
│                                                          │
│  If issues detected:                                    │
│    1. Set ENABLE_NORMALIZATION=false                    │
│    2. Restart service (immediate effect)                │
│    3. Investigate logs & metadata                       │
│    4. Fix issue                                         │
│    5. Re-run A/B tests                                  │
│    6. Re-enable with monitoring                         │
└──────────────────────────────────────────────────────────┘
```

---

## Metadata Flow

```
Document → [Stage 1] → [Stage 2] → [Stage 3] → [Stage 4] → Sections

Metadata accumulates at each stage:

{
  // Stage 1
  stage1: {
    mammothOptionsApplied: true
  },

  // Stage 2
  stage2: {
    tocRanges: [{ start: 0, end: 53, confidence: 'high' }],
    tocConfidence: 'high',
    changes: [
      { type: 'whitespace-collapse', count: 47 },
      { type: 'toc-mark', line: 5 }
    ],
    diff: { originalLength: 15420, difference: -220 }
  },

  // Stage 3
  stage3: {
    originalLineCount: 150,
    normalizedLineCount: 140,
    changes: [
      { type: 'toc-filter', line: 5 },
      { type: 'header-standardization', line: 12 }
    ]
  },

  // Stage 4
  stage4: {
    duplicatesRemoved: 36,
    duplicateCitations: ['ARTICLE I', 'ARTICLE II'],
    matchConfidence: { avg: 0.97, min: 0.85, max: 1.0 }
  }
}

This metadata is:
- Attached to parse results
- Logged for debugging
- Used in A/B testing
- Available for monitoring
- Can be stripped in production if needed
```

---

## Performance Considerations

```
┌──────────────────────────────────────────────────────────┐
│  Performance Analysis                                    │
│                                                          │
│  Stage 1: Pre-Extraction                                │
│    Complexity: O(1) - one-time config                   │
│    Memory: ~1KB (config object)                         │
│    Time: <1ms                                           │
│                                                          │
│  Stage 2: Post-Extraction                               │
│    Complexity: O(n) where n = text length               │
│    Memory: ~2x text size (original + normalized)        │
│    Time: ~50ms for 500KB document                       │
│                                                          │
│  Stage 3: Pre-Parsing                                   │
│    Complexity: O(m) where m = line count                │
│    Memory: ~1.5x (lines array + filtered)               │
│    Time: ~20ms for 1000 lines                           │
│                                                          │
│  Stage 4: During-Parsing                                │
│    Complexity: O(k×p) where k=patterns, p=lines         │
│    Memory: ~sections count × avg section size           │
│    Time: ~100ms for 500 patterns × 1000 lines           │
│                                                          │
│  Total Overhead: ~170ms for typical document            │
│  Baseline parsing: ~2000ms                              │
│  Percentage: ~8.5% (acceptable)                         │
└──────────────────────────────────────────────────────────┘

Optimization Strategies:
1. Early termination (TOC search stops at line 200 if nothing found)
2. Parallel processing (run independent normalizations concurrently)
3. Caching (cache TOC detection results per document hash)
4. Lazy loading (only load enabled normalizers)
```

This comprehensive diagram set complements the main design document with visual representations of the normalization pipeline architecture.
