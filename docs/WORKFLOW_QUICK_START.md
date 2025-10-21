# Workflow Assignment - Quick Start Guide

**Last Updated:** October 15, 2025
**Status:** ✅ Ready to Use
**Server:** http://localhost:3000

---

## 🎯 How to Access Workflow Assignment

### **Method 1: From Dashboard (Easiest)**

1. **Go to your dashboard:**
   ```
   http://localhost:3000/dashboard
   ```

2. **Find the "Recent Documents" table**
   - Look for the document you want to assign a workflow to

3. **Click the green workflow button:**
   - In the "Actions" column, you'll see 3 buttons:
     - 👁️ Blue eye icon = View document
     - **📊 Green diagram icon = Manage Workflow** ← CLICK THIS!
     - 📥 Gray download icon = Export document

4. **You're now on the workflow assignment page!**

---

### **Method 2: Direct URL**

If you know your document ID:

```
http://localhost:3000/admin/documents/{YOUR_DOCUMENT_ID}/assign-workflow
```

**Example:**
```
http://localhost:3000/admin/documents/a1b2c3d4-5678-90ab-cdef-1234567890ab/assign-workflow
```

---

### **Method 3: From Document Viewer**

1. Open a document in the viewer
2. Copy the document ID from the URL
3. Use Method 2 (Direct URL) above

---

## 📋 Step-by-Step Workflow Assignment

### **Step 1: Access the Page**
- Use the **green diagram button** 📊 from your dashboard
- Or navigate directly with the URL

### **Step 2: Select a Template**
- You'll see a dropdown list of available workflow templates
- Each template shows the number of stages (e.g., "Review Process (3 stages)")

### **Step 3: Preview Stages**
- When you select a template, a preview appears automatically
- Shows:
  - Stage order (1, 2, 3...)
  - Stage names (e.g., "Committee Review", "Board Approval")
  - Stage permissions (who can approve)
  - Color-coded badges

### **Step 4: Assign Workflow**
- Click the green **"Assign Workflow"** button
- Wait for success message (appears in ~1 second)
- Shows:
  - Template name assigned
  - Initial stage name
  - Number of sections initialized

### **Step 5: View the Results**
- **Automatic redirect** to document viewer
- Now expand any section
- **You'll see the workflow action buttons:**
  - 🟢 **Green "Approve" button**
  - 🔴 **Red "Reject" button**
  - 🕐 **Clock icon for history**

---

## 🎯 What the Buttons Look Like

### **On Dashboard:**
```
┌─────────────────────────────────────────────┐
│ Recent Documents                            │
├─────┬──────┬────────┬────────┬────────────┬─┤
│Title│ Type │Sections│ Status │  Actions   │ │
├─────┼──────┼────────┼────────┼────────────┼─┤
│ ... │ ... │   ...  │  ...   │ 👁️ 📊 📥  │ │
└─────┴──────┴────────┴────────┴────────────┴─┘
                                   ↑
                            Click this green one!
```

### **On Workflow Assignment Page:**
```
┌─────────────────────────────────────────────┐
│ Assign Workflow Template                    │
├─────────────────────────────────────────────┤
│ Document: My Bylaws Document                │
│ (12 sections)                               │
│                                             │
│ Select Workflow Template:                   │
│ ┌─────────────────────────────────────────┐│
│ │ ▼ Review Process (3 stages)            ││
│ └─────────────────────────────────────────┘│
│                                             │
│ Workflow Stages:                            │
│ 1. Initial Review                           │
│ 2. Committee Approval                       │
│ 3. Board Approval                           │
│                                             │
│ [Assign Workflow] [Cancel]                  │
└─────────────────────────────────────────────┘
```

---

## ✅ Success Checklist

After assigning a workflow, verify everything works:

- [ ] Go to dashboard at http://localhost:3000/dashboard
- [ ] See the green workflow button (📊) in the Actions column
- [ ] Click the green button
- [ ] See the workflow assignment page load
- [ ] See list of templates in dropdown
- [ ] Select a template
- [ ] See stage preview appear
- [ ] Click "Assign Workflow"
- [ ] See success message
- [ ] Redirect to document viewer
- [ ] Expand a section
- [ ] **See green "Approve" button appear** ✨
- [ ] **See red "Reject" button appear** ✨
- [ ] Click "Approve" and enter notes
- [ ] Section advances to next stage
- [ ] Workflow progress bar updates

---

## 🐛 Troubleshooting

### **Can't see the green workflow button?**
- Refresh your dashboard page
- Make sure you have at least one document uploaded
- Check that you're logged in as Admin or Owner

### **"Document already has a workflow assigned" error?**
- Each document can only have one workflow
- To change workflows, you'll need to remove the existing one first
- (Workflow removal feature is on the roadmap)

### **Buttons still not appearing after assignment?**
1. Make sure the success message showed up
2. Refresh the document viewer page
3. Expand the section (buttons only show when expanded)
4. Check browser console for errors (F12)

### **Need to find your document ID?**
```bash
# From terminal
sqlite3 database/bylaws_tool.db "SELECT id, title FROM documents;"

# Copy the UUID from the first column
```

---

## 🎉 You're All Set!

The green workflow button (📊) is now on your dashboard. Just:

1. Go to dashboard
2. Find your document
3. Click the green diagram button
4. Select a template
5. Click "Assign Workflow"
6. Done! Buttons will appear.

---

## 📖 More Information

- **Full Testing Guide:** `docs/WORKFLOW_ASSIGNMENT_GUIDE.md`
- **API Reference:** `docs/WORKFLOW_API_REFERENCE.md`
- **Complete System Docs:** `docs/WORKFLOW_IMPLEMENTATION_COMPLETE.md`

---

**Quick Access:**
```
Dashboard: http://localhost:3000/dashboard
```

**Look for the 📊 green button in the Actions column!**
