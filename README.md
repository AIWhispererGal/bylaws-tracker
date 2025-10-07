# Bylaws Amendment Tracker - Ready to Run!

## What This Does
- Shows your Google Doc on the left, management panel on the right
- Committee can lock/unlock sections with decisions
- Tracks all amendment suggestions
- Exports decisions as JSON files

## Quick Setup (5 minutes)

### 1. Install Dependencies
Open Command Prompt/Terminal in this folder and run:
```bash
npm install
```

### 2. Set Up Supabase Database
1. Go to https://supabase.com
2. Create a new project (or use existing)
3. Go to SQL Editor
4. Copy the contents of `database/schema.sql` and paste it
5. Click "Run" button

### 3. Update Your Credentials
Edit `server.js` (lines 8-9):
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';  // ← Your actual URL
const SUPABASE_ANON_KEY = 'your-anon-key-here';          // ← Your actual key
```
Get these from Supabase: Settings → API

### 4. Add Your Google Doc
Edit `views/bylaws.ejs` (line 197):
```javascript
const DOC_ID = 'YOUR_GOOGLE_DOC_ID_HERE';  // ← Your Doc ID
```
Get from your Google Doc URL: `docs.google.com/document/d/[THIS_PART]/edit`

### 5. Start the Server
```bash
npm start
```
Open http://localhost:3000

## Test It Works
1. Click "Initialize Doc" - should create sample sections
2. Click "View/Lock" on a section - should show options
3. Lock a section - should turn yellow
4. Click "Export Committee" - should download JSON

## Optional: Google Docs Integration
1. Open your bylaws Google Doc
2. Extensions → Apps Script
3. Paste contents of `google-apps-script/Code.gs`
4. Save and authorize
5. Use "🔧 Bylaws Sync" menu in your Doc

## Run on Windows or WSL?
Either works! The npm commands work the same in both Windows Command Prompt and WSL.

## File Structure
```
BYLAWSTOOL2/
├── server.js                  # Main server (edit Supabase credentials)
├── package.json               # Dependencies
├── views/
│   └── bylaws.ejs            # Web page (edit Doc ID)
├── database/
│   └── schema.sql            # Run in Supabase
└── google-apps-script/
    └── Code.gs               # Paste into Google Apps Script
```

## What's Next?
Once running, you can:
- Add real suggestions through Google Docs
- Customize the styling
- Add user authentication
- Deploy to a server for public access

You now have a complete bylaws amendment tracker!
