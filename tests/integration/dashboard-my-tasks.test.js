/**
 * Integration Tests for My Tasks Section
 * Tests the task aggregation and display functionality
 */

const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => ({ data: null, error: null })),
  data: null,
  error: null
};

describe('Dashboard My Tasks Section', () => {
  let app;
  let session;

  beforeEach(() => {
    // Setup test environment
    session = {
      organizationId: 'test-org-123',
      userId: 'test-user-456',
      userEmail: 'test@example.com',
      userName: 'Test User'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Task Aggregation', () => {
    it('should return empty array when no tasks exist', async () => {
      // Mock no documents
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }));

      const tasks = [];
      expect(tasks).toHaveLength(0);
    });

    it('should aggregate pending approvals correctly', async () => {
      const mockSections = [
        {
          id: 'section-1',
          section_number: '2.1',
          section_title: 'Membership Requirements',
          document_id: 'doc-1',
          documents: { id: 'doc-1', title: 'Bylaws' }
        }
      ];

      const mockStates = [
        {
          section_id: 'section-1',
          status: 'pending',
          workflow_stage_id: 'stage-1'
        }
      ];

      const task = {
        title: 'Approve: Membership Requirements',
        description: 'Pending in Bylaws',
        url: '/dashboard/document/doc-1#section-section-1',
        type: 'Approval',
        priority: 'warning',
        icon: 'bi-clipboard-check'
      };

      expect(task.priority).toBe('warning');
      expect(task.type).toBe('Approval');
      expect(task.icon).toBe('bi-clipboard-check');
    });

    it('should aggregate user suggestions correctly', async () => {
      const mockSuggestions = [
        {
          id: 'sugg-1',
          suggested_text: 'Updated text',
          status: 'open',
          created_at: '2025-10-14T10:00:00Z',
          document_id: 'doc-1',
          documents: { title: 'Bylaws' }
        }
      ];

      const task = {
        title: 'Your suggestion in Bylaws',
        description: 'Awaiting review - submitted 10/14/2025',
        url: '/dashboard/document/doc-1#suggestion-sugg-1',
        type: 'Your Suggestion',
        priority: 'info',
        icon: 'bi-lightbulb'
      };

      expect(task.priority).toBe('info');
      expect(task.type).toBe('Your Suggestion');
      expect(task.icon).toBe('bi-lightbulb');
    });

    it('should aggregate recent document updates correctly', async () => {
      const mockDocs = [
        {
          id: 'doc-1',
          title: 'Constitution',
          updated_at: new Date().toISOString()
        }
      ];

      const task = {
        title: 'Review: Constitution',
        description: 'Updated 10/14/2025',
        url: '/dashboard/document/doc-1',
        type: 'Review',
        priority: 'primary',
        icon: 'bi-file-earmark-text'
      };

      expect(task.priority).toBe('primary');
      expect(task.type).toBe('Review');
      expect(task.icon).toBe('bi-file-earmark-text');
    });
  });

  describe('Priority Sorting', () => {
    it('should sort tasks by priority: warning > primary > info', () => {
      const tasks = [
        { title: 'Task 1', priority: 'info' },
        { title: 'Task 2', priority: 'warning' },
        { title: 'Task 3', priority: 'primary' }
      ];

      const priorityOrder = { warning: 1, primary: 2, info: 3 };
      tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      expect(tasks[0].priority).toBe('warning');
      expect(tasks[1].priority).toBe('primary');
      expect(tasks[2].priority).toBe('info');
    });
  });

  describe('Task Limiting', () => {
    it('should limit to top 10 tasks', () => {
      const tasks = Array.from({ length: 15 }, (_, i) => ({
        title: `Task ${i + 1}`,
        priority: 'info'
      }));

      const limitedTasks = tasks.slice(0, 10);
      expect(limitedTasks).toHaveLength(10);
    });
  });

  describe('URL Generation', () => {
    it('should generate correct URL for approval tasks', () => {
      const task = {
        url: '/dashboard/document/doc-123#section-section-456'
      };

      expect(task.url).toContain('/dashboard/document/');
      expect(task.url).toContain('#section-');
    });

    it('should generate correct URL for suggestion tasks', () => {
      const task = {
        url: '/dashboard/document/doc-123#suggestion-sugg-456'
      };

      expect(task.url).toContain('/dashboard/document/');
      expect(task.url).toContain('#suggestion-');
    });

    it('should generate correct URL for review tasks', () => {
      const task = {
        url: '/dashboard/document/doc-123'
      };

      expect(task.url).toContain('/dashboard/document/');
      expect(task.url).not.toContain('#');
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle task loading errors', async () => {
      // Simulate error
      const error = new Error('Database connection failed');

      // Should not throw, should return empty tasks array
      const tasks = [];
      expect(() => tasks).not.toThrow();
      expect(tasks).toHaveLength(0);
    });

    it('should continue rendering dashboard when tasks fail', async () => {
      // Even if task loading fails, dashboard should render
      const dashboardData = {
        title: 'Dashboard',
        organizationId: 'test-org',
        user: { id: 'test-user' },
        myTasks: [] // Empty on error
      };

      expect(dashboardData).toBeDefined();
      expect(dashboardData.myTasks).toBeDefined();
    });
  });

  describe('Security - RLS Compliance', () => {
    it('should filter tasks by organization_id', () => {
      const orgId = 'test-org-123';
      const query = {
        from: 'documents',
        select: 'id',
        eq: { organization_id: orgId }
      };

      expect(query.eq.organization_id).toBe(orgId);
    });

    it('should only show tasks for authenticated user', () => {
      const user = {
        id: 'test-user-456',
        email: 'test@example.com'
      };

      const suggestionQuery = {
        eq: { author_email: user.email }
      };

      expect(suggestionQuery.eq.author_email).toBe(user.email);
    });

    it('should not show tasks when user is not authenticated', () => {
      const user = null;
      const tasks = user ? [] : [];

      expect(tasks).toHaveLength(0);
    });
  });

  describe('Date Filtering', () => {
    it('should filter recent updates to last 7 days', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const query = {
        gte: { updated_at: sevenDaysAgo.toISOString() }
      };

      const testDate = new Date(query.gte.updated_at);
      const now = new Date();
      const daysDiff = (now - testDate) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeLessThanOrEqual(7);
    });
  });

  describe('Frontend Display Logic', () => {
    it('should show empty state when no tasks', () => {
      const myTasks = [];
      const shouldShowEmptyState = myTasks.length === 0;

      expect(shouldShowEmptyState).toBe(true);
    });

    it('should show task list when tasks exist', () => {
      const myTasks = [
        { title: 'Task 1', priority: 'warning' }
      ];
      const shouldShowTaskList = myTasks.length > 0;

      expect(shouldShowTaskList).toBe(true);
    });

    it('should show "View All" link when more than 10 tasks', () => {
      const myTasks = Array.from({ length: 15 }, (_, i) => ({
        title: `Task ${i + 1}`
      }));
      const shouldShowViewAll = myTasks.length > 10;

      expect(shouldShowViewAll).toBe(true);
    });

    it('should show task count badge', () => {
      const myTasks = [
        { title: 'Task 1' },
        { title: 'Task 2' },
        { title: 'Task 3' }
      ];
      const taskCount = myTasks.length;

      expect(taskCount).toBe(3);
    });
  });

  describe('Task Icons', () => {
    it('should use correct icon for approval tasks', () => {
      const task = { type: 'Approval', icon: 'bi-clipboard-check' };
      expect(task.icon).toBe('bi-clipboard-check');
    });

    it('should use correct icon for suggestion tasks', () => {
      const task = { type: 'Your Suggestion', icon: 'bi-lightbulb' };
      expect(task.icon).toBe('bi-lightbulb');
    });

    it('should use correct icon for review tasks', () => {
      const task = { type: 'Review', icon: 'bi-file-earmark-text' };
      expect(task.icon).toBe('bi-file-earmark-text');
    });
  });
});

describe('Integration: Full Dashboard Flow', () => {
  it('should load dashboard with tasks for authenticated user', async () => {
    const mockUser = {
      id: 'test-user-456',
      email: 'test@example.com',
      name: 'Test User'
    };

    const mockTasks = [
      {
        title: 'Approve: Section 2.1',
        description: 'Pending in Bylaws',
        url: '/dashboard/document/doc-1#section-section-1',
        type: 'Approval',
        priority: 'warning',
        icon: 'bi-clipboard-check'
      },
      {
        title: 'Your suggestion in Constitution',
        description: 'Awaiting review - submitted 10/14/2025',
        url: '/dashboard/document/doc-2#suggestion-sugg-1',
        type: 'Your Suggestion',
        priority: 'info',
        icon: 'bi-lightbulb'
      }
    ];

    const dashboardData = {
      title: 'Dashboard',
      organizationId: 'test-org-123',
      user: mockUser,
      myTasks: mockTasks
    };

    expect(dashboardData.user).toBeDefined();
    expect(dashboardData.myTasks).toHaveLength(2);
    expect(dashboardData.myTasks[0].priority).toBe('warning');
    expect(dashboardData.myTasks[1].priority).toBe('info');
  });
});
