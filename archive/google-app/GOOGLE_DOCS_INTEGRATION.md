# Google Docs Integration Guide

Complete guide to integrating the Bylaws Amendment Tracker with Google Docs for automated section parsing and synchronization.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Install Apps Script](#install-apps-script)
4. [Configure Connection](#configure-connection)
5. [Use the Add-on](#use-the-add-on)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Features](#advanced-features)

---

## Overview

The Google Docs integration allows you to:
- ✅ Automatically parse bylaws from Google Docs into sections
- ✅ Sync changes from Google Docs to your tracker
- ✅ Maintain formatting and structure
- ✅ Track version history

**How it works:**
1. Add Apps Script to your Google Doc
2. Configure script with your app URL
3. Click menu item to parse sections
4. Sections automatically sync to your database

---

## Prerequisites

### Required
- Google Account (free)
- Google Docs document with your bylaws
- Deployed Bylaws Tracker (Render URL)
- Supabase database configured

### Document Requirements

Your Google Docs bylaws should have:
- **Clear article headings** (e.g., "Article I", "Article II")
- **Clear section headings** (e.g., "Section 1", "Section 2")
- **Consistent formatting** (bold headers recommended)

**Example structure:**
```
Article I: Name and Purpose
  Section 1: Official Name
    The name of this organization shall be...

  Section 2: Purpose
    The purpose of this organization is to...

Article II: Membership
  Section 1: Eligibility
    Membership is open to...
```

---

## Install Apps Script

### Step 1: Open Script Editor

1. Open your Google Docs bylaws document
2. Click: **Extensions** → **Apps Script**
3. A new tab opens with the Apps Script editor

### Step 2: Copy Script Code

1. **Delete any existing code** in the editor
2. **Copy the script** from one of these sources:

   **Option A: From Repository**
   - Navigate to: `/scripts/google-apps-script/Code.gs`
   - Copy ALL the code

   **Option B: Direct Link** (if available)
   - Get from project documentation

3. **Paste** into the Apps Script editor

### Step 3: Review Script Structure

The script contains these key functions:

```javascript
// Configuration
const APP_URL = 'http://localhost:3000'; // ← YOU WILL UPDATE THIS

// Main functions
function onOpen() {...}              // Creates menu
function parseBylawsIntoSections() {...} // Parses document
function syncToTracker(sections) {...}   // Syncs to app
function testConnection() {...}          // Tests API connection
```

### Step 4: Save Script

1. Click: **File** → **Save** (or Ctrl+S / Cmd+S)
2. Give it a name: "Bylaws Sync Script"
3. Click "OK"

**Time Required:** 3 minutes

---

## Configure Connection

### Step 1: Update APP_URL

1. Find this line in the script:
```javascript
const APP_URL = 'http://localhost:3000';
```

2. Replace with your **actual app URL**:
```javascript
const APP_URL = 'https://bylaws-tracker.onrender.com';
```

**Important:**
- Use your actual Render URL
- Include `https://`
- No trailing slash

### Step 2: Configure Document Settings (Optional)

Find the configuration section:

```javascript
const CONFIG = {
  // Article pattern (adjust if different)
  articlePattern: /Article\s+([IVXLCDM]+)[\s:]/i,

  // Section pattern (adjust if different)
  sectionPattern: /Section\s+(\d+)[\s:]/i,

  // Subsection pattern (optional)
  subsectionPattern: /Subsection\s+([A-Z])[\s:]/i,

  // Minimum section length (characters)
  minSectionLength: 10
};
```

Adjust patterns to match your document structure.

### Step 3: Save Changes

1. Click: **File** → **Save**
2. Script is now configured

**Time Required:** 2 minutes

---

## Use the Add-on

### Step 1: Authorize Script

**First time only:**

1. Close and reopen your Google Doc
2. You should see a new menu: **🔧 Bylaws Sync**
3. Click: **🔧 Bylaws Sync** → **Parse into Small Sections**
4. Authorization popup appears

**Authorization steps:**
1. Click "Continue"
2. Select your Google account
3. Click "Advanced" (if warned about unverified app)
4. Click "Go to Bylaws Sync Script (unsafe)"
5. Click "Allow"

**Why "unsafe"?**
- Google shows this for personal scripts
- Your script is safe (you created it)
- No data is shared with third parties

### Step 2: Parse Sections

1. Click: **🔧 Bylaws Sync** → **Parse into Small Sections**
2. Script starts processing:
   - Analyzes document structure
   - Identifies articles and sections
   - Extracts text content
   - Sends to your tracker app

3. **Wait for completion** (10-60 seconds depending on document size)
4. You'll see a success message: "Parsed X sections successfully"

### Step 3: Verify in Tracker

1. Open your tracker: `https://bylaws-tracker.onrender.com`
2. Go to main bylaws page
3. You should see all sections loaded
4. Verify:
   - Article numbers correct
   - Section numbers correct
   - Text content matches

**Time Required:** 2-5 minutes

---

## Menu Options

The **🔧 Bylaws Sync** menu provides these options:

### Parse into Small Sections
- **What it does:** Splits document into article/section/subsection
- **When to use:** First import or major restructure
- **Result:** Creates individual sections in database

### Test Connection
- **What it does:** Tests API connectivity
- **When to use:** Troubleshooting connection issues
- **Result:** Shows success/error message

### Sync Changes
- **What it does:** Updates existing sections (future feature)
- **When to use:** After editing document
- **Result:** Syncs text changes to tracker

### View API Status
- **What it does:** Shows API health status
- **When to use:** Verify app is running
- **Result:** Displays API health check

---

## Troubleshooting

### Issue: Menu Doesn't Appear

**Symptoms:**
- No "🔧 Bylaws Sync" menu after reopening doc

**Solutions:**
1. **Refresh the document** (close and reopen)
2. **Check script is saved:**
   - Extensions → Apps Script
   - Verify code is there
3. **Check `onOpen()` function exists:**
```javascript
function onOpen() {
  DocumentApp.getUi()
    .createMenu('🔧 Bylaws Sync')
    .addItem('Parse into Small Sections', 'parseBylawsIntoSections')
    .addToUi();
}
```

### Issue: "Failed to connect to server"

**Symptoms:**
- Error message when parsing
- "Failed to fetch" or "Connection refused"

**Solutions:**

1. **Verify APP_URL is correct:**
```javascript
const APP_URL = 'https://bylaws-tracker.onrender.com'; // ← Check this
```

2. **Test API manually:**
   - Open: `https://bylaws-tracker.onrender.com/api/health`
   - Should show: `{"status": "healthy"}`

3. **Check app is running:**
   - Go to Render dashboard
   - Verify service status is "Live"

4. **Check CORS settings:**
   - App should allow requests from `docs.google.com`
   - Verify in `server.js`:
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  // ...
});
```

### Issue: Sections Not Parsing Correctly

**Symptoms:**
- Wrong sections detected
- Missing sections
- Incorrect hierarchy

**Solutions:**

1. **Check document formatting:**
   - Articles should be clearly marked: "Article I", "Article II"
   - Sections should be clearly marked: "Section 1", "Section 2"
   - Use consistent formatting (bold recommended)

2. **Adjust regex patterns:**
```javascript
const CONFIG = {
  // Try different patterns
  articlePattern: /Article\s+([IVXLCDM]+)/i,  // More flexible
  sectionPattern: /Section\s+(\d+)/i,
};
```

3. **Test pattern matching:**
   - Apps Script → Run → "testPatterns()"
   - Check logs for matches

### Issue: Authorization Fails

**Symptoms:**
- "Authorization required" error
- Script won't run

**Solutions:**

1. **Re-authorize:**
   - Extensions → Apps Script
   - Run → "parseBylawsIntoSections"
   - Complete authorization flow again

2. **Check account permissions:**
   - Ensure you own the document
   - Ensure you're signed into correct Google account

3. **Clear and re-grant:**
   - Visit: https://myaccount.google.com/permissions
   - Remove "Bylaws Sync Script"
   - Re-authorize in document

### Issue: Slow Performance

**Symptoms:**
- Parsing takes >2 minutes
- Script timeout errors

**Solutions:**

1. **Split large documents:**
   - Parse articles separately
   - Or reduce document size

2. **Increase timeout (advanced):**
```javascript
function parseBylawsIntoSections() {
  const timeLimit = 300000; // 5 minutes (max: 6 minutes)
  // ... rest of code
}
```

3. **Use batch processing:**
   - Parse in chunks
   - Send multiple requests

---

## Advanced Features

### Custom Section Patterns

**For different document structures:**

**Example 1: Chapter-based:**
```javascript
const CONFIG = {
  chapterPattern: /Chapter\s+(\d+)/i,
  sectionPattern: /Section\s+(\d+\.\d+)/i, // e.g., "Section 1.1"
};
```

**Example 2: Numbered hierarchy:**
```javascript
const CONFIG = {
  level1Pattern: /^(\d+)\.\s/,        // "1. Name"
  level2Pattern: /^(\d+\.\d+)\s/,     // "1.1 Purpose"
  level3Pattern: /^(\d+\.\d+\.\d+)\s/, // "1.1.1 Mission"
};
```

### Auto-Sync on Edit (Future)

**Enable auto-sync when document changes:**

```javascript
function onEdit(e) {
  // Trigger on specific edits
  if (shouldSync(e)) {
    syncChangesToTracker();
  }
}

function shouldSync(e) {
  // Only sync significant changes
  const range = e.range;
  const text = range.getValue();
  return text.length > 50; // Ignore minor edits
}
```

### Version Tracking

**Track document versions:**

```javascript
function createVersionSnapshot() {
  const doc = DocumentApp.getActiveDocument();
  const version = {
    timestamp: new Date().toISOString(),
    content: doc.getBody().getText(),
    revisionId: doc.getUrl().match(/\/d\/([^/]+)\//)[1]
  };

  // Send to tracker
  syncVersionToTracker(version);
}
```

### Batch Operations

**Parse multiple documents:**

```javascript
function parseMultipleDocuments() {
  const docIds = [
    'doc-id-1',
    'doc-id-2',
    'doc-id-3'
  ];

  docIds.forEach(docId => {
    const doc = DocumentApp.openById(docId);
    const sections = parseSections(doc);
    syncToTracker(sections);
  });
}
```

---

## API Integration Details

### Endpoints Used

**1. Health Check**
```
GET /api/health
Response: {"status": "healthy"}
```

**2. Initialize Document**
```
POST /bylaws/api/initialize
Body: {
  "docId": "google-doc-id",
  "sections": [
    {
      "citation": "Article I, Section 1",
      "title": "Name",
      "text": "The name of..."
    }
  ]
}
```

**3. Sync Sections**
```
POST /api/sections/sync
Body: {
  "sections": [...]
}
```

### Request Format

**Section object structure:**
```javascript
{
  "citation": "Article I, Section 1",
  "title": "Official Name",
  "text": "The name of this organization shall be...",
  "hierarchy": {
    "article": "I",
    "section": "1",
    "depth": 1
  },
  "metadata": {
    "googleDocId": "1LdE2N...",
    "lastModified": "2025-10-09T12:00:00Z"
  }
}
```

### Error Handling

**Script includes retry logic:**
```javascript
function syncToTracker(sections) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = UrlFetchApp.fetch(APP_URL + '/api/initialize', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({sections})
      });

      if (response.getResponseCode() === 200) {
        return JSON.parse(response.getContentText());
      }
    } catch (e) {
      attempt++;
      if (attempt >= maxRetries) throw e;
      Utilities.sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

---

## Security Considerations

### Data Privacy

- ✅ Script runs in your Google account (no third-party access)
- ✅ Data sent only to your specified APP_URL
- ✅ No data stored in Apps Script servers
- ✅ HTTPS encryption for API calls

### API Security

**Implement authentication (optional):**
```javascript
function syncToTracker(sections) {
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty('API_KEY');

  const response = UrlFetchApp.fetch(APP_URL + '/api/initialize', {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({sections})
  });
}
```

### Rate Limiting

**Avoid hitting API limits:**
```javascript
function parseWithRateLimit(sections) {
  const batchSize = 50;
  const delayMs = 1000;

  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    syncToTracker(batch);

    if (i + batchSize < sections.length) {
      Utilities.sleep(delayMs);
    }
  }
}
```

---

## Best Practices

### Document Structure

1. **Use consistent headers:**
   - Article I (not "1st Article")
   - Section 1 (not "Section One")

2. **Clear hierarchy:**
   ```
   Article I
     Section 1
       Subsection A
       Subsection B
     Section 2
   ```

3. **Avoid complex nesting:**
   - Maximum 3-4 levels recommended
   - Deeper nesting may not parse correctly

### Script Maintenance

1. **Version control:**
   - Add version number to script:
   ```javascript
   const SCRIPT_VERSION = '1.0.0';
   ```

2. **Logging:**
   - Use `Logger.log()` for debugging
   - View logs: Apps Script → Executions

3. **Backup:**
   - Save script code to file
   - Keep in version control with app

### Performance Optimization

1. **Cache API responses:**
```javascript
const cache = CacheService.getScriptCache();

function getCachedHealth() {
  const cached = cache.get('health_status');
  if (cached) return JSON.parse(cached);

  const health = checkHealth();
  cache.put('health_status', JSON.stringify(health), 300); // 5 min
  return health;
}
```

2. **Batch processing:**
   - Process sections in groups of 50
   - Reduces API calls

3. **Async operations (if available):**
   - Use `UrlFetchApp.fetchAll()` for parallel requests

---

## Migration Guide

### From Legacy Script

If upgrading from older version:

**Old format:**
```javascript
function parseBylaw() {
  // Old parsing logic
}
```

**New format:**
```javascript
function parseBylawsIntoSections() {
  // New multi-section logic
}
```

**Migration steps:**
1. Backup old script
2. Replace with new version
3. Update APP_URL
4. Re-authorize
5. Test with small document first

---

## Quick Reference

### Essential Configuration

```javascript
// 1. Set your app URL
const APP_URL = 'https://your-app.onrender.com';

// 2. Set patterns (if custom)
const CONFIG = {
  articlePattern: /Article\s+([IVXLCDM]+)/i,
  sectionPattern: /Section\s+(\d+)/i
};

// 3. Test connection
function testConnection() {
  const health = UrlFetchApp.fetch(APP_URL + '/api/health');
  Logger.log(health.getContentText());
}
```

### Common Commands

```javascript
// Parse current document
parseBylawsIntoSections();

// Test API connection
testConnection();

// View logs
Logger.getLog();

// Clear cache
CacheService.getScriptCache().removeAll();
```

---

**Last Updated:** 2025-10-09
**Version:** 2.0.0
**Compatible with:** Bylaws Tracker v2.0+
