# Workflow System User Guide

**Version:** 1.0
**Last Updated:** 2025-10-14
**Audience:** End Users (Members, Admins, Owners)

---

## Table of Contents

1. [What is the Workflow System?](#what-is-the-workflow-system)
2. [Getting Started](#getting-started)
3. [Understanding Workflow Stages](#understanding-workflow-stages)
4. [Creating Suggestions](#creating-suggestions)
5. [Reviewing and Approving Sections](#reviewing-and-approving-sections)
6. [Locking Sections](#locking-sections)
7. [Viewing Approval History](#viewing-approval-history)
8. [Understanding Your Role](#understanding-your-role)
9. [Common Scenarios](#common-scenarios)
10. [Troubleshooting](#troubleshooting)
11. [Frequently Asked Questions](#frequently-asked-questions)

---

## What is the Workflow System?

### Overview

The Workflow System is a multi-stage approval process for document amendments. It ensures that changes to your bylaws go through proper review and approval before being finalized.

### Key Benefits

- **Structured Review**: Changes progress through defined stages (e.g., Committee Review → Board Approval)
- **Role-Based Control**: Only authorized users can approve at each stage
- **Complete History**: Track who approved what and when
- **Transparency**: Everyone can see the approval status of each section

### How It Works

```
1. User creates suggestion
         ↓
2. Committee reviews and locks section with selected suggestion
         ↓
3. Board approves the locked section
         ↓
4. Section is finalized
```

---

## Getting Started

### Accessing the Workflow System

1. **Log in** to the bylaws management platform
2. **Select your organization** from the dashboard
3. **Navigate to a document** by clicking "View" on a document card
4. The **Document Viewer** shows workflow progress

### Your Dashboard

The dashboard shows:

- **Total Documents**: Number of documents in your organization
- **Active Sections**: Sections currently being reviewed
- **Pending Suggestions**: Suggestions awaiting review
- **Approval Progress**: Percentage of sections approved

### Document Viewer Layout

```
┌─────────────────────────────────────────────────────┐
│  Document Title: Bylaws 2025                        │
│  Workflow Progress: ▓▓▓▓▓░░░░░ 50% Complete         │
├──────────────┬──────────────────┬───────────────────┤
│  Sections    │  Section Detail  │  Approval History │
│  (Left)      │  (Center)        │  (Right)          │
│              │                  │                   │
│  [Section 1] │  Original Text   │  ✓ Committee      │
│  [Section 2] │  Suggestions     │  ⏳ Board Pending │
│  [Section 3] │  Actions         │                   │
└──────────────┴──────────────────┴───────────────────┘
```

---

## Understanding Workflow Stages

### What Are Workflow Stages?

Workflow stages define the steps a document section must go through before being finalized. Each stage has:

- **Stage Name**: e.g., "Committee Review", "Board Approval"
- **Required Roles**: Who can approve (e.g., Admin, Owner)
- **Permissions**: What actions are allowed (lock, edit, approve)

### Default 2-Stage Workflow

Most organizations start with a standard 2-stage workflow:

#### Stage 1: Committee Review

- **Who Can Approve**: Admins and Owners
- **Actions Allowed**:
  - Lock sections with selected suggestions
  - Approve/reject sections
- **Purpose**: Initial review and selection of preferred changes

#### Stage 2: Board Approval

- **Who Can Approve**: Owners only
- **Actions Allowed**:
  - Final approval of locked sections
- **Purpose**: Final authorization before changes are finalized

### Workflow Progress Indicators

**Visual indicators** show where each section is in the workflow:

| Icon | Status | Meaning |
|------|--------|---------|
| ○ | Pending | Not started |
| ⏳ | In Progress | Currently being reviewed |
| ✓ | Approved | Approved at this stage |
| ✗ | Rejected | Rejected at this stage |
| 🔒 | Locked | Section locked with selected suggestion |

---

## Creating Suggestions

### As a Member

Members can create suggestions for any section of a document.

### Steps to Create a Suggestion

1. **Navigate to the document** you want to suggest changes for
2. **Click on a section** in the left panel
3. **Click "Add Suggestion"** button in the section detail panel
4. **Fill in the suggestion form**:
   - **Suggested Text**: Your proposed wording
   - **Rationale**: Why this change is needed
   - **Your Name**: Your name (or use "Anonymous")
5. **Click "Submit Suggestion"**

### Example

**Original Text:**
> The board shall meet quarterly to review organization activities.

**Suggested Text:**
> The board shall meet monthly to review organization activities and approve major expenditures.

**Rationale:**
> Monthly meetings provide better oversight and allow for timely decision-making on financial matters.

### After Submission

- Your suggestion appears in the **Suggestions List** for that section
- Other members can **view and discuss** your suggestion
- Admins can **select your suggestion** when locking the section

---

## Reviewing and Approving Sections

### Who Can Approve?

Your ability to approve depends on:

1. **Your Role**: Viewer, Member, Admin, or Owner
2. **Current Workflow Stage**: Each stage defines required roles
3. **Organization Settings**: Workflow configured by your admin

### Approval Workflow for Admins

#### Step 1: Review Suggestions

1. **Navigate to the section**
2. **Read all suggestions** in the suggestions list
3. **Compare** suggested text with original text
4. **Discuss with team** if needed

#### Step 2: Lock Section (Committee Review Stage)

1. **Select the preferred suggestion** by clicking "Select" button
2. **Click "Lock Section"** button
3. **Add notes** (optional): Explain why this suggestion was chosen
4. **Confirm** the lock action

**What Happens:**
- Section is **locked** at Stage 1 (Committee Review)
- Selected suggestion becomes the **proposed new text**
- Section **progresses** to Stage 2 (Board Approval)
- Other suggestions are **still visible** but section is locked

#### Step 3: Approve at Current Stage

1. **Review the locked section**
2. **Click "Approve"** button
3. **Add approval notes** (optional)
4. **Confirm** approval

**What Happens:**
- Section is marked as **approved** at this stage
- Section **automatically progresses** to next stage (if any)
- **Activity is logged** in approval history

### Approval Workflow for Owners (Board Approval Stage)

1. **Review sections** that have passed Committee Review
2. **Verify** the selected suggestion is appropriate
3. **Click "Approve"** to give final approval
4. **Add notes** if needed

**What Happens:**
- Section is **fully approved**
- Changes are **finalized**
- Section appears in **approved sections** list

---

## Locking Sections

### What Does Locking Mean?

**Locking a section** means:

- You've **selected a preferred suggestion** (or kept the original text)
- The section is **frozen** at this workflow stage
- Others **cannot modify** the section until it progresses
- The section is **ready for next-stage review**

### When to Lock a Section

Lock sections when:

- ✅ You've reviewed all suggestions
- ✅ You've selected the best option
- ✅ You're ready to move to the next approval stage

### How to Lock a Section

#### Option 1: Lock with a Suggestion

1. **Select a suggestion** from the list (click "Select" button)
2. **Click "Lock Section"** button
3. **Add lock notes** (optional)
4. **Confirm**

#### Option 2: Lock with Original Text

1. **Don't select any suggestion** (keep original)
2. **Click "Lock Section"** button
3. **Add notes** explaining why no changes are needed
4. **Confirm**

### Lock Notes Best Practices

**Good lock notes**:
- Explain **why** this option was chosen
- Reference **discussion** or rationale
- Note any **concerns** or **follow-up** needed

**Examples**:
- "Selected suggestion #3 as it addresses both clarity and legal compliance."
- "Keeping original text - no changes needed after committee discussion."
- "Chosen suggestion #2 with minor grammatical improvements during next review."

---

## Viewing Approval History

### Approval History Panel

Located on the **right side** of the document viewer, the approval history shows:

- **Stage Name**: Which workflow stage
- **Status**: Approved, Rejected, Locked, In Progress
- **Approved By**: User who performed the action
- **Approved At**: Date and time
- **Notes**: Comments added during approval

### Example Approval History

```
┌─────────────────────────────────────┐
│  Approval History                   │
├─────────────────────────────────────┤
│  ✓ Committee Review                 │
│    Approved by: admin@org.com       │
│    Date: 2025-10-10 14:30 PST       │
│    Notes: Selected suggestion #2    │
│    for improved clarity.            │
├─────────────────────────────────────┤
│  ⏳ Board Approval                  │
│    Status: Pending Review           │
│    Assigned to: Owner               │
└─────────────────────────────────────┘
```

### Filtering History

- **View by stage**: See approvals for specific stages
- **View by date**: Sort by approval date
- **View by approver**: Filter by who approved

---

## Understanding Your Role

### Role Capabilities

| Role | Create Suggestions | Approve Sections | Lock Sections | Manage Workflow |
|------|-------------------|------------------|---------------|-----------------|
| **Viewer** | ❌ | ❌ | ❌ | ❌ |
| **Member** | ✅ | ❌ | ❌ | ❌ |
| **Admin** | ✅ | ✅ (if stage allows) | ✅ (if stage allows) | ❌ |
| **Owner** | ✅ | ✅ (all stages) | ✅ (if stage allows) | ✅ |

### What You Can Do

#### As a Viewer

- **View documents** and sections
- **Read suggestions** from others
- **See approval history**
- **Cannot**: Create suggestions or approve

#### As a Member

- **Everything a Viewer can do**
- **Create suggestions** for any section
- **Edit your own suggestions**
- **Cannot**: Approve or lock sections

#### As an Admin

- **Everything a Member can do**
- **Approve sections** at stages requiring Admin role
- **Lock sections** with selected suggestions
- **Manage users** in your organization
- **Cannot**: Approve at Owner-only stages

#### As an Owner

- **Everything an Admin can do**
- **Approve at any stage** (including Owner-only stages)
- **Configure workflow** settings
- **Manage organization** settings

---

## Common Scenarios

### Scenario 1: Suggesting a Change (Member)

**Situation**: You want to suggest updating Section 3 of the bylaws.

**Steps**:

1. Navigate to the document
2. Click on Section 3 in the left panel
3. Click "Add Suggestion"
4. Enter your suggested text and rationale
5. Submit

**Result**: Your suggestion appears in the suggestions list and committee members will review it.

---

### Scenario 2: Reviewing and Locking (Admin)

**Situation**: You're reviewing Section 5 with 3 suggestions at Committee Review stage.

**Steps**:

1. Click on Section 5
2. Read all 3 suggestions
3. Decide that Suggestion #2 is best
4. Click "Select" on Suggestion #2
5. Click "Lock Section"
6. Add note: "Selected for clarity and legal compliance"
7. Confirm lock

**Result**: Section 5 is locked with Suggestion #2 and moves to Board Approval stage.

---

### Scenario 3: Final Approval (Owner)

**Situation**: 10 sections are locked and awaiting Board Approval.

**Steps**:

1. Review each section in Board Approval stage
2. Verify selected suggestions are appropriate
3. For each section:
   - Click "Approve"
   - Add notes if needed
   - Confirm
4. After all sections approved, create a version snapshot

**Result**: All 10 sections are fully approved and changes are finalized.

---

### Scenario 4: Rejecting a Section (Admin)

**Situation**: You're reviewing Section 7 but the locked suggestion has legal issues.

**Steps**:

1. Click on Section 7
2. Review the locked suggestion
3. Click "Reject" button
4. Add detailed notes explaining the legal concern
5. Confirm rejection

**Result**:
- Section returns to previous stage
- Committee can re-review and select different suggestion
- Rejection notes are visible in history

---

### Scenario 5: Tracking Progress (Any Role)

**Situation**: You want to see how many sections are approved.

**Steps**:

1. Go to document viewer
2. Look at **Workflow Progress Bar** at top
3. See progress percentage and stage breakdown
4. Click on different sections to see individual status

**Result**: Clear visibility into approval progress.

---

## Troubleshooting

### I Can't Create a Suggestion

**Possible Reasons**:

- ❌ You're a **Viewer** (only Members+ can create suggestions)
- ❌ Section is **locked** (locked sections can't receive new suggestions)
- ❌ You're **not logged in** or session expired

**Solution**:
1. Check your role (Dashboard → Profile)
2. Verify section is not locked (look for 🔒 icon)
3. Refresh page and re-login if needed

---

### I Can't Approve a Section

**Possible Reasons**:

- ❌ You're a **Member** (only Admins/Owners can approve)
- ❌ Current stage requires a **higher role** (e.g., Owner-only stage)
- ❌ Section is **not at a stage** you can approve

**Solution**:
1. Check current workflow stage
2. Verify stage's required roles
3. Contact your admin if you need role upgrade

---

### Approval Button is Grayed Out

**Possible Reasons**:

- ❌ Section **hasn't been locked** yet (must lock before approving)
- ❌ Section is **already approved** at this stage
- ❌ You **don't have permission** for this stage

**Solution**:
1. Check if section needs to be locked first
2. Verify section status in approval history
3. Confirm your role matches stage requirements

---

### I Locked the Wrong Suggestion

**What to Do**:

1. **Contact an Owner** or admin with higher permissions
2. They can **reject** the locked section
3. Section returns to previous stage
4. You can **re-lock** with correct suggestion

**Prevention**:
- Always **review carefully** before locking
- Use **preview** to verify selected text
- Add **clear notes** explaining your choice

---

### Approval History Doesn't Show My Action

**Possible Reasons**:

- ❌ Action **just occurred** (refresh page)
- ❌ Action **failed** due to error (check for error message)
- ❌ You approved a **different section** (verify section ID)

**Solution**:
1. Refresh browser (Ctrl+R or Cmd+R)
2. Check browser console for errors (F12)
3. Re-try the approval action
4. Contact support if issue persists

---

## Frequently Asked Questions

### General Questions

**Q: Can I edit a suggestion after submitting it?**
A: Yes, as a Member you can edit your own suggestions before the section is locked.

**Q: What happens if I disagree with a locked suggestion?**
A: Contact the person who locked it or an Owner. They can reject and unlock the section.

**Q: Can I see who created each suggestion?**
A: Yes, each suggestion shows the author name and email.

**Q: How do I know when action is needed from me?**
A: Check the dashboard for "Pending Approvals" count. Sections needing your approval will be highlighted.

### Workflow Questions

**Q: How many workflow stages can we have?**
A: Your organization can configure 1-N stages. Most use 2-3 stages.

**Q: Can we skip a workflow stage?**
A: No, sections must progress through all stages in order.

**Q: What if someone leaves during an approval process?**
A: Owners can reassign approval or complete the stage themselves.

**Q: Can we change the workflow after starting?**
A: Admins can update workflow templates, but active approvals continue with original workflow.

### Permission Questions

**Q: Why can't I approve at Stage 2?**
A: Stage 2 (Board Approval) typically requires Owner role. Contact your admin for role upgrade if needed.

**Q: Can a Member approve if they're also an Admin?**
A: Yes, role levels are hierarchical. Admin includes all Member permissions.

**Q: What if I'm an Admin in one org and a Member in another?**
A: Roles are **per-organization**. Your permissions depend on the organization you're currently viewing.

### Technical Questions

**Q: Is my data secure?**
A: Yes. Row-Level Security (RLS) ensures you can only access data from organizations you're a member of.

**Q: Can I export approved sections?**
A: Yes. Owners can export finalized documents in JSON or PDF format.

**Q: What happens if two people try to lock the same section?**
A: The first person to submit wins. The second person will see an error and can retry.

---

## Need More Help?

### Contact Support

- **Email**: support@your-org.com
- **Documentation**: [Admin Guide](./WORKFLOW_ADMIN_GUIDE.md)
- **API Reference**: [API Docs](./WORKFLOW_API_REFERENCE.md)

### Training Resources

- Video tutorial: "Getting Started with Workflows"
- Webinar: "Best Practices for Approval Processes"
- User forum: community.your-org.com

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: Product Team
**Feedback**: users@your-org.com
