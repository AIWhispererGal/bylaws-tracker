# DOCX Export - Quick Start (Next Session)

**5-Minute Session Kickoff Guide**

---

## TL;DR - What to Do Next Session

1. **Install packages** (2 min):
   ```bash
   npm install docx diff --save
   ```

2. **Create service** (3 hours):
   - Copy code from `/docs/guides/DOCX_EXPORT_IMPLEMENTATION_GUIDE.md` Phase 2
   - Save as `/src/services/docxExporter.js`

3. **Add endpoint** (1 hour):
   - Copy code from Implementation Guide Phase 5
   - Add to `/src/routes/dashboard.js` after line 1281

4. **Add frontend button** (1 hour):
   - Copy code from Implementation Guide Phase 6
   - Add to `/views/dashboard/document-viewer.ejs` after line 361

5. **Test** (2 hours):
   - Visit document viewer
   - Click "Export Word" button
   - Open in Microsoft Word
   - Verify formatting

**Total Time:** 8 hours

---

## Files to Create

```
/src/services/docxExporter.js       ← NEW (Copy from guide)
```

## Files to Modify

```
/src/routes/dashboard.js            ← Add endpoint (after line 1281)
/views/dashboard/document-viewer.ejs ← Add button (after line 361)
/package.json                       ← Auto-updated by npm install
```

## Code Locations

### 1. Service Code
**Location in Guide:** Phase 2, Section 2.1
**Destination:** `/src/services/docxExporter.js`
**Size:** ~500 lines

### 2. Route Code
**Location in Guide:** Phase 5, Section 5.1
**Destination:** `/src/routes/dashboard.js` (line ~1282)
**Size:** ~120 lines

### 3. Frontend Code
**Location in Guide:** Phase 6, Sections 6.1 and 6.2
**Destination:** `/views/dashboard/document-viewer.ejs` (line ~362)
**Size:** ~80 lines (HTML + JavaScript)

---

## Installation Command

```bash
npm install docx diff --save
```

**Expected Result:**
```
+ docx@8.5.0
+ diff@7.0.0
added 2 packages in 3.2s
```

---

## Testing Checklist

### Quick Test (5 min)
- [ ] Export button visible
- [ ] File downloads
- [ ] Opens in Word
- [ ] Has red strikethrough
- [ ] Has blue underline

### Full Test (1 hour)
- [ ] All changed sections exported
- [ ] No unchanged sections
- [ ] Section numbers correct
- [ ] Professional appearance
- [ ] Works for viewer (disabled)
- [ ] Works for member (enabled)

---

## Success Criteria

✅ Export only changed sections
✅ Strikethrough for deleted (red)
✅ Underline for added (blue)
✅ Professional Word format
✅ Correct filename format

---

## If Something Breaks

**Check:**
1. Node version: `node --version` (should be v22+)
2. Packages installed: `npm list docx diff`
3. File paths correct (absolute paths in guide)
4. Console errors: Check browser console and server logs

**Common Fixes:**
- `Cannot find module 'docx'` → Run `npm install docx --save`
- `Cannot find module 'diff'` → Run `npm install diff --save`
- `Packer is not a function` → Check import: `const { Packer } = require('docx');`
- `File corrupted` → Check buffer handling in endpoint

---

## Documentation References

**Primary Guide:** `/docs/guides/DOCX_EXPORT_IMPLEMENTATION_GUIDE.md`
- Complete implementation details
- All code examples
- Step-by-step instructions
- Troubleshooting guide

**User Guide:** `/docs/user/DOCX_EXPORT_USER_GUIDE.md`
- End-user documentation
- How to use the feature
- FAQs and examples

**Feasibility Analysis:** `/docs/analysis/DOCX_EXPORT_FEASIBILITY.md`
- Original research
- Library comparison
- Effort estimates

---

## Session Plan

### Hour 1: Setup (30 min work + 30 min verification)
- Install packages
- Verify installation
- Review code structure

### Hour 2-4: Service Implementation (3 hours)
- Create docxExporter.js
- Implement document generation
- Implement diff algorithm
- Implement Track Changes formatting
- Test service in isolation

### Hour 5: Endpoint (1 hour)
- Add route to dashboard.js
- Import dependencies
- Test endpoint with curl/Postman

### Hour 6: Frontend (1 hour)
- Add button to document-viewer.ejs
- Add JavaScript handler
- Wire up button to endpoint
- Test in browser

### Hour 7-8: Testing (2 hours)
- Manual testing with real data
- Test all edge cases
- Test permissions
- Test with Microsoft Word
- Fix any issues found

---

## Victory Conditions

### Must Complete
- [x] Packages installed
- [x] Service created
- [x] Endpoint added
- [x] Button added
- [x] Downloads DOCX file
- [x] Opens in Word
- [x] Shows Track Changes formatting

### Should Complete
- [ ] All changed sections included
- [ ] Professional appearance
- [ ] Correct filename
- [ ] Error handling works
- [ ] Permissions work

### Nice to Have
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] User documentation updated
- [ ] Admin notified

---

## Next Next Session (Future)

**Enhancements to Consider:**
- PDF export option
- Side-by-side comparison table
- Batch export (multiple documents)
- Customizable color schemes
- Export templates
- Comment annotations

**See:** Implementation Guide Appendix for details

---

## Contact & Support

**Documentation:**
- Implementation Guide: `/docs/guides/DOCX_EXPORT_IMPLEMENTATION_GUIDE.md`
- User Guide: `/docs/user/DOCX_EXPORT_USER_GUIDE.md`
- Feasibility: `/docs/analysis/DOCX_EXPORT_FEASIBILITY.md`

**Code References:**
- Existing JSON export: `/src/routes/dashboard.js` lines 1127-1281
- Section storage: `/src/services/sectionStorage.js`
- Document viewer: `/views/dashboard/document-viewer.ejs`

**Libraries:**
- docx: https://docx.js.org/
- diff: https://github.com/kpdecker/jsdiff

---

**Ready to implement! 🚀**

**Estimated completion: 8 hours**
**Complexity: MEDIUM**
**Risk: LOW**

Good luck! The comprehensive guide has everything you need.

---

**Quick Start Version:** 1.0
**Last Updated:** 2025-10-28
**Related:** DOCX_EXPORT_IMPLEMENTATION_GUIDE.md
