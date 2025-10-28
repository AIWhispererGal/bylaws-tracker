# 🔍 Expand/Collapse Debugging Guide

**Issue:** Clicking on sections doesn't expand them

---

## 🧪 DEBUGGING STEPS

### Step 1: Check Browser Console (MOST IMPORTANT)
1. Open document viewer
2. Press **F12** to open Developer Tools
3. Click on **Console** tab
4. Look for **RED error messages**
5. **Report back any errors you see**

Common errors to look for:
- `Uncaught SyntaxError`
- `Uncaught ReferenceError`
- `toggleSection is not defined`
- `sections is not defined`

### Step 2: Check if onclick Attribute Exists
1. Right-click on a section card
2. Select **"Inspect Element"**
3. Look at the `<div class="section-card">` element
4. **Check if it has `onclick="toggleSection('...')"`**

Expected:
```html
<div class="section-card"
     id="section-1"
     data-section-id="abc-123-def"
     onclick="toggleSection('abc-123-def')">
```

### Step 3: Test toggleSection Manually
1. Open browser console (F12)
2. Type this command and press Enter:
```javascript
typeof toggleSection
```

Expected result: `"function"`

If you get `"undefined"`, the function isn't loading.

### Step 4: Test Clicking Manually
1. In browser console, type:
```javascript
toggleSection('any-section-id-here')
```

Does it expand/collapse anything?

---

## 📊 REPORT BACK

Please report:
1. ✅ Any RED errors in console
2. ✅ Does onclick attribute exist on section-card divs?
3. ✅ What does `typeof toggleSection` return?
4. ✅ Does manual toggleSection call work?

---

## 🔧 POSSIBLE FIXES

### If Console Shows: "sections is not defined"
The EJS template rendering failed. Check server logs.

### If Console Shows: "toggleSection is not defined"
The main script block didn't load. Check for earlier JavaScript errors.

### If onclick is missing from section-card
The EJS template isn't rendering the onclick attribute.
Check line 517 in document-viewer.ejs

### If No Errors But Still Not Working
CSS might be blocking clicks. Check if section-card has `pointer-events: none`

---

**Most likely:** There's a JavaScript syntax error preventing the script from loading. The browser console will show the exact line and error.
