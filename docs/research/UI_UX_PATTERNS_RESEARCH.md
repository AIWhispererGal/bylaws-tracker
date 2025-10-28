# UI/UX Pattern Research - Document Navigation Best Practices

**Research Date:** 2025-10-27
**Researcher:** Hive Mind Research Agent
**Purpose:** Research collapsible UI patterns and document navigation best practices

---

## Table of Contents

1. [Collapsible Sidebar Patterns](#collapsible-sidebar-patterns)
2. [Collapsible Section/Article Patterns](#collapsible-sectionarticle-patterns)
3. [Document Navigation Best Practices](#document-navigation-best-practices)
4. [Error Page Design Examples](#error-page-design-examples)
5. [Implementation Recommendations](#implementation-recommendations)

---

## Collapsible Sidebar Patterns

### Pattern 1: VS Code File Explorer
**Characteristics:**
- Persistent tree structure on left side
- Expand/collapse folders with arrow icons
- Highlights current file
- Keyboard navigation (arrows, enter)
- Right-click context menus
- Resizable width with drag handle

**Pros:**
- Highly efficient for developers
- Clear visual hierarchy
- Fast keyboard navigation
- Context preserved when collapsing

**Cons:**
- Complex to implement
- Requires careful state management
- May be overkill for simple navigation

**When to Use:**
- Large document collections with deep nesting
- Users who need frequent navigation between sections
- Power users who value keyboard shortcuts

**CSS Implementation:**
```css
.sidebar-tree {
  position: fixed;
  left: 0;
  top: 64px; /* Below header */
  bottom: 0;
  width: 300px;
  overflow-y: auto;
  background: #f5f5f5;
  border-right: 1px solid #ddd;
  transition: transform 0.3s ease;
}

.sidebar-tree.collapsed {
  transform: translateX(-100%);
}

.tree-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-item:hover {
  background: #e9ecef;
}

.tree-item.active {
  background: #007bff;
  color: white;
}

.tree-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.tree-toggle.expanded {
  transform: rotate(90deg);
}
```

---

### Pattern 2: GitHub Repository File Tree
**Characteristics:**
- Sticky sidebar that scrolls with page
- File/folder icons for visual distinction
- Breadcrumb path at top
- "Collapse all" and "Expand all" buttons
- Search filter at top

**Pros:**
- Familiar to most developers
- Good balance of features and simplicity
- Works well on medium screens
- Search integration

**Cons:**
- Can be overwhelming with many files
- No keyboard shortcuts by default
- Fixed width may waste space

**When to Use:**
- Document repository with clear hierarchy
- Users comfortable with file tree metaphor
- Need for quick search within structure

**Implementation:**
```javascript
class FileTree {
  constructor(container, data) {
    this.container = container;
    this.data = data;
    this.collapsed = new Set();
    this.render();
  }

  render() {
    const html = this.renderTree(this.data);
    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  renderTree(nodes, level = 0) {
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = this.collapsed.has(node.id);
      const indent = level * 20;

      return `
        <div class="tree-node" style="padding-left: ${indent}px">
          ${hasChildren ? `
            <button class="tree-toggle" data-id="${node.id}">
              <i class="bi bi-chevron-${isCollapsed ? 'right' : 'down'}"></i>
            </button>
          ` : '<span class="tree-spacer"></span>'}
          <a href="#${node.id}" class="tree-link">
            <i class="bi bi-${node.type === 'folder' ? 'folder' : 'file-text'}"></i>
            ${node.title}
          </a>
        </div>
        ${hasChildren && !isCollapsed ? this.renderTree(node.children, level + 1) : ''}
      `;
    }).join('');
  }

  attachEventListeners() {
    this.container.querySelectorAll('.tree-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (this.collapsed.has(id)) {
          this.collapsed.delete(id);
        } else {
          this.collapsed.add(id);
        }
        this.render();
      });
    });
  }

  collapseAll() {
    this.data.forEach(node => this.collapseRecursive(node));
    this.render();
  }

  expandAll() {
    this.collapsed.clear();
    this.render();
  }

  collapseRecursive(node) {
    this.collapsed.add(node.id);
    if (node.children) {
      node.children.forEach(child => this.collapseRecursive(child));
    }
  }
}
```

---

### Pattern 3: Notion Page Tree
**Characteristics:**
- Clean, minimal design
- Indent with hover to show/hide toggle
- Drag-and-drop reordering
- Inline editing of titles
- Smooth animations
- Icons/emojis for visual anchors

**Pros:**
- Beautiful, modern aesthetic
- Excellent user experience
- Natural interactions
- Works great on touch devices

**Cons:**
- Complex implementation
- Requires significant JavaScript
- May be too "flashy" for some use cases

**When to Use:**
- Modern, consumer-facing applications
- Documents with user-editable structure
- Need for drag-and-drop organization

---

### Pattern 4: Bootstrap Collapse Accordion
**Characteristics:**
- Simple, accessible collapse component
- One section open at a time (accordion mode)
- Or multiple sections open (independent)
- Built-in ARIA attributes
- Mobile-friendly

**Pros:**
- Simple to implement
- Accessible by default
- Works on all devices
- No custom JavaScript needed

**Cons:**
- Basic functionality only
- Limited customization
- Not ideal for deep hierarchies

**When to Use:**
- Simple FAQ or section lists
- Need quick implementation
- Accessibility is priority

**Implementation:**
```html
<!-- Accordion (one at a time) -->
<div class="accordion" id="tocAccordion">
  <div class="accordion-item">
    <h2 class="accordion-header" id="headingOne">
      <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne">
        Article I - Organization
      </button>
    </h2>
    <div id="collapseOne" class="accordion-collapse collapse show" data-bs-parent="#tocAccordion">
      <div class="accordion-body">
        <a href="#section-1-1">Section 1.1 - Name</a>
        <a href="#section-1-2">Section 1.2 - Purpose</a>
      </div>
    </div>
  </div>
</div>

<!-- Independent Collapse (multiple open) -->
<div class="collapse-list">
  <div class="collapse-item">
    <button class="collapse-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#section1">
      <i class="bi bi-chevron-down"></i> Article I
    </button>
    <div id="section1" class="collapse show">
      <ul>
        <li><a href="#1.1">Section 1.1</a></li>
        <li><a href="#1.2">Section 1.2</a></li>
      </ul>
    </div>
  </div>
</div>
```

---

## Recommended Pattern for Bylaws Tool: **Hybrid Approach**

### Design Decision
**Combine VS Code tree structure + GitHub sticky sidebar + Notion animations**

### Why This Works:
1. **Tree Structure:** Natural for hierarchical bylaws documents
2. **Sticky Positioning:** Always accessible during scroll
3. **Smooth Animations:** Professional, modern feel
4. **Bootstrap Foundation:** Accessible, mobile-friendly

### Implementation Sketch:
```javascript
// Hybrid Collapsible TOC Sidebar
class BylawsTOC {
  constructor(selector, sections) {
    this.container = document.querySelector(selector);
    this.sections = sections;
    this.collapsed = new Set();
    this.activeSection = null;

    this.render();
    this.attachScrollSpy();
  }

  render() {
    const toc = this.buildTree(this.sections);
    this.container.innerHTML = `
      <div class="toc-header">
        <h5>Table of Contents</h5>
        <button class="btn-collapse-all" onclick="tocInstance.collapseAll()">
          Collapse All
        </button>
      </div>
      <div class="toc-search">
        <input type="text" placeholder="Search sections..." />
      </div>
      <div class="toc-tree">
        ${toc}
      </div>
    `;
  }

  buildTree(nodes, depth = 0) {
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = this.collapsed.has(node.id);
      const isActive = this.activeSection === node.id;

      return `
        <div class="toc-item" data-depth="${depth}" data-id="${node.id}">
          <div class="toc-item-header ${isActive ? 'active' : ''}">
            ${hasChildren ? `
              <button class="toc-toggle" onclick="tocInstance.toggle('${node.id}')">
                <i class="bi bi-chevron-${isCollapsed ? 'right' : 'down'}"></i>
              </button>
            ` : '<span class="toc-spacer"></span>'}
            <a href="#${node.anchorId}" class="toc-link">
              <span class="toc-number">${node.section_number}</span>
              <span class="toc-title">${node.section_title || 'Untitled'}</span>
            </a>
          </div>
          ${hasChildren && !isCollapsed ? `
            <div class="toc-children">
              ${this.buildTree(node.children, depth + 1)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  toggle(id) {
    if (this.collapsed.has(id)) {
      this.collapsed.delete(id);
    } else {
      this.collapsed.add(id);
    }
    this.render();
  }

  collapseAll() {
    this.sections.forEach(node => this.collapseRecursive(node));
    this.render();
  }

  expandAll() {
    this.collapsed.clear();
    this.render();
  }

  collapseRecursive(node) {
    this.collapsed.add(node.id);
    if (node.children) {
      node.children.forEach(child => this.collapseRecursive(child));
    }
  }

  // Scroll spy to highlight active section
  attachScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.activeSection = entry.target.id;
          this.updateActiveState();
        }
      });
    }, {
      rootMargin: '-20% 0px -70% 0px'
    });

    document.querySelectorAll('[data-section-id]').forEach(section => {
      observer.observe(section);
    });
  }

  updateActiveState() {
    this.container.querySelectorAll('.toc-link').forEach(link => {
      link.classList.remove('active');
    });
    const activeLink = this.container.querySelector(`a[href="#${this.activeSection}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Usage
const tocInstance = new BylawsTOC('#tableOfContents', sectionsData);
```

---

## Collapsible Section/Article Patterns

### Pattern 1: Accordion (Bootstrap)
**Already covered above** - Good for simple use cases

### Pattern 2: Details/Summary (Native HTML)
**Characteristics:**
- Native HTML element (no JavaScript needed)
- Accessible by default
- Simple API
- Works everywhere

**Pros:**
- Zero JavaScript
- Fully accessible
- Works without CSS
- Progressive enhancement

**Cons:**
- Limited styling options
- No animation control
- Browser inconsistencies

**Implementation:**
```html
<details open>
  <summary>Article I - Organization</summary>
  <div class="section-content">
    <p>This organization shall be known as...</p>
  </div>
</details>

<style>
  details {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  summary {
    cursor: pointer;
    font-weight: 600;
    user-select: none;
  }

  summary:hover {
    color: #007bff;
  }

  details[open] summary {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #ddd;
  }
</style>
```

---

### Pattern 3: Card with Expand/Collapse Button
**Characteristics:**
- Card-based design
- Explicit expand/collapse button
- Shows preview when collapsed
- Smooth height transition

**Pros:**
- Clear visual affordance
- Preview helps scanning
- Smooth animations
- Good for content-heavy sections

**Cons:**
- Requires JavaScript for smooth animation
- More complex markup
- Takes more vertical space

**Implementation:**
```html
<div class="section-card" data-section-id="article-1">
  <div class="section-header">
    <div class="section-meta">
      <span class="section-number">Article I</span>
      <span class="section-badge">5 suggestions</span>
    </div>
    <h3 class="section-title">Organization</h3>
    <button class="btn-expand" aria-expanded="false" aria-controls="content-article-1">
      <i class="bi bi-chevron-down"></i>
    </button>
  </div>
  <div id="content-article-1" class="section-content collapsed">
    <div class="section-body">
      <p>This organization shall be known as...</p>
    </div>
  </div>
</div>

<style>
  .section-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    margin-bottom: 1rem;
    overflow: hidden;
    transition: box-shadow 0.3s;
  }

  .section-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  }

  .section-header {
    padding: 1.5rem;
    cursor: pointer;
  }

  .section-content {
    max-height: 5000px;
    overflow: hidden;
    transition: max-height 0.4s ease-out, opacity 0.3s ease-out;
  }

  .section-content.collapsed {
    max-height: 0;
    opacity: 0;
  }

  .btn-expand i {
    transition: transform 0.3s ease;
  }

  .btn-expand[aria-expanded="true"] i {
    transform: rotate(180deg);
  }
</style>

<script>
  document.querySelectorAll('.btn-expand').forEach(btn => {
    btn.addEventListener('click', function() {
      const content = document.getElementById(this.getAttribute('aria-controls'));
      const isExpanded = this.getAttribute('aria-expanded') === 'true';

      this.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('collapsed');
    });
  });
</script>
```

---

## Document Navigation Best Practices

### 1. Persistent TOC (Table of Contents)
**Best Implementation:**
- Sticky sidebar on left (desktop)
- Collapsible header section (mobile)
- Highlight current section
- Smooth scroll to section on click

### 2. Breadcrumb Navigation
**Always show context:**
```html
<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li><a href="/dashboard">Home</a></li>
    <li><a href="/dashboard/documents">Documents</a></li>
    <li class="active">Bylaws 2024</li>
  </ol>
</nav>
```

### 3. Section Navigation Controls
**Add to each section:**
- Previous section button
- Next section button
- Jump to parent section
- Copy link to section

### 4. Search Within Document
**Implement client-side search:**
```javascript
function searchDocument(query) {
  const sections = document.querySelectorAll('.section-content');
  const results = [];

  sections.forEach(section => {
    const text = section.textContent.toLowerCase();
    const index = text.indexOf(query.toLowerCase());

    if (index !== -1) {
      results.push({
        section: section.dataset.sectionId,
        excerpt: text.substr(Math.max(0, index - 50), 150),
        position: index
      });
    }
  });

  return results;
}
```

### 5. Keyboard Shortcuts
**Essential shortcuts:**
- `Ctrl+F` or `/`: Search document
- `n`: Next section
- `p`: Previous section
- `h`: Home/Dashboard
- `Esc`: Close modals/exit search

---

## Error Page Design Examples

### 1. GitHub Style (Friendly Octopus)
**Characteristics:**
- Illustration + humor
- Clear error message
- Helpful suggestions
- Link to homepage

**Example:**
```html
<div class="error-page">
  <img src="/images/404-octopus.svg" alt="Lost octopus" />
  <h1>404 - Page Not Found</h1>
  <p>Looks like this page swam away. Let's get you back on track:</p>
  <ul>
    <li><a href="/dashboard">Return to Dashboard</a></li>
    <li><a href="/search">Search Documents</a></li>
    <li><a href="/help">Get Help</a></li>
  </ul>
</div>
```

### 2. Stripe Style (Minimalist)
**Characteristics:**
- Clean, simple design
- Explains what happened
- Next steps clearly listed
- Branding maintained

**Example:**
```html
<div class="error-minimal">
  <div class="error-code">403</div>
  <h1>Access Denied</h1>
  <p>You don't have permission to view this resource.</p>
  <p>This could be because:</p>
  <ul>
    <li>Your account role doesn't include this permission</li>
    <li>The resource belongs to a different organization</li>
  </ul>
  <a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
  <a href="/help/permissions" class="btn btn-link">Learn about permissions</a>
</div>
```

### 3. Asana Style (Helpful + Visual)
**Characteristics:**
- Large icon/illustration
- Friendly tone
- Multiple action buttons
- Context-aware suggestions

**Example:**
```html
<div class="error-helpful">
  <i class="error-icon bi bi-shield-x"></i>
  <h1>Oops! You don't have access</h1>
  <p>It looks like you're trying to view admin settings, but your current role is "Member".</p>

  <div class="error-actions">
    <button class="btn btn-primary" onclick="location.href='/dashboard'">
      <i class="bi bi-house"></i> Go to Dashboard
    </button>
    <button class="btn btn-outline-secondary" onclick="history.back()">
      <i class="bi bi-arrow-left"></i> Go Back
    </button>
  </div>

  <div class="error-help">
    <p>Need admin access?</p>
    <a href="/contact-admin">Contact your organization administrator</a>
  </div>
</div>
```

---

## Recommended Error Page Design for Bylaws Tool

### Error Page Template
```html
<!DOCTYPE html>
<html>
<head>
  <title><%= errorCode %> - Bylaws Tool</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .error-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 2rem;
    }

    .error-content {
      max-width: 600px;
      background: white;
      color: #2c3e50;
      border-radius: 16px;
      padding: 3rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    .error-code {
      font-size: 6rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }

    .error-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.7;
    }

    .error-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }

    .error-help {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #e9ecef;
      font-size: 0.875rem;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <div class="error-page">
    <div class="error-content">
      <div class="error-code"><%= errorCode %></div>
      <i class="error-icon bi bi-<%= iconClass %>"></i>
      <h1><%= title %></h1>
      <p><%= message %></p>

      <% if (suggestions && suggestions.length > 0) { %>
        <div class="error-suggestions">
          <p>This might have happened because:</p>
          <ul class="text-start">
            <% suggestions.forEach(suggestion => { %>
              <li><%= suggestion %></li>
            <% }); %>
          </ul>
        </div>
      <% } %>

      <div class="error-actions">
        <% if (backButton) { %>
          <button class="btn btn-outline-primary" onclick="history.back()">
            <i class="bi bi-arrow-left"></i> Go Back
          </button>
        <% } %>
        <a href="/dashboard" class="btn btn-primary">
          <i class="bi bi-house"></i> Go to Dashboard
        </a>
      </div>

      <% if (helpLink) { %>
        <div class="error-help">
          <p>Need help? <a href="<%= helpLink %>"><%= helpText || 'Contact Support' %></a></p>
        </div>
      <% } %>
    </div>
  </div>
</body>
</html>
```

---

## Implementation Recommendations

### Phase 1: Collapsible TOC Sidebar
1. Create `BylawsTOC` class (JavaScript)
2. Add sticky sidebar container to document viewer
3. Implement expand/collapse logic
4. Add scroll spy for active section highlighting
5. Style with Bootstrap + custom CSS

### Phase 2: Section Expand/Collapse
1. Convert sections to collapsible cards
2. Add smooth height transitions
3. Implement "Expand All" / "Collapse All" buttons
4. Add keyboard shortcuts
5. Optimize for mobile (touch-friendly)

### Phase 3: Error Pages
1. Create error page template (`views/error.ejs`)
2. Implement for 404, 403, 500 errors
3. Add context-aware suggestions
4. Test with all user roles
5. Add branding and illustrations

### Phase 4: Polish
1. Add animations (CSS transitions)
2. Implement lazy loading for large documents
3. Add search functionality
4. Optimize performance
5. Accessibility audit (ARIA labels, keyboard nav)

---

## Conclusion

Recommended approach for Bylaws Tool:

1. **Collapsible TOC:** Hybrid tree sidebar (VS Code + GitHub + Notion)
2. **Section Expand:** Card-based with smooth transitions
3. **Error Pages:** Helpful, branded, with clear next steps
4. **Mobile:** Responsive, touch-friendly, bottom sheet modals

All patterns prioritize:
- ✅ Accessibility (ARIA, keyboard nav)
- ✅ Performance (lazy loading, smooth animations)
- ✅ User experience (clear affordances, helpful messages)
- ✅ Mobile-first (responsive, touch-friendly)

---

**Report End**
Research complete. Ready for architect to create implementation plan.
