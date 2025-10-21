# Dashboard Quick Start Guide

## 🚀 Getting Started

The multi-tenant dashboard is now integrated into the Bylaws Amendment Tracker! Follow these steps to access your new dashboard.

## ✅ Prerequisites

1. ✅ Database migration 002 applied (organizations, documents, document_sections tables)
2. ✅ Setup wizard completed
3. ✅ At least one organization created

## 📋 How to Access

### For New Users

1. **Run Setup Wizard**: Navigate to `/setup`
2. **Complete All Steps**:
   - Organization information
   - Document structure
   - Workflow configuration
   - Document import (optional)
3. **Automatic Redirect**: You'll be redirected to `/dashboard` after completion

### For Existing Users

Simply navigate to: `http://localhost:3000/dashboard`

## 🎯 Dashboard Features

### Overview Statistics (Top Row)

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Total Documents │ Active Sections │ Pending         │ Approval        │
│       5         │       124       │ Suggestions: 12 │ Progress: 67%   │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Recent Documents (Left Panel)

- Document title and description
- Document type badge
- Section counts
- Pending suggestions indicator
- Status badge (draft/active/published)
- Last modified timestamp
- Quick actions (view, export)

### Recent Activity (Right Panel)

- Real-time activity feed
- Suggestion creation notices
- Workflow approvals
- Section reviews
- Time-ago timestamps
- Auto-refreshes every 30 seconds

## 🔐 Security Features

### Multi-Tenant Isolation

✅ **Every query is filtered by organization_id**
- You only see your organization's data
- No cross-tenant data leakage
- Session-based authentication
- RLS (Row Level Security) enabled

### Authentication Flow

```
Setup Wizard → Creates Organization → Stores organization_id in session
              ↓
Dashboard Access → Checks session.organizationId → Filters all queries
```

## 📊 API Endpoints

All endpoints require authentication (valid session with organization_id):

### GET /api/dashboard/overview
Returns statistics:
```json
{
  "success": true,
  "stats": {
    "totalDocuments": 5,
    "activeSections": 124,
    "pendingSuggestions": 12,
    "approvalProgress": 67
  }
}
```

### GET /api/dashboard/documents
Returns document list:
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "title": "Organization Bylaws 2025",
      "document_type": "bylaws",
      "section_count": 45,
      "pending_suggestions": 3,
      "status": "active",
      "updated_at": "2025-10-12T10:30:00Z"
    }
  ]
}
```

### GET /api/dashboard/sections?documentId=uuid
Returns sections with workflow status:
```json
{
  "success": true,
  "sections": [
    {
      "id": "uuid",
      "section_number": "1.1",
      "section_title": "Name",
      "workflow_status": "approved",
      "last_action": "2025-10-12T09:00:00Z"
    }
  ]
}
```

### GET /api/dashboard/suggestions
Returns pending suggestions:
```json
{
  "success": true,
  "suggestions": [
    {
      "id": "uuid",
      "author_name": "John Doe",
      "suggested_text": "...",
      "sections": [
        {
          "section_number": "2.3",
          "section_title": "Membership"
        }
      ],
      "created_at": "2025-10-12T08:00:00Z"
    }
  ]
}
```

### GET /api/dashboard/activity?limit=20
Returns activity feed:
```json
{
  "success": true,
  "activity": [
    {
      "type": "suggestion_created",
      "description": "New suggestion by Jane Smith",
      "timestamp": "2025-10-12T10:00:00Z",
      "icon": "lightbulb",
      "color": "info"
    }
  ]
}
```

## 🎨 UI Components

### Navigation Sidebar

**Main Section:**
- Dashboard (active)
- Documents

**Workflow Section:**
- Suggestions
- Approvals

**Settings Section:**
- Organization
- Users

### Stat Cards

Each card shows:
- Gradient icon
- Large numeric value
- Descriptive label
- Hover animation

### Document Table

Columns:
- Title (with description preview)
- Type badge
- Section count
- Status badge
- Last modified
- Actions (view, export)

### Activity Feed

Each item shows:
- Icon with color coding
- Description text
- Time ago (e.g., "2 hours ago")

## 🔧 Customization

### Changing Refresh Interval

In `/public/js/dashboard.js`:
```javascript
// Change from 30 seconds to 60 seconds
setInterval(() => {
  this.loadOverview();
  this.loadActivity();
}, 60000); // 60 seconds
```

### Adding Custom Statistics

In `/src/routes/dashboard.js`, add to overview endpoint:
```javascript
// Example: Count archived documents
const { count: archivedCount } = await supabase
  .from('documents')
  .select('*', { count: 'exact', head: true })
  .eq('organization_id', orgId)
  .eq('status', 'archived');

