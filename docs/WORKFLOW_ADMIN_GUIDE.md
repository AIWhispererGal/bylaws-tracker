# Workflow System Admin Guide

**Version:** 1.0
**Last Updated:** 2025-10-14
**Audience:** Organization Administrators and Owners

---

## Table of Contents

1. [Introduction](#introduction)
2. [Workflow Template Management](#workflow-template-management)
3. [Stage Configuration](#stage-configuration)
4. [Permission Assignment](#permission-assignment)
5. [Default Template Selection](#default-template-selection)
6. [Monitoring Workflow Progress](#monitoring-workflow-progress)
7. [Audit Trail Access](#audit-trail-access)
8. [Performance Tuning](#performance-tuning)
9. [Backup and Recovery](#backup-and-recovery)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

### Purpose of This Guide

This guide helps administrators and owners configure and manage workflow templates for their organizations. Workflows control how document sections progress through approval stages.

### Who Should Read This

- **Organization Owners**: Full workflow configuration access
- **Organization Admins**: Limited configuration and monitoring
- **Global Admins**: Cross-organization oversight

### What You'll Learn

- How to create custom workflow templates
- How to configure approval stages
- How to assign permissions
- How to monitor approval progress
- How to troubleshoot common issues

---

## Workflow Template Management

### What is a Workflow Template?

A **workflow template** defines:

- **Number of stages**: How many approval steps (1-10)
- **Stage names**: What each stage is called
- **Stage order**: The sequence sections must follow
- **Permissions**: Who can approve at each stage
- **Display settings**: Colors, icons for visual indicators

### Default Template

Every organization starts with a **default 2-stage workflow**:

1. **Committee Review** (Admins + Owners)
   - Lock sections with selected suggestions
   - Initial approval
2. **Board Approval** (Owners only)
   - Final approval

### Creating a Custom Workflow Template

#### Step 1: Access Workflow Management

1. Navigate to **Admin Dashboard**
2. Click **"Workflow Settings"**
3. Click **"Create New Template"**

#### Step 2: Configure Template Basics

Fill in template details:

```
Template Name: Executive Review Process
Description: 3-stage approval for policy changes
Is Default: No (keep existing default)
Is Active: Yes
```

#### Step 3: Add Workflow Stages

Click **"Add Stage"** for each stage:

**Stage 1: Department Review**
```
Stage Name: Department Review
Stage Order: 1
Can Lock: Yes
Can Edit: No
Can Approve: Yes
Requires Approval: Yes
Required Roles: [member, admin, owner]
Display Color: #3498db (Blue)
Icon: users
Description: Initial review by department members
```

**Stage 2: Management Approval**
```
Stage Name: Management Approval
Stage Order: 2
Can Lock: Yes
Can Edit: No
Can Approve: Yes
Requires Approval: Yes
Required Roles: [admin, owner]
Display Color: #f39c12 (Orange)
Icon: briefcase
Description: Management team approval
```

**Stage 3: Executive Approval**
```
Stage Name: Executive Approval
Stage Order: 3
Can Lock: Yes
Can Edit: No
Can Approve: Yes
Requires Approval: Yes
Required Roles: [owner]
Display Color: #27ae60 (Green)
Icon: star
Description: Final executive approval
```

#### Step 4: Review and Save

1. Preview the workflow diagram
2. Verify stage order is correct
3. Check permission assignments
4. Click **"Save Template"**

### Editing an Existing Template

⚠️ **Warning**: Editing a template affects all documents using it.

1. Go to **Admin Dashboard → Workflow Settings**
2. Find the template to edit
3. Click **"Edit"** button
4. Make changes to stages
5. Click **"Save Changes"**

**Best Practice**: Create a new template instead of modifying active ones.

### Deleting a Template

⚠️ **Warning**: Cannot delete if documents are using it.

1. Go to **Workflow Settings**
2. Find template to delete
3. Click **"Delete"** button
4. Confirm deletion

**Before Deleting**:
- Move documents to another template
- Or mark template as inactive instead

### Cloning a Template

To create a variation of an existing template:

1. Go to **Workflow Settings**
2. Find template to clone
3. Click **"Clone"** button
4. Modify the cloned version
5. Save with a new name

---

## Stage Configuration

### Stage Properties

Each stage has these configurable properties:

| Property | Description | Values |
|----------|-------------|--------|
| **stage_name** | Display name | Text (e.g., "Committee Review") |
| **stage_order** | Sequence number | Integer (1, 2, 3...) |
| **can_lock** | Can lock sections? | Boolean (true/false) |
| **can_edit** | Can edit text? | Boolean (true/false) |
| **can_approve** | Can approve sections? | Boolean (true/false) |
| **requires_approval** | Must be approved to proceed? | Boolean (true/false) |
| **required_roles** | Which roles can act? | Array ["admin", "owner"] |
| **display_color** | Visual indicator color | Hex code (#FFA500) |
| **icon** | Icon name | String ("users", "check-circle") |
| **description** | Help text | Text |

### Stage Permissions Explained

#### can_lock

**Purpose**: Controls if users can lock sections at this stage

**Use Cases**:
- ✅ **Enable** for stages where suggestions are selected
- ❌ **Disable** for review-only stages

**Example**:
```
Stage 1 (Committee Review): can_lock = true
  → Admins can lock sections with selected suggestions

Stage 2 (Legal Review): can_lock = false
  → Lawyers review only, cannot lock
```

#### can_edit

**Purpose**: Controls if users can edit section text directly

**Use Cases**:
- ✅ **Enable** for stages allowing minor edits
- ❌ **Disable** for strict approval-only stages

⚠️ **Recommendation**: Keep disabled for most workflows to maintain audit trail.

#### can_approve

**Purpose**: Controls if stage requires approval action

**Use Cases**:
- ✅ **Enable** for all approval stages
- ❌ **Disable** for informational/notification stages

#### requires_approval

**Purpose**: Controls if approval is mandatory to proceed

**Use Cases**:
- ✅ **Enable** for required approval stages
- ❌ **Disable** for optional review stages

**Example**:
```
Stage 1 (Peer Review): requires_approval = false
  → Optional, can skip if no concerns

Stage 2 (Board Approval): requires_approval = true
  → Mandatory approval before proceeding
```

### Stage Display Settings

#### display_color

Choose colors that visually distinguish stages:

**Recommended Color Scheme**:
- **Stage 1 (Initial)**: Blue (#3498db) - Review phase
- **Stage 2 (Middle)**: Orange (#f39c12) - Approval phase
- **Stage 3 (Final)**: Green (#27ae60) - Completion

**Avoid**:
- Red (reserved for errors/rejections)
- Gray (reserved for pending/inactive states)

#### icon

Icons help users quickly identify stages:

**Bootstrap Icons** (recommended):
- `users` - Committee/team review
- `briefcase` - Management approval
- `star` - Executive/final approval
- `check-circle` - Completion
- `shield-check` - Compliance review

### Stage Order Best Practices

**Linear Progression**:
```
Stage 1 (Order: 1) → Stage 2 (Order: 2) → Stage 3 (Order: 3)
```

**Avoid Gaps**:
```
❌ WRONG: Stage 1 (Order: 1), Stage 2 (Order: 5)
✅ RIGHT: Stage 1 (Order: 1), Stage 2 (Order: 2)
```

**Reordering Stages**:
1. Edit template
2. Change `stage_order` values
3. Save
4. System automatically sorts by order

---

## Permission Assignment

### Understanding Role Hierarchy

```
Owner (Level 4)
  ↳ Has ALL permissions
  ↳ Can approve at any stage

Admin (Level 3)
  ↳ Has Member + Admin permissions
  ↳ Can approve at stages allowing "admin" role

Member (Level 2)
  ↳ Can create suggestions
  ↳ Cannot approve (unless stage allows "member" role)

Viewer (Level 1)
  ↳ Read-only access
  ↳ Cannot approve or create suggestions
```

### Assigning Roles to Stages

#### Single-Role Stage

**Scenario**: Only owners can approve final stage

```
Stage 3: Final Approval
required_roles: ["owner"]
```

**Result**:
- ✅ Owners can approve
- ❌ Admins **cannot** approve
- ❌ Members **cannot** approve

#### Multi-Role Stage

**Scenario**: Admins OR owners can approve

```
Stage 2: Management Review
required_roles: ["admin", "owner"]
```

**Result**:
- ✅ Owners can approve
- ✅ Admins can approve
- ❌ Members **cannot** approve

#### Member-Inclusive Stage

**Scenario**: Anyone can approve (rare)

```
Stage 1: Peer Review
required_roles: ["member", "admin", "owner"]
```

**Result**:
- ✅ All authenticated users can approve
- ❌ Viewers still **cannot** approve

### Permission Best Practices

#### Principle of Least Privilege

**Give minimum permissions needed**:

```
✅ GOOD:
Stage 1: required_roles = ["admin", "owner"]
Stage 2: required_roles = ["owner"]

❌ BAD:
Stage 1: required_roles = ["member", "admin", "owner"]
Stage 2: required_roles = ["member", "admin", "owner"]
  → Too permissive, no escalation
```

#### Escalating Permissions

**Higher stages should have stricter requirements**:

```
Stage 1 (Committee): ["admin", "owner"]
Stage 2 (Board): ["owner"]
Stage 3 (Executive): ["owner"]
```

#### Separation of Duties

**Don't allow same person to approve all stages**:

```
✅ GOOD:
Stage 1: Department leads (specific admins)
Stage 2: Management (different admins)
Stage 3: Executive (owners)

❌ BAD:
All stages: ["owner"]
  → Owner can approve everything, no checks
```

### Managing User Roles

#### Assigning Roles to Users

1. Go to **Admin Dashboard → Users**
2. Find user to modify
3. Click **"Change Role"**
4. Select new role:
   - Viewer
   - Member
   - Admin
   - Owner
5. Click **"Save"**

**Important**: Role changes take effect immediately.

#### Inviting New Users

1. Go to **Admin Dashboard → Users**
2. Click **"Invite User"**
3. Fill in details:
   ```
   Email: newuser@example.com
   Name: John Doe
   Role: Member
   ```
4. Click **"Send Invitation"**
5. User receives email with registration link

#### Best Practices for Role Assignment

**Start Conservative**:
- New users: **Member** role
- Proven contributors: **Admin** role (after 30+ days)
- Leadership: **Owner** role (very limited)

**Regular Review**:
- Audit user roles quarterly
- Remove inactive users
- Downgrade users who change positions

**Document Decisions**:
- Keep log of role changes
- Note rationale for admin/owner grants
- Review during security audits

---

## Default Template Selection

### What is a Default Template?

The **default template** is automatically assigned to:
- New documents uploaded to the organization
- Documents without an explicitly set workflow

### Setting a Default Template

1. Go to **Admin Dashboard → Workflow Settings**
2. Find template to make default
3. Click **"Set as Default"** button
4. Confirm change

**Result**:
- Previous default is unmarked
- New default is marked with ⭐ icon
- Future documents use this template

### When to Change Default Template

**Change default template when**:
- ✅ Organization restructures approval process
- ✅ New regulations require additional approval
- ✅ Feedback shows current process is too complex

**Don't change default template for**:
- ❌ One-off special documents (assign custom template instead)
- ❌ Temporary experiments (create test template)

### Template Assignment Priority

**Priority order** (highest to lowest):

1. **Document-specific template**: Manually assigned to document
2. **Default template**: Organization default
3. **Fallback**: System-wide default (2-stage workflow)

**Example**:
```
Document A: No assignment → Uses org default template
Document B: Assigned to "Special Review" → Uses Special Review template
Document C: Org has no default → Uses system fallback
```

---

## Monitoring Workflow Progress

### Workflow Progress Dashboard

**Access**: Admin Dashboard → Workflow Analytics

**Metrics Shown**:
- **Overall Progress**: % of sections approved across all documents
- **Sections by Stage**: Count of sections at each workflow stage
- **Approval Rate**: Sections approved per day/week
- **Bottlenecks**: Stages with longest delays

### Viewing Document-Level Progress

1. Go to **Documents** page
2. Click on a document
3. View **Workflow Progress Bar** at top:
   ```
   Committee Review: ▓▓▓▓▓▓▓░░░ 70% (14/20 sections)
   Board Approval:   ▓▓░░░░░░░░ 20% (4/20 sections)
   Overall Progress: 47%
   ```

### Section-Level Status

Each section shows:
- **Current Stage**: Which workflow stage it's in
- **Status**: Pending, In Progress, Approved, Rejected, Locked
- **Last Action**: Who approved and when
- **Time in Stage**: How long at current stage

**Visual Indicators**:
```
○ Pending       - Not started
⏳ In Progress  - Being reviewed
✓ Approved      - Approved at this stage
✗ Rejected      - Rejected, needs rework
🔒 Locked       - Locked with selected suggestion
```

### Identifying Bottlenecks

**Red Flags**:
- Sections stuck at one stage for >7 days
- Many rejections at a specific stage
- Low approval rate compared to submission rate

**Bottleneck Analysis**:

1. Go to **Workflow Analytics**
2. Click **"Bottleneck Report"**
3. Review:
   - Stages with longest average time
   - Sections with most rejections
   - Approvers with pending actions

**Action Steps**:
- Reassign sections if approver is unavailable
- Simplify stage requirements if too complex
- Add more approvers if workload is high

### Pending Approvals Report

**Daily/Weekly Report** sent to approvers:

```
Subject: [Action Required] 5 Sections Awaiting Your Approval

Dear Admin,

You have 5 sections pending your approval:

Document: Bylaws 2025
  - Section 3.1: Financial Procedures (Stage 2) - 3 days pending
  - Section 4.2: Membership Rules (Stage 2) - 5 days pending

Document: Policy Manual
  - Section 1.1: Code of Conduct (Stage 1) - 1 day pending
  ...

Click here to review: [Link to Dashboard]
```

**Configuring Reports**:

1. Go to **Admin Settings → Notifications**
2. Enable **"Daily Pending Approval Report"**
3. Set delivery time (e.g., 9:00 AM)
4. Choose recipients (e.g., all admins)

---

## Audit Trail Access

### What is the Audit Trail?

The **audit trail** is a complete log of all workflow actions:
- Who approved/rejected sections
- When actions occurred
- What notes were added
- Who locked sections and with which suggestions

### Accessing the Audit Trail

#### Organization-Wide Audit Log

1. Go to **Admin Dashboard → Audit Log**
2. Filter by:
   - Date range
   - Action type (approved, rejected, locked)
   - User
   - Document
3. Export as CSV/PDF for compliance

#### Document-Specific Audit Trail

1. Open a document
2. Click **"View Audit Trail"** button
3. See chronological log of all actions on this document

#### Section-Specific History

1. Open a document
2. Click on a section
3. View **Approval History** panel on right side
4. See all actions on this specific section

### Audit Log Fields

Each audit log entry contains:

```json
{
  "id": "log-entry-uuid",
  "timestamp": "2025-10-14T10:30:00Z",
  "user_id": "user-uuid",
  "user_email": "admin@org.com",
  "action_type": "section.approved",
  "entity_type": "section",
  "entity_id": "section-uuid",
  "organization_id": "org-uuid",
  "action_data": {
    "workflow_stage_id": "stage-uuid",
    "stage_name": "Board Approval",
    "notes": "Approved after legal review"
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

### Common Audit Queries

#### Find All Actions by User

```sql
-- Admin interface provides this query
Filter: user_email = "specific-user@org.com"
Date Range: Last 30 days
```

**Use Case**: Investigate suspicious activity

#### Find All Rejections

```sql
Filter: action_type = "section.rejected"
Sort By: timestamp DESC
```

**Use Case**: Identify quality issues

#### Find Sections Locked Today

```sql
Filter: action_type = "section.locked"
Date Range: Today
```

**Use Case**: Daily progress report

### Compliance and Retention

**Retention Policy**:
- Audit logs retained for **7 years** (configurable)
- Deleted logs are archived, not destroyed
- Export logs monthly for long-term storage

**Compliance Requirements**:
- SOC 2: Audit trail must be tamper-proof
- GDPR: User actions must be logged for accountability
- Industry Standards: 90-day minimum retention

**Best Practices**:
- Export audit logs quarterly
- Store in secure, immutable storage
- Review logs during security audits
- Notify users their actions are logged

---

## Performance Tuning

### Database Optimization

#### Index Maintenance

**Critical indexes** for workflow performance:

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelname LIKE '%workflow%';

-- Rebuild indexes if fragmented
REINDEX TABLE section_workflow_states;
```

**Recommended Schedule**: Monthly reindex during maintenance window

#### Materialized View Refresh

**Workflow progress summary** view should be refreshed regularly:

```sql
-- Manual refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_progress_summary;

-- Scheduled refresh (via cron or pg_cron)
-- Every 5 minutes during business hours
SELECT cron.schedule('refresh-workflow-progress',
  '*/5 8-18 * * 1-5',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_progress_summary'
);
```

#### Query Performance

**Monitor slow queries**:

1. Go to **Admin Dashboard → Performance**
2. View **Slow Query Log**
3. Identify queries taking >1 second
4. Optimize or add indexes

**Common Slow Queries**:

```sql
-- Before optimization (slow)
SELECT * FROM section_workflow_states
WHERE section_id IN (SELECT id FROM document_sections WHERE document_id = ?)

-- After optimization (fast with index)
SELECT sws.* FROM section_workflow_states sws
JOIN document_sections ds ON sws.section_id = ds.id
WHERE ds.document_id = ?
```

### Caching Strategy

#### Application-Level Caching

**Workflow templates** (rarely change):

```javascript
// Cache for 1 hour
const cache = new Map();
function getWorkflowTemplate(orgId) {
  const cached = cache.get(orgId);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.data;
  }

  const data = fetchFromDatabase(orgId);
  cache.set(orgId, { data, timestamp: Date.now() });
  return data;
}
```

**Clear cache** when templates are updated:
- Template edited
- Stage added/removed
- Permissions changed

#### Database-Level Caching

**PostgreSQL configuration** (if self-hosted):

```
shared_buffers = 2GB        # Increase for better caching
effective_cache_size = 6GB  # Expected cache size
work_mem = 64MB             # Memory per query
```

**Supabase (cloud)**: Caching handled automatically

### Pagination and Lazy Loading

**Large result sets** should be paginated:

```javascript
// GET /api/approval/versions?limit=20&offset=0
// Returns 20 versions at a time instead of all
```

**Benefits**:
- Faster page loads
- Reduced memory usage
- Better user experience

### Performance Targets

| Operation | Target Time | Notes |
|-----------|-------------|--------|
| Load workflow config | <200ms | Cached after first load |
| Approve section | <500ms | Includes DB write + audit log |
| Create version snapshot | <1000ms | Large JSON payload |
| Load document viewer | <1500ms | Initial load with all sections |
| Refresh approval history | <300ms | Frequent operation |

**Monitor performance**:
- Use **Admin Dashboard → Performance** to track
- Set up alerts for slow operations (>2x target)
- Review performance monthly

---

## Backup and Recovery

### Backup Strategy

#### What to Backup

**Critical Data**:
- Workflow templates
- Workflow stages
- Section workflow states
- Document versions
- Audit logs

**Backup Frequency**:
- **Daily**: Incremental backups of all workflow data
- **Weekly**: Full database backup
- **Monthly**: Archive backup for long-term retention

#### Automated Backups

**Supabase (cloud)**:
- Automatic daily backups
- Point-in-time recovery (PITR) available
- Backup retention: 30 days

**Self-Hosted**:
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -h localhost -U postgres -d bylaws_db \
  --table=workflow_templates \
  --table=workflow_stages \
  --table=section_workflow_states \
  --table=document_versions \
  > /backups/workflow_$DATE.sql
```

### Disaster Recovery

#### Recovery Point Objective (RPO)

**Target**: 24 hours
- **Meaning**: Can lose up to 24 hours of data
- **Mitigation**: Daily backups ensure max 24hr data loss

#### Recovery Time Objective (RTO)

**Target**: 4 hours
- **Meaning**: System restored within 4 hours
- **Steps**:
  1. Identify issue (0-30 min)
  2. Restore from backup (30-120 min)
  3. Verify data integrity (60 min)
  4. Resume operations (30 min)

#### Recovery Procedures

**Scenario 1: Accidental Template Deletion**

1. Identify deleted template ID from audit log
2. Restore from most recent backup:
   ```sql
   -- Restore specific template
   INSERT INTO workflow_templates
   SELECT * FROM backup.workflow_templates
   WHERE id = 'deleted-template-uuid';
   ```
3. Verify template appears in admin dashboard
4. Notify users of restoration

**Scenario 2: Corrupted Workflow Data**

1. Stop all write operations
2. Restore entire workflow schema from backup:
   ```bash
   psql -h localhost -U postgres -d bylaws_db < /backups/workflow_20251014.sql
   ```
3. Verify data integrity
4. Resume operations

**Scenario 3: Complete Database Failure**

1. Provision new database instance
2. Restore latest full backup
3. Apply incremental backups
4. Verify all workflow data
5. Update application connection strings
6. Resume operations

### Testing Recovery

**Quarterly Recovery Drills**:

1. Schedule maintenance window
2. Restore backup to staging environment
3. Verify all workflow functionality
4. Document any issues found
5. Update recovery procedures

---

## Best Practices

### Workflow Design

#### Keep It Simple

**Recommended**:
- 2-3 stages for most organizations
- Clear stage names ("Committee Review" not "Stage 1")
- Linear progression (no branches)

**Avoid**:
- Complex multi-branch workflows
- More than 5 stages (becomes unwieldy)
- Ambiguous stage names

#### Match Organizational Structure

**Align workflow with decision-making**:

```
Small Org (10-50 members):
  Stage 1: Committee Review (Admins)
  Stage 2: Board Approval (Owners)

Large Org (100+ members):
  Stage 1: Department Review (Members)
  Stage 2: Management Approval (Admins)
  Stage 3: Board Approval (Owners)
  Stage 4: Legal Review (Specific Admins)
```

#### Document Your Workflow

**Create a workflow guide**:

```markdown
# Our Approval Process

## Stage 1: Committee Review
- **Who**: Committee chairs (Admins)
- **What**: Review all suggestions, select best option
- **Action**: Lock section with selected suggestion
- **Timeline**: 7 days

## Stage 2: Board Approval
- **Who**: Board members (Owners)
- **What**: Final approval of locked sections
- **Action**: Approve or reject
- **Timeline**: 14 days
```

**Share with**:
- All organization members
- New users during onboarding
- External auditors

### User Management

#### Regular Role Reviews

**Monthly**:
- Review active users
- Check for dormant accounts
- Verify admin assignments

**Quarterly**:
- Full role audit
- Remove unnecessary permissions
- Update role assignments based on organizational changes

#### Communication

**Notify users of workflow changes**:

```
Subject: [Update] Workflow Process Changes

Dear Members,

Effective Oct 15, 2025, we're updating our approval workflow:

CHANGES:
- Added "Legal Review" stage before final approval
- Extended approval timeline from 14 to 21 days
- Legal team members can now approve Stage 3

WHAT THIS MEANS FOR YOU:
- Members: No change (continue creating suggestions)
- Admins: No change (continue Stage 1 approvals)
- Owners: New Stage 3 review required after legal approval

Questions? Contact admin@org.com
```

### Monitoring and Maintenance

#### Weekly Tasks

- [ ] Review pending approvals
- [ ] Check for bottlenecks
- [ ] Respond to user questions
- [ ] Clear completed notifications

#### Monthly Tasks

- [ ] Review audit logs
- [ ] Check database performance
- [ ] Update workflow documentation
- [ ] Train new admins if needed

#### Quarterly Tasks

- [ ] Full role audit
- [ ] Workflow effectiveness review
- [ ] Backup restoration test
- [ ] Security assessment

---

## Troubleshooting

### Common Issues

#### Issue: Sections Stuck at One Stage

**Symptoms**:
- Multiple sections show "Pending" at Stage 2
- Approval progress stalled

**Causes**:
- Approver is unavailable
- Approver doesn't have permission
- Email notifications not delivered

**Solutions**:

1. **Check approver availability**:
   ```
   Contact the assigned approver
   Ask if they received notification
   Offer to reassign if needed
   ```

2. **Verify permissions**:
   ```
   Admin Dashboard → Users
   Check approver's role
   Verify stage's required_roles includes their role
   ```

3. **Reassign sections** (if approver unavailable):
   ```
   Option 1: Promote another user to required role
   Option 2: Owner manually approves to unblock
   Option 3: Reject and restart workflow
   ```

#### Issue: High Rejection Rate

**Symptoms**:
- Many sections rejected at specific stage
- Workflow progress slowing down

**Causes**:
- Unclear requirements
- Poor quality suggestions
- Misaligned expectations

**Solutions**:

1. **Analyze rejection reasons**:
   ```
   Admin Dashboard → Audit Log
   Filter: action_type = "section.rejected"
   Review notes field for patterns
   ```

2. **Improve guidance**:
   ```
   Update workflow description
   Provide examples of good suggestions
   Hold training session for members
   ```

3. **Adjust workflow**:
   ```
   Add preliminary review stage
   Clarify stage requirements
   Provide templates for suggestions
   ```

#### Issue: Workflow Template Not Appearing

**Symptoms**:
- Created template doesn't show in dropdown
- Documents can't be assigned to new template

**Causes**:
- Template marked as inactive
- Permissions issue
- Caching delay

**Solutions**:

1. **Check template status**:
   ```
   Admin Dashboard → Workflow Settings
   Find template
   Verify "Is Active" = Yes
   ```

2. **Clear cache**:
   ```
   Refresh browser (Ctrl+F5)
   Or wait 5 minutes for cache to expire
   ```

3. **Verify permissions**:
   ```
   Check user is Owner (only Owners can create templates)
   Verify organization_id matches
   ```

### Getting Help

#### Support Channels

**Email Support**: support@your-org.com
- Response time: 24 hours
- Escalation for critical issues: 4 hours

**Documentation**: docs.your-org.com
- User guides
- API reference
- Video tutorials

**Community Forum**: community.your-org.com
- Ask questions
- Share best practices
- Connect with other admins

#### When to Escalate

**Escalate to technical support if**:
- Database performance degraded
- RLS policies not working correctly
- Data corruption suspected
- Security incident

**Provide**:
- Organization ID
- Affected template/document IDs
- Steps to reproduce
- Screenshots
- Relevant audit log entries

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: Admin Team
**Feedback**: admin-docs@your-org.com
