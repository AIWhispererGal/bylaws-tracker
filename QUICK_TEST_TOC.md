# Quick Test Guide - TOC Sidebar

## ⚡ Quick Start

1. **Restart Server:**
   ```bash
   npm start
   ```

2. **Open Document:**
   - Navigate to Dashboard
   - Click any document

3. **Look for Toggle Button:**
   - Left edge of screen
   - Circular button with 📋 icon
   - Shows section count badge

4. **Click Toggle Button:**
   - Sidebar slides in from left
   - Shows "Document Map" header
   - Lists all sections with #1, #2, #3...

## ✅ Success Checklist

- [ ] Toggle button visible on left edge
- [ ] Click toggle → sidebar opens
- [ ] See list of sections with numbering
- [ ] Search box works (type to filter)
- [ ] Click section → page scrolls to it
- [ ] Section number badges visible on cards (#1, #2, etc.)
- [ ] Click number badge → "Link copied" message
- [ ] Keyboard shortcut Ctrl+K toggles TOC
- [ ] Escape key closes TOC
- [ ] No console errors (F12 → Console tab)

## 🐛 If Issues

1. **Clear browser cache:** Ctrl+Shift+R (or Cmd+Shift+R)
2. **Check console for errors:** F12 → Console
3. **Verify files load:** F12 → Network → Look for:
   - `/css/section-numbering-toc.css` (status 200)
   - `/js/section-numbering-toc.js` (status 200)

## 📱 Mobile Test

1. Open on mobile device or resize browser to < 768px
2. Toggle button should still be visible
3. Click toggle → sidebar overlays content
4. Click section or backdrop → sidebar closes

## 🎯 What Changed

**Before:** TOC files existed but weren't loaded
**After:** Added 2 lines to load CSS and JS files
**Result:** Full-featured TOC sidebar now visible

---

**Files Changed:** `views/dashboard/document-viewer.ejs` (2 lines)
**Documentation:** See `docs/fixes/TOC_SIDEBAR_IMPLEMENTATION.md`
