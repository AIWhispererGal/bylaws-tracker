# Normalization Pipeline - Implementation Guide

**Status**: Ready for Implementation
**Priority**: High
**Estimated Effort**: 4 weeks
**Dependencies**: None (integrates with existing parser)

---

## Executive Summary

This guide provides step-by-step instructions for implementing the **4-stage document normalization pipeline** that will:

✅ **Eliminate duplicate sections** (RNC bylaws: 72 → ~36 sections)
✅ **Remove TOC pollution** (Table of Contents creates false sections)
✅ **Standardize formatting** (tabs, spaces, Unicode whitespace)
✅ **Improve parsing accuracy** (fuzzy matching catches variations)
✅ **Maintain 100% content capture** (no data loss)

---

## Related Documents

- **Design Specification**: `/docs/NORMALIZATION_PIPELINE_DESIGN.md`
- **Architecture Diagrams**: `/docs/NORMALIZATION_ARCHITECTURE_DIAGRAM.md`
- **Quick Reference**: `/docs/NORMALIZATION_QUICK_REF.md`
- **TOC Detection Design**: `/docs/TOC_DETECTION_DESIGN.md`

---

## Implementation Phases

### Phase 1: Infrastructure Setup (Week 1)

**Goal**: Create directory structure, base classes, and configuration without changing behavior.

#### Step 1.1: Create Directory Structure

```bash
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# Create normalizers directory structure
mkdir -p src/normalizers/{stage1,stage2,stage3,stage4,utils}

# Create test directory
mkdir -p tests/normalizers
```

#### Step 1.2: Create Base Configuration

**File**: `/src/config/normalizationConfig.js`

```javascript
/**
 * Default normalization configuration
 */
module.exports = {
  normalization: {
    enabled: process.env.ENABLE_NORMALIZATION === 'true',

    // Stage 1: Pre-Extraction
    preExtraction: {
      normalizeUnicode: true,
      tabsToSpaces: true,
      tabWidth: 4,
      transformDocument: false
    },

    // Stage 2: Post-Extraction
    postExtraction: {
      normalizeWhitespace: true,
      normalizeLineEndings: true,
      detectTOC: true,
      removePageArtifacts: true,
      fixEncoding: true
    },

    // Stage 3: Pre-Parsing
    preParsing: {
      filterTOC: true,
      smartTrim: true,
      standardizeHeaders: true,
      removeEmptyLines: false
    },

    // Stage 4: During-Parsing
    duringParsing: {
      fuzzyMatching: true,
      fuzzyThreshold: 0.9,
      deduplication: true
    },

    // Debug options
    debug: {
      preserveOriginal: process.env.NODE_ENV !== 'production',
      logChanges: true,
      generateDiffs: process.env.NODE_ENV !== 'production'
    }
  }
};
```

#### Step 1.3: Create Main Pipeline Orchestrator

**File**: `/src/normalizers/NormalizationPipeline.js`

```javascript
/**
 * Main normalization pipeline orchestrator
 */
const PreExtractionNormalizer = require('./stage1/PreExtractionNormalizer');
const PostExtractionNormalizer = require('./stage2/PostExtractionNormalizer');
const PreParsingNormalizer = require('./stage3/PreParsingNormalizer');
const DuringParsingNormalizer = require('./stage4/DuringParsingNormalizer');
const defaultConfig = require('../config/normalizationConfig');

class NormalizationPipeline {
  constructor(organizationConfig = {}) {
    // Merge with defaults
    this.config = this.mergeConfig(defaultConfig, organizationConfig);

    // Initialize stage normalizers only if enabled
    if (this.config.normalization?.enabled) {
      this.stage1 = new PreExtractionNormalizer(this.config);
      this.stage2 = new PostExtractionNormalizer(this.config);
      this.stage3 = new PreParsingNormalizer(this.config);
      this.stage4 = new DuringParsingNormalizer(this.config);
    }
  }

  mergeConfig(defaults, orgConfig) {
    return {
      ...defaults,
      ...orgConfig,
      normalization: {
        ...defaults.normalization,
        ...(orgConfig.normalization || {}),
        enabled: this.checkFeatureFlags(orgConfig)
      }
    };
  }

  checkFeatureFlags(orgConfig) {
    // Environment variable overrides config
    if (process.env.ENABLE_NORMALIZATION !== undefined) {
      return process.env.ENABLE_NORMALIZATION === 'true';
    }
    return orgConfig.normalization?.enabled !== false;
  }

  async normalize(input) {
    if (!this.config.normalization?.enabled) {
      return {
        data: input,
        metadata: { normalizationSkipped: true }
      };
    }

    let data = input;
    let metadata = {};

    try {
      // Stage 2: Post-Extraction (text normalization)
      if (data.text) {
        const stage2Result = this.stage2.normalize(data.text, metadata);
        data.text = stage2Result.text;
        metadata = { ...metadata, ...stage2Result.metadata };
      }

      // Stage 3: Pre-Parsing (line normalization)
      if (data.text) {
        const lines = data.text.split('\n');
        const stage3Result = this.stage3.normalizeLines(lines, metadata);
        data.text = stage3Result.lines.join('\n');
        metadata = { ...metadata, ...stage3Result.metadata };
      }

      return { data, metadata };
    } catch (error) {
      console.error('[NormalizationPipeline] Error:', error);
      // Fallback: return original
      return {
        data: input,
        metadata: { normalizationError: error.message }
      };
    }
  }

  getParsingNormalizer() {
    return this.stage4;
  }
}

module.exports = NormalizationPipeline;
```

