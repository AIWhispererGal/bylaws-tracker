# Error Messages & User Guidance

## Overview

This document catalogs all user-facing error messages in the onboarding flow, providing consistent, helpful, and actionable guidance.

---

## Principles for Error Messages

1. **Be Human:** Use conversational, empathetic language
2. **Be Specific:** Tell users exactly what went wrong
3. **Be Actionable:** Always provide clear next steps
4. **Be Positive:** Frame as opportunities to improve, not failures

**Template:**
```
[Icon] [What happened]

[Why it happened - optional if obvious]

[What to do about it]:
• Action 1
• Action 2
• Action 3

[Button: Primary Action] [Button: Alternative Action]
```

---

## Upload Errors

### UE-001: Invalid File Type

**Trigger:** User uploads non-.docx file (e.g., .pdf, .txt, .doc)

**Message:**
```
❌ Invalid File Type

We can only import .docx files (Microsoft Word 2007 or newer).

You uploaded: [filename.pdf]

To fix this:
• Open your document in Microsoft Word
• Click "File" → "Save As"
• Choose "Word Document (.docx)" as the format
• Upload the new file

[Upload Different File] [Get Help]
```

**Technical Details (for logs):**
- Error Code: UE-001
- File Type: [mime-type]
- Expected: application/vnd.openxmlformats-officedocument.wordprocessingml.document

---

### UE-002: File Too Large

**Trigger:** File exceeds 10MB limit

**Message:**
```
❌ File Too Large

Your file is [X.X] MB, but our limit is 10 MB.

To reduce file size:
• Remove embedded images or compress them
• Save as a "Strict" DOCX format in Word
• Split into multiple documents (we can combine later)

[Upload Smaller File] [Contact Support]
```

**Technical Details:**
- Error Code: UE-002
- File Size: [bytes]
- Limit: 10485760 bytes (10 MB)

---

### UE-003: Corrupted or Unreadable File

**Trigger:** Mammoth.js fails to parse the document

**Message:**
```
❌ Unable to Read Document

The file appears to be corrupted or uses an unsupported format.

Try these solutions:
• Open the document in Microsoft Word
• Make sure it opens correctly without errors
• Save it again as a .docx file
• Upload the newly saved version

Still having trouble? The document might use advanced Word features we don't support yet.

[Try Again] [Use Manual Setup] [Get Help]
```

**Technical Details:**
- Error Code: UE-003
- Parser Error: [mammoth error message]
- File: [filename]

---

### UE-004: Empty Document

**Trigger:** No text content extracted

**Message:**
```
❌ Document Appears Empty

We couldn't find any text content in your document.

Please check:
• The document actually contains text
• Text isn't hidden or in text boxes
• The document isn't just images

If your bylaws are in images or scanned PDFs, you'll need to use manual setup for now.

[Upload Different File] [Manual Setup] [Get Help]
```

**Technical Details:**
- Error Code: UE-004
- Extracted Length: 0 characters
- File: [filename]

---

### UE-005: Network Upload Error

**Trigger:** Network failure during upload

**Message:**
```
❌ Upload Failed

We couldn't upload your file. This usually means a network issue.

Please try:
• Check your internet connection
• Refresh the page and try again
• Try a different browser if the problem persists

Your progress is saved, so you won't lose your organization information.

[Retry Upload] [Check Connection] [Get Help]
```

**Technical Details:**
- Error Code: UE-005
- Network Error: [error type]
- Retry Attempt: [count]

---

## Parsing Errors

### PE-001: No Structure Detected

**Trigger:** No section headers found in document

**Message:**
```
⚠️ No Document Structure Detected

We couldn't find any section headings (like "Article I" or "Section 1").

This might mean:
• Your document doesn't use standard heading styles
• Headings are formatted as regular text
• The document uses an unusual structure

What to do:
1. Review our formatting guide to see what we expect
2. Update your document to use Word heading styles
3. Or use Manual Setup to define sections yourself

[View Formatting Guide] [Re-upload Fixed Document] [Manual Setup]
```

