# UI/UX Flow Specifications

**Document Version:** 1.0
**Date:** 2025-10-13
**Status:** Analysis Complete
**Author:** Analyst Agent (Hive Mind Collective)

---

## Executive Summary

This document defines complete user interface flows and interactions for the role management system and approval workflow. All flows are designed for intuitive user experience while maintaining California Brown Act compliance.

---

## Table of Contents

1. [Role Management Flows](#1-role-management-flows)
2. [User Invitation Flow](#2-user-invitation-flow)
3. [Workflow Approval Flows](#3-workflow-approval-flows)
4. [Section Locking Flow](#4-section-locking-flow)
5. [Document Versioning Flow](#5-document-versioning-flow)
6. [Dashboard Interactions](#6-dashboard-interactions)
7. [Mobile Responsiveness](#7-mobile-responsiveness)

---

## 1. Role Management Flows

### 1.1 User Management Page

**Route:** `/dashboard/settings/users`

**Access:** Admins and Owners only

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│  [← Dashboard] Organization Settings > Users                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Organization Users (23 / 50)          [+ Invite User]        │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  🔍 [Search by name or email... ]  Role: [All Roles ▼]       │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 👤 John Doe (you)                                      │  │
│  │ john.doe@example.com                        [Owner ▼]  │  │
│  │ Joined Jan 1, 2025 • Last active 2 mins ago           │  │
│  │ ────────────────────────────────────────────────────── │  │
│  │ Permissions:                                           │  │
│  │ ✓ Manage users  ✓ Approve workflows  ✓ All access     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 👤 Jane Smith                                          │  │
│  │ jane.smith@example.com          [Admin ▼]  [Remove]   │  │
│  │ Joined Jan 5, 2025 • Last active 1 hour ago           │  │
│  │ ────────────────────────────────────────────────────── │  │
│  │ Permissions:                                           │  │
│  │ ✓ Manage users  ✓ Approve workflows  ✓ Edit docs      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 👤 Bob Johnson                                         │  │
│  │ bob.johnson@example.com  [Committee ▼]  [Remove]      │  │
│  │ Joined Feb 10, 2025 • Last active 3 days ago          │  │
│  │ ────────────────────────────────────────────────────── │  │
│  │ Permissions:                                           │  │
│  │ ✓ Vote on suggestions  ✓ Approve committee stage      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  [Load More...]                                   Page 1 of 3 │
└────────────────────────────────────────────────────────────────┘
```

**Interactions:**

1. **Search:** Real-time filtering of user list
2. **Role Dropdown:** Click to change user role (triggers confirmation)
3. **Remove Button:** Opens confirmation dialog
4. **Invite User Button:** Opens invitation modal

---

### 1.2 Role Change Flow

**Trigger:** Admin clicks role dropdown and selects new role

**Flow:**
```
User clicks role dropdown
  ↓
Dropdown shows available roles:
  • Owner (disabled if not current owner)
  • Admin
  • Committee Member
  • Staff
  • Suggester
  • Viewer
  ↓
User selects new role
  ↓
Confirmation modal appears
  ↓
User reviews permission changes
  ↓
User enters optional reason
  ↓
User clicks "Confirm Change"
  ↓
API call to update role
  ↓
Success: User list updates, notification appears
Failed: Error message displays
```

**Confirmation Modal:**
```
┌─────────────────────────────────────────────────┐
│ Change User Role                          [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Change Jane Smith's role:                       │
│                                                 │
│ Admin  →  Committee Member                      │
│                                                 │
│ ⚠️ Permissions that will be removed:            │
│ • Manage users and invitations                  │
│ • Configure workflows                           │
│ • Approve board-level amendments                │
│ • Delete documents                              │
│                                                 │
│ ✅ Permissions that will be kept:               │
│ • Vote on suggestions                           │
│ • Approve committee stage                       │
│ • Lock sections                                 │
│                                                 │
│ Reason for change (optional):                   │
│ [___________________________________________]   │
│                                                 │
│ [Cancel]                      [Confirm Change]  │
└─────────────────────────────────────────────────┘
```

**Success Notification:**
```
┌─────────────────────────────────────────┐
│ ✓ Role Updated Successfully             │
│ Jane Smith is now a Committee Member    │
│ Email notification has been sent        │
└─────────────────────────────────────────┘
```

---

## 2. User Invitation Flow

### 2.1 Invite User Modal

**Trigger:** Admin clicks "+ Invite User" button

**Modal:**
```
┌─────────────────────────────────────────────────┐
│ Invite User to Organization               [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Email Address *                                 │
│ [___________________________________________]   │
│                                                 │
│ Full Name                                       │
│ [___________________________________________]   │
│                                                 │
│ Role *                                          │
│ [Committee Member         ▼]                    │
│                                                 │
│ ℹ️  Role Description:                           │
│ Committee members can vote on suggestions       │
│ and approve amendments during committee         │
│ review stage.                                   │
│                                                 │
│ Personal Message (optional):                    │
│ [___________________________________________]   │
│ [___________________________________________]   │
│                                                 │
│ 👥 Organization capacity: 23 / 50 users         │
│                                                 │
│ [Cancel]                   [Send Invitation]   │
└─────────────────────────────────────────────────┘
```

**Validation Rules:**
- Email must be valid format
- Email cannot already exist in organization
- Role must be selected
- Must not exceed 50-user limit

**Success:**
```
┌─────────────────────────────────────────┐
│ ✓ Invitation Sent!                      │
│ jane.smith@example.com                  │
│ The invitation link will expire in 7    │
│ days.                                   │
└─────────────────────────────────────────┘
```

---

### 2.2 Accept Invitation Flow

**Entry Point:** User clicks invitation link in email

**URL:** `/auth/accept-invite?token=XXXXXXXXX`

**Flow:**
```
User clicks invitation link
  ↓
System validates token
  ↓
Valid token?
  ├─ YES: Continue
  └─ NO: Show "Invitation expired or invalid" page
  ↓
User already has account?
  ├─ YES: Log in and join organization
  └─ NO: Show registration form
  ↓
Show invitation details:
  • Organization name
  • Role being assigned
  • Invited by (name)
  ↓
User reviews and accepts
  ↓
Account created / Membership activated
  ↓
Redirect to dashboard
```

**Invitation Acceptance Page:**
```
┌────────────────────────────────────────────────────────────┐
│                  Bylaws Amendment Tracker                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│             You've been invited to join                    │
│          Reseda Neighborhood Council                       │
│                                                            │
│  Invited by: John Doe (john.doe@example.com)              │
│  Role: Committee Member                                    │
│  Invited on: October 10, 2025                              │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│  As a Committee Member, you will be able to:               │
│  ✓ View and edit document sections                         │
│  ✓ Create and vote on suggestions                          │
│  ✓ Approve amendments during committee review              │
│  ✓ Lock sections for final approval                        │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│  Already have an account?                                  │
│  [Login and Join]                                          │
│                                                            │
│  New to Bylaws Amendment Tracker?                          │
│  [Create Account and Join]                                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Workflow Approval Flows

### 3.1 Section Review and Approval

**Entry Point:** User views document, clicks section to expand

**Section Card (Expanded with Workflow Panel):**
```
┌────────────────────────────────────────────────────────────┐
│ Article III, Section 2: Board Composition                  │
│ [Committee Review ▼]                   Status: In Progress │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Current Text:                                              │
│ ┌────────────────────────────────────────────────────┐   │
│ │ The Board shall consist of fifteen (15) elected   │   │
│ │ representatives from the community, serving two-   │   │
│ │ year staggered terms...                            │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ ────────────────────────────────────────────────────────  │
│                                                            │
│ 📋 Workflow Progress                                       │
│ ● Committee Review (Current)                               │
│ ○ Board Approval                                           │
│                                                            │
│ ────────────────────────────────────────────────────────  │
│                                                            │
│ 💡 Suggestions (3)                         [+ Add Yours]   │
│                                                            │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 👤 Jane Smith  •  Oct 5, 2025                      │   │
│ │ ────────────────────────────────────────────────── │   │
│ │ "Change board size to 17 members"                  │   │
│ │                                                    │   │
│ │ Rationale: Increase representation                 │   │
│ │                                                    │   │
│ │ 👥 8 community members support this                │   │
│ │                                                    │   │
│ │ [View Full Text]    [🔒 Select & Lock Section]    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 👤 Bob Johnson  •  Oct 6, 2025                     │   │
│ │ ────────────────────────────────────────────────── │   │
│ │ "Reduce board size to 13 members"                  │   │
│ │                                                    │   │
│ │ Rationale: Improve efficiency                      │   │
│ │                                                    │   │
│ │ 👥 3 community members support this                │   │
│ │                                                    │   │
│ │ [View Full Text]    [🔒 Select & Lock Section]    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ Actions:                                                   │
│ [💬 Add Comment]  [✗ Reject Amendment]                    │
└────────────────────────────────────────────────────────────┘
```

**Permission-based Button Display:**
- **Committee Member:** Sees "Select & Lock Section" button
- **Staff:** Only sees "Add Comment" button
- **Suggester:** Only sees "Add Yours" button
- **Viewer:** No action buttons

---

### 3.2 Lock Section Flow

**Trigger:** Committee member clicks "Select & Lock Section" on a suggestion

**Flow:**
```
User clicks "Select & Lock Section"
  ↓
Confirmation modal appears
  ↓
User reviews selection
  ↓
User adds optional note
  ↓
User clicks "Lock Section"
  ↓
API call to lock section
  ↓
Success:
  • Section card shows "LOCKED" badge
  • Selected suggestion highlighted
  • Other suggestions disabled
  • Unlock button appears
  • Notification sent to org admins
```

**Lock Confirmation Modal:**
```
┌─────────────────────────────────────────────────┐
│ Lock Section with Selected Suggestion    [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ You are about to lock:                          │
│ Article III, Section 2: Board Composition       │
│                                                 │
│ With this suggestion:                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ "Change board size to 17 members"           │ │
│ │ by Jane Smith                               │ │
│ │                                             │ │
│ │ Rationale: Increase community               │ │
│ │ representation...                           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ⚠️ This action will:                            │
│ • Lock the section for further editing          │
│ • Mark this suggestion as selected              │
│ • Disable other suggestions for this section    │
│ • Notify organization admins                    │
│                                                 │
│ Note for committee (optional):                  │
│ [___________________________________________]   │
│                                                 │
│ [Cancel]                          [Lock Section] │
└─────────────────────────────────────────────────┘
```

**Locked Section Display:**
```
┌────────────────────────────────────────────────────────────┐
│ Article III, Section 2: Board Composition                  │
│ [Committee Review ▼]                   🔒 Locked           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 🔒 Section Locked by John Doe on Oct 10, 2025             │
│                                                            │
│ ✓ Selected Suggestion:                                     │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 👤 Jane Smith  •  Oct 5, 2025        [SELECTED]   │   │
│ │ ────────────────────────────────────────────────── │   │
│ │ "Change board size to 17 members"                  │   │
│ │                                                    │   │
│ │ [View Full Text]           [Show Diff]            │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ Committee Note: "Most supported by community"              │
│                                                            │
│ Actions (Committee Members):                               │
│ [🔓 Unlock Section]  [✓ Approve for Board Review]         │
└────────────────────────────────────────────────────────────┘
```

---

### 3.3 Approve Stage Flow

**Trigger:** Committee member clicks "Approve for Board Review"

**Flow:**
```
User clicks "Approve for Board Review"
  ↓
Confirmation modal appears
  ↓
User confirms approval
  ↓
API call to approve stage
  ↓
Success:
  • Section moves to "Board Approval" stage
  • Badge changes to "Approved"
  • Section remains locked
  • Board members notified
  • Progress indicator updates
```

**Approval Confirmation:**
```
┌─────────────────────────────────────────────────┐
│ Approve for Board Review                  [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ You are approving this amendment for board      │
│ review:                                         │
│                                                 │
│ Article III, Section 2: Board Composition       │
│ "Change board size to 17 members"               │
│                                                 │
│ ℹ️ This section will:                           │
│ • Move to Board Approval stage                  │
│ • Remain locked with selected suggestion        │
│ • Require board approval before finalization    │
│                                                 │
│ Approval note (optional):                       │
│ [___________________________________________]   │
│                                                 │
│ [Cancel]                                [Approve] │
└─────────────────────────────────────────────────┘
```

---

## 4. Section Locking Flow

### 4.1 Lock States and Visual Indicators

**State 1: Unlocked (Editable)**
```
┌────────────────────────────────┐
│ Section 2.1              [Edit] │
│ Status: Open                    │
│ ○ Unlocked                      │
└────────────────────────────────┘
```

**State 2: Locked (Committee)**
```
┌────────────────────────────────┐
│ Section 2.1            [Locked] │
│ Status: Committee Review        │
│ 🔒 Locked by John D.  [Unlock] │
│ Oct 10, 2025                    │
└────────────────────────────────┘
```

**State 3: Locked (Board Stage)**
```
┌────────────────────────────────┐
│ Section 2.1            [Locked] │
│ Status: Board Approval          │
│ 🔒 Locked by Committee          │
│ Cannot be unlocked              │
└────────────────────────────────┘
```

**State 4: Finalized**
```
┌────────────────────────────────┐
│ Section 2.1         [Finalized] │
│ Status: Adopted                 │
│ ✓ Version 1.2.0                 │
│ Oct 15, 2025                    │
└────────────────────────────────┘
```

---

### 4.2 Unlock Section Flow

**Trigger:** User (who locked it or admin) clicks "Unlock Section"

**Confirmation:**
```
┌─────────────────────────────────────────────────┐
│ Unlock Section                            [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Unlock Article III, Section 2?                  │
│                                                 │
│ ⚠️ This will:                                   │
│ • Remove the lock                               │
│ • Deselect the chosen suggestion                │
│ • Allow section to be edited again              │
│ • Reset workflow to "In Progress"               │
│                                                 │
│ Reason for unlocking:                           │
│ [___________________________________________]   │
│                                                 │
│ [Cancel]                              [Unlock]  │
└─────────────────────────────────────────────────┘
```

---

## 5. Document Versioning Flow

### 5.1 Finalize Amendments

**Entry Point:** Admin clicks "Finalize Amendments" on workflow dashboard

**Workflow Dashboard:**
```
┌────────────────────────────────────────────────────────────┐
│ Bylaws Amendment Workflow                                  │
│ Document Version: 1.1.0           [Finalize Amendments]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Board Approval Stage (8 sections ready)                    │
│                                                            │
│ ✓ Article III, Section 2: Board Composition               │
│ ✓ Article V, Section 1: Meeting Frequency                 │
│ ✓ Article VI, Section 3: Quorum Requirements              │
│ ✓ Article VII, Section 1: Amendment Process               │
│ ... and 4 more                                             │
│                                                            │
│ [Finalize All 8 Approved Sections]                         │
└────────────────────────────────────────────────────────────┘
```

**Finalize Modal:**
```
┌─────────────────────────────────────────────────────────┐
│ Finalize Approved Amendments                      [×]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ You are about to finalize 8 board-approved             │
│ amendments and create a new document version.          │
│                                                         │
│ Current Version: 1.1.0                                  │
│ New Version:     [1.2.0 ▼] (Minor)                     │
│                       │                                 │
│                       ├─ 1.2.0 (Minor) - Recommended   │
│                       ├─ 2.0.0 (Major)                 │
│                       └─ 1.1.1 (Patch)                 │
│                                                         │
│ Affected Sections (8):                                  │
│ ┌─────────────────────────────────────────────────┐   │
│ │ ✓ Article III, Section 2: Board Composition    │   │
│ │ ✓ Article V, Section 1: Meeting Frequency      │   │
│ │ ✓ Article VI, Section 3: Quorum Requirements   │   │
│ │ ... and 5 more (click to expand)               │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Version Notes:                                          │
│ [____________________________________________]         │
│ [____________________________________________]         │
│                                                         │
│ ⚠️ This action will:                                    │
│ • Apply all 8 approved amendments                       │
│ • Create document version 1.2.0                         │
│ • Unlock all affected sections                          │
│ • Reset workflow states for these sections              │
│ • Send notification to all organization members         │
│                                                         │
│ [Cancel]                    [Finalize Amendments]      │
└─────────────────────────────────────────────────────────┘
```

**Success:**
```
┌─────────────────────────────────────────┐
│ ✓ Amendments Finalized!                 │
│ Document version 1.2.0 created          │
│ 8 sections updated                      │
│ [View Version History]  [View Document] │
└─────────────────────────────────────────┘
```

---

### 5.2 Version History Viewer

**Route:** `/dashboard/documents/:id/versions`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  [← Back to Document] Bylaws Version History              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Current Version: 1.2.0                                    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📄 Version 1.2.0  •  Oct 15, 2025  •  by John Doe │  │
│  │ ────────────────────────────────────────────────── │  │
│  │ Type: Minor Update                                 │  │
│  │ Changes: October 2025 amendments                   │  │
│  │                                                    │  │
│  │ 8 sections modified:                               │  │
│  │ • Article III, Section 2: Board Composition        │  │
│  │ • Article V, Section 1: Meeting Frequency          │  │
│  │ ... and 6 more                                     │  │
│  │                                                    │  │
│  │ [View Full Document]  [Compare to 1.1.0]           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📄 Version 1.1.0  •  Sept 20, 2025  •  Jane Smith │  │
│  │ ────────────────────────────────────────────────── │  │
│  │ Type: Minor Update                                 │  │
│  │ Changes: September meeting amendments              │  │
│  │                                                    │  │
│  │ 5 sections modified                                │  │
│  │                                                    │  │
│  │ [View Full Document]  [Compare to 1.0.0]           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📄 Version 1.0.0  •  Jan 1, 2025  •  Initial      │  │
│  │ ────────────────────────────────────────────────── │  │
│  │ Type: Major Release                                │  │
│  │ Original document uploaded                         │  │
│  │                                                    │  │
│  │ [View Full Document]                               │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

### 5.3 Version Comparison (Diff View)

**Route:** `/dashboard/documents/:id/compare?from=1.1.0&to=1.2.0`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Compare Versions: 1.1.0 → 1.2.0                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  View: [Side-by-Side ▼]  [Unified]  [Changes Only]       │
│                                                            │
│  Article III, Section 2: Board Composition                 │
│  ┌──────────────────────┬──────────────────────┐         │
│  │ Version 1.1.0        │ Version 1.2.0        │         │
│  ├──────────────────────┼──────────────────────┤         │
│  │ The Board shall      │ The Board shall      │         │
│  │ consist of fifteen   │ consist of seventeen │         │
│  │ (15) elected...      │ (17) elected...      │         │
│  │                      │                      │         │
│  │ [Deleted text in red with strikethrough]    │         │
│  │ [Added text in green with highlight]        │         │
│  └──────────────────────┴──────────────────────┘         │
│                                                            │
│  [Export as PDF]  [Download Redline Document]             │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Dashboard Interactions

### 6.1 Workflow Progress Dashboard

**Route:** `/dashboard`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Dashboard                          Hi, John Doe (Admin)   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Active Documents                                          │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📄 Bylaws 2025                   Version: 1.1.0   │  │
│  │ ────────────────────────────────────────────────── │  │
│  │ Progress: ████████░░░░ 56% complete                │  │
│  │                                                    │  │
│  │ Committee Review: 12 sections                      │  │
│  │ Board Approval: 8 sections                         │  │
│  │ Finalized: 25 sections                             │  │
│  │                                                    │  │
│  │ [View Document]  [Manage Workflow]                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  Recent Activity                                           │
│  • John Doe locked Article III, Section 2 (5 min ago)     │
│  • Jane Smith approved Section 5.1 (1 hr ago)             │
│  • Board finalized 5 sections (2 hrs ago)                  │
│                                                            │
│  Pending Actions (3)                                       │
│  • 5 sections awaiting committee approval                  │
│  • 3 sections ready for board review                       │
│  • 12 new suggestions submitted                            │
│                                                            │
│  [View All Activity]                                       │
└────────────────────────────────────────────────────────────┘
```

---

### 6.2 Notification System

**Notification Triggers:**
1. User invited to organization
2. Role changed
3. Section locked
4. Amendment approved at any stage
5. Amendment finalized
6. New suggestion on section you're watching
7. Workflow progressed to next stage

**Notification Bell (Top Right):**
```
┌─────────────────────────────────────────┐
│ 🔔 (3)                                  │
│ ┌─────────────────────────────────────┐ │
│ │ New notification                    │ │
│ │ John Doe locked Article III, Sec 2  │ │
│ │ 5 minutes ago                       │ │
│ ├─────────────────────────────────────┤ │
│ │ Amendment approved                  │ │
│ │ Section 5.1 moved to board review   │ │
│ │ 1 hour ago                          │ │
│ ├─────────────────────────────────────┤ │
│ │ New suggestion                      │ │
│ │ Jane Smith suggested changes to...  │ │
│ │ 2 hours ago                         │ │
│ └─────────────────────────────────────┘ │
│ [View All Notifications]                │
└─────────────────────────────────────────┘
```

---

## 7. Mobile Responsiveness

### 7.1 Mobile User Management

**Stacked Cards on Mobile:**
```
┌─────────────────────────────┐
│ [☰] Organization Users      │
│         [+ Invite]          │
├─────────────────────────────┤
│                             │
│ 🔍 Search users...          │
│ Filter: [All Roles ▼]      │
│                             │
│ ┌─────────────────────────┐ │
│ │ 👤 John Doe (you)       │ │
│ │ john.doe@example.com    │ │
│ │ [Owner ▼]               │ │
│ │                         │ │
│ │ Joined Jan 1, 2025      │ │
│ │ Last active: 2 mins ago │ │
│ │                         │ │
│ │ [Manage]                │ │
│ └─────────────────────────┘ │
│                             │
│ [Load More...]              │
└─────────────────────────────┘
```

---

### 7.2 Mobile Workflow View

**Simplified Section Cards:**
```
┌─────────────────────────────┐
│ Article III, Section 2      │
│ [Committee Review ▼]        │
│                             │
│ Status: 🔒 Locked           │
│ by John D. • Oct 10         │
│                             │
│ [Tap to expand ▼]           │
└─────────────────────────────┘
```

**Expanded:**
```
┌─────────────────────────────┐
│ Article III, Section 2      │
│ [Committee Review ▼]        │
├─────────────────────────────┤
│ Status: 🔒 Locked           │
│ by John D. • Oct 10         │
│                             │
│ Current Text:               │
│ The Board shall consist of  │
│ fifteen (15) elected...     │
│                             │
│ ───────────────────────────  │
│                             │
│ Selected Suggestion:        │
│ "Change board size to 17"   │
│ by Jane Smith               │
│                             │
│ [View Details]              │
│                             │
│ Actions:                    │
│ [🔓 Unlock]  [✓ Approve]   │
│                             │
│ [Collapse ▲]                │
└─────────────────────────────┘
```

---

## 8. Accessibility Considerations

### 8.1 WCAG 2.1 Level AA Compliance

**Color Contrast:**
- All text meets 4.5:1 contrast ratio minimum
- Status badges use both color AND icons
- Locked state uses 🔒 icon, not just red color

**Keyboard Navigation:**
- All interactive elements accessible via Tab
- Modal dialogs trap focus
- Escape key closes modals
- Arrow keys navigate dropdowns

**Screen Reader Support:**
- ARIA labels on all interactive elements
- Status announcements for workflow changes
- Descriptive alt text for icons
- Semantic HTML structure

**Focus Indicators:**
- Visible focus rings on all interactive elements
- Focus persists when modals close
- Skip links for keyboard users

---

## 9. Error States and Edge Cases

### 9.1 Error Messages

**Network Error:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Connection Error                     │
│ Unable to save changes. Please check    │
│ your internet connection and try again. │
│                                         │
│ [Retry]              [Cancel]          │
└─────────────────────────────────────────┘
```

**Permission Denied:**
```
┌─────────────────────────────────────────┐
│ 🚫 Permission Denied                    │
│ You don't have permission to perform    │
│ this action. Contact your organization  │
│ admin for access.                       │
│                                         │
│ [OK]                                    │
└─────────────────────────────────────────┘
```

**Validation Error:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Invalid Input                        │
│ Please check the following:             │
│ • Email address is required             │
│ • Role must be selected                 │
│                                         │
│ [OK]                                    │
└─────────────────────────────────────────┘
```

---

## 10. Loading States

### 10.1 Skeleton Loaders

**User List Loading:**
```
┌─────────────────────────────────────────┐
│ ▮▮▮▮▮▮▮▮ Organization Users             │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ● ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮                  │ │
│ │   ▮▮▮▮▮▮▮▮▮▮▮▮▮▮                   │ │
│ │   ▮▮▮▮▮ ▮▮▮▮▮▮▮                    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ● ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮                  │ │
│ │   ▮▮▮▮▮▮▮▮▮▮▮▮▮▮                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Inline Loading (Action in Progress):**
```
┌─────────────────────────────────────────┐
│ Updating role...  [⟳ Loading]          │
│ Please wait while we save your changes. │
└─────────────────────────────────────────┘
```

---

## Success Criteria

- ✅ All flows complete from start to finish without errors
- ✅ Permission-based UI elements show/hide correctly
- ✅ Mobile responsive design works on all screen sizes
- ✅ WCAG 2.1 Level AA accessibility compliance
- ✅ Loading states provide clear feedback
- ✅ Error messages are helpful and actionable
- ✅ Keyboard navigation works for all interactions
- ✅ Screen readers can access all functionality

---

**Document Status:** ✅ Complete
**Next Steps:** Review with UX designer, create high-fidelity mockups, implement component library