#### Step 1.4: Create Stage Stubs

Create minimal stub files for each stage that pass through data unchanged:

**File**: `/src/normalizers/stage1/PreExtractionNormalizer.js`

```javascript
class PreExtractionNormalizer {
  constructor(config) {
    this.config = config.normalization?.preExtraction || {};
  }

  getMammothOptions() {
    // TODO: Implement in Phase 2
    return {};
  }
}

module.exports = PreExtractionNormalizer;
```

**File**: `/src/normalizers/stage2/PostExtractionNormalizer.js`

```javascript
class PostExtractionNormalizer {
  constructor(config) {
    this.config = config.normalization?.postExtraction || {};
  }

  normalize(text, metadata = {}) {
    // TODO: Implement in Phase 2
    return { text, metadata };
  }
}

module.exports = PostExtractionNormalizer;
```

**File**: `/src/normalizers/stage3/PreParsingNormalizer.js`

```javascript
class PreParsingNormalizer {
  constructor(config) {
    this.config = config.normalization?.preParsing || {};
  }

  normalizeLines(lines, metadata = {}) {
    // TODO: Implement in Phase 2
    return { lines, metadata };
  }
}

module.exports = PreParsingNormalizer;
```

**File**: `/src/normalizers/stage4/DuringParsingNormalizer.js`

```javascript
class DuringParsingNormalizer {
  constructor(config) {
    this.config = config.normalization?.duringParsing || {};
  }

  fuzzyMatch(line, pattern, detectedItem) {
    // TODO: Implement in Phase 2
    return { matched: false, confidence: 0, method: 'none' };
  }

  deduplicateSections(sections, metadata = {}) {
    // TODO: Implement in Phase 2
    return { sections, metadata };
  }
}

module.exports = DuringParsingNormalizer;
```

#### Step 1.5: Create Export Index

**File**: `/src/normalizers/index.js`

```javascript
module.exports = {
  NormalizationPipeline: require('./NormalizationPipeline'),
  PreExtractionNormalizer: require('./stage1/PreExtractionNormalizer'),
  PostExtractionNormalizer: require('./stage2/PostExtractionNormalizer'),
  PreParsingNormalizer: require('./stage3/PreParsingNormalizer'),
  DuringParsingNormalizer: require('./stage4/DuringParsingNormalizer')
};
```

#### Step 1.6: Write Basic Tests

**File**: `/tests/normalizers/pipeline.test.js`

```javascript
const { NormalizationPipeline } = require('../../src/normalizers');

describe('NormalizationPipeline', () => {
  describe('with normalization disabled', () => {
    it('should pass through data unchanged', async () => {
      const pipeline = new NormalizationPipeline({
        normalization: { enabled: false }
      });

      const input = { text: 'ARTICLE I\tNAME' };
      const result = await pipeline.normalize(input);

      expect(result.data.text).toBe('ARTICLE I\tNAME');
      expect(result.metadata.normalizationSkipped).toBe(true);
    });
  });

  describe('with normalization enabled', () => {
    it('should initialize all stages', () => {
      const pipeline = new NormalizationPipeline({
        normalization: { enabled: true }
      });

      expect(pipeline.stage1).toBeDefined();
      expect(pipeline.stage2).toBeDefined();
      expect(pipeline.stage3).toBeDefined();
      expect(pipeline.stage4).toBeDefined();
    });
  });
});
```

