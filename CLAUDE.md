# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Bylaws Amendment Tracker application for the Reseda Neighborhood Council to manage and track amendments to organizational bylaws. It provides a web interface with Google Docs integration for viewing bylaws alongside a management panel for tracking and approving suggested amendments.

## Key Commands

### Development
```bash
npm install              # Install dependencies (@supabase/supabase-js, express, ejs)
npm start               # Start server on port 3000
npm run dev             # Start with nodemon for auto-reload
```

## Architecture

### Core Components

1. **Backend (server.js)**
   - Express.js server on port 3000
   - EJS templating for views
   - Supabase client for database operations
   - Static file serving from public directory
   - RESTful API endpoints for section management

2. **Frontend (views/bylaws.ejs)**
   - Split-screen interface: Google Doc iframe + management sidebar
   - Bootstrap 5 for styling
   - Real-time section status display
   - Modal-based suggestion review and locking

3. **Database (Supabase)**
   - `bylaw_sections`: Document sections with locking/approval states
   - `bylaw_suggestions`: Community suggestions for amendments
   - `bylaw_votes`: User support for suggestions
   - Setup via `database/schema.sql`

4. **Google Docs Integration (google-apps-script/Code.gs)**
   - Menu-driven sync operations
   - Section parsing (ARTICLE/Section headers)
   - Visual formatting for locked sections
   - Bi-directional communication with web app

## Configuration Requirements

All configuration is now managed through environment variables in `.env` file:

1. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Fill in your actual values

2. **Key Variables**
   - `APP_URL`: Your server URL (update with NGROK URL when using NGROK)
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `GOOGLE_DOC_ID`: Your Google Doc ID

3. **NGROK Integration**
   - Run: `ngrok http 3000`
   - Update `APP_URL` in `.env` with the HTTPS URL
   - Update `google-apps-script/UPDATE_THIS_WITH_NGROK.gs` with same URL
   - Copy the updated script to Google Apps Script
   - Restart server after updating `.env`

## API Endpoints

- `GET /bylaws/api/sections/:docId` - Fetch all sections for a document
- `POST /bylaws/api/initialize` - Initialize document with parsed sections
- `POST /bylaws/api/sections/:sectionId/lock` - Lock section with committee decision
- `POST /bylaws/api/sections/:sectionId/unlock` - Unlock a section
- `GET /bylaws/api/export/committee` - Export committee-approved sections as JSON
- `GET /bylaws/api/export/board` - Export board-approved sections as JSON

## Workflow

1. Google Doc sections are parsed and sent to the database via Apps Script
2. Committee members view sections and suggestions in the web interface
3. Sections can be locked with selected amendments
4. Decisions are exported as JSON for board review and archival

## Database State Management

- Sections have multiple states: unlocked, committee-locked, board-approved
- Each section tracks: original_text, new_text (committee), final_text (board)
- Locking records: who locked, when, selected suggestion, and notes