**Technical Details:**
- Error Code: PE-001
- Detected Items: 0
- Document Length: [chars]

---

### PE-002: Low Content Retention

**Trigger:** Retention rate < 90%

**Severity Levels:**

**Critical (< 80%):**
```
❌ Low Content Retention (78.5%)

Only 78.5% of your document content was captured. This suggests significant formatting issues.

Issues found:
• Inconsistent section numbering
• Missing headers for some content
• Unrecognized document structure

We strongly recommend:
1. Review the formatting guide
2. Fix your document structure
3. Re-upload for better results

Or skip automatic import and use Manual Setup instead.

[📄 Formatting Guide] [🔄 Fix & Re-upload] [⚙️ Manual Setup]
```

**Warning (80-90%):**
```
⚠️ Good Content Retention (87.2%)

We captured 87.2% of your content. Some sections may have been missed.

Issues found:
• Some sections without clear headers
• Inconsistent numbering in places
• [Specific issues if available]

You can:
• Continue with what we found (you can add missing sections later)
• Fix the document and re-upload for better results
• Use manual setup for complete control

[Continue Anyway] [Fix & Re-upload] [Manual Setup]
```

**Technical Details:**
- Error Code: PE-002
- Retention: [X.XX]%
- Original Length: [chars]
- Captured Length: [chars]

---

### PE-003: Inconsistent Numbering

**Trigger:** Mixed or irregular numbering patterns

**Message:**
```
⚠️ Inconsistent Section Numbering

We found multiple numbering styles in your document:
• Roman numerals (I, II, III)
• Arabic numbers (1, 2, 3)
• Letters (A, B, C)

This makes it hard to determine the hierarchy.

Examples found:
• Article I
• Article 2 (expected: Article II)
• Section A (expected: Section 1)

Recommendation:
• Use consistent numbering throughout
• Articles: Roman (I, II, III)
• Sections: Decimal (1.1, 1.2, 2.1)

[Continue with Best Guess] [View Examples] [Manual Setup]
```

**Technical Details:**
- Error Code: PE-003
- Numbering Patterns: [list]
- Affected Sections: [citations]

---

### PE-004: Duplicate Sections Removed

**Trigger:** Duplicate citations found (usually from TOC)

**Severity:** Info (not an error)

**Message:**
```
ℹ️ Duplicate Sections Removed

We found [X] duplicate sections and removed them automatically.

This is normal if your document has:
• A table of contents at the beginning
• Section headers repeated in footers
• Copy-pasted content

Duplicates removed:
• Article I - Name (TOC entry)
• Article II - Purpose (TOC entry)
• [Others...]

The actual section content is preserved. No action needed.

[✓ Continue]
```

**Technical Details:**
- Error Code: PE-004 (Info)
- Duplicates: [count]
- Removed: [citations]

---

### PE-005: Empty Sections Detected

**Trigger:** Sections with no content text

**Severity:** Warning (but often normal)

**Message:**
```
ℹ️ Organizational Containers Detected

[X] sections appear to have no content:
• Article III - Membership
• Article V - Governance
• Article VII - Amendments

This is normal if:
✓ These "Articles" only contain subsections
✓ The actual content is in the subsections
✓ They serve as organizational containers

Example:
Article III - Membership (no direct content)
  Section 3.1 - Eligibility (has content)
  Section 3.2 - Dues (has content)

This is fine! We've preserved the structure correctly.

[✓ Looks Good, Continue]
```

**Technical Details:**
- Error Code: PE-005 (Info)
- Empty Sections: [count]
- Citations: [list]
- Type: Organizational containers

---

### PE-006: Missing Section Numbers

**Trigger:** Gaps in sequential numbering

