# My Tasks Section - Visual Guide

## Overview
This guide provides visual examples of the My Tasks section implementation.

---

## Desktop View (with Tasks)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bylaws Amendment Tracker                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 📋 My Tasks (3)                                    View All (3) ▸       │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ [⚠️]  Approve: Membership Requirements              [Approval] ▸  │  │ │
│  │  │      Pending in Bylaws Document                                  │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ [📄]  Review: Updated Constitution                  [Review] ▸    │  │ │
│  │  │      Updated 10/14/2025                                          │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ [💡]  Your suggestion in Bylaws          [Your Suggestion] ▸      │  │ │
│  │  │      Awaiting review - submitted 10/13/2025                      │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [Stats Cards and Other Dashboard Content Below...]                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Empty State View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bylaws Amendment Tracker                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 📋 My Tasks                                                             │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │                                                                         │ │
│  │                             ✅                                          │ │
│  │                                                                         │ │
│  │              All caught up! No pending tasks at the moment.            │ │
│  │                                                                         │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [Stats Cards and Other Dashboard Content Below...]                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile View (Stacked Layout)

```
┌───────────────────────────────────┐
│  📋 My Tasks (2)                  │
├───────────────────────────────────┤
│                                   │
│  ┌─────────────────────────────┐  │
│  │ [⚠️]                         │  │
│  │ Approve: Section 2.1        │  │
│  │ Pending in Bylaws Document  │  │
│  │                             │  │
│  │ [Approval] ▸                │  │
│  └─────────────────────────────┘  │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ [💡]                         │  │
│  │ Your suggestion in Bylaws   │  │
│  │ Awaiting review - 10/13/25  │  │
│  │                             │  │
│  │ [Your Suggestion] ▸         │  │
│  └─────────────────────────────┘  │
│                                   │
└───────────────────────────────────┘
```

---

## Task Item Anatomy

### Desktop Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│  [Icon]  Title of the task                           [Badge] [→]    │
│          Description with context                                   │
└─────────────────────────────────────────────────────────────────────┘

Components:
1. Icon (40x40px, colored background, priority-based)
2. Title (Bold, truncated with ellipsis if too long)
3. Description (Smaller text, gray, context info)
4. Badge (Task type, colored by priority)
5. Chevron (Navigation indicator)
```

### Mobile Layout
```
┌───────────────────────────┐
│  [Icon]                   │
│  Title of the task        │
│  Description              │
│                           │
│  [Badge] [→]              │
└───────────────────────────┘

Layout Changes:
- Full width on small screens
- Badge wraps to new row
- Text no longer truncated
```

---

## Color Coding

### Priority Colors

**Warning (Pending Approvals)**
- Background: rgba(255, 193, 7, 0.1) - Light yellow
- Icon: #ffc107 - Yellow
- Border: #ffc107 on hover
- Use: High priority items requiring immediate action

**Primary (Reviews)**
- Background: rgba(13, 110, 253, 0.1) - Light blue
- Icon: #0d6efd - Blue
- Border: #0d6efd on hover
- Use: Medium priority items for review

**Info (Your Suggestions)**
- Background: rgba(13, 202, 240, 0.1) - Light cyan
- Icon: #0dcaf0 - Cyan
- Border: #0dcaf0 on hover
- Use: Lower priority informational items

---

## Interactive States

### Default State
```css
border: 1px solid #e9ecef
background: white
```

### Hover State
```css
background: #f8f9fa (light gray)
border-color: #dee2e6 (darker gray)
transform: translateX(2px) (subtle shift right)
box-shadow: 0 2px 4px rgba(0,0,0,0.05) (subtle shadow)
```

### Active/Clicked State
```css
Navigation occurs immediately on click
No special active state needed
```

---

## Icon Mapping

| Task Type | Icon | Bootstrap Class |
|-----------|------|-----------------|
| Approval | Clipboard with checkmark | `bi-clipboard-check` |
| Your Suggestion | Light bulb | `bi-lightbulb` |
| Review | File with text | `bi-file-earmark-text` |

---

## Badge Design

```
┌──────────────┐
│  Task Type   │  ← 0.75rem font, 600 weight
└──────────────┘
  ^          ^
  |          |
  0.25rem padding (top/bottom)
  0.75rem padding (left/right)
  6px border radius
