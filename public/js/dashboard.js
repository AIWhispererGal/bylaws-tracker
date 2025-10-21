/**
 * Dashboard JavaScript
 * Handles data fetching and UI updates for the dashboard
 */

const Dashboard = {
  currentSuggestionFilter: 'all',

  /**
   * Initialize dashboard
   */
  async init() {
    await this.loadOverview();
    await this.loadDocuments();
    // Activity feed removed from dashboard

    // Refresh every 30 seconds
    setInterval(() => {
      this.loadOverview();
    }, 30000);
  },

  /**
   * Filter suggestions by status
   */
  filterSuggestions(status) {
    this.currentSuggestionFilter = status;
    const suggestionsList = document.getElementById('suggestionsList');
    if (!suggestionsList) return;

    const suggestionItems = suggestionsList.querySelectorAll('.suggestion-item');
    const filterButtons = document.querySelectorAll('.btn-group button');

    // Update active button
    filterButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.toLowerCase() === status) {
        btn.classList.add('active');
      }
    });

    // Filter items
    suggestionItems.forEach(item => {
      const itemStatus = item.dataset.status;
      if (status === 'all' || itemStatus === status) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  },

  /**
   * Load overview statistics
   */
  async loadOverview() {
    try {
      const response = await fetch('/api/dashboard/overview');
      const result = await response.json();

      if (result.success && result.stats) {
        document.getElementById('totalDocuments').textContent = result.stats.totalDocuments;
        document.getElementById('activeSections').textContent = result.stats.activeSections;
        document.getElementById('pendingSuggestions').textContent = result.stats.pendingSuggestions;
        document.getElementById('approvalProgress').textContent = result.stats.approvalProgress + '%';
      }
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  },

  /**
   * Load recent documents
   */
  async loadDocuments() {
    try {
      const response = await fetch('/api/dashboard/documents');
      const result = await response.json();

      const tbody = document.getElementById('documentsBody');

      if (!result.success || !result.documents || result.documents.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6">
              <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <p class="mb-0">No documents yet. Create your first document to get started.</p>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = result.documents.map(doc => {
        const statusBadge = this.getStatusBadge(doc.status);
        const modifiedDate = this.formatDate(doc.updated_at);

        return `
          <tr>
            <td>
              <strong>${this.escapeHtml(doc.title)}</strong>
              ${doc.description ? `<br><small class="text-muted">${this.escapeHtml(doc.description).substring(0, 60)}...</small>` : ''}
            </td>
            <td>
              <span class="badge bg-light text-dark">${this.escapeHtml(doc.document_type || 'bylaws')}</span>
            </td>
            <td>
              ${doc.section_count || 0} sections
              ${doc.pending_suggestions > 0 ? `<br><small class="text-warning">${doc.pending_suggestions} suggestions</small>` : ''}
            </td>
            <td>${statusBadge}</td>
            <td>
              <small class="text-muted">${modifiedDate}</small>
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <a href="/dashboard/document/${doc.id}" class="btn btn-outline-primary btn-sm" data-bs-toggle="tooltip" title="View document">
                  <i class="bi bi-eye"></i>
                </a>
                <a href="/admin/documents/${doc.id}/assign-workflow" class="btn btn-outline-success btn-sm" data-bs-toggle="tooltip" title="Manage workflow">
                  <i class="bi bi-diagram-3"></i>
                </a>
                <button class="btn btn-outline-secondary btn-sm" onclick="Dashboard.exportDocument('${doc.id}')" data-bs-toggle="tooltip" title="Export document">
                  <i class="bi bi-download"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading documents:', error);
      document.getElementById('documentsBody').innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            Error loading documents. Please refresh the page.
          </td>
        </tr>
      `;
    }
  },

  /**
   * Load activity feed
   */
  async loadActivity() {
    try {
      const response = await fetch('/api/dashboard/activity?limit=10');
      const result = await response.json();

      const feedContainer = document.getElementById('activityFeed');

      if (!result.success || !result.activity || result.activity.length === 0) {
        feedContainer.innerHTML = `
          <div class="empty-state">
            <i class="bi bi-activity"></i>
            <p class="mb-0">No recent activity</p>
          </div>
        `;
        return;
      }

      feedContainer.innerHTML = result.activity.map(item => {
        const timeAgo = this.timeAgo(item.timestamp);
        const iconClass = this.getActivityIcon(item.icon);
        const colorClass = item.color || 'primary';

        return `
          <div class="activity-item">
            <div class="activity-icon ${colorClass}">
              <i class="bi bi-${iconClass}"></i>
            </div>
            <div class="activity-content">
              <div class="activity-description">${this.escapeHtml(item.description)}</div>
              <div class="activity-time">${timeAgo}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading activity:', error);
      document.getElementById('activityFeed').innerHTML = `
        <div class="text-center text-danger p-3">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error loading activity
        </div>
      `;
    }
  },

  /**
   * Export document
   */
  async exportDocument(documentId) {
    try {
      // Show placeholder message for now
      alert('Export functionality coming soon!\n\nThis feature is currently being implemented and will allow you to export documents in multiple formats (PDF, Word, etc.).');
    } catch (error) {
      console.error('Error exporting document:', error);
      alert('Failed to export document');
    }
  },

  /**
   * Get status badge HTML
   */
  getStatusBadge(status) {
    const badges = {
      'draft': '<span class="status-badge bg-secondary">Draft</span>',
      'active': '<span class="status-badge bg-success">Active</span>',
      'published': '<span class="status-badge bg-primary">Published</span>',
      'archived': '<span class="status-badge bg-dark">Archived</span>'
    };
    return badges[status] || badges['draft'];
  },

  /**
   * Get activity icon
   */
  getActivityIcon(icon) {
    const icons = {
      'lightbulb': 'lightbulb',
      'check-circle': 'check-circle-fill',
      'activity': 'activity',
      'file': 'file-earmark-text'
    };
    return icons[icon] || 'circle-fill';
  },

  /**
   * Format date
   */
  formatDate(dateString) {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  },

  /**
   * Time ago formatter
   */
  timeAgo(dateString) {
    if (!dateString) return 'Just now';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.init();
});