**Message:**
```
⚠️ Gaps in Section Numbering

We noticed some numbers are missing:

Expected sequence: 1.1, 1.2, 1.3, 1.4
Found in document: 1.1, 1.2, 1.4 (missing 1.3)

This might mean:
• Section 1.3 was deleted but header remains in TOC
• Numbering error in the original document
• Section 1.3 exists but wasn't detected

What to do:
• Review the imported sections
• Add missing sections manually if needed
• Or fix the source document and re-upload

[Review Sections] [Continue Anyway] [Re-upload]
```

**Technical Details:**
- Error Code: PE-006
- Missing Numbers: [list]
- Affected Articles: [list]

---

## Processing Errors

### PR-001: Database Save Error

**Trigger:** Supabase insert fails

**Message:**
```
❌ Unable to Save Sections

We parsed your document successfully, but couldn't save the sections to the database.

This is usually a temporary issue. Please try again.

If the problem persists:
• Check your internet connection
• Refresh the page and retry
• Contact support with error code: PR-001-[timestamp]

Your document is safe and we can retry the import.

[Retry Save] [Contact Support]
```

**Technical Details:**
- Error Code: PR-001
- Database Error: [supabase error]
- Sections Parsed: [count]
- Retry Count: [n]

---

### PR-002: Processing Timeout

**Trigger:** Parsing takes > 60 seconds

**Message:**
```
⏱️ Processing Timeout

Your document is taking longer than expected to process.

This might mean:
• The document is very large (100+ sections)
• Complex formatting is slowing things down
• Server is experiencing high load

What to do:
• Refresh and try again (often works!)
• Use Manual Setup for immediate access
• Contact support if you need help

[Try Again] [Manual Setup] [Contact Support]
```

**Technical Details:**
- Error Code: PR-002
- Processing Time: [seconds]
- Document Size: [chars/sections]
- Last Step Completed: [step]

---

### PR-003: Memory/Resource Error

**Trigger:** Document too large for parser

**Message:**
```
❌ Document Too Complex

Your document is too complex for automatic processing.

Document stats:
• Size: [X] MB
• Estimated sections: [Y]

Recommendations:
• Split the document into smaller parts (we can combine them later)
• Simplify formatting (remove embedded objects, images)
• Use Manual Setup to import in stages

We're working on supporting larger documents!

[Split Document Guide] [Manual Setup] [Contact Support]
```

**Technical Details:**
- Error Code: PR-003
- Document Size: [bytes]
- Memory Used: [MB]
- Sections Attempted: [count]

---

### PR-004: Validation Error

**Trigger:** Stored sections don't match parsed sections

**Message:**
```
⚠️ Validation Issues Detected

After importing, we found some inconsistencies:

Issues:
• [X] sections have mismatched content
• [Y] sections missing from database
• [Z] sections with incorrect hierarchy

This might be:
• A temporary sync issue
• Database constraint violation
• Unexpected data format

What to do:
1. Review the imported sections
2. Fix any issues manually
3. Or retry the import process

[View Issues] [Retry Import] [Continue Anyway]
```

**Technical Details:**
- Error Code: PR-004
- Validation Errors: [list]
- Sections Affected: [citations]

---

## Google Docs Errors (Future)

### GD-001: Invalid URL

**Trigger:** Not a valid Google Docs URL

**Message:**
```
❌ Invalid Google Docs URL

The link you provided isn't a valid Google Docs document URL.

A valid URL looks like:
https://docs.google.com/document/d/DOCUMENT_ID/edit

You entered:
[user-provided URL]

Please:
• Copy the URL from your Google Docs browser tab
• Make sure you're sharing a "document" (not a spreadsheet or form)
• Paste the complete URL including "https://"

[Try Again] [Upload File Instead]
```