res.json({
  success: true,
  stats: {
    // ... existing stats
    archivedDocuments: archivedCount || 0
  }
});
```

Then update frontend in `/public/js/dashboard.js`:
```javascript
document.getElementById('archivedDocuments').textContent =
  result.stats.archivedDocuments;
```

## 🐛 Troubleshooting

### Dashboard Not Loading

**Symptom**: White screen or "Authentication required" error

**Solution**:
1. Check that setup wizard completed successfully
2. Verify `req.session.organizationId` is set
3. Check server logs for errors
4. Clear browser cookies and re-run setup

### Statistics Showing Zero

**Symptom**: All stat cards show "0"

**Solution**:
1. Verify organization has documents in database
2. Check that document.organization_id matches session.organizationId
3. Run this SQL to verify:
   ```sql
   SELECT * FROM documents WHERE organization_id = 'your-org-id';
   ```

### Activity Feed Empty

**Symptom**: "No recent activity" message

**Solution**:
1. Create a suggestion to generate activity
2. Approve a section to generate activity
3. Check that suggestions and section_workflow_states tables have data
4. Verify RLS policies allow SELECT access

### Documents Not Appearing

**Symptom**: "No documents yet" message when documents exist

**Solution**:
1. Check RLS policies on documents table
2. Verify organization_id filtering is correct
3. Test query directly in Supabase:
   ```sql
   SELECT * FROM documents WHERE organization_id = 'your-org-id';
   ```
4. Check user_organizations table has correct mapping

## 📱 Mobile Support

Currently optimized for:
- ✅ Desktop (1920x1080+)
- ✅ Tablet (768x1024)
- ⚠️  Mobile (responsive but sidebar needs work)

**Mobile Enhancement (Coming Soon)**:
- Hamburger menu for sidebar
- Swipe gestures
- Touch-optimized buttons

## 🚀 Performance Tips

### For Large Organizations (1000+ documents)

1. **Enable Pagination**:
   ```javascript
   // In dashboard.js
   const limit = 50;
   const offset = page * limit;
   ```

2. **Add Lazy Loading**:
   ```javascript
   // Load documents on scroll
   window.addEventListener('scroll', () => {
     if (nearBottom()) {
       loadMoreDocuments();
     }
   });
   ```

3. **Cache Statistics**:
   ```javascript
   // Cache stats for 5 minutes
   const cacheKey = `stats:${orgId}`;
   const cached = cache.get(cacheKey);
   if (cached) return cached;
   ```

## 📚 Next Steps

1. **Explore Documents**: Click "Documents" in sidebar
2. **View Details**: Click eye icon on any document
3. **Check Suggestions**: Navigate to Suggestions section
4. **Review Workflow**: Check approval progress
5. **Export Data**: Use export buttons

## 🆘 Need Help?

1. Check server logs: `npm run dev`
2. Check browser console (F12)
3. Review `/docs/DASHBOARD_IMPLEMENTATION.md`
4. Verify database schema with migration 002

## ✨ What's Next?

Planned features:
- [ ] User management interface
- [ ] Advanced filtering and search
- [ ] Bulk operations
- [ ] Real-time WebSocket updates
- [ ] Email notifications
- [ ] Mobile app

---

**Quick Start Updated**: October 12, 2025
**Version**: 1.0.0
**Status**: Ready to Use! 🎉
