# Setup Wizard Critical Fix

## Quick Fix Guide

Apply these changes to `/src/routes/setup.js` to fix the wizard flow.

---

## Fix #1: Organization Form (Line 104)

**Current Code:**
```javascript
// Line 104
res.redirect('/setup/document-type');
```

**Fixed Code:**
```javascript
res.json({ success: true, redirectUrl: '/setup/document-type' });
```

---

## Fix #2: Document-Type Form (Line 155)

**Current Code:**
```javascript
// Line 155
res.redirect('/setup/workflow');
```

**Fixed Code:**
```javascript
res.json({ success: true, redirectUrl: '/setup/workflow' });
```

---

## Fix #3: Workflow Form (Line 215)

**Current Code:**
```javascript
// Line 215
res.redirect('/setup/import');
```

**Fixed Code:**
```javascript
res.json({ success: true, redirectUrl: '/setup/import' });
```

---

## Fix #4: Import Form (Line 295)

**Current Code:**
```javascript
// Line 295
res.redirect('/setup/processing');
```

**Fixed Code:**
```javascript
res.json({ success: true, redirectUrl: '/setup/processing' });
```

---

## Fix #5: Update Client JS to Handle Redirect (Optional Enhancement)

The client JavaScript already handles `redirectUrl` correctly, but we can improve error handling:

**File:** `/public/js/setup-wizard.js`

**Add this helper function at the top of SetupWizard object (after line 8):**

```javascript
/**
 * Handle server response with redirect
 */
async handleServerResponse(response) {
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned unexpected response format');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Operation failed');
    }

    // Handle redirect if provided
    if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return result;
    }

    return result;
},
```

**Then update each submit handler to use it:**

**Example for Organization Submit (Lines 143-150):**
```javascript
// Current:
const result = await response.json();
if (result.success) {
    window.location.href = '/setup/document-type';
}

// Better:
await this.handleServerResponse(response);
```

---

## Testing After Fix

### Test Steps:
1. Restart server: `npm start`
2. Visit: `http://172.31.239.231:3000/setup`
3. Complete each step:
   - ✅ Fill organization form → should redirect to document-type
   - ✅ Select structure card → click Continue → should redirect to workflow
   - ✅ Configure workflow → should redirect to import
   - ✅ Upload/skip document → should redirect to processing
   - ✅ Processing completes → should redirect to success

### Validation:
- No JavaScript errors in browser console
- Session data persists between pages
- Organization record created in Supabase
- All redirects work smoothly

---

## Alternative: Apply All Fixes at Once

Save this to a file and run it:

```bash
# backup original
cp src/routes/setup.js src/routes/setup.js.backup

# apply fixes using sed
sed -i '104s|res.redirect(\x27/setup/document-type\x27);|res.json({ success: true, redirectUrl: \x27/setup/document-type\x27 });|' src/routes/setup.js
sed -i '155s|res.redirect(\x27/setup/workflow\x27);|res.json({ success: true, redirectUrl: \x27/setup/workflow\x27 });|' src/routes/setup.js
sed -i '215s|res.redirect(\x27/setup/import\x27);|res.json({ success: true, redirectUrl: \x27/setup/import\x27 });|' src/routes/setup.js
sed -i '295s|res.redirect(\x27/setup/processing\x27);|res.json({ success: true, redirectUrl: \x27/setup/processing\x27 });|' src/routes/setup.js

echo "Fixes applied! Restart server to test."
```

---

## Priority: CRITICAL

This fix is **REQUIRED** for the setup wizard to function. Without it, users cannot complete the onboarding flow.

**Impact:** Blocks all new organization setup
**Effort:** 15 minutes to apply fixes + 15 minutes to test
**Risk:** Low - simple response format change
