# Document Formatting Guide for Bylaws Import

## Overview

This guide helps you prepare your bylaws document for successful import into the Governance Tracker. Follow these guidelines to achieve **95%+ content retention** and ensure all sections are properly detected.

---

## Quick Checklist

Before uploading your document, make sure:

- [ ] Saved as `.docx` format (Word 2007 or newer)
- [ ] Section headers use consistent numbering (Roman/Arabic/Decimal)
- [ ] Headers formatted with Word styles (Heading 1, Heading 2)
- [ ] Table of Contents is at the beginning (we'll filter it automatically)
- [ ] No text in text boxes or special containers
- [ ] File size under 10 MB
- [ ] Document opens without errors in Microsoft Word

---

## Recommended Document Structure

### Ideal Format

```
BYLAWS OF [ORGANIZATION NAME]

Table of Contents (optional - we automatically filter this)
Article I................................................4
Article II...............................................7
[etc.]

ARTICLE I - NAME AND PURPOSE
Section 1.1 - Official Name
The official name of this organization shall be...

Section 1.2 - Purpose
The purpose of this organization is to...

ARTICLE II - MEMBERSHIP
Section 2.1 - Eligibility
Membership shall be open to...

Section 2.2 - Classes of Membership
There shall be two classes of members...
```

### What We Detect

**Article-Level Headers:**
- ✓ `Article I - Name`
- ✓ `ARTICLE I - NAME`
- ✓ `Article I: Name`
- ✓ `Article 1 - Name` (if using Arabic numbers)

**Section-Level Headers:**
- ✓ `Section 1.1 - Official Name`
- ✓ `Section 1.1: Official Name`
- ✓ `1.1 Official Name`
- ✓ `Section A - Official Name` (if using letters)

---

## Numbering Styles

### Supported Numbering Patterns

| Level | Style | Pattern | Example |
|-------|-------|---------|---------|
| **Articles** | Roman Numerals | I, II, III, IV, V... | Article I - Name |
| | Arabic Numbers | 1, 2, 3, 4, 5... | Article 1 - Name |
| | Letters | A, B, C, D, E... | Article A - Name |
| **Sections** | Decimal | 1.1, 1.2, 2.1... | Section 1.1 - Purpose |
| | Roman Numerals | I, II, III... | Section I - Purpose |
| | Arabic | 1, 2, 3... | Section 1 - Purpose |
| | Letters | A, B, C... | Section A - Purpose |
| **Subsections** | Lowercase Letters | a, b, c... | (a) Subsection text |
| | Parenthetical Numbers | (1), (2), (3)... | (1) Subsection text |

### Consistency is Key

**✅ Good - Consistent:**
```
Article I - Name
  Section 1.1 - Official Name
  Section 1.2 - Abbreviation

Article II - Purpose
  Section 2.1 - Mission
  Section 2.2 - Goals
```

**❌ Bad - Inconsistent:**
```
Article I - Name
  Section 1.1 - Official Name
  Section B - Abbreviation    ← Inconsistent!

Article 2 - Purpose            ← Inconsistent!
  Section 2.1 - Mission
```

---

## Microsoft Word Styles

### Using Built-in Heading Styles

**Why it matters:** Word styles help us identify headers vs. regular text.

**How to apply:**
1. Select your section header text
2. Go to the "Home" tab
3. Choose a heading style from the gallery:
   - **Heading 1** for Articles
   - **Heading 2** for Sections
   - **Heading 3** for Subsections

**Visual Example:**

```
┌─────────────────────────────────┐
│ Home  Insert  Design  Layout    │  ← Ribbon
├─────────────────────────────────┤
│ [Aa] [Aa] [Aa] [Aa] [Aa]        │  ← Styles Gallery
│ Normal H1   H2   H3   H4        │
└─────────────────────────────────┘

Article I - Name              ← Apply "Heading 1"
  Section 1.1 - Purpose       ← Apply "Heading 2"
    (a) Subsection text       ← Apply "Heading 3" (optional)
```

### Custom Styles

If you use custom styles, they should:
- Have distinct font size (larger than body text)
- Use bold or different font family
- Include section numbers at the start

---

## Common Issues & Solutions

### Issue 1: Low Content Retention (< 90%)

**Symptom:** Import shows "78% retention" with many missing sections.

**Common Causes:**
- Headers formatted as normal text (not Word styles)
- Inconsistent numbering (mixing Roman and Arabic)
- Section numbers buried in text, not at the start of line

**Solution:**
```
❌ Before:
The official name is defined in section one point one.

✅ After:
Section 1.1 - Official Name
The official name shall be...
```

### Issue 2: Duplicate Sections

**Symptom:** Warning says "X duplicate sections removed."

**Common Causes:**
- Table of Contents duplicates actual sections
- Copy-pasted sections
- Repeated headers in footers

**Solution:**
- ✓ Keep Table of Contents (we filter it automatically)
- Remove duplicate section headers
- Remove headers from footers

### Issue 3: No Structure Detected

**Symptom:** Error says "No document structure detected."

**Common Causes:**
- No section numbers in headers
- Unusual numbering system (e.g., "Chapter One")
- All text formatted the same way

**Solution:**
Add clear section numbers:
```
❌ Before:
Name and Purpose
The organization shall...

✅ After:
Article I - Name and Purpose
Section 1.1 - Official Name
The organization shall...
```

### Issue 4: Empty Sections

**Symptom:** Info message says "X sections have no content."

**Common Cause:**
Organizational article containers (this is normal!)

**Example (Normal):**
```
Article III - Membership        ← No direct content (container)
  Section 3.1 - Eligibility     ← Has content
  Section 3.2 - Dues            ← Has content
```

**Not an Error:** This structure is fine and intentional.

---

## Word Document Preparation Steps

### Step-by-Step Guide

**1. Start with a Clean Document**
- Open your bylaws in Microsoft Word
- Save a backup copy first!
- Save as `.docx` format (File → Save As → Word Document)

**2. Review Structure**
- Ensure headers are clearly numbered
- Check for consistent numbering throughout
- Verify all content is in the main document (not text boxes)

**3. Apply Heading Styles**
```
Select Article header → Apply "Heading 1"
Select Section header → Apply "Heading 2"
Select Subsection header → Apply "Heading 3" (optional)
```

**4. Clean Up**
- Remove any duplicate sections
- Remove manual page breaks (Ctrl+Shift+8 to show)
- Remove excessive blank lines
- Keep Table of Contents at the beginning

**5. Final Check**
- Open document and scroll through
- Verify all sections are visible and formatted
- Check file size (should be < 10 MB)
- Save and close

**6. Upload**
- Upload to the Governance Tracker
- Review the parse preview
- Check retention percentage (goal: 95%+)

---

## Advanced Tips

### Handling Complex Structures

**Multi-level Hierarchies:**
```
Article I - Name
  Section 1.1 - Official Name
    (a) Short name
    (b) Long name
  Section 1.2 - Abbreviation
    (a) Common abbreviation
```

**Parenthetical Subsections:**
```
Section 2.1 - Membership Classes
There shall be three classes:
(a) Regular members - those who...
(b) Associate members - those who...
(c) Honorary members - those who...
```

**Numbered Lists vs. Subsections:**
- Use parenthetical letters `(a), (b), (c)` for subsections
- Use plain numbers `1., 2., 3.` for simple lists
- We detect parenthetical as subsections, plain as content

### Handling Special Cases

**Preamble (Content Before First Article):**
```
BYLAWS OF XYZ ORGANIZATION

Adopted: January 1, 2024

Preamble:
Whereas the members of this community...    ← We capture this

Article I - Name
...
```

**Appendices and Schedules:**
```
Article X - Final Provisions
  Section 10.1 - Amendments
  ...

SCHEDULE A - FEE STRUCTURE              ← Include as Article or Section
  Annual Dues: $100
  ...
```

**Amendments and Revision History:**
```
Article XII - Amendments
  Section 12.1 - Amendment Process
  ...

[End of Main Bylaws]

Amendment History:                       ← Can be separate section
- Amended January 15, 2023: Article V
- Amended June 30, 2023: Article VIII
```

---

## File Format Specifications

### Supported Formats

| Format | Extension | Version | Support |
|--------|-----------|---------|---------|
| Word Document | `.docx` | 2007+ | ✅ Full support |
| Word 97-2003 | `.doc` | Legacy | ⚠️ Convert to .docx first |
| OpenDocument | `.odt` | - | ❌ Not supported (save as .docx) |
| PDF | `.pdf` | - | ❌ Not supported (convert to Word) |
| Text | `.txt` | - | ❌ Not supported (copy to Word) |
| Google Docs | URL | - | 🔄 Coming soon |

### File Size Limits

- **Maximum:** 10 MB
- **Recommended:** < 5 MB for faster processing
- **Typical bylaws:** 100-500 KB

**If your file is too large:**
- Remove embedded images (insert as links instead)
- Compress images (right-click image → Format Picture → Compress)
- Save as "Strict Open XML Document" (smaller file size)
- Split into multiple documents (we can combine later)

---

## Example Documents

### Template 1: HOA Bylaws (Article → Section)

```
BYLAWS OF SUNSET HILLS HOMEOWNERS ASSOCIATION

Table of Contents
Article I - Name and Purpose.................................1
Article II - Membership......................................3
Article III - Board of Directors.............................5

ARTICLE I - NAME AND PURPOSE

Section 1.1 - Official Name
The official name of this organization shall be the Sunset Hills Homeowners Association, hereinafter referred to as "the Association."

Section 1.2 - Purpose
The purpose of the Association is to maintain and enhance the community's property values and quality of life.

ARTICLE II - MEMBERSHIP

Section 2.1 - Membership Eligibility
Membership in the Association shall be open to all property owners within the defined boundaries.

Section 2.2 - Classes of Membership
There shall be two classes of membership:
(a) Regular members - property owners in good standing
(b) Associate members - tenants with written permission from owners
```

### Template 2: Club Bylaws (Chapter → Section)

```
BYLAWS OF THE RIVERSIDE SAILING CLUB

CHAPTER 1 - GENERAL PROVISIONS

Section 1.1 - Name
The name of this organization shall be the Riverside Sailing Club.

Section 1.2 - Purpose
The club is organized for the purpose of promoting sailing and water safety.

CHAPTER 2 - MEMBERSHIP

Section 2.1 - Eligibility
Membership shall be open to individuals at least 18 years of age.

Section 2.2 - Application Process
Applications for membership shall be submitted in writing to the Membership Committee.
```

### Template 3: Nonprofit Bylaws (Part → Section)

```
BYLAWS OF COMMUNITY HEALTH FOUNDATION

PART I - ORGANIZATION

Section 1 - Formation
The Community Health Foundation is a nonprofit corporation organized under the laws of [State].

Section 2 - Registered Office
The registered office shall be located at [address].

PART II - PURPOSES AND POWERS

Section 1 - Purposes
The Foundation is organized exclusively for charitable and educational purposes.

Section 2 - Powers
The Foundation shall have the power to:
(a) Receive and administer funds
(b) Make grants to qualified organizations
(c) Conduct research and educational programs
```

---

## Troubleshooting Checklist

Use this checklist if your import fails:

**Format Issues:**
- [ ] File is `.docx` format (not .doc, .pdf, or .txt)
- [ ] File size is under 10 MB
- [ ] File opens without errors in Microsoft Word

**Structure Issues:**
- [ ] All section headers have numbers (Article I, Section 1.1)
- [ ] Numbering is consistent throughout
- [ ] Headers use Word heading styles

**Content Issues:**
- [ ] All text is in main document (not text boxes)
- [ ] No critical content in headers/footers
- [ ] Table of Contents is separate from body sections

**If Still Having Issues:**
1. Download our [sample template document](/downloads/bylaws-template.docx)
2. Copy your content into the template
3. Save and try uploading again
4. Or use Manual Setup option for complete control

---

## Getting Help

### Resources

- **Video Tutorial:** [Watch: How to Format Bylaws for Import](#)
- **Sample Templates:** [Download Templates](#)
- **Support Forum:** [Community Help](#)
- **Live Chat:** Available Mon-Fri 9am-5pm EST

### Contact Support

If you're still having trouble:
- Email: support@bylaws-tracker.com
- Include: Document name, error message, retention percentage
- Attach: Your .docx file (we'll review it privately)

Response time: Within 24 hours

---

## Parser Capabilities Reference

### What We Can Parse

✅ **Supported:**
- Article/Section/Subsection hierarchies
- Roman numerals (I, II, III, IV, V...)
- Arabic numbers (1, 2, 3, 4, 5...)
- Decimal numbering (1.1, 1.2, 2.1...)
- Alphabetical numbering (A, B, C or a, b, c)
- Parenthetical subsections (a), (b), (c)
- Mixed numbering in proper hierarchy
- Organizational containers (empty articles)
- Preambles and appendices
- Table of contents (auto-filtered)

✅ **Content Retention:**
- Plain text: 100%
- Formatted text (bold, italic): 100% (text captured, format optional)
- Lists and bullets: 100%
- Tables: 95%+ (content captured, structure may vary)

### What We Don't Parse (Yet)

❌ **Not Supported:**
- Images and diagrams (captured as placeholders)
- Embedded objects (charts, equations)
- Comments and track changes
- Text boxes and shapes
- Multiple columns (flattened to single column)
- Footnotes and endnotes (captured inline)

🔄 **Coming Soon:**
- Google Docs direct import
- PDF text extraction
- Image OCR
- Collaborative multi-file import

---

## FAQ

**Q: Do I need to remove the Table of Contents?**
A: No! We automatically detect and filter it. Keep it in your document.

**Q: What if I use "Chapter" instead of "Article"?**
A: That's fine! Our parser recognizes various terms. Just be consistent.

**Q: Can I mix Roman numerals and Arabic numbers?**
A: Yes, but use them at different levels (e.g., Roman for Articles, Arabic for Sections).

**Q: What happens to formatting like bold and italic?**
A: We capture the text, and can optionally preserve formatting. Check "Preserve formatting" during import.

**Q: Will my section numbering be preserved exactly?**
A: Yes! We store the exact number as it appears in your document.

**Q: What if I have 100+ sections?**
A: No problem! We've successfully imported documents with 200+ sections. Just might take 10-15 seconds.

**Q: Can I edit sections after import?**
A: Absolutely! The import is just the starting point. You can edit, add, delete sections anytime.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-09
**Author:** System Architecture Designer

**Quick Links:**
- [Onboarding Flow Design](./ONBOARDING_FLOW.md)
- [Error Messages Guide](./ERROR_MESSAGES.md)
- [Technical Documentation](../README.md)
