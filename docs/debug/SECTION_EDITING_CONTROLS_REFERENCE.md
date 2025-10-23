# Section Editing Controls - User Reference

## 🎛️ SECTION EDITING TOOLBAR

When you expand a section as an **Owner** or **Admin**, you should see this toolbar:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Edit Section:  [✏️ Rename] [↑] [↓] [→ Indent] [← Dedent] [✂️ Split] [⊔ Join]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📋 BUTTON REFERENCE

### 1️⃣ **Rename** (✏️ Pencil Icon)
**Function:** Change section title and/or section number

**Use Cases:**
- Fix typo in section title
- Update section number after manual reordering
- Adjust numbering scheme (e.g., change "1.1" to "1.a")

**API Endpoint:** `PUT /admin/sections/:id/retitle`

**Example:**
```
Before: Section 3.1 - Board Meetings
After:  Section 3.1 - Board and Committee Meetings
```

---

### 2️⃣ **Move Up** (↑ Arrow)
**Function:** Move section up in the list (swap with previous sibling)

**Use Cases:**
- Reorder sections within same parent
- Fix import order mistakes
- Organize related sections together

**API Endpoint:** `PUT /admin/sections/:id/move`

**Example:**
```
Before:
  3.1 Committee Meetings
  3.2 Board Meetings     ← Move this up

After:
  3.1 Board Meetings     ← Swapped
  3.2 Committee Meetings
```

---

### 3️⃣ **Move Down** (↓ Arrow)
**Function:** Move section down in the list (swap with next sibling)

**Use Cases:**
- Reorder sections within same parent
- Move less important sections lower
- Group related content

**API Endpoint:** `PUT /admin/sections/:id/move`

---

### 4️⃣ **Indent** (→ Right Arrow)
**Function:** Make section a child of the previous sibling (increase hierarchy depth)

**Use Cases:**
- Create subsections
- Fix hierarchy after import
- Nest related content under parent

**API Endpoint:** `PUT /admin/sections/:id/move` (changes parent)

**Example:**
```
Before:
  Article 3 - Meetings
  Board Meetings        ← Indent this

After:
  Article 3 - Meetings
    → Board Meetings    ← Now a child of Article 3
```

**⚠️ Requirement:** Must have a previous sibling to indent under

---

### 5️⃣ **Dedent** (← Left Arrow)
**Function:** Move section up one hierarchy level (make it sibling of current parent)

**Use Cases:**
- Promote subsection to main section
- Fix over-nested hierarchy
- Flatten document structure

**API Endpoint:** `PUT /admin/sections/:id/move` (changes parent)

**Example:**
```
Before:
  Article 3 - Meetings
    → Board Meetings     ← Dedent this
    → Committee Meetings

After:
  Article 3 - Meetings
  Board Meetings         ← Now sibling of Article 3
    → Committee Meetings
```

**⚠️ Requirement:** Section must have a parent (depth > 0)

---

### 6️⃣ **Split** (✂️ Scissors Icon)
**Function:** Split one section into two sections at a specific text position

**Use Cases:**
- Separate topics wrongly combined in one section
- Break up overly long sections
- Fix import merge mistakes

**API Endpoint:** `POST /admin/sections/:id/split`

**Workflow:**
1. Click Split button
2. Modal opens with text preview
3. Use slider to select split position
4. Enter title/number for new section
5. Confirm split

**Example:**
```
Before:
  Section 3.1 - Board meetings are held monthly. Committee meetings are held quarterly.
                ^
                Split here (position 50)

After:
  Section 3.1 - Board meetings are held monthly.
  Section 3.2 - Committee meetings are held quarterly.
```

**⚠️ Restrictions:**
- ❌ Cannot split if section has active suggestions
- ✅ Must split at valid character position (not in middle of word)
- ✅ Both resulting sections must have text content

---

### 7️⃣ **Join** (⊔ Union Icon)
**Function:** Merge multiple adjacent sections into one section

**Use Cases:**
- Combine wrongly split sections
- Merge related content
- Simplify over-fragmented document

**API Endpoint:** `POST /admin/sections/join`

**Workflow:**
1. Click Join button on first section
2. Modal shows adjacent sections
3. Select which sections to merge
4. Choose separator (newline, space, etc.)
5. Confirm join

**Example:**
```
Before:
  Section 3.1 - Board meetings
  Section 3.2 - are held monthly.   ← Join these
  Section 3.3 - in the main office.

After:
  Section 3.1 - Board meetings are held monthly. in the main office.
```

**⚠️ Restrictions:**
- ❌ Cannot join if ANY section has active suggestions
- ✅ Sections must be adjacent siblings (same parent)
- ✅ All suggestions are transferred to the merged section

---

## 🔒 BUTTON STATES

### Enabled (Blue/Primary)
Button is clickable and operation will work.

### Disabled (Gray)
Button appears but is not clickable. Reasons:

**Split/Join disabled:**
```
⚠️ Split/Join disabled: This section has 2 active suggestions.
   Resolve suggestions before splitting or joining.
```

