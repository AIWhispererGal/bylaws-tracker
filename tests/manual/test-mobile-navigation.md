# Manual Test: Mobile Navigation

## Test Environment Setup
1. Open application in browser
2. Open Developer Tools (F12)
3. Toggle Device Toolbar (Ctrl+Shift+M or Cmd+Shift+M)
4. Select mobile device or custom viewport

## Test Cases

### TC-1: Hamburger Button Visibility
**Viewport:** < 768px width
**Steps:**
1. Set viewport to 375px width (iPhone)
2. Navigate to /dashboard
3. Observe hamburger button in top-left corner

**Expected:**
- [x] Purple gradient hamburger button visible
- [x] Button positioned at top-left (10px from top/left)
- [x] Hamburger icon (three lines) displayed
- [x] Button has proper z-index (appears above content)

### TC-2: Open Sidebar
**Viewport:** < 768px width
**Steps:**
1. Click hamburger button
2. Observe sidebar animation

**Expected:**
- [x] Sidebar slides in from left
- [x] Animation smooth (0.3s ease)
- [x] Overlay appears behind sidebar
- [x] Hamburger icon changes to X icon
- [x] Body scroll disabled
- [x] Sidebar visible with all navigation items

### TC-3: Close Sidebar - Overlay Click
**Viewport:** < 768px width
**Precondition:** Sidebar is open
**Steps:**
1. Click on dark overlay area

**Expected:**
- [x] Sidebar slides out to left
- [x] Overlay fades away
- [x] Hamburger icon changes back to three lines
- [x] Body scroll re-enabled

### TC-4: Close Sidebar - X Button
**Viewport:** < 768px width
**Precondition:** Sidebar is open
**Steps:**
1. Click hamburger button (now showing X)

**Expected:**
- [x] Sidebar slides out to left
- [x] Overlay fades away
- [x] Icon changes back to hamburger
- [x] Menu closes smoothly

### TC-5: Close Sidebar - Navigation Link
**Viewport:** < 768px width
**Precondition:** Sidebar is open
**Steps:**
1. Click any navigation link in sidebar

**Expected:**
- [x] Navigation proceeds to target page
- [x] Sidebar closes with small delay (200ms)
- [x] Smooth transition

### TC-6: Close Sidebar - Escape Key
**Viewport:** < 768px width
**Precondition:** Sidebar is open
**Steps:**
1. Press Escape key

**Expected:**
- [x] Sidebar closes immediately
- [x] Focus returns to hamburger button
- [x] Overlay disappears

### TC-7: Touch Swipe Gesture
**Viewport:** < 768px width (Touch device or simulated)
**Precondition:** Sidebar is open
**Steps:**
1. Touch sidebar
2. Swipe left (>50px distance)
3. Release

**Expected:**
- [x] Sidebar closes on swipe completion
- [x] Gesture feels natural
- [x] Minimum swipe threshold required (50px)

### TC-8: Desktop Behavior
**Viewport:** > 768px width
**Steps:**
1. Set viewport to 1024px width
2. Navigate to /dashboard

**Expected:**
- [x] Sidebar always visible
- [x] Hamburger button hidden
- [x] No overlay present
- [x] Normal desktop navigation

### TC-9: Resize Behavior
**Viewport:** Variable
**Steps:**
1. Open sidebar on mobile (< 768px)
2. Resize viewport to desktop (> 768px)
3. Resize back to mobile

**Expected:**
- [x] Menu auto-closes when resizing to desktop
- [x] Hamburger re-appears on mobile resize
- [x] No visual glitches
- [x] Smooth transitions

### TC-10: Tablet Viewport
**Viewport:** 769px - 991px
**Steps:**
1. Set viewport to 800px width
2. Navigate to /dashboard

**Expected:**
- [x] Sidebar always visible (220px width)
- [x] Hamburger button hidden
- [x] Narrower sidebar than desktop
- [x] All navigation items readable