#### Step 1.7: Deploy Infrastructure (No Impact)

```bash
# Add to .env (disabled by default)
echo "ENABLE_NORMALIZATION=false" >> .env

# Run tests
npm test -- tests/normalizers/pipeline.test.js

# Commit infrastructure
git add src/normalizers tests/normalizers src/config/normalizationConfig.js
git commit -m "Add normalization pipeline infrastructure (disabled)"
```

**Deliverables**:
- ✅ Directory structure created
- ✅ Base classes with stubs
- ✅ Configuration system
- ✅ Basic tests passing
- ✅ Deployed with feature flag OFF

---

### Phase 2: Stage Implementation (Week 2)

**Goal**: Implement each stage with full functionality and unit tests.

#### Step 2.1: Implement Stage 1 (Pre-Extraction)

**File**: `/src/normalizers/stage1/PreExtractionNormalizer.js`

Copy the full implementation from `/docs/NORMALIZATION_PIPELINE_DESIGN.md` (lines 39-105).

**Test**: `/tests/normalizers/stage1.test.js`

```javascript
describe('PreExtractionNormalizer', () => {
  it('should provide mammoth options', () => {
    const normalizer = new PreExtractionNormalizer({
      normalization: { preExtraction: { tabsToSpaces: true } }
    });

    const options = normalizer.getMammothOptions();

    expect(options).toBeDefined();
    expect(options.ignoreEmptyParagraphs).toBe(true);
  });

  it('should normalize Unicode whitespace', () => {
    const normalizer = new PreExtractionNormalizer({
      normalization: { preExtraction: { normalizeUnicode: true } }
    });

    const result = normalizer.normalizeUnicodeWhitespace('Test\u00A0Space');

    expect(result).toBe('Test Space');
  });
});
```

#### Step 2.2: Implement Stage 2 (Post-Extraction)

**File**: `/src/normalizers/stage2/PostExtractionNormalizer.js`

Copy the full implementation from `/docs/NORMALIZATION_PIPELINE_DESIGN.md` (lines 114-380).

**Test**: `/tests/normalizers/stage2.test.js`

```javascript
describe('PostExtractionNormalizer', () => {
  describe('whitespace normalization', () => {
    it('should collapse multiple spaces', () => {
      const normalizer = new PostExtractionNormalizer(defaultConfig);

      const result = normalizer.normalizeWhitespace('ARTICLE  I    NAME');

      expect(result.text).toBe('ARTICLE I NAME');
      expect(result.changes).toContainEqual(
        expect.objectContaining({ type: 'whitespace-collapse' })
      );
    });
  });

  describe('TOC detection', () => {
    it('should detect page number pattern', () => {
      const normalizer = new PostExtractionNormalizer(defaultConfig);

      const hasPageNum = normalizer.hasTocPageNumber('ARTICLE I\t4');

      expect(hasPageNum).toBe(true);
    });

    it('should detect TOC clusters', () => {
      const normalizer = new PostExtractionNormalizer(defaultConfig);
      const lines = [
        'ARTICLE I    4',
        'ARTICLE II   8',
        'ARTICLE III  12',
        '',
        'ARTICLE I',
        'Content here'
      ];

      const clusters = normalizer.detectTocClusters(lines);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].startLine).toBe(0);
      expect(clusters[0].endLine).toBe(2);
    });

    it('should mark TOC lines', () => {
      const normalizer = new PostExtractionNormalizer(defaultConfig);
      const text = 'ARTICLE I\t4\nARTICLE I\nContent';

      const result = normalizer.detectAndMarkTOC(text);

      expect(result.text).toContain('[TOC]ARTICLE I\t4');
      expect(result.tocRanges).toHaveLength(1);
    });
  });
});
```

#### Step 2.3: Implement Stage 3 (Pre-Parsing)

**File**: `/src/normalizers/stage3/PreParsingNormalizer.js`

Copy the full implementation from `/docs/NORMALIZATION_PIPELINE_DESIGN.md` (lines 390-505).

**Test**: `/tests/normalizers/stage3.test.js`

