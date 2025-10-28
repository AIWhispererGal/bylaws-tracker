# TOC Sidebar Visual Preview

## What the User Will See After Fix

### Before Fix:
```
┌──────────────────────────────────────────────┐
│  Document Viewer                             │
│  ┌────────────────────────────────────────┐  │
│  │ ❌ No TOC button visible                │  │
│  │ ❌ No sidebar                           │  │
│  │ ❌ No section numbering                 │  │
│  │                                         │  │
│  │ [Section cards without numbers...]     │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### After Fix:
```
┌────────────────────────────────────────────────────────────────┐
│  Document Viewer                                               │
│                                                                │
│  🔘 [Toggle]  ◄─── NEW: Toggle button with badge              │
│                                                                │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ 📋 Document Map      │  │ #1  Preamble                 │  │
│  │ ──────────────────── │  │ #2  Article I - Name         │  │
│  │ 🔍 [Search...]       │  │ #3  Article II - Purpose     │  │
│  │ ──────────────────── │  │ #4    Section 2.1           │  │
│  │                      │  │ #5    Section 2.2           │  │
│  │ #1  📄 Preamble      │  │ #6  Article III - Members    │  │
│  │ #2  📄 Article I     │  │ ...                          │  │
│  │ #3  📄 Article II    │  └──────────────────────────────┘  │
│  │ #4    📄 Section 2.1 │   ▲                                │
│  │ #5    📄 Section 2.2 │   │ NEW: Section number badges     │
│  │ #6  📄 Article III   │   │ (click to copy link)           │
│  │ ...                  │                                    │
│  │                      │                                    │
│  └──────────────────────┘                                    │
│   ▲                                                           │
│   │ NEW: Slide-out TOC sidebar                               │
│   │ (click any section to scroll)                            │
└────────────────────────────────────────────────────────────────┘
```

## Layout Breakdown

### 1. Toggle Button (Left Edge)
```
🔘 [📋 42]
│   └─ Section count badge
└─ Click to open/close sidebar
```

**Position:** Fixed to left edge of viewport
**Appearance:** Circular button with list icon
**Badge:** Shows total number of sections
**Action:** Opens/closes TOC sidebar

### 2. TOC Sidebar (Slide-out from Left)
```
┌──────────────────────────┐
│ 📋 Document Map          │ ◄─ Header
│ ──────────────────────── │
│ 42 sections   [Collapse] │ ◄─ Meta info
│ ──────────────────────── │
│ 🔍 [Search sections...]  │ ◄─ Search box
│ ──────────────────────── │
│                          │
│ #1  📄 Preamble          │ ◄─ Root section
│ #2  📄 Article I         │ ◄─ Root section
│ #3  📄 Article II        │ ◄─ Root section
│ #4    📄 Section 2.1     │ ◄─ Indented (depth 1)
│ #5      📄 Subsec 2.1.1  │ ◄─ More indented (depth 2)
│ #6    📄 Section 2.2  🔒 │ ◄─ Locked badge
│ #7    📄 Section 2.3  3💬│ ◄─ Suggestion count
│ ...                      │
│                          │
│ ──────────────────────── │
│ Structure Overview       │ ◄─ Depth summary
│ [Articles: 5] [Sects: 12]│
│ [Subsects: 25]          │
└──────────────────────────┘
```

**Width:** ~280px (responsive)
**Animation:** Slides in/out smoothly
**Background:** White with subtle shadow
**Scroll:** Independent scroll (sticky header)

### 3. Section Number Badges (On Section Cards)
```
Section Card:
┌─────────────────────────────────────────┐
│  #1  Preamble                    [Edit]│
│  └─ Blue numbered badge                │
│                                         │
│  Original Text: ...                     │
└─────────────────────────────────────────┘
       ▲
       │ Click badge to copy anchor link
       │ Tooltip: "Section 1 - Click to copy link"
```

**Appearance:** Blue gradient badge with white # symbol
**Position:** Left side of section header
**Tooltip:** Shows on hover
**Action:** Click to copy anchor link to clipboard
**Feedback:** Badge flashes green on copy success

## Depth Visualization (Indentation)

```
TOC Indentation by Depth:
═══════════════════════════════════════

Depth 0 (Root):
#1  📄 Preamble

Depth 1 (1 indent):
#2    📄 Article I

Depth 2 (2 indents):
#3      📄 Section 1.1

Depth 3 (3 indents):
#4        📄 Subsection 1.1.1

Depth 4+ (4+ indents):
#5          📄 Clause 1.1.1.1
```

**Visual Hierarchy:**
- Depth 0: No indentation, bold
- Depth 1: 20px indent, medium weight
- Depth 2: 40px indent, normal weight
- Depth 3+: 60px+ indent, lighter weight

## Interactive Features

### Search (Real-time Filtering)
```
Before search:
#1  Preamble
#2  Article I
#3  Article II
#4  Section 2.1
#5  Section 2.2

User types "2.1" →

After search:
#4  Section 2.1        ◄─ Match highlighted
#5  Section 2.1.1      ◄─ Match highlighted
```

### Active Section Highlighting
```
As user scrolls document:

TOC automatically highlights current section:
#1  Preamble
#2  Article I        ◄─ ✨ Highlighted (user is here)
#3  Article II
```

**Highlight Color:** Blue background with border
**Scroll Behavior:** TOC scrolls to keep active section visible

### Click to Scroll
```
User clicks "#5 Section 2.2" in TOC
         ↓
Page smoothly scrolls to that section
         ↓
Section card flashes yellow briefly
         ↓
Section auto-expands if collapsed
         ↓
TOC closes on mobile (stays open on desktop)
```

## Mobile Responsive Behavior

### Desktop (> 768px)
```
┌─────────────────────────────────────┐
│ 🔘 [TOC]  [Document content...]     │
│            ▲                         │
│            │ Toggle stays visible    │
│            │ Sidebar overlays        │
└─────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌───────────────────────┐
│ 🔘 [TOC hidden]       │
│                       │
│ [Document content]    │
│ ...                   │
└───────────────────────┘

Tap toggle →

┌───────────────────────┐
│ [TOC slides over      │
│  and covers content]  │
│                       │
│ #1  Preamble          │
│ #2  Article I         │
│ ...                   │
└───────────────────────┘

Tap section or backdrop →

┌───────────────────────┐
│ [TOC slides away]     │
│                       │
│ [Document content]    │
│ ...                   │
└───────────────────────┘
```

## Keyboard Navigation

### Shortcuts
```
Ctrl/Cmd + K  →  Toggle TOC open/close
Escape        →  Close TOC (if open)
Arrow Up      →  Previous TOC item (when TOC focused)
Arrow Down    →  Next TOC item (when TOC focused)
Enter/Space   →  Jump to selected section
Tab           →  Navigate focusable elements
```

### Focus Management
```
1. User presses Ctrl+K
   └─> TOC opens and search box gets focus

2. User types to search
   └─> List filters in real-time

3. User presses Tab
   └─> Focus moves to first TOC item

4. User presses Arrow Down
   └─> Focus moves to next TOC item

5. User presses Enter
   └─> Page scrolls to that section
       └─> Focus moves to section card
```

## Color Scheme

```
Toggle Button:
- Background: #2563eb (blue)
- Hover: #1d4ed8 (darker blue)
- Badge: #ef4444 (red) with white text

Sidebar:
- Background: #ffffff (white)
- Border: #e5e7eb (light gray)
- Shadow: rgba(0,0,0,0.1)

Section Number Badges:
- Background: Linear gradient #2563eb → #1d4ed8 (blue)
- Text: #ffffff (white)
- Hover: Darker gradient + shadow
- Copied: Flash green (#10b981)

TOC Items:
- Default: #1f2937 (dark gray text)
- Hover: #eff6ff (light blue background)
- Active: #dbeafe (blue background) + #2563eb (blue border)
- Depth colors: Gradient from dark to light

Badges in TOC:
- Locked: #dc2626 (red) with lock icon
- Suggestions: #f59e0b (amber) with count
```

## Animations

### Sidebar Slide
```
Open:  transform: translateX(0)      [300ms ease-out]
Close: transform: translateX(-100%)  [250ms ease-in]
```

### Section Flash
```
Click section in TOC:
  background: white → #fef3c7 (yellow) → white  [1000ms]
```

### Badge Copy
```
Click number badge:
  background: blue → #10b981 (green) → blue  [2000ms]
  content: "#1" → "✓" → "#1"  [2000ms]
```

### Hover Effects
```
TOC items:     scale(1.02)  [200ms ease]
Number badges: translateY(-1px) + shadow  [200ms ease]
Toggle button: scale(1.1)  [200ms ease]
```

## Accessibility Features

```
ARIA Labels:
- Toggle button: "Toggle table of contents" / "aria-expanded"
- TOC nav: "Table of Contents" / role="navigation"
- TOC items: "Jump to section X: [title]" / role="link"
- Number badges: "Section number X. Click to copy permanent link."

Screen Reader Announcements:
- "Table of contents opened"
- "Table of contents closed"
- "Link copied to clipboard"
- "Navigated to section [title]"
- "Showing [N] of [total] sections" (when searching)

Keyboard Focus:
- Visible focus rings on all interactive elements
- Logical tab order
- Trapped focus in TOC when open (Escape to exit)
- Skip to content link at top
```

## Browser Compatibility

```
✅ Chrome/Edge (Chromium):  Full support
✅ Firefox:                 Full support
✅ Safari:                  Full support
✅ Mobile Safari:           Full support
✅ Chrome Mobile:           Full support

Fallback Features:
- Clipboard API: Falls back to execCommand if not supported
- Intersection Observer: Graceful degradation (no auto-highlight)
- Smooth scroll: Falls back to instant scroll
- CSS Grid/Flexbox: Required (IE11 not supported)
```

---

## Summary

The TOC sidebar provides:
- **Visual navigation** through numbered sections
- **Quick access** via searchable list
- **Contextual awareness** with active section highlighting
- **Accessibility** with full keyboard and screen reader support
- **Mobile-friendly** responsive design
- **Professional appearance** with smooth animations

**User Experience:** Clean, intuitive, fast, and accessible.

**Implementation:** Already complete, just needed to be loaded!