### TC-11: Small Mobile (320px)
**Viewport:** 320px - 576px
**Steps:**
1. Set viewport to 375px width
2. Open and close menu

**Expected:**
- [x] Hamburger button properly sized (8px margins)
- [x] Sidebar fits viewport
- [x] Touch targets at least 44x44px
- [x] Text readable and not cut off

### TC-12: Landscape Mobile
**Viewport:** < 768px width, landscape orientation
**Steps:**
1. Set viewport to 667x375 (iPhone landscape)
2. Test menu open/close

**Expected:**
- [x] Narrower sidebar (240px)
- [x] Menu functions properly
- [x] Content visible when closed
- [x] No horizontal scroll

### TC-13: Accessibility - Keyboard Navigation
**Viewport:** < 768px width
**Steps:**
1. Tab to hamburger button
2. Press Enter to open
3. Tab through nav links
4. Press Escape to close

**Expected:**
- [x] Hamburger button focusable
- [x] Focus visible (white outline)
- [x] Focus moves to first nav link on open
- [x] All nav items keyboard accessible
- [x] Escape key closes menu
- [x] Focus returns to hamburger on close

### TC-14: Accessibility - Screen Reader
**Viewport:** < 768px width
**Tools:** Screen reader (NVDA, JAWS, VoiceOver)
**Steps:**
1. Navigate to hamburger button
2. Listen to button announcement

**Expected:**
- [x] Button labeled "Toggle navigation menu"
- [x] aria-expanded="false" when closed
- [x] aria-expanded="true" when open
- [x] Menu items properly announced
- [x] Overlay has aria-hidden="true"

### TC-15: Multiple Page Navigation
**Viewport:** < 768px width
**Steps:**
1. Open sidebar
2. Click "Documents" link
3. Return to dashboard
4. Open sidebar again

**Expected:**
- [x] Menu state doesn't persist incorrectly
- [x] Always starts closed on new page
- [x] No JavaScript errors
- [x] Consistent behavior

### TC-16: Performance
**Viewport:** < 768px width
**Tools:** DevTools Performance tab
**Steps:**
1. Record performance while opening menu
2. Check frame rate

**Expected:**
- [x] Animation at 60fps
- [x] No janky frames
- [x] will-change CSS applied
- [x] Hardware acceleration active

### TC-17: Touch Target Size
**Viewport:** < 768px width
**Steps:**
1. Measure hamburger button size
2. Measure nav link tap areas

**Expected:**
- [x] Hamburger button ≥ 44x44px
- [x] Nav links ≥ 44px height
- [x] Adequate spacing between items
- [x] Easy to tap without mistakes

### TC-18: Console Errors
**Viewport:** All
**Steps:**
1. Open console
2. Navigate to dashboard
3. Open and close menu multiple times

**Expected:**
- [x] No JavaScript errors
- [x] No CSS warnings
- [x] Only localhost debug message (if local)
- [x] Clean console

### TC-19: Admin Dashboard
**Viewport:** < 768px width
**Steps:**
1. Navigate to /admin/dashboard (as global admin)
2. Test mobile menu

**Expected:**
- [x] Mobile menu works on admin dashboard
- [x] Same behavior as regular dashboard
- [x] mobile-menu.js properly loaded
- [x] No conflicts with admin styles

### TC-20: Cross-Browser Testing
**Browsers:** Chrome, Safari, Firefox, Edge
**Viewport:** < 768px width
**Steps:**
1. Test on each browser (desktop simulation)
2. Test on actual mobile devices if available

**Expected:**
- [x] Chrome Mobile: Fully functional
- [x] Safari iOS: Fully functional
- [x] Firefox Mobile: Fully functional
- [x] Samsung Internet: Fully functional
- [x] Edge Mobile: Fully functional

## Test Results Template