**Technical Details:**
- Error Code: GD-001
- Provided URL: [url]
- URL Pattern Expected: docs.google.com/document/d/*

---

### GD-002: Access Denied

**Trigger:** Document not publicly accessible

**Message:**
```
❌ Cannot Access Document

Your Google Doc isn't publicly accessible. We need permission to read it.

How to fix:
1. Open your document in Google Docs
2. Click the "Share" button (top-right)
3. Change access to "Anyone with the link"
4. Make sure role is set to "Viewer" or higher
5. Copy the new link and paste it here

[View Instructions] [Try New Link] [Upload File Instead]
```

**Technical Details:**
- Error Code: GD-002
- Access Error: [403/401]
- URL: [url]

---

### GD-003: Fetch Failed

**Trigger:** Network/API error fetching from Google

**Message:**
```
❌ Unable to Fetch Document

We couldn't download your Google Doc. This might be:
• Temporary Google API issue
• Network connectivity problem
• Rate limiting (too many requests)

What to do:
• Wait a minute and try again
• Download the doc as .docx and upload it instead
• Check Google's status page

[Retry] [Download & Upload Guide] [Check Status]
```

**Technical Details:**
- Error Code: GD-003
- API Error: [error]
- URL: [url]
- Retry Count: [n]

---

## Manual Configuration Fallback

### When to Offer Manual Setup

Show "Manual Setup" option when:
1. Parse success but low retention (< 90%)
2. No structure detected
3. User requests it explicitly
4. Any critical parsing error

**Manual Setup Entry Message:**
```
⚙️ Manual Setup Option

Can't get automatic import to work? No problem!

Manual Setup lets you:
✓ Define your document structure from scratch
✓ Copy-paste sections one at a time
✓ Build exactly the structure you want
✓ Import at your own pace

It takes 15-20 minutes but gives you complete control.

[Start Manual Setup] [Try Auto-Import Again]
```

---

## Success Messages

### Parse Success (Excellent Retention)

```
✅ Perfect Import!

Your document was imported successfully with excellent results.

📊 Import Summary:
• Total Sections: [24]
• Content Retention: [96.84%] ✓
• Structure: Article → Section
• Quality: Excellent

All sections have been saved and are ready to use.

[Continue to Next Step →]
```

### Parse Success (Good Retention with Warnings)

```
✓ Import Complete (with minor issues)

Your document was imported successfully. We found a few minor issues:

📊 Import Summary:
• Total Sections: [22]
• Content Retention: [92.3%]
• Structure: Article → Section
• Quality: Good

⚠️ Minor Issues:
• 3 organizational containers have no content (normal)
• 1 duplicate section removed from TOC

These won't affect your ability to use the system.

[View Details] [Continue →]
```

---

## Help Links & Resources

Include these links in error messages:

- **Formatting Guide:** `/help/document-formatting`
- **Troubleshooting:** `/help/import-troubleshooting`
- **Contact Support:** `/support` or `support@example.com`
- **Community Forum:** `/community`
- **Video Tutorial:** `/tutorials/document-import`

---

## Error Logging

**For every error, log:**
```javascript
{
  errorCode: "PE-002",
  timestamp: "2025-10-09T10:30:00Z",
  userId: "user-123",
  sessionId: "session-456",
  documentName: "bylaws_2024.docx",
  documentSize: 2457600,
  errorDetails: {
    retentionRate: 87.2,
    originalLength: 45230,
    capturedLength: 39460,
    sectionsFound: 18
  },
  userAction: "displayed_warning", // or "re-uploaded", "used_manual", etc.
  context: {
    organizationId: "org-789",
    step: "document-import",
    attemptNumber: 1
  }
}
```

---

## Testing Error Messages

**Checklist for each error message:**
- [ ] Uses appropriate icon/emoji
- [ ] States what happened clearly
- [ ] Explains why (if not obvious)
- [ ] Provides 2-3 actionable steps
- [ ] Includes primary and secondary action buttons
- [ ] Links to help resources
- [ ] Logs error with context
- [ ] Tested with real users

---

**Document Version:** 1.0
**Last Updated:** 2025-10-09
**Author:** System Architecture Designer