```javascript
describe('PreParsingNormalizer', () => {
  describe('TOC filtering', () => {
    it('should filter lines marked with [TOC]', () => {
      const normalizer = new PreParsingNormalizer(defaultConfig);
      const lines = [
        '[TOC]ARTICLE I    4',
        'ARTICLE I',
        'Content here'
      ];

      const result = normalizer.normalizeLines(lines);

      expect(result.lines).toHaveLength(2);
      expect(result.lines).not.toContain('[TOC]ARTICLE I    4');
    });
  });

  describe('header standardization', () => {
    it('should collapse multiple spaces', () => {
      const normalizer = new PreParsingNormalizer(defaultConfig);

      const result = normalizer.standardizeHeader('ARTICLE  I');

      expect(result.text).toBe('ARTICLE I');
      expect(result.pattern).toBe('multiple-spaces');
    });

    it('should replace tabs with spaces', () => {
      const normalizer = new PreParsingNormalizer(defaultConfig);

      const result = normalizer.standardizeHeader('ARTICLE\tI');

      expect(result.text).toBe('ARTICLE I');
      expect(result.pattern).toBe('tab-separator');
    });
  });
});
```

#### Step 2.4: Implement Stage 4 (During-Parsing)

**File**: `/src/normalizers/stage4/DuringParsingNormalizer.js`

Copy the full implementation from `/docs/NORMALIZATION_PIPELINE_DESIGN.md` (lines 515-720).

**Test**: `/tests/normalizers/stage4.test.js`

```javascript
describe('DuringParsingNormalizer', () => {
  describe('fuzzy matching', () => {
    it('should match exact patterns', () => {
      const normalizer = new DuringParsingNormalizer(defaultConfig);

      const result = normalizer.fuzzyMatch(
        'ARTICLE I',
        'ARTICLE I',
        {}
      );

      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('exact');
    });

    it('should fuzzy match variations', () => {
      const normalizer = new DuringParsingNormalizer(defaultConfig);

      const result = normalizer.fuzzyMatch(
        'Article  I:',
        'ARTICLE I',
        {}
      );

      expect(result.matched).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.method).toBe('fuzzy');
    });
  });

  describe('deduplication', () => {
    it('should remove duplicates, keeping longer content', () => {
      const normalizer = new DuringParsingNormalizer(defaultConfig);
      const sections = [
        { citation: 'ARTICLE I', title: 'NAME', text: 'Short' },
        { citation: 'ARTICLE I', title: 'NAME', text: 'This is much longer content here' }
      ];

      const result = normalizer.deduplicateSections(sections);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].text).toBe('This is much longer content here');
      expect(result.metadata.duringParsing.duplicatesRemoved).toBe(1);
    });
  });
});
```

#### Step 2.5: Run All Tests

```bash
# Run all normalization tests
npm test -- tests/normalizers/

# Verify 80%+ coverage
npm test -- --coverage tests/normalizers/
```

**Deliverables**:
- ✅ All 4 stages fully implemented
- ✅ Unit tests for each stage
- ✅ >80% code coverage
- ✅ Still disabled (feature flag OFF)

---

### Phase 3: Integration (Week 3)

**Goal**: Integrate normalization pipeline into wordParser.

#### Step 3.1: Update WordParser

**File**: `/src/parsers/wordParser.js`

Add at the top:
```javascript
const NormalizationPipeline = require('../normalizers/NormalizationPipeline');
```

Update `parseDocument` method:
```javascript
async parseDocument(filePath, organizationConfig) {
  try {
    // Initialize normalization pipeline
    const pipeline = new NormalizationPipeline(organizationConfig);

    // Stage 1: Get mammoth options (if normalization enabled)
    const mammothOptions = pipeline.stage1
      ? pipeline.stage1.getMammothOptions()
      : {};

    // Read DOCX with normalized options
    const buffer = await fs.readFile(filePath);
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }, mammothOptions),
      mammoth.convertToHtml({ buffer }, mammothOptions)
    ]);

    // Stage 2 & 3: Normalize extracted text
    const normalizedResult = await pipeline.normalize({
      text: textResult.value,
      html: htmlResult.value
    });

    // Parse sections with normalized text and Stage 4 normalizer
    const sections = await this.parseSections(
      normalizedResult.data.text,
      normalizedResult.data.html,
      organizationConfig,
      pipeline.getParsingNormalizer() // Pass Stage 4
    );

    return {
      success: true,
      sections,
      metadata: {
        source: 'word',
        fileName: filePath.split('/').pop(),
        parsedAt: new Date().toISOString(),
        sectionCount: sections.length,
        normalization: normalizedResult.metadata // Include normalization metadata
      }
    };
  } catch (error) {
    console.error('Error parsing Word document:', error);
    return {
      success: false,
      error: error.message,
      sections: []
    };
  }
}
```

