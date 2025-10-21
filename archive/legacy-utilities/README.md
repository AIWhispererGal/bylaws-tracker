# Legacy Utilities Archive

This directory contains one-time utility scripts and tools that were used during the initial project setup but have since been superseded by production code.

## Files in This Archive

### parse_bylaws.js

**Purpose:** One-time migration script for parsing RNC bylaws text file
**Date Created:** October 6, 2024
**Last Used:** October 6, 2024 (initial commit only)
**Superseded By:** `/src/parsers/wordParser.js` + `/src/parsers/hierarchyDetector.js`

**Why Archived:**
- Hardcoded paths to old project location (BYLAWSTOOL2)
- Only handles `.txt` files (production uses `.docx`)
- Hardcoded for single organization (RNC-specific patterns)
- Zero active code dependencies
- Never modified after initial commit

**Original Functionality:**
- Parsed text file with hardcoded line numbers (TOC lines 13-65, content stop at 513)
- Basic ARTICLE/Section regex detection
- Fixed 2-level hierarchy (Articles → Sections)
- Output to `parsed_sections.json`

**Modern Replacement:**
The production parser system in `/src/parsers/` provides:
- .docx file support via mammoth library
- 10+ configurable hierarchy levels
- Multi-tenant support
- Dynamic TOC detection
- Context-aware depth calculation
- Orphan content capture
- Full Supabase database integration
- Comprehensive test coverage (31+ test files)

**Historical Context:**
This script was created during the initial project setup to migrate RNC bylaws data from a `.txt` file into the new system. It served as a proof-of-concept that informed the design of the production parser architecture.

**Usage (Historical Reference Only):**
```javascript
// This script is NO LONGER FUNCTIONAL due to hardcoded paths
node parse_bylaws.js
// Output: parsed_sections.json (also archived if found)
```

**Related Archived Files:**
- `parsed_sections.json` - Output from this script (if exists)
- `upload_to_render.js` - Used parsed_sections.json for one-time upload (if archived)

**For Current Parsing:**
See:
- `/src/parsers/wordParser.js` - Main production parser
- `/src/parsers/hierarchyDetector.js` - Pattern detection
- `/src/parsers/numberingSchemes.js` - Number format support
- `/docs/features/document-parsing/` - Documentation

---

*Archived by Hive Mind cleanup operation - October 21, 2025*
*Investigation by: Researcher, Analyst, and Tester agents*
