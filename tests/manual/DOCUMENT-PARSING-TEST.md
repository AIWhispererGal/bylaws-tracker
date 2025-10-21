# 📄 DOCUMENT PARSING TEST SUITE
### Comprehensive testing guide for the document parser

---

## 🎯 PURPOSE

The document parser has been a known issue area. This guide provides:
1. Automated test script to validate parsing
2. Sample test documents
3. Expected results for each test case
4. How to interpret parsing results
5. Common issues and fixes

---

## 🚀 QUICK START - AUTOMATED TEST

### Option 1: Run Automated Test Script

**Create and run the test**:
```bash
# Navigate to project root
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized

# Run the automated parsing test
node tests/manual/run-parsing-test.js
```

This will:
- Create test documents with known structures
- Parse each document
- Compare results to expected output
- Generate detailed report

---

## 📋 MANUAL TESTING APPROACH

If you prefer to test manually, follow these steps:

### Step 1: Prepare Test Documents

Create these 4 test documents in Word (.docx):

#### **Test Document 1: Simple Linear** (MUST PASS)
```
Article I - General Provisions
Section 1.1 - Name
Section 1.2 - Purpose

Article II - Membership
Section 2.1 - Eligibility
Section 2.2 - Dues
```

**Expected Result**:
- 2 Articles (depth 0)
- 4 Sections (depth 1)
- All sections have correct parent
- 0% orphans

---

#### **Test Document 2: Complex Hierarchy** (SHOULD PASS)
```
Article I - Organization
  Section 1.1 - General
    Subsection 1.1.1 - Name
    Subsection 1.1.2 - Address
  Section 1.2 - Purpose
    Subsection 1.2.1 - Mission
    Subsection 1.2.2 - Vision

Article II - Governance
  Section 2.1 - Board
    Subsection 2.1.1 - Composition
      Paragraph 2.1.1(a) - Officers
      Paragraph 2.1.1(b) - Directors
    Subsection 2.1.2 - Powers
  Section 2.2 - Committees
```

**Expected Result**:
- 2 Articles (depth 0)
- 4 Sections (depth 1)
- 6 Subsections (depth 2)
- 2 Paragraphs (depth 3)
- <5% orphans acceptable
- Correct parent-child relationships

---

#### **Test Document 3: Irregular Numbering** (EDGE CASE)
```
Article 1 - First Article
Section 1.A - Alpha Section
Section 1.B - Beta Section

Article 2 - Second Article
Section 2.I - Roman Section
Section 2.II - Another Roman

ARTICLE III - Third (caps variation)
Section 3-1 - Dash numbering
Section 3-2 - More dashes
```

**Expected Result**:
- Should detect all 3 articles
- Should detect all 6 sections
- May have some depth inconsistencies (acceptable)
- May have 10-20% orphans (acceptable for irregular docs)

---

#### **Test Document 4: Stress Test** (PERFORMANCE)
```
Article I - Start
  Section 1.1
    Subsection 1.1.1
    ... (repeat 50 sections)
Article II - Middle
  Section 2.1
    ... (repeat 50 sections)
Article III - End
  Section 3.1
    ... (repeat 50 sections)

Total: ~150 sections
```

**Expected Result**:
- Should parse in <10 seconds
- All sections detected
- <10% orphans
- No crashes or timeouts

---

### Step 2: Upload Each Document

For each test document:

1. **Login to your application**
2. **Navigate to document upload**
3. **Upload the test document**
4. **Monitor browser console** (F12) during parsing
5. **Record timing**: How long did parsing take?
6. **Check for errors**: Any red errors in console?

---

### Step 3: Verify Parsing Results

For each uploaded document, check:

#### **A. Section Detection**
- Open the document viewer
- Count sections displayed
- Compare to expected count
- ✅ All sections present?
- ❌ Missing sections?

#### **B. Hierarchy Structure**
- Check parent-child relationships
- Verify depth levels are correct
- Look for "orphan sections" (no parent)
- Calculate orphan percentage: `(orphans / total) * 100`

**Acceptable Orphan Rates**:
- Simple documents: 0%
- Complex documents: <5%
- Irregular documents: <20%

#### **C. Content Accuracy**
- Verify section text is correct
- Check numbers/identifiers preserved
- Ensure no text is missing or corrupted

#### **D. Performance**
- Document processing time
- Browser responsiveness
- Console log volume

---