Update `parseSections` method signature:
```javascript
async parseSections(text, html, organizationConfig, parsingNormalizer = null) {
  // ... existing code ...

  // Stage 4: Use fuzzy matching if normalizer provided
  for (const item of detectedItems) {
    const pattern = item.fullMatch.trim();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (headerLines.has(i)) continue;

      // Use fuzzy matching if available
      let matched = false;
      let confidence = 0;

      if (parsingNormalizer) {
        const matchResult = parsingNormalizer.fuzzyMatch(line, pattern, item);
        matched = matchResult.matched;
        confidence = matchResult.confidence;
      } else {
        // Fallback: exact match
        const trimmedLine = line.trim();
        matched = trimmedLine.toLowerCase().startsWith(pattern.toLowerCase());
        confidence = matched ? 1.0 : 0;
      }

      if (matched) {
        headerLines.add(i);
        itemsByLine.set(i, {
          ...item,
          matchConfidence: confidence
        });
        break;
      }
    }
  }

  // ... existing section building code ...

  // Stage 4: Deduplication (if normalizer provided)
  if (parsingNormalizer) {
    const deduplicatedResult = parsingNormalizer.deduplicateSections(
      sections,
      { /* existing metadata */ }
    );
    return deduplicatedResult.sections;
  }

  // Fallback: use existing deduplication
  return this.deduplicateSections(sections);
}
```

#### Step 3.2: Integration Tests

**File**: `/tests/normalizers/integration.test.js`

```javascript
const wordParser = require('../../src/parsers/wordParser');
const fs = require('fs').promises;

describe('Normalization Integration', () => {
  it('should parse document with normalization enabled', async () => {
    const config = {
      normalization: { enabled: true },
      hierarchy: {
        levels: [
          { type: 'article', numbering: 'roman', prefix: 'ARTICLE ', depth: 0 }
        ]
      }
    };

    const result = await wordParser.parseDocument(
      'test-data/sample-bylaws.docx',
      config
    );

    expect(result.success).toBe(true);
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.metadata.normalization).toBeDefined();
  });

  it('should handle documents without normalization', async () => {
    const config = {
      normalization: { enabled: false },
      hierarchy: {
        levels: [
          { type: 'article', numbering: 'roman', prefix: 'ARTICLE ', depth: 0 }
        ]
      }
    };

    const result = await wordParser.parseDocument(
      'test-data/sample-bylaws.docx',
      config
    );

    expect(result.success).toBe(true);
    expect(result.metadata.normalizationSkipped).toBe(true);
  });
});
```

#### Step 3.3: A/B Testing Setup

**File**: `/scripts/ab-test-normalization.js`

Copy the `NormalizationABTest` class from `/docs/NORMALIZATION_PIPELINE_DESIGN.md` (lines 850-1050).

```javascript
const NormalizationABTest = require('../src/normalizers/utils/NormalizationABTest');
const rncConfig = require('../src/config/organizationConfig');

async function main() {
  const abTest = new NormalizationABTest();

  const testDocuments = [
    'test-data/rnc-bylaws.docx',
    'test-data/normal-bylaws.docx',
    // Add more test documents
  ];

  for (const docPath of testDocuments) {
    console.log(`Testing: ${docPath}`);
    const comparison = await abTest.runTest(docPath, rncConfig);

    console.log(`  Status: ${comparison.verdict.status}`);
    console.log(`  Sections: ${comparison.sectionCount.baseline} → ${comparison.sectionCount.normalized}`);
    console.log(`  Verdict: ${comparison.verdict.recommendation}`);
    console.log('');
  }

  const report = abTest.generateReport();

  console.log('=== Summary ===');
  console.log(`Successes: ${report.summary.successes}/${report.summary.totalTests}`);
  console.log('');
  console.log('=== Recommendations ===');
  report.recommendations.forEach(rec => console.log(rec));

  // Save report
  const fs = require('fs').promises;
  await fs.writeFile(
    'ab-test-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\nReport saved to: ab-test-report.json');
}

main().catch(console.error);
```

