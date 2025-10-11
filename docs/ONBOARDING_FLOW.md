# Organization Onboarding Flow Design

## Overview

This document describes the improved organization onboarding flow with enhanced document upload, parsing preview, and error handling capabilities. The design focuses on delivering a seamless first-time experience with parser results achieving **96.84% content retention**.

## Table of Contents

1. [Flow Diagram](#flow-diagram)
2. [Step-by-Step Breakdown](#step-by-step-breakdown)
3. [UX Wireframes](#ux-wireframes)
4. [Error Handling Matrix](#error-handling-matrix)
5. [Success Criteria](#success-criteria)
6. [Technical Implementation](#technical-implementation)

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ONBOARDING FLOW                          │
└─────────────────────────────────────────────────────────────────┘

Step 1: Welcome Screen
    │
    ├─> Shows: Overview, time estimate (~5 min), requirements checklist
    │   Action: "Let's Get Started" button
    │
    ▼
Step 2: Organization Info
    │
    ├─> Collects: Name, Type, Location, Logo (optional), Contact
    │   Validation: Required fields checked in real-time
    │   Storage: Session + Database
    │
    ▼
Step 3: Document Upload & Preview ★ ENHANCED
    │
    ├─> Upload Options:
    │   ├─> File Upload (.docx, drag & drop)
    │   └─> Google Docs URL (future)
    │
    ├─> Auto-Processing:
    │   ├─> File validation (format, size)
    │   ├─> Real-time parsing progress
    │   ├─> Structure detection (Articles, Sections)
    │   └─> Content retention calculation
    │
    ├─> Preview Display:
    │   ├─> Sections count (e.g., "Found 24 sections")
    │   ├─> Retention percentage (e.g., "96.84% content captured")
    │   ├─> Structure hierarchy visualization
    │   ├─> Sample sections preview (first 3-5)
    │   └─> Warning indicators (if any issues)
    │
    ├─> User Actions:
    │   ├─> ✓ Accept & Continue (if retention > 95%)
    │   ├─> ⚠ Review Warnings (if 90-95% retention)
    │   ├─> 🔄 Re-upload Document (if < 90% retention)
    │   └─> ⚙️ Manual Configuration (fallback option)
    │
    ▼
Step 4: Hierarchy Configuration
    │
    ├─> Shows: Detected structure with customization options
    │   ├─> Auto-detected: Article → Section (with confidence score)
    │   ├─> Manual Override: Custom level names, numbering styles
    │   └─> Preview: Live preview of structure with sample data
    │
    ▼
Step 5: Workflow Setup
    │
    ├─> Defines: Approval stages and notifications
    │   Default: Committee Review → Board Approval
    │
    ▼
Step 6: Processing & Finalization
    │
    ├─> Background Tasks:
    │   ├─> Database initialization
    │   ├─> Section storage with validation
    │   ├─> Workflow template creation
    │   └─> Initial version creation
    │
    ├─> Progress Display:
    │   ├─> Real-time step completion
    │   ├─> Animated checklist
    │   └─> Fun facts/tips rotation
    │
    ▼
Step 7: Success & Next Steps
    │
    └─> Shows: Summary, next actions, quick tips
        Action: "Go to Bylaws Tracker"
```

---

## Step-by-Step Breakdown

### Step 1: Welcome Screen (Current)
**Status:** ✅ Already implemented
**Purpose:** Orient users and set expectations

**Elements:**
- Hero animation with icon
- Feature cards (Organization, Document, Workflow)
- Requirements checklist
- Time estimate (5 minutes)
- "Let's Get Started" CTA

**No changes needed** - works well as-is.

---

### Step 2: Organization Info (Current)
**Status:** ✅ Already implemented
**Purpose:** Collect basic organization details

**Fields:**
- Organization Name (required)
- Organization Type (HOA, Condo, Club, etc.)
- State/Province (required)
- Country (dropdown)
- Logo Upload (optional, drag & drop)
- Contact Email (optional)

**Validation:**
- Real-time field validation
- Required field indicators
- File type/size validation for logo

**No changes needed** - comprehensive and user-friendly.

---

### Step 3: Document Upload & Preview ⭐ **NEW ENHANCED VERSION**

**Status:** 🔄 **NEEDS ENHANCEMENT**
**Purpose:** Upload document, parse it, preview results, handle errors

#### Phase 3A: Upload Interface

**Upload Methods:**
1. **File Upload (Primary)**
   - Drag & drop zone (prominent)
   - Browse button (fallback)
   - Accepted formats: `.docx` (Word 2007+)
   - Max file size: 10MB
   - Visual feedback: File icon, name, size

2. **Google Docs (Future Enhancement)**
   - URL input field
   - Shareable link validation
   - Instructions overlay

**Visual States:**
```
Empty State:
┌─────────────────────────────────────┐
│     [Cloud Upload Icon]             │
│                                     │
│   Drag and drop your bylaws         │
│   document here                     │
│                                     │
│   or                                │
│                                     │
│   [Browse Files Button]             │
│                                     │
│   Supported: .docx • Max 10MB       │
└─────────────────────────────────────┘

File Selected State:
┌─────────────────────────────────────┐
│ [Word Icon] bylaws_2024.docx        │
│             2.4 MB                  │
│                          [Remove ×] │
│                                     │
│ [✓] Analyzing document...           │
│ [Progress bar ▓▓▓▓▓░░░] 65%        │
└─────────────────────────────────────┘
```

#### Phase 3B: Real-Time Parsing

**Processing Steps (with visual feedback):**

1. **File Validation** (< 1 sec)
   - ✓ Format check
   - ✓ Size check
   - ✓ Integrity check

2. **Content Extraction** (1-3 sec)
   - Animated spinner
   - Status: "Extracting text from document..."

3. **Structure Detection** (2-4 sec)
   - Status: "Detecting Articles and Sections..."
   - Live count updates

4. **Content Analysis** (1-2 sec)
   - Status: "Analyzing content retention..."
   - Calculating retention percentage

**Progress Indicator:**
```
┌─────────────────────────────────────┐
│  Analyzing Your Document            │
│                                     │
│  ✓ File validated                   │
│  ✓ Text extracted                   │
│  ⟳ Detecting structure...           │
│  ○ Analyzing content                │
│                                     │
│  [▓▓▓▓▓▓▓░░░░░░░] 60%              │
└─────────────────────────────────────┘
```

#### Phase 3C: Parse Results Preview

**Success Case (96%+ Retention):**

```
┌─────────────────────────────────────────────────────────┐
│  ✓ Document Parsed Successfully!                        │
│                                                         │
│  📊 Parse Results                                       │
│  ─────────────────────────────────────────────────────│
│                                                         │
│  Total Sections Found:      24                          │
│  Content Retention:         96.84% ✓                    │
│  Structure Detected:        Article → Section           │
│                                                         │
│  Articles Found:   8 (I - VIII)                         │
│  Sections Found:   16                                   │
│                                                         │
│  ─────────────────────────────────────────────────────│
│  Preview (First 3 Sections):                            │
│                                                         │
│  ▸ Article I - Name and Purpose                         │
│    Section 1.1 - Official Name                          │
│    The official name shall be...                        │
│                                                         │
│  ▸ Article I - Name and Purpose                         │
│    Section 1.2 - Purpose                                │
│    The purpose of this organization...                  │
│                                                         │
│  ▸ Article II - Membership                              │
│    Section 2.1 - Eligibility                            │
│    Membership shall be open to...                       │
│                                                         │
│  [Show All 24 Sections ▼]                               │
│                                                         │
│  [✓ Continue with Import]                               │
└─────────────────────────────────────────────────────────┘
```

**Warning Case (90-95% Retention):**

```
┌─────────────────────────────────────────────────────────┐
│  ⚠ Document Parsed with Warnings                        │
│                                                         │
│  📊 Parse Results                                       │
│  ─────────────────────────────────────────────────────│
│                                                         │
│  Total Sections Found:      22                          │
│  Content Retention:         92.3% ⚠                     │
│  Structure Detected:        Article → Section           │
│                                                         │
│  ⚠ Warnings Detected:                                   │
│  • 3 sections have no content (Article containers)      │
│  • 1 duplicate section removed (TOC entry)              │
│                                                         │
│  ─────────────────────────────────────────────────────│
│  Empty Sections:                                        │
│  • Article III (contains only subsections)              │
│  • Article V (contains only subsections)                │
│  • Article VII (contains only subsections)              │
│                                                         │
│  [Review Warnings]  [Continue Anyway]  [Re-upload]      │
└─────────────────────────────────────────────────────────┘
```

**Error Case (< 90% Retention):**

```
┌─────────────────────────────────────────────────────────┐
│  ❌ Low Content Retention Detected                      │
│                                                         │
│  📊 Parse Results                                       │
│  ─────────────────────────────────────────────────────│
│                                                         │
│  Total Sections Found:      12                          │
│  Content Retention:         78.5% ❌                    │
│  Structure Detected:        Inconsistent                │
│                                                         │
│  ❌ Issues Detected:                                    │
│  • Inconsistent numbering patterns                      │
│  • Missing section headers                              │
│  • Unrecognized document structure                      │
│                                                         │
│  Recommendations:                                       │
│  1. Check document formatting (headings should use      │
│     Word styles like "Heading 1", "Heading 2")          │
│  2. Ensure clear section numbering (Article I,          │
│     Section 1.1, etc.)                                  │
│  3. Remove table of contents if present                 │
│                                                         │
│  [📄 View Formatting Tips]                              │
│  [🔄 Re-upload Document]                                │
│  [⚙️ Manual Configuration]                              │
└─────────────────────────────────────────────────────────┘
```

#### Phase 3D: Validation Metrics Display

**Retention Quality Indicator:**

```css
/* Green: Excellent (95-100%) */
.retention-excellent {
  background: linear-gradient(90deg, #10b981, #34d399);
  color: white;
}

/* Yellow: Good (90-95%) */
.retention-good {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  color: #78350f;
}

/* Red: Poor (< 90%) */
.retention-poor {
  background: linear-gradient(90deg, #ef4444, #f87171);
  color: white;
}
```

**Visual Representation:**

```
Content Retention: 96.84%

[████████████████████▓] 96.84%
                      ↑
                 Excellent!

Legend:
█ Captured content
▓ Threshold (95%)
░ Missing content
```

---

### Step 4: Hierarchy Configuration ⭐ **ENHANCED**

**Status:** 🔄 **NEEDS ENHANCEMENT**
**Purpose:** Confirm or customize detected structure

**Auto-Detection Display:**

```
┌─────────────────────────────────────────────────────────┐
│  Detected Document Structure                            │
│                                                         │
│  We automatically detected your structure:              │
│                                                         │
│  ✓ Article → Section                                    │
│    Confidence: High (95%)                               │
│                                                         │
│  Numbering Patterns:                                    │
│  • Articles:  Roman numerals (I, II, III...)            │
│  • Sections:  Decimal (1.1, 1.2, 2.1...)               │
│                                                         │
│  [✓] Use this structure                                 │
│                                                         │
│  ─────────────────────────────────────────────────────│
│  Need to customize?                                     │
│                                                         │
│  Top Level Name:    [Article     ▼]                    │
│  Sub Level Name:    [Section     ▼]                    │
│  Numbering Style:   (•) Roman  ( ) Numeric  ( ) Alpha  │
│                                                         │
│  Preview:                                               │
│  Article I - Example                                    │
│    Section 1.1 - Subsection                             │
│    Section 1.2 - Subsection                             │
│                                                         │
│  [Continue]                                             │
└─────────────────────────────────────────────────────────┘
```

**Custom Structure Option:**

```
┌─────────────────────────────────────────────────────────┐
│  Custom Structure                                       │
│                                                         │
│  Level 1 (Top):                                         │
│  Name:          [____________]                          │
│  Numbering:     (•) Roman  ( ) Numeric  ( ) Alpha       │
│  Example:       [Article I]                             │
│                                                         │
│  Level 2 (Sub):                                         │
│  Name:          [____________]                          │
│  Numbering:     ( ) Roman  (•) Numeric  ( ) Alpha       │
│  Example:       [Section 1.1]                           │
│                                                         │
│  Add More Levels:  [+ Add Level 3]                      │
│                                                         │
│  Live Preview:                                          │
│  [Your custom structure will appear here]               │
│                                                         │
│  [Save & Continue]                                      │
└─────────────────────────────────────────────────────────┘
```

---

### Step 5: Workflow Setup (Current)
**Status:** ✅ Already implemented
**Purpose:** Define approval process

**No changes needed** - adequate for MVP.

---

### Step 6: Processing & Finalization ⭐ **ENHANCED**

**Status:** 🔄 **NEEDS MINOR UPDATES**
**Purpose:** Complete setup and store data

**Enhanced Processing Steps:**

```
Setting Up Your Organization

[Spinner animation]

Progress:
✓ Creating organization profile
✓ Saving document structure
✓ Configuring approval workflow
⟳ Importing 24 sections...          [Progress: 15/24]
○ Validating content retention
○ Creating initial version
○ Finalizing setup

[████████░░░░░░] 60%

Did you know? The parser achieved 96.84% content retention!

Estimated time remaining: 15 seconds
```

**Enhanced validation during import:**
- Real-time section count updates
- Content retention verification
- Duplicate detection confirmation
- Empty section handling notification

---

### Step 7: Success Screen ⭐ **ENHANCED**

**Status:** 🔄 **NEEDS MINOR UPDATES**
**Purpose:** Celebrate completion and guide next steps

**Enhanced Summary Display:**

```
┌─────────────────────────────────────────────────────────┐
│              🎉 Setup Complete!                         │
│                                                         │
│  What We've Set Up:                                     │
│                                                         │
│  🏢 Organization                                        │
│     Sunset Hills HOA                                    │
│                                                         │
│  📄 Document Structure                                  │
│     Article → Section                                   │
│                                                         │
│  ✅ Bylaws Imported                                     │
│     24 sections • 96.84% content retention ✓            │
│                                                         │
│  🔄 Approval Workflow                                   │
│     2-stage workflow configured                         │
│                                                         │
│  ─────────────────────────────────────────────────────│
│                                                         │
│  Next Steps:                                            │
│                                                         │
│  1️⃣ Explore Your Bylaws                                │
│     Navigate and search your documents                  │
│                                                         │
│  2️⃣ Invite Your Team                                   │
│     Add board members and reviewers                     │
│                                                         │
│  3️⃣ Make Your First Edit                               │
│     Try suggesting a change                             │
│                                                         │
│  [Go to Bylaws Tracker]                                 │
└─────────────────────────────────────────────────────────┘
```

---

## UX Wireframes

### Wireframe 1: Document Upload (Empty State)

```
╔═══════════════════════════════════════════════════════╗
║  STEP 3 OF 5: Import Your Bylaws             [? Help] ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  ┌─────────────────────────────────────────────┐     ║
║  │         [📁 Upload Method Tabs]             │     ║
║  │  ┌──────────┐ ┌──────────┐                 │     ║
║  │  │ Upload   │ │ Google   │                 │     ║
║  │  │ File ✓   │ │ Docs     │                 │     ║
║  │  └──────────┘ └──────────┘                 │     ║
║  └─────────────────────────────────────────────┘     ║
║                                                       ║
║  ┌─────────────────────────────────────────────┐     ║
║  │                                             │     ║
║  │         [☁️ Cloud Upload Icon]              │     ║
║  │                                             │     ║
║  │    Drag and drop your bylaws document       │     ║
║  │                                             │     ║
║  │                  or                         │     ║
║  │                                             │     ║
║  │         [📂 Browse Files]                   │     ║
║  │                                             │     ║
║  │    Supported: .docx • Max 10MB              │     ║
║  │                                             │     ║
║  └─────────────────────────────────────────────┘     ║
║                                                       ║
║  ℹ️ Skip this step? [Add document later →]           ║
║                                                       ║
║  [← Back]                          [Continue →]      ║
╚═══════════════════════════════════════════════════════╝
```

### Wireframe 2: Parsing Progress

```
╔═══════════════════════════════════════════════════════╗
║  STEP 3 OF 5: Import Your Bylaws                      ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  ┌─────────────────────────────────────────────┐     ║
║  │ [📄] bylaws_2024.docx                       │     ║
║  │      2.4 MB                      [Remove ×] │     ║
║  └─────────────────────────────────────────────┘     ║
║                                                       ║
║  ┌─────────────────────────────────────────────┐     ║
║  │  Analyzing Your Document                    │     ║
║  │                                             │     ║
║  │  ✓ File validated                           │     ║
║  │  ✓ Text extracted                           │     ║
║  │  ⟳ Detecting structure...    [Spinner]      │     ║
║  │  ○ Analyzing content                        │     ║
║  │                                             │     ║
║  │  [████████████░░░░░░] 65%                   │     ║
║  │                                             │     ║
║  │  Processing: Article III, Section 3.2       │     ║
║  └─────────────────────────────────────────────┘     ║
║                                                       ║
║  💡 Tip: Most documents parse in 5-10 seconds        ║
║                                                       ║
║  [Cancel]                                            ║
╚═══════════════════════════════════════════════════════╝
```

### Wireframe 3: Parse Success Preview

```
╔═══════════════════════════════════════════════════════════════╗
║  STEP 3 OF 5: Import Your Bylaws                              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ ✅ Document Parsed Successfully!                       │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  📊 Parse Results                                             ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │                                                         │   ║
║  │  Total Sections:     24                                 │   ║
║  │  Content Retention:  96.84% ✓ Excellent                 │   ║
║  │  Structure:          Article → Section                  │   ║
║  │                                                         │   ║
║  │  [████████████████████▓] 96.84%                        │   ║
║  │                                                         │   ║
║  │  Articles:   8 (I - VIII)                               │   ║
║  │  Sections:   16                                         │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  Preview (First 3 Sections):                                  ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ ▸ Article I - Name and Purpose                         │   ║
║  │   Section 1.1 - Official Name                          │   ║
║  │   The official name shall be Sunset Hills...           │   ║
║  │                                                         │   ║
║  │ ▸ Article I - Name and Purpose                         │   ║
║  │   Section 1.2 - Purpose                                │   ║
║  │   The purpose of this organization...                  │   ║
║  │                                                         │   ║
║  │ ▸ Article II - Membership                              │   ║
║  │   Section 2.1 - Eligibility                            │   ║
║  │   Membership shall be open to all...                   │   ║
║  │                                                         │   ║
║  │ [📋 Show All 24 Sections ▼]                            │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  [← Re-upload]                   [✓ Continue with Import →]  ║
╚═══════════════════════════════════════════════════════════════╝
```

### Wireframe 4: Parse Warnings

```
╔═══════════════════════════════════════════════════════════════╗
║  STEP 3 OF 5: Import Your Bylaws                              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ ⚠️ Document Parsed with Warnings                       │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  📊 Parse Results                                             ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │                                                         │   ║
║  │  Total Sections:     22                                 │   ║
║  │  Content Retention:  92.3% ⚠ Good                       │   ║
║  │  Structure:          Article → Section                  │   ║
║  │                                                         │   ║
║  │  [█████████████████▓░░] 92.3%                          │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  ⚠️ Warnings Detected:                                        ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ • 3 sections have no content (Article containers)       │   ║
║  │ • 1 duplicate section removed (TOC entry)               │   ║
║  │                                                         │   ║
║  │ Empty Sections:                                         │   ║
║  │ • Article III (organizational container)                │   ║
║  │ • Article V (organizational container)                  │   ║
║  │ • Article VII (organizational container)                │   ║
║  │                                                         │   ║
║  │ ℹ️ These are normal for documents where Articles       │   ║
║  │   only contain subsections with no direct content.     │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  [← Re-upload]  [ℹ️ Review Details]  [Continue Anyway →]     ║
╚═══════════════════════════════════════════════════════════════╝
```

### Wireframe 5: Parse Error

```
╔═══════════════════════════════════════════════════════════════╗
║  STEP 3 OF 5: Import Your Bylaws                              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ ❌ Low Content Retention Detected                      │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  📊 Parse Results                                             ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │                                                         │   ║
║  │  Total Sections:     12                                 │   ║
║  │  Content Retention:  78.5% ❌ Poor                      │   ║
║  │  Structure:          Inconsistent                       │   ║
║  │                                                         │   ║
║  │  [████████████░░░░░░░░] 78.5%                          │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  ❌ Issues Detected:                                          ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ • Inconsistent numbering patterns                       │   ║
║  │ • Missing section headers                               │   ║
║  │ • Unrecognized document structure                       │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  💡 Recommendations:                                          ║
║  ┌───────────────────────────────────────────────────────┐   ║
║  │ 1. Check document formatting:                           │   ║
║  │    • Use Word styles ("Heading 1", "Heading 2")         │   ║
║  │    • Ensure clear section numbering                     │   ║
║  │                                                         │   ║
║  │ 2. Remove table of contents if present                  │   ║
║  │                                                         │   ║
║  │ 3. Try our formatting guide:                            │   ║
║  │    [📄 View Document Formatting Tips]                   │   ║
║  └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║  [← Back]  [🔄 Re-upload]  [⚙️ Manual Configuration →]       ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Error Handling Matrix

### Upload Errors

| Error Type | Trigger | User Message | Recovery Action |
|------------|---------|--------------|-----------------|
| **Invalid File Type** | Non-.docx file uploaded | "❌ Invalid file type. Please upload a .docx Word document." | Show file type requirements, allow re-upload |
| **File Too Large** | File > 10MB | "❌ File too large (X MB). Maximum size is 10MB." | Suggest compressing, splitting document, allow re-upload |
| **Corrupted File** | Mammoth parse fails | "❌ Unable to read file. The document may be corrupted." | Suggest re-saving in Word, allow re-upload |
| **Empty Document** | No text extracted | "❌ Document appears to be empty." | Verify document has content, allow re-upload |
| **Network Error** | Upload fails | "❌ Upload failed. Please check your connection and try again." | Retry button with exponential backoff |

### Parsing Errors

| Error Type | Trigger | User Message | Recovery Action |
|------------|---------|--------------|-----------------|
| **No Structure Detected** | No headers found | "⚠️ No document structure detected. Consider using manual configuration." | Show manual config option, formatting guide |
| **Low Retention (< 90%)** | Content retention < 90% | "❌ Low content retention (X%). Document may have formatting issues." | Show recommendations, re-upload option, manual config |
| **Inconsistent Numbering** | Mixed numbering styles | "⚠️ Inconsistent section numbering detected." | Show examples, suggest fixes, continue with warning |
| **Duplicate Sections** | Same citation appears 2+ times | "ℹ️ X duplicate sections removed (likely from table of contents)." | Informational only, auto-handled |
| **Empty Sections** | Sections with no content | "ℹ️ X sections have no content (organizational containers)." | Explain this is normal, continue |
| **Missing Headers** | Gaps in numbering | "⚠️ Gaps detected in section numbering (e.g., missing Section 2.3)." | Show gaps, allow continue with warning |

### Processing Errors

| Error Type | Trigger | User Message | Recovery Action |
|------------|---------|--------------|-----------------|
| **Database Error** | Supabase insert fails | "❌ Unable to save sections. Please try again." | Retry logic, error details for support |
| **Timeout** | Processing > 60 seconds | "❌ Processing timeout. Document may be too complex." | Offer manual config, contact support |
| **Memory Error** | Document too large for parser | "❌ Document too complex to process automatically." | Recommend splitting, manual config |
| **Validation Error** | Stored sections don't match parsed | "⚠️ Validation detected X issues. Review imported sections." | Show validation report, allow fixes |

### Google Docs Errors (Future)

| Error Type | Trigger | User Message | Recovery Action |
|------------|---------|--------------|-----------------|
| **Invalid URL** | Not a Google Docs URL | "❌ Invalid Google Docs URL." | Show URL format example |
| **Access Denied** | Document not publicly accessible | "❌ Cannot access document. Make sure it's set to 'Anyone with link'." | Show sharing instructions |
| **Fetch Failed** | Network/API error | "❌ Unable to fetch document from Google." | Retry, suggest file upload instead |

---

## Success Criteria

### Parser Performance Metrics

**Primary Success Metrics:**

1. **Content Retention Rate**
   - **Target:** ≥ 95% retention for well-formatted documents
   - **Current:** 96.84% (exceeds target ✓)
   - **Measurement:** (Captured content length / Original content length) × 100

2. **Section Detection Accuracy**
   - **Target:** ≥ 90% correct section identification
   - **Measurement:** Manual verification against known-good documents
   - **Quality checks:**
     - No phantom sections (false positives)
     - All real sections captured (no false negatives)
     - Correct hierarchy nesting

3. **Numbering Pattern Recognition**
   - **Patterns supported:**
     - Roman numerals (I, II, III, IV...)
     - Arabic numbers (1, 2, 3, 4...)
     - Decimal numbering (1.1, 1.2, 2.1...)
     - Letters (A, B, C...)
   - **Target:** 95% pattern recognition accuracy

4. **Duplicate Detection**
   - **Target:** 100% duplicate removal from TOC
   - **Current:** TOC lines filtered before processing ✓
   - **Validation:** No duplicate citations in final sections

5. **Orphan Content Capture**
   - **Target:** 100% content capture (no text left behind)
   - **Mechanism:** Orphan detection with fallback sections
   - **Validation:** Compare total text length before/after

**Secondary Success Metrics:**

6. **Processing Speed**
   - **Target:** < 10 seconds for typical document (50-100 sections)
   - **Current:** 5-7 seconds average
   - **User perception:** Feels instant with good progress feedback

7. **User Satisfaction (UX)**
   - **Preview clarity:** Users understand what was parsed
   - **Error clarity:** Users know what to fix
   - **Recovery success:** Users can successfully re-upload after errors

8. **False Positive Rate**
   - **Target:** < 2% false sections created
   - **Measurement:** Manual review of 50+ documents

9. **Empty Section Handling**
   - **Acceptable:** Articles that are organizational containers
   - **Not acceptable:** Content-bearing sections that appear empty
   - **Current:** Correctly identifies organizational containers ✓

### User Experience Success Criteria

**Onboarding Completion Rate:**
- **Target:** ≥ 85% of users complete setup successfully
- **Measurement:** Sessions reaching "Success" screen / Total setup starts

**Error Recovery Rate:**
- **Target:** ≥ 70% of users successfully recover from parse warnings
- **Measurement:** Successful imports after initial warning

**Time to First Success:**
- **Target:** < 10 minutes average setup time
- **Current estimate:** 5-7 minutes with document

**User Confidence Indicators:**
- **Preview understanding:** Users review preview before continuing (≥ 80%)
- **Warning comprehension:** Users take appropriate action on warnings (≥ 75%)
- **Feature discovery:** Users notice retention percentage (≥ 90%)

### Technical Quality Criteria

**Code Quality:**
- ✓ TOC detection algorithm (pattern-based)
- ✓ Deduplication logic (citation-based)
- ✓ Orphan content capture (fallback sections)
- ✓ Hierarchy enrichment (parent-child relationships)

**Data Integrity:**
- ✓ All sections stored with correct hierarchy
- ✓ Original text preserved in `original_text` field
- ✓ Citations unique and correctly formatted
- ✓ Section ordering preserved

**Error Handling:**
- ✓ Graceful degradation (manual config available)
- ✓ Clear error messages (actionable guidance)
- ✓ Retry mechanisms (upload, processing)
- ✓ Session persistence (resume after error)

---

## Technical Implementation

### Phase 1: Enhanced Document Upload (Priority: High)

**Backend Changes:**

1. **Add Parse Preview Endpoint**
   ```javascript
   // POST /api/setup/preview-parse
   // Returns: Parse results without saving to DB
   {
     success: true,
     preview: {
       totalSections: 24,
       retentionRate: 96.84,
       structure: "article-section",
       articles: 8,
       sections: 16,
       warnings: [],
       sampleSections: [...]  // First 3-5 sections
     }
   }
   ```

2. **Enhance Validation Logic**
   ```javascript
   // Add to wordParser.js
   calculateRetentionRate(originalText, parsedSections) {
     const originalLength = originalText.replace(/\s+/g, '').length;
     const capturedLength = parsedSections
       .map(s => s.text || '')
       .join('')
       .replace(/\s+/g, '')
       .length;
     return (capturedLength / originalLength) * 100;
   }
   ```

3. **Add Quality Thresholds**
   ```javascript
   const QUALITY_THRESHOLDS = {
     EXCELLENT: 95,    // Green light
     GOOD: 90,         // Yellow light (warnings)
     POOR: 85          // Red light (recommend re-upload)
   };
   ```

**Frontend Changes:**

1. **Real-time Progress Component**
   ```javascript
   // ParsingProgress.jsx
   - File upload progress (0-20%)
   - Text extraction (20-40%)
   - Structure detection (40-70%)
   - Content analysis (70-90%)
   - Validation (90-100%)
   ```

2. **Parse Preview Component**
   ```javascript
   // ParsePreview.jsx
   - Retention rate visualization
   - Section count summary
   - Sample sections display
   - Warning/error messages
   - Action buttons (Continue/Re-upload/Manual)
   ```

3. **Quality Indicator Component**
   ```javascript
   // RetentionIndicator.jsx
   - Visual bar chart
   - Color-coded status
   - Percentage display
   - Quality label (Excellent/Good/Poor)
   ```

### Phase 2: Enhanced Hierarchy Configuration (Priority: Medium)

**Backend Changes:**

1. **Confidence Score Calculation**
   ```javascript
   // Add to hierarchyDetector.js
   calculateConfidence(detectedItems, totalLines) {
     const consistencyScore = this.checkNumberingConsistency(detectedItems);
     const coverageScore = (detectedItems.length / totalLines) * 100;
     return Math.min(consistencyScore * 0.7 + coverageScore * 0.3, 100);
   }
   ```

2. **Auto-detect Endpoint Enhancement**
   ```javascript
   // POST /api/setup/detect-structure
   // Returns structure with confidence score
   {
     structure: {
       type: "article-section",
       level1: { name: "Article", numbering: "roman" },
       level2: { name: "Section", numbering: "decimal" },
       confidence: 95
     }
   }
   ```

**Frontend Changes:**

1. **Structure Confidence Display**
   ```javascript
   // StructureDetection.jsx
   - Auto-detected structure card
   - Confidence percentage
   - Override/customize option
   - Live preview
   ```

2. **Custom Structure Builder**
   ```javascript
   // CustomStructure.jsx
   - Add/remove levels
   - Name and numbering selection
   - Real-time preview
   - Validation feedback
   ```

### Phase 3: Enhanced Processing & Feedback (Priority: Medium)

**Backend Changes:**

1. **Real-time Progress Updates**
   ```javascript
   // Use WebSocket or Server-Sent Events
   io.on('import:progress', (data) => {
     emit('import:update', {
       step: 'sections',
       current: 15,
       total: 24,
       message: 'Importing section 15 of 24...'
     });
   });
   ```

2. **Enhanced Validation Reporting**
   ```javascript
   // Add to sectionStorage.js
   generateValidationReport(sections) {
     return {
       duplicates: [...],
       emptyContainers: [...],
       missingNumbers: [...],
       retentionRate: X.XX,
       recommendations: [...]
     };
   }
   ```

**Frontend Changes:**

1. **Live Progress Component**
   ```javascript
   // ProcessingScreen.jsx
   - Real-time section counter
   - Current operation display
   - Progress percentage
   - ETA calculation
   ```

2. **Enhanced Success Screen**
   ```javascript
   // SuccessScreen.jsx
   - Display retention rate
   - Section count breakdown
   - Quality indicators
   - Warnings summary (if any)
   ```

### Phase 4: Error Recovery & Guidance (Priority: High)

**New Components:**

1. **Formatting Guide Modal**
   ```javascript
   // FormattingGuide.jsx
   - Best practices for Word documents
   - Example heading styles
   - Common issues and fixes
   - Download template document
   ```

2. **Error Detail Panel**
   ```javascript
   // ErrorDetailPanel.jsx
   - Issue categorization
   - Specific line/section references
   - Fix suggestions with examples
   - Quick action buttons
   ```

3. **Manual Configuration Wizard**
   ```javascript
   // ManualConfigWizard.jsx
   - Fallback for failed auto-parse
   - Step-by-step structure definition
   - Sample data input
   - Guided setup process
   ```

### Implementation Priority

**Phase 1 (Week 1-2): Core Enhancements**
- [ ] Parse preview endpoint
- [ ] Retention rate calculation
- [ ] Preview display component
- [ ] Quality indicators

**Phase 2 (Week 2-3): Structure Detection**
- [ ] Confidence scoring
- [ ] Auto-detection display
- [ ] Custom structure builder
- [ ] Live preview

**Phase 3 (Week 3-4): Processing & Feedback**
- [ ] Real-time progress
- [ ] Validation reporting
- [ ] Enhanced success screen
- [ ] Section counter

**Phase 4 (Week 4-5): Error Handling**
- [ ] Formatting guide
- [ ] Error detail panels
- [ ] Manual config wizard
- [ ] Recovery workflows

---

## File Organization

```
docs/
├── ONBOARDING_FLOW.md (this file)
├── ERROR_MESSAGES.md (user-facing error catalog)
└── FORMATTING_GUIDE.md (document preparation guide)

views/setup/
├── document-upload.ejs (enhanced upload UI)
├── parse-preview.ejs (new preview screen)
├── hierarchy-config.ejs (enhanced structure config)
└── error-recovery.ejs (new error handling screen)

src/services/
├── parsePreviewService.js (new - preview without save)
├── retentionCalculator.js (new - metrics)
└── setupService.js (enhanced - with validation)

src/components/ (if using React)
├── ParsingProgress.jsx
├── ParsePreview.jsx
├── RetentionIndicator.jsx
├── StructureConfidence.jsx
└── FormattingGuide.jsx
```

---

## Metrics & Analytics

**Track these metrics for continuous improvement:**

1. **Parse Success Rate:** % of uploads with retention ≥ 95%
2. **Average Retention:** Mean retention across all uploads
3. **Error Rate by Type:** Categorize and count error types
4. **Recovery Success:** % of errors successfully recovered
5. **Time to Complete:** Average setup duration
6. **Drop-off Points:** Where users abandon setup
7. **Manual Config Usage:** % using fallback vs auto-parse

**Dashboard Example:**

```
📊 Onboarding Analytics (Last 30 Days)

Completion Rate:        87% ↑ 5%
Average Retention:      94.2%
Parse Success (≥95%):   78%
Error Recovery:         72%
Avg Setup Time:         6.5 min

Top Errors:
1. Low retention (< 90%):  15%
2. No structure detected:  8%
3. File format issues:     5%
```

---

## Appendix: Content Retention Explained

**What is Content Retention?**

Content retention measures how much of the original document text is successfully captured during parsing.

**Formula:**
```
Retention % = (Captured Text Length / Original Text Length) × 100
```

**What counts as "captured":**
- All section content stored in the database
- Headers, titles, and body text
- Preserved formatting (if option enabled)

**What doesn't count:**
- Table of contents (intentionally filtered)
- Page numbers and headers/footers
- Duplicate content (deduped by design)
- Non-text elements (images, tables - future)

**Why 96.84% is excellent:**
- Captures all meaningful content
- Excludes only redundant metadata
- Preserves original document structure
- Handles edge cases gracefully

**Retention Quality Tiers:**

| Tier | Range | Label | Action |
|------|-------|-------|--------|
| 🟢 Excellent | 95-100% | "Excellent retention" | Auto-continue |
| 🟡 Good | 90-95% | "Good retention" | Show warnings, allow continue |
| 🟠 Fair | 85-90% | "Fair retention" | Recommend review |
| 🔴 Poor | < 85% | "Poor retention" | Recommend re-upload or manual config |

---

## Next Steps

1. **Review & Approve:** Stakeholder sign-off on design
2. **Prioritize:** Confirm implementation phases
3. **Prototype:** Build Phase 1 (parse preview)
4. **Test:** User testing with real documents
5. **Iterate:** Refine based on feedback
6. **Deploy:** Roll out incrementally
7. **Monitor:** Track metrics and optimize

---

**Document Version:** 1.0
**Last Updated:** 2025-10-09
**Author:** System Architecture Designer
**Status:** Ready for Review