## 🔍 HOW TO INTERPRET RESULTS

### ✅ PASSING CRITERIA

**Test Document 1 (Simple Linear)**:
- 100% sections detected
- 0% orphans
- Correct hierarchy
- <5 seconds processing

**Test Document 2 (Complex Hierarchy)**:
- 95%+ sections detected
- <5% orphans
- Mostly correct hierarchy
- <10 seconds processing

**Test Document 3 (Irregular)**:
- 90%+ sections detected
- <20% orphans
- Variable hierarchy (acceptable)
- <10 seconds processing

**Test Document 4 (Stress Test)**:
- 90%+ sections detected
- <10% orphans
- No crashes
- <15 seconds processing

---

### 🔴 FAILING CRITERIA

**Critical Failures** (Block MVP):
- Parser crashes
- <50% sections detected
- All sections are orphans
- Timeout (>30 seconds)
- Data corruption

**Major Issues** (Fix before full launch):
- >20% orphans on simple documents
- Missing large sections
- Incorrect content
- >10 seconds on simple docs

**Minor Issues** (Fix in next sprint):
- Some depth level errors
- 5-10% orphans
- Verbose console logging
- Slow on complex documents

---

## 📊 PARSING QUALITY METRICS

### Expected Console Output

When parsing, you should see logs like:
```
[Parser] Starting document analysis...
[Parser] Detected 3 articles
[Parser] Detected 12 sections
[Parser] Calculating context-aware depth...
[Parser] Building hierarchy stack...
[Parser] Processing section: Article I
[Parser] Depth: 0, Parent: null
[Parser] Processing section: Section 1.1
[Parser] Depth: 1, Parent: Article I
[Parser] Complete. Total sections: 15, Orphans: 2 (13%)
```

### What to Look For

**Good Signs** ✅:
- "Complete" message appears
- Section count matches document
- Orphan percentage is low
- No error messages

**Warning Signs** ⚠️:
- Many "Unable to determine parent" warnings
- High orphan percentage (>20%)
- "Depth calculation failed" messages
- Many "Using fallback" messages

**Critical Issues** 🔴:
- "Parser crashed" or exceptions
- "Maximum call stack exceeded"
- "RLS policy violation"
- No sections detected

---

## 🐛 COMMON ISSUES & FIXES

### Issue 1: High Orphan Rate (>20%)

**Symptoms**: Many sections have no parent

**Possible Causes**:
- Irregular numbering scheme
- Inconsistent formatting
- Complex document structure

**Solutions**:
1. Check document numbering consistency
2. Review hierarchy configuration in setup
3. Look at `hierarchyDetector.js` pattern matching
4. May need to adjust regex patterns

**Code Location**: `src/parsers/hierarchyDetector.js:150-250`

---

### Issue 2: Slow Parsing (>10 seconds)

**Symptoms**: Processing takes long time

**Possible Causes**:
- Excessive console.log statements (90+ found by Hive Mind)
- Large document (500+ sections)
- Complex depth calculation

**Solutions**:
1. Set `NODE_ENV=production` to reduce logging
2. Add pagination for large documents
3. Optimize depth calculation algorithm

**Code Location**: `src/parsers/wordParser.js:683-831`

---

### Issue 3: Incorrect Depth Levels

**Symptoms**: Sections at wrong hierarchy level

**Possible Causes**:
- Context-aware depth calculation error
- Hierarchy configuration mismatch
- Unclear document structure

**Solutions**:
1. Verify hierarchy config matches document
2. Check depth calculation logs
3. Review algorithm in wordParser

**Code Location**: `src/parsers/wordParser.js:750-831`

---

### Issue 4: Parser Crashes

**Symptoms**: Upload fails, errors in console

**Possible Causes**:
- Invalid .docx file
- Corrupted document
- Missing dependencies
- Code bug

**Solutions**:
1. Verify document is valid .docx
2. Check server logs for stack trace
3. Review recent code changes
4. Check `wordParser.js` error handling

**Code Location**: `src/parsers/wordParser.js:1-100`

---

## 📈 PERFORMANCE BENCHMARKS

Based on Hive Mind analysis:

| Document Size | Expected Time | Max Acceptable | Current |
|--------------|---------------|----------------|---------|
| 10 sections | <1 second | 2 seconds | ~1s |
| 50 sections | <3 seconds | 5 seconds | ~3s |
| 100 sections | <5 seconds | 10 seconds | ~7s |
| 500 sections | <15 seconds | 30 seconds | Unknown |

