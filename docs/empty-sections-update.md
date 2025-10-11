# Empty Sections Analysis - Update

## Current Status (After TOC Filtering)

**Progress Made:**
- Empty sections: 28 → 4 (86% improvement!)
- But word retention: 84.63% → 65.76% (regression!)

## The 4 Remaining Empty Sections

From analysis output:

1. **Article X** - Line 110
   - Header: `"ARTICLE XI\tGRIEVANCE PROCESS\t20"` (mismatch - header says XI, but detected as X)
   - Next line: blank
   - Line after: `"ARTICLE XII PARLIAMENTARY AUTHORITY\t21"`
   - **Issue:** Header mismatch causing wrong detection

2. **Section 10** - Line 492
   - Header: `"Section 10: Resignation - A Board member may resign..."`
   - **Issue:** Title includes full content - no separate content lines!

3. **Section 11** - Line 496
   - Header: `"Section 11: Community Outreach – left blank"`
   - **Issue:** Explicitly marked as "left blank" in source document

4. **Article VI** - Line 502
   - Header: `"ARTICLE VI OFFICERS"`
   - Next line: blank
   - **Issue:** No content between this article and next section

## Root Cause for Word Retention Drop

The TOC filtering is now **correctly** preventing TOC lines from being content, but this reveals a bigger problem:

**The TOC lines in the orphan handler were ADDING content to sections!**

Old behavior:
- TOC lines detected as orphans
- Attached to Preamble section
- This accidentally preserved the TOC structure text
- Result: Higher word retention (84.63%)

New behavior:
- TOC lines correctly filtered
- NOT added as orphans
- TOC content lost
- Result: Lower word retention (65.76%)

**The real issue:** Content AFTER the TOC (actual body content) is not being captured!

## Next Steps

1. **Verify TOC end line:** The TOC filtering may be too aggressive
2. **Check line 99+:** Where does body content actually start?
3. **Fix orphan detection:** Body content after TOC should be captured
4. **Handle inline content:** Section 10 has content in the title itself

## Hypothesis

The document structure is:
```
Lines 1-29:   Title, preamble
Lines 30-98:  Table of Contents (35 TOC lines)
Lines 99-110: Gap / transition (TOC spillover?)
Lines 111+:   Actual body content
```

We're filtering lines 30-98 as TOC, but lines 99-110 might ALSO be TOC or gap lines that should allow body content to start fresh at line 111.

## Recommended Investigation

Check what's on lines 99-120 to see where body content actually begins.