**Deliverables**:
- ✅ WordParser integrated with pipeline
- ✅ Integration tests passing
- ✅ A/B testing framework ready
- ✅ Still disabled (ready for testing)

---

### Phase 4: Testing & Rollout (Week 4)

**Goal**: Enable normalization stage-by-stage with monitoring.

#### Step 4.1: Enable Stage 1

```bash
# Week 4, Day 1
export ENABLE_NORMALIZATION=true
export ENABLE_NORMALIZATION_STAGE1=true
export ENABLE_NORMALIZATION_STAGE2=false
export ENABLE_NORMALIZATION_STAGE3=false
export ENABLE_NORMALIZATION_STAGE4=false

# Restart
pm2 restart bylaws-tool

# Monitor
tail -f logs/app.log | grep "normalization"

# Run A/B tests
node scripts/ab-test-normalization.js

# Check results
cat ab-test-report.json
```

**Monitor**:
- Mammoth extraction quality
- No content loss
- No errors in logs

#### Step 4.2: Enable Stage 2 (TOC Detection)

```bash
# Week 4, Day 2-3
export ENABLE_NORMALIZATION_STAGE2=true

pm2 restart bylaws-tool

# Monitor
tail -f logs/app.log | grep "TOC"

# Run A/B tests
node scripts/ab-test-normalization.js

# Expected: RNC bylaws section count should decrease
```

**Monitor**:
- TOC detection accuracy (check metadata)
- Section count changes
- No false positives

#### Step 4.3: Enable Stage 3 (Line Normalization)

```bash
# Week 4, Day 4
export ENABLE_NORMALIZATION_STAGE3=true

pm2 restart bylaws-tool
node scripts/ab-test-normalization.js
```

**Monitor**:
- Header standardization
- Line filtering
- No content loss

#### Step 4.4: Enable Stage 4 (Full Pipeline)

```bash
# Week 4, Day 5
export ENABLE_NORMALIZATION_STAGE4=true

pm2 restart bylaws-tool
node scripts/ab-test-normalization.js
```

**Monitor**:
- Fuzzy matching accuracy
- Deduplication effectiveness
- Quality scores

#### Step 4.5: Production Rollout

```bash
# Week 4, Day 6-7
# Update .env file
echo "ENABLE_NORMALIZATION=true" > .env

# Restart
pm2 restart bylaws-tool

# Monitor production metrics
node scripts/normalization-metrics.js

# Dashboard: Check section counts, quality scores, errors
```

**Success Criteria**:
- ✅ RNC bylaws: ~36 sections (down from 72)
- ✅ No empty sections
- ✅ Quality score > 90
- ✅ No errors in logs
- ✅ Performance within 10% of baseline

**Deliverables**:
- ✅ All stages enabled and tested
- ✅ A/B test report shows SUCCESS
- ✅ Production deployment complete
- ✅ Monitoring dashboard active

---

## Rollback Procedures

### Emergency Rollback (Instant)

```bash
# Disable all normalization
export ENABLE_NORMALIZATION=false
pm2 restart bylaws-tool

# Or disable specific stage
export ENABLE_NORMALIZATION_STAGE2=false
pm2 restart bylaws-tool
```

### Gradual Rollback

1. **Identify Issue**
   - Check logs: `tail -f logs/app.log | grep "ERROR"`
   - Check A/B reports: `cat ab-test-report.json`
   - Check metadata: Look at normalization metadata in parse results

2. **Disable Problematic Stage**
   - If Stage 2 (TOC) is issue: `ENABLE_NORMALIZATION_STAGE2=false`
   - If Stage 4 (dedup) is issue: `ENABLE_NORMALIZATION_STAGE4=false`

3. **Investigate**
   - Review normalization metadata
   - Check diff logs
   - Reproduce locally with test documents

4. **Fix & Re-deploy**
   - Update normalizer code
   - Re-run unit tests
   - Re-run A/B tests
   - Re-enable stage

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Section Count**
   - Before: 72 (RNC bylaws)
   - After: ~36
   - Monitor: Any document with section count > 50% reduction