**Move Up disabled:**
- Section is already first in list
- No previous sibling

**Move Down disabled:**
- Section is already last in list
- No next sibling

**Indent disabled:**
- Section is first (no previous sibling to become parent)
- Would exceed maximum depth (10 levels)

**Dedent disabled:**
- Section is at root level (depth 0)
- No parent to move up from

---

## 🚨 RESTRICTIONS & WARNINGS

### Active Suggestions Protection
**Split and Join operations are blocked** if section has any active (non-rejected) suggestions.

**Why?**
- Splitting would orphan suggestions (which part does the suggestion apply to?)
- Joining would mix suggestions from multiple sections

**Solution:**
1. Approve or reject all suggestions first
2. Then perform split/join
3. Add new suggestions if needed

### Locked Sections
If section is locked by workflow:
```
🔒 Section is locked. Unlock before editing.
```

Only admins with workflow permissions can unlock.

---

## 🎯 COMMON WORKFLOWS

### Fix Import Section Order

**Problem:** Sections imported in wrong order
```
1. Introduction
3. Meetings       ← Should be after Officers
2. Officers       ← Should be after Introduction
```

**Solution:**
1. Select "3. Meetings"
2. Click **Move Down** (↓)
3. Result: Introduction → Officers → Meetings

---

### Create Subsection Hierarchy

**Problem:** All sections at same level
```
Article 3 - Meetings
Board Meetings
Committee Meetings
Special Meetings
```

**Solution:**
1. Select "Board Meetings"
2. Click **Indent** (→)
3. Select "Committee Meetings"
4. Click **Indent** (→)
5. Select "Special Meetings"
6. Click **Indent** (→)

**Result:**
```
Article 3 - Meetings
  → Board Meetings
  → Committee Meetings
  → Special Meetings
```

---

### Split Wrongly Combined Section

**Problem:** Two topics in one section
```
Section 4.1 - The board shall meet monthly. Officers shall be elected annually.
```

**Solution:**
1. Click **Split** (✂️)
2. Move slider to position after "monthly."
3. Set new title: "Officer Elections"
4. Set new number: "4.2"
5. Click "Confirm Split"

**Result:**
```
Section 4.1 - The board shall meet monthly.
Section 4.2 - Officers shall be elected annually.
```

---

## 📍 WHERE TO FIND THE BUTTONS

**Location:** Each expanded section card

**Path to UI:**
1. Dashboard → View Document
2. Scroll to any section
3. Click on section to expand
4. Scroll down past suggestions
5. Look for "Edit Section:" toolbar with gray border

**Screenshot Location:**
```
┌─────────────────────────────────────────┐
│ Section 3.1 - Board Meetings            │
│ ═══════════════════════════════════     │
│                                         │
│ [Current Text Display]                  │
│                                         │
│ ─────────────────────────────────────   │
│ Edit Section: [Buttons appear here]    │ ← Look here!
└─────────────────────────────────────────┘
```

---

## 🐛 IF BUTTONS DON'T APPEAR

### Check 1: User Role
```sql
-- Verify your role
SELECT role FROM user_organizations
WHERE user_id = 'YOUR_USER_ID'
AND organization_id = 'YOUR_ORG_ID';

-- Should return: 'owner' or 'admin'
```

### Check 2: Session Data
Open browser console (F12), type:
```javascript
// Check if you're logged in
console.log('User role:', document.querySelector('[data-user-role]')?.dataset.userRole);
```

### Check 3: JavaScript Errors
Open browser console (F12), look for red error messages.
Common issues:
- Failed to load `/js/document-viewer-enhancements.js`
- Bootstrap modal not initialized

### Check 4: Backend API Routes
Test if admin routes are accessible:
```bash
# In browser, try accessing (should redirect to login, not 404)
https://your-app.com/admin/users
```

---

## 🔧 TROUBLESHOOTING

### "Cannot split section with active suggestions"
**Solution:**
1. View suggestions for section
2. Approve or reject each suggestion
3. Refresh page
4. Try split again

### "No previous sibling to indent under"
**Solution:**
- Can't indent first section
- Move section down first, then indent

### Buttons appear but don't work
**Check browser console for errors:**
```
F12 → Console tab
Look for red error messages
```

**Common causes:**
- Network request failed (check server logs)
- Permission denied (check user role)
- Section is locked (check workflow status)

---

## 📚 RELATED DOCUMENTATION

- **API Endpoints:** `/src/routes/admin.js` lines 1120-1927
- **UI Template:** `/views/dashboard/document-viewer.ejs` lines 673-730
- **Permissions:** `/src/middleware/permissions.js`
- **Full Diagnosis:** `SPLIT_INDENT_UI_DIAGNOSIS.md`

---

**Last Updated:** 2025-10-22
**Applies to:** Owner and Admin roles only
**Status:** URGENT FIX NEEDED (see QUICK_FIX_OWNER_BUTTONS.md)