**Note**: Current times include overhead from 90+ console.log statements

**Performance Improvement Potential**:
- Remove console.log in production: -40% time
- Optimize depth calculation: -20% time
- Add caching: -30% time
- **Total potential**: 2.5-5 second reduction

---

## 🔧 ADVANCED DEBUGGING

### Enable Verbose Logging

**Temporarily add to `wordParser.js`**:
```javascript
const VERBOSE_PARSING = true;

if (VERBOSE_PARSING) {
  console.log('[Parser Debug]', detailedInfo);
}
```

### Check Database Directly

**After parsing, query database**:
```sql
-- Check sections created
SELECT id, content, depth, parent_id, order_index
FROM document_sections
WHERE document_id = '[your-document-id]'
ORDER BY order_index;

-- Count orphans
SELECT COUNT(*) as orphan_count
FROM document_sections
WHERE document_id = '[your-document-id]'
  AND parent_id IS NULL
  AND depth > 0;
```

### Analyze Parsing Logs

**Look for patterns**:
```bash
# Extract parsing logs from browser console
# Look for:
- "Unable to determine parent" (high orphan cause)
- "Fallback depth" (depth calculation failures)
- "Context mismatch" (hierarchy issues)
```

---

## 📋 PARSING TEST CHECKLIST

Use this checklist when testing:

```
DOCUMENT PARSING TEST - [DATE]
========================================

Document: Simple Linear (Test 1)
✅ / ❌  All sections detected
✅ / ❌  0% orphans
✅ / ❌  Correct hierarchy
✅ / ❌  <5 seconds processing
Notes: _______________________________

Document: Complex Hierarchy (Test 2)
✅ / ❌  95%+ sections detected
✅ / ❌  <5% orphans
✅ / ❌  Mostly correct hierarchy
✅ / ❌  <10 seconds processing
Notes: _______________________________

Document: Irregular Numbering (Test 3)
✅ / ❌  90%+ sections detected
✅ / ❌  <20% orphans
✅ / ❌  No crashes
✅ / ❌  <10 seconds processing
Notes: _______________________________

Document: Stress Test (Test 4)
✅ / ❌  90%+ sections detected
✅ / ❌  <10% orphans
✅ / ❌  No crashes/timeouts
✅ / ❌  <15 seconds processing
Notes: _______________________________

OVERALL PARSER STATUS: PASS / FAIL
========================================

Critical Issues:
1. _______________________________
2. _______________________________

Performance Issues:
1. _______________________________
2. _______________________________

Acceptable Issues (log for next sprint):
1. _______________________________
2. _______________________________
```

---

## 🎯 MVP PARSER REQUIREMENTS

**To pass for MVP, parser must**:
- ✅ Parse simple documents (Test 1) with 100% accuracy
- ✅ Parse complex documents (Test 2) with 90%+ accuracy
- ✅ Handle irregular documents (Test 3) without crashing
- ✅ Process in reasonable time (<10s for typical docs)
- ✅ Not corrupt data
- ✅ Not crash the server

**Acceptable limitations for MVP**:
- ⚠️ 5-10% orphans on complex documents
- ⚠️ Some depth level errors on irregular documents
- ⚠️ Slow on very large documents (500+ sections)
- ⚠️ Verbose console logging

**Must fix before MVP**:
- 🔴 Parser crashes
- 🔴 Data corruption
- 🔴 >20% orphans on simple documents
- 🔴 Timeouts

---

## 📚 RELATED HIVE MIND REPORTS

For deeper analysis, see:
- **`/docs/hive-mind/coder-parser-findings.md`** - Complete parser code review
- **`/docs/hive-mind/researcher-schema-findings.md`** - Database schema for sections
- **`/docs/hive-mind/tester-mvp-findings.md`** - Overall testing status

---

## 🚀 NEXT STEPS

### If Parser Tests Pass:
1. ✅ Parser is MVP-ready
2. Run main smoke tests
3. Proceed with soft launch
4. Plan P2 optimizations

### If Parser Tests Fail:
1. Document exact failure modes
2. Check which test documents fail
3. Review Hive Mind coder report
4. Fix critical issues before launch
5. Re-run tests

---

**Good luck with your parsing tests!** 📄✨

The Hive Mind found your parser is **functional but needs optimization**. These tests will help you quantify exactly where it stands.