2. **Empty Sections**
   - Before: ~15%
   - After: <5%
   - Monitor: Any document with >10% empty sections

3. **Quality Score**
   - Before: 65/100
   - After: 95/100
   - Monitor: Any document with score <80

4. **Performance**
   - Baseline: 2.5s
   - Target: <3s
   - Monitor: Any document taking >4s

### Logging

```javascript
// In wordParser.js, after normalization
if (normalizedResult.metadata.normalization) {
  const metrics = {
    tocDetected: normalizedResult.metadata.tocRanges?.length > 0,
    tocConfidence: normalizedResult.metadata.tocConfidence,
    duplicatesRemoved: normalizedResult.metadata.stage4?.duplicatesRemoved || 0,
    contentDiff: normalizedResult.metadata.diff?.difference || 0
  };

  console.log('[Normalization Metrics]', metrics);

  // Send to monitoring service (optional)
  // monitoringService.track('normalization', metrics);
}
```

---

## Troubleshooting Guide

### Issue: TOC Not Detected

**Symptoms**: Duplicate sections still appearing

**Debug**:
```javascript
// Check metadata
console.log(result.metadata.tocRanges);
console.log(result.metadata.tocConfidence);
```

**Solutions**:
1. Lower confidence threshold (accept 'low' confidence)
2. Adjust TOC patterns in `hasTocPageNumber()`
3. Rely on Stage 4 deduplication fallback

### Issue: Content Loss

**Symptoms**: Sections missing content

**Debug**:
```javascript
// Check diff
console.log(result.metadata.normalization.diff);
// Check changes
console.log(result.metadata.normalization.changes);
```

**Solutions**:
1. Disable aggressive normalizations
2. Check validation (no more than 20% loss allowed)
3. Review whitespace normalization settings

### Issue: Performance Degradation

**Symptoms**: Parsing taking too long

**Debug**:
```javascript
// Profile each stage
console.time('Stage 1');
const stage1 = await pipeline.stage1.normalize(...);
console.timeEnd('Stage 1');
```

**Solutions**:
1. Enable parallel processing
2. Add early termination (TOC search)
3. Cache TOC detection results
4. Disable `preserveOriginal` in production

---

## Checklist

### Pre-Implementation
- [ ] Review design document
- [ ] Understand 4-stage architecture
- [ ] Set up test data (RNC bylaws, etc.)
- [ ] Create feature branch

### Week 1: Infrastructure
- [ ] Create directory structure
- [ ] Implement configuration system
- [ ] Create pipeline orchestrator
- [ ] Create stage stubs
- [ ] Write basic tests
- [ ] Deploy with feature flag OFF

### Week 2: Stage Implementation
- [ ] Implement Stage 1 + tests
- [ ] Implement Stage 2 + tests
- [ ] Implement Stage 3 + tests
- [ ] Implement Stage 4 + tests
- [ ] Achieve >80% code coverage
- [ ] All unit tests passing

### Week 3: Integration
- [ ] Integrate with wordParser
- [ ] Write integration tests
- [ ] Set up A/B testing framework
- [ ] Run initial A/B tests
- [ ] Review and fix issues

### Week 4: Rollout
- [ ] Day 1: Enable Stage 1, monitor
- [ ] Day 2-3: Enable Stage 2, validate TOC detection
- [ ] Day 4: Enable Stage 3, check header standardization
- [ ] Day 5: Enable Stage 4, run full A/B tests
- [ ] Day 6-7: Production rollout
- [ ] Document rollback procedures
- [ ] Set up monitoring dashboard

### Post-Implementation
- [ ] Update user documentation
- [ ] Train team on normalization features
- [ ] Monitor metrics for 1 week
- [ ] Collect user feedback
- [ ] Plan future enhancements

---

## Success Criteria

✅ **Functional**:
- RNC bylaws: 72 → ~36 sections
- Empty sections: <5%
- Duplicate sections: 0
- Quality score: >90/100

✅ **Non-Functional**:
- Performance: <10% overhead
- Memory: <35% increase
- Test coverage: >80%
- No production errors

✅ **Process**:
- A/B test success rate: >90%
- Rollback procedure validated
- Documentation complete
- Team trained

---

This implementation guide provides a complete roadmap for adding document normalization to the parsing pipeline. Follow the phases sequentially, validate at each step, and maintain the ability to rollback if issues arise.