```

---

## Responsive Breakpoints

### Desktop (> 768px)
- Horizontal layout
- Text truncation enabled
- Hover effects active
- Full spacing between elements

### Tablet (768px - 576px)
- Same as desktop but narrower
- Earlier text truncation

### Mobile (< 576px)
- Vertical layout
- No text truncation
- Touch-friendly spacing
- Badge wraps below content

---

## Accessibility Features

1. **Semantic HTML**: Uses proper anchor tags for navigation
2. **ARIA Labels**: All icons have descriptive labels
3. **Color Contrast**: All text meets WCAG AA standards
4. **Keyboard Navigation**: Full keyboard support for all tasks
5. **Screen Reader Support**: Descriptive text for all elements

---

## Example Task URLs

### Approval Task
```
/dashboard/document/550e8400-e29b-41d4-a716-446655440000#section-section-abc123
                    └─ Document ID ─┘                        └─ Anchor ─┘
```

### Your Suggestion
```
/dashboard/document/550e8400-e29b-41d4-a716-446655440000#suggestion-sugg-xyz789
                    └─ Document ID ─┘                         └─ Anchor ──┘
```

### Review Task
```
/dashboard/document/550e8400-e29b-41d4-a716-446655440000
                    └─ Document ID (no anchor) ─┘
```

---

## Animation Details

### Hover Animation
```
Duration: 0.2s
Easing: ease
Properties:
  - background-color
  - border-color
  - transform (translateX)
  - box-shadow
```

### Click Animation
```
No animation - immediate navigation
Browser handles link click feedback
```

---

## Task Limits

| Scenario | Behavior |
|----------|----------|
| 0 tasks | Show empty state |
| 1-10 tasks | Show all tasks, no "View All" link |
| 11+ tasks | Show top 10, display "View All" link |
| 100+ tasks | Still show top 10 (performance optimization) |

---

## Performance Considerations

### Database Queries
- Limited to 10 tasks maximum display
- Each query type limited (5 suggestions, 3 recent docs)
- Uses indexed columns for fast retrieval
- RLS enforced on all queries

### Rendering
- No JavaScript required for initial display
- Server-side rendering for SEO and performance
- Minimal CSS (inline in dashboard template)
- No external dependencies

### Load Time
- Tasks loaded during dashboard GET request
- No additional API calls required
- Cached by browser after first load
- Graceful degradation if queries fail

---

## Future Enhancements Visual Mockups

### Task Filters
```
┌─────────────────────────────────────────────┐
│ 📋 My Tasks (5)  [All ▾] [⚙️ Filter]        │
│                  └─ Dropdown menu           │
│                     ┌──────────────┐        │
│                     │ All Tasks    │        │
│                     │ Approvals    │        │
│                     │ Reviews      │        │
│                     │ Suggestions  │        │
│                     └──────────────┘        │
└─────────────────────────────────────────────┘
```

### Task Actions
```
┌───────────────────────────────────────────────┐
│ [⚠️] Approve: Section 2.1    [✓] [✕] [💤] ▸  │
│     Pending in Bylaws         │   │   │      │
│                               │   │   │      │
│     Done ─────────────────────┘   │   │      │
│     Dismiss ──────────────────────┘   │      │
│     Snooze ───────────────────────────┘      │
└───────────────────────────────────────────────┘
```

### Task History
```
┌─────────────────────────────────────────────┐
│ 📋 My Tasks    [Pending ▾]                  │
│                └─ Status filter             │
│                   ┌──────────────┐          │
│                   │ Pending (5)  │          │
│                   │ Completed    │          │
│                   │ Dismissed    │          │
│                   │ All          │          │
│                   └──────────────┘          │
└─────────────────────────────────────────────┘
```

---

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Opera | 76+ | ✅ Full |
| Mobile Safari | 14+ | ✅ Full |
| Chrome Mobile | 90+ | ✅ Full |

---

## Print View

When printing the dashboard:
- Sidebar hidden
- Topbar hidden
- Action buttons hidden
- Tasks displayed in clean list format
- Page breaks avoided within task items
- Black and white friendly colors

---

This visual guide provides a complete reference for the My Tasks implementation!
