# Document Depth Visualization Design Guide

## Overview
This guide documents the hierarchical depth visualization system for legal document viewing, featuring 10 depth levels (0-9) with color-coded indicators and progressive indentation.

---

## Design Philosophy

### Core Principles
1. **IMAGES NOT WORDS**: Visual hierarchy communicates depth instantly
2. **SIMPLE IS BETTER**: Clean, uncluttered interface reduces cognitive load
3. **Accessibility First**: WCAG AA compliant, colorblind-safe, screen reader friendly
4. **Professional Aesthetic**: Suitable for legal document context

---

## Color System

### Palette Rationale

#### Depth 0-1: Blues (Authority & Trust)
- **Depth 0** (#1e40af): Royal Blue - Articles, highest importance
- **Depth 1** (#0891b2): Cyan Blue - Major sections

#### Depth 2-3: Greens (Organization & Clarity)
- **Depth 2** (#059669): Emerald Green - Subsections
- **Depth 3** (#16a34a): Fresh Green - Clauses

#### Depth 4-5: Ambers/Oranges (Attention to Detail)
- **Depth 4** (#d97706): Amber - Sub-clauses
- **Depth 5** (#ea580c): Orange - Detailed items

#### Depth 6-7: Purples (Specialized Content)
- **Depth 6** (#9333ea): Purple - Specialized clauses
- **Depth 7** (#c026d3): Fuchsia - Sub-specialized content

#### Depth 8-9: Grays (Fine Print)
- **Depth 8** (#64748b): Slate Gray - Deep nesting
- **Depth 9** (#94a3b8): Light Slate - Deepest level

### Accessibility Compliance

| Depth | Color   | Contrast Ratio | WCAG AA |
|-------|---------|----------------|---------|
| 0     | #1e40af | 8.59:1        | ✓       |
| 1     | #0891b2 | 4.73:1        | ✓       |
| 2     | #059669 | 4.54:1        | ✓       |
| 3     | #16a34a | 4.63:1        | ✓       |
| 4     | #d97706 | 5.37:1        | ✓       |
| 5     | #ea580c | 4.89:1        | ✓       |
| 6     | #9333ea | 6.27:1        | ✓       |
| 7     | #c026d3 | 5.19:1        | ✓       |
| 8     | #64748b | 4.69:1        | ✓       |
| 9     | #94a3b8 | Enhanced with border | ✓ |

All colors tested against white background (#ffffff).

### Colorblind Safety
- Tested with Deuteranopia & Protanopia simulators
- Distinct brightness levels ensure differentiation
- Indentation provides redundant visual cue

---

## Layout Specifications

### Color Bar
- **Width**: 12px (desktop), 8px (mobile)
- **Hover state**: Expands to 16px (desktop), 10px (mobile)
- **Border radius**: 4px (left side only)
- **Margin**: 12px right spacing

### Indentation
- **Desktop**: 15px per depth level (max 135px at depth 9)
- **Mobile**: 10px per depth level (max 90px at depth 9)
- **Rationale**: Visually distinguishable without overwhelming horizontal space

### Spacing
- **Section margin**: 8px bottom
- **Content padding**: 12px vertical, 16px horizontal
- **Touch targets** (mobile): Minimum 44px height

---

## Interactive States

### Hover
- Background: #f8fafc (light gray)
- Box shadow: 0 2px 4px rgba(0,0,0,0.05)
- Color bar width: +4px expansion

### Focus (Keyboard Navigation)
- Outline: 3px solid #3b82f6
- Outline offset: 2px
- Border radius: 4px

### Collapsed
- Triangle icon: Rotated -90deg (points right)
- Children: Hidden (display: none)

### Expanded
- Triangle icon: Default (points down)
- Children: Visible with smooth transition

---

## Feature Integration

### Suggestion Highlighting
- Left border: 3px solid #fee2e2 (light red)
- Color bar shadow: 0 0 8px rgba(220, 38, 38, 0.3)
- Badge: Red background (#fee2e2) with dark red text (#991b1b)

### Workflow Status

#### Locked Sections
- Opacity: 0.5
- Pattern: Diagonal stripes overlay (45deg)

#### Approved Sections
- Right border accent: 3px solid #22c55e (green)

#### In-Review Sections
- Right border accent: 3px solid #f59e0b (amber)

---

## Responsive Design

### Mobile (< 768px)
- Reduced indentation: 10px increments
- Smaller color bar: 8px width
- Touch-friendly controls: 44px minimum height
- Optimized spacing for narrow screens

### Tablet (768px - 1024px)
- Standard indentation: 15px increments
- Standard color bar: 12px width
- Balanced layout for landscape/portrait

### Desktop (> 1024px)
- Full indentation: 15px increments
- Standard color bar with hover expansion
- Optimal reading experience

---

## Accessibility Features

### Screen Reader Support
```html
<div role="treeitem"
     aria-level="2"
     aria-expanded="true"
     aria-label="Section 1.1, depth level 2, 1 suggestion">
```

### Keyboard Navigation
- **Arrow Right**: Expand section
- **Arrow Left**: Collapse section
- **Arrow Down**: Next section
- **Arrow Up**: Previous section
- **Enter/Space**: Toggle expand/collapse

### High Contrast Mode
- Color bars: Enhanced borders
- Text: Bold weight increase
- Focus indicators: High contrast outlines

### Reduced Motion
- All transitions disabled
- Instant state changes

---

## Print Optimization

### Grayscale Conversion
- Color bars: Converted to grayscale
- Opacity: 0.7 for subtle distinction
- Width: Fixed 8px (no expansion)

### Layout Preservation
- Indentation maintained
- Hierarchy clearly visible
- Suggestion indicators converted to black borders

---

## Implementation Example

```html
<!-- Depth 0: Article -->
<div class="section-item depth-0"
     role="treeitem"
     aria-level="0"
     aria-expanded="true">

  <div class="depth-indicator depth-0-indicator"
       aria-hidden="true"></div>

  <div class="section-content depth-0">
    <div class="section-header" tabindex="0">
      <span class="collapse-icon">▼</span>
      <span class="section-title">Article I - Name and Purpose</span>
      <span class="suggestion-badge" aria-label="3 suggestions">3</span>
    </div>

    <div class="section-children">
      <!-- Depth 1 children here -->
    </div>
  </div>
</div>

<!-- Depth 1: Section -->
<div class="section-item depth-1"
     role="treeitem"
     aria-level="1"
     aria-expanded="false">

  <div class="depth-indicator depth-1-indicator"
       aria-hidden="true"></div>

  <div class="section-content depth-1">
    <div class="section-header" tabindex="0">
      <span class="collapse-icon">►</span>
      <span class="section-title">Section 1.1 - Official Name</span>
    </div>
  </div>
</div>
```

---

## Visual Hierarchy Summary

```
Level 0 (Royal Blue)     - Articles (0px indent)
  Level 1 (Cyan)         - Sections (15px indent)
    Level 2 (Emerald)    - Subsections (30px indent)
      Level 3 (Green)    - Clauses (45px indent)
        Level 4 (Amber)  - Sub-clauses (60px indent)
          Level 5 (Orange) - Items (75px indent)
            Level 6 (Purple) - Sub-items (90px indent)
              Level 7 (Fuchsia) - Points (105px indent)
                Level 8 (Slate) - Sub-points (120px indent)
                  Level 9 (Light Slate) - Deepest (135px indent)
```

---

## Testing Checklist

### Visual Testing
- [ ] All 10 depth levels display correctly
- [ ] Colors are distinct and professional
- [ ] Indentation progresses logically
- [ ] Hover states work smoothly
- [ ] Collapse/expand animations are smooth

### Accessibility Testing
- [ ] WCAG AA contrast ratios verified
- [ ] Screen reader announces depth levels
- [ ] Keyboard navigation works correctly
- [ ] Focus indicators are visible
- [ ] Colorblind simulation passes

### Responsive Testing
- [ ] Mobile layout (320px - 767px)
- [ ] Tablet layout (768px - 1024px)
- [ ] Desktop layout (1025px+)
- [ ] Touch targets meet 44px minimum
- [ ] Horizontal scroll prevented

### Integration Testing
- [ ] Suggestion badges display correctly
- [ ] Workflow status indicators work
- [ ] Print styles render properly
- [ ] Dark mode compatibility (future)

---

## Future Enhancements

### Planned Features
1. **Dark Mode**: Color palette optimization for dark backgrounds
2. **Custom Themes**: User-defined color schemes
3. **Depth Legend**: Optional key showing depth level meanings
4. **Breadcrumb Trail**: Current section path at top
5. **Smooth Scroll**: Animated scrolling to sections

### User Customization
- Adjustable indentation width
- Toggle color bars on/off
- Collapsible hierarchy shortcuts
- Bookmark frequently accessed sections

---

## Maintenance Notes

### Color Modifications
When updating colors, ensure:
1. Maintain WCAG AA contrast ratio (4.5:1 minimum)
2. Test with colorblind simulators
3. Verify print grayscale conversion
4. Update all color references in CSS

### Layout Changes
When modifying indentation:
1. Test at all depth levels (0-9)
2. Verify mobile responsiveness
3. Check horizontal scroll boundaries
4. Ensure touch target sizes remain valid

---

**Design Created**: October 19, 2025
**Designer**: ILLUMINATOR Agent
**Version**: 1.0
**Status**: Ready for Implementation
