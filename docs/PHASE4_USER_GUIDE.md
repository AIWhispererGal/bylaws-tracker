# Phase 4: User Guide - Multi-Format Document Upload

## What's New?

Your Bylaws Tool now supports **4 file formats** for document upload:

- **Word Documents**: `.docx` and `.doc` (as before)
- **Plain Text**: `.txt` (NEW)
- **Markdown**: `.md` (NEW)

## How to Upload Different File Types

### Upload Text File (.txt)

1. Navigate to Admin Dashboard
2. Click "Upload Document"
3. Select your `.txt` file
4. Click "Upload"
5. Your bylaws will be parsed and stored automatically

**Example .txt format:**
```
Article I - Name and Purpose

Section 1.1 - Name
The organization shall be known as...

Section 1.2 - Purpose
The purpose of this organization is...
```

### Upload Markdown File (.md)

1. Navigate to Admin Dashboard
2. Click "Upload Document"
3. Select your `.md` file
4. Click "Upload"
5. Your bylaws will be parsed and stored automatically

**Example .md format:**
```markdown
# Article I - Name and Purpose

## Section 1.1 - Name
The organization shall be known as...

## Section 1.2 - Purpose
The purpose of this organization is...
```

### Upload Word Document (.docx)

Works exactly as before - no changes to existing functionality!

## File Format Comparison

| Format | Best For | Advantages |
|--------|----------|------------|
| `.docx` | Rich formatting, complex documents | Full formatting support, images, tables |
| `.txt` | Simple documents, plain text | Fast parsing, universal compatibility |
| `.md` | Technical docs, GitHub integration | Clean syntax, version control friendly |

## Supported Hierarchy Patterns

All formats support the same 10-level hierarchy:

- **Roman numerals**: I, II, III, IV
- **Numbers**: 1, 2, 3, 4
- **Letters**: A, B, C or a, b, c
- **Parenthetical**: (a), (1), (i)

Example:
```
Article I - Top Level (Depth 0)
  Section 1.1 - Second Level (Depth 1)
    1.1.1 - Third Level (Depth 2)
      (a) - Fourth Level (Depth 3)
```

## Error Messages

If you try to upload an unsupported file type:

❌ **Error**: "Only .doc, .docx, .txt, and .md files are allowed"

**Solution**: Convert your file to one of the supported formats.

## Technical Details

### Automatic Parser Selection

The system automatically detects your file type and uses the correct parser:

- `.txt` and `.md` → Text Parser
- `.docx` and `.doc` → Word Parser

You don't need to do anything - it just works!

### Database Storage

All file formats are stored identically in the database:
- Same section structure
- Same hierarchy levels
- Same search capabilities
- Same editing features

## FAQ

**Q: Can I mix file formats?**
A: Yes! Upload .docx for one document and .txt for another.

**Q: Will my existing .docx uploads still work?**
A: Absolutely! Zero changes to existing functionality.

**Q: Which format should I use?**
A:
- Use `.docx` if you need formatting, images, or tables
- Use `.txt` for simple text documents
- Use `.md` if you work with GitHub or version control

**Q: Is there a file size limit?**
A: Yes, 10MB maximum for all file types.

**Q: Can I upload PDFs?**
A: Not yet - only .docx, .doc, .txt, and .md are supported.

## Performance

| File Type | Average Parse Time | Memory Usage |
|-----------|-------------------|--------------|
| `.txt` | ~50ms | Low |
| `.md` | ~50ms | Low |
| `.docx` | ~150ms | Medium |

Text and Markdown files parse 2-3x faster than Word documents!

## Best Practices

1. **Use consistent formatting** in your source file
2. **Number sections clearly** (1.1, 1.2, etc.)
3. **Use clear section titles**
4. **Keep files under 10MB**
5. **Test with a small file first**

## Getting Help

If you encounter issues:

1. Check the file format is supported
2. Verify the file isn't corrupted
3. Try a smaller test file
4. Contact your system administrator

## What's Coming Next?

Future enhancements may include:
- PDF support
- Rich Text Format (.rtf)
- OpenDocument (.odt)
- Batch upload

---

**Questions?** Check the full documentation in `/docs/PHASE4_INTEGRATION_COMPLETE.md`