```
Date: ___________
Tester: ___________
Browser: ___________
Device: ___________

| TC# | Test Case | Pass | Fail | Notes |
|-----|-----------|------|------|-------|
| TC-1 | Hamburger Visibility | [ ] | [ ] | |
| TC-2 | Open Sidebar | [ ] | [ ] | |
| TC-3 | Close - Overlay | [ ] | [ ] | |
| TC-4 | Close - X Button | [ ] | [ ] | |
| TC-5 | Close - Nav Link | [ ] | [ ] | |
| TC-6 | Close - Escape | [ ] | [ ] | |
| TC-7 | Touch Swipe | [ ] | [ ] | |
| TC-8 | Desktop Behavior | [ ] | [ ] | |
| TC-9 | Resize Behavior | [ ] | [ ] | |
| TC-10 | Tablet Viewport | [ ] | [ ] | |
| TC-11 | Small Mobile | [ ] | [ ] | |
| TC-12 | Landscape Mobile | [ ] | [ ] | |
| TC-13 | Keyboard Nav | [ ] | [ ] | |
| TC-14 | Screen Reader | [ ] | [ ] | |
| TC-15 | Multi-Page Nav | [ ] | [ ] | |
| TC-16 | Performance | [ ] | [ ] | |
| TC-17 | Touch Targets | [ ] | [ ] | |
| TC-18 | Console Errors | [ ] | [ ] | |
| TC-19 | Admin Dashboard | [ ] | [ ] | |
| TC-20 | Cross-Browser | [ ] | [ ] | |

Overall: PASS / FAIL
```

## Common Issues to Watch For

### Issue: Menu doesn't open
**Possible causes:**
- mobile-menu.js not loaded
- JavaScript error preventing initialization
- CSS conflict hiding hamburger button

**Debug steps:**
1. Check browser console for errors
2. Verify mobile-menu.js in Network tab
3. Check if hamburger button exists in DOM
4. Verify viewport width < 768px

### Issue: Overlay doesn't appear
**Possible causes:**
- Z-index conflict
- CSS not loaded
- Overlay element not created

**Debug steps:**
1. Inspect DOM for .sidebar-overlay element
2. Check computed styles for overlay
3. Verify mobile-menu.css loaded

### Issue: Menu doesn't close
**Possible causes:**
- Event listeners not attached
- JavaScript error in closeMenu function
- CSS transition broken

**Debug steps:**
1. Check console for JavaScript errors
2. Verify event listeners in DevTools
3. Test each close method individually

### Issue: Animation janky
**Possible causes:**
- Too many elements animating
- No hardware acceleration
- Browser performance throttling

**Debug steps:**
1. Check Performance tab for frame drops
2. Verify will-change CSS applied
3. Test on actual device (not just simulation)

### Issue: Accessibility problems
**Possible causes:**
- Missing ARIA attributes
- Focus management broken
- Keyboard events not handled

**Debug steps:**
1. Use axe DevTools for a11y audit
2. Test with keyboard only
3. Test with screen reader

## Automated Test Script

To create automated tests for mobile navigation:

```javascript
// Example Cypress test
describe('Mobile Navigation', () => {
  beforeEach(() => {
    cy.viewport(375, 667); // iPhone size
    cy.visit('/dashboard');
  });

  it('should show hamburger button on mobile', () => {
    cy.get('#mobile-menu-toggle').should('be.visible');
  });

  it('should open sidebar when hamburger clicked', () => {
    cy.get('#mobile-menu-toggle').click();
    cy.get('.sidebar').should('have.class', 'show');
    cy.get('.sidebar-overlay').should('have.class', 'show');
  });

  it('should close sidebar when overlay clicked', () => {
    cy.get('#mobile-menu-toggle').click();
    cy.get('.sidebar-overlay').click();
    cy.get('.sidebar').should('not.have.class', 'show');
  });

  it('should close sidebar on escape key', () => {
    cy.get('#mobile-menu-toggle').click();
    cy.get('body').type('{esc}');
    cy.get('.sidebar').should('not.have.class', 'show');
  });
});
```

## Sign-off

**Tested by:** _________________
**Date:** _________________
**Result:** PASS / FAIL
**Notes:** _________________
