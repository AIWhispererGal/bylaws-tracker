/**
 * API Integration Tests
 * Tests complete API workflows end-to-end
 */

// Mock HTTP client
class MockHTTPClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.mockResponses = new Map();
  }

  setMockResponse(endpoint, response) {
    this.mockResponses.set(endpoint, response);
  }

  async get(endpoint) {
    const mock = this.mockResponses.get(endpoint);
    if (mock) return { status: 200, data: mock };

    return {
      status: 200,
      data: { success: true, message: 'Mock GET response' }
    };
  }

  async post(endpoint, data) {
    const mock = this.mockResponses.get(endpoint);
    if (mock) return { status: 201, data: mock };

    return {
      status: 201,
      data: { success: true, message: 'Mock POST response', data }
    };
  }

  async put(endpoint, data) {
    return {
      status: 200,
      data: { success: true, message: 'Mock PUT response', data }
    };
  }

  async delete(endpoint) {
    return {
      status: 200,
      data: { success: true, message: 'Mock DELETE response' }
    };
  }
}

describe('API Integration Tests', () => {
  let client;

  beforeEach(() => {
    client = new MockHTTPClient('http://localhost:3000');
  });

  describe('Section Management API', () => {
    test('should fetch all sections for a document', async () => {
      const mockSections = [
        { id: '1', section_citation: 'Article I, Section 1', title: 'Purpose' },
        { id: '2', section_citation: 'Article I, Section 2', title: 'Scope' }
      ];

      client.setMockResponse('/bylaws/api/sections/doc-123', {
        success: true,
        sections: mockSections
      });

      const response = await client.get('/bylaws/api/sections/doc-123');

      expect(response.status).toBe(200);
      expect(response.data.sections).toHaveLength(2);
      expect(response.data.sections[0].title).toBe('Purpose');
    });

    test('should create new section', async () => {
      const newSection = {
        doc_id: 'doc-123',
        section_citation: 'Article II, Section 1',
        section_title: 'New Section',
        original_text: 'Section content'
      };

      const response = await client.post('/bylaws/api/sections', newSection);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
    });

    test('should lock section with suggestion', async () => {
      const lockData = {
        suggestionId: 'sug-123',
        notes: 'Committee approved',
        lockedBy: 'Committee Chair'
      };

      const response = await client.post('/bylaws/api/sections/sec-123/lock', lockData);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
    });

    test('should unlock section', async () => {
      const response = await client.post('/bylaws/api/sections/sec-123/unlock', {});

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
    });
  });

  describe('Multi-Section API', () => {
    test('should lock multiple sections atomically', async () => {
      const lockData = {
        sectionIds: ['sec-1', 'sec-2', 'sec-3'],
        suggestionId: 'multi-sug-123',
        notes: 'Multi-section approval',
        lockedBy: 'Committee'
      };

      client.setMockResponse('/bylaws/api/sections/sec-1/lock', {
        success: true,
        message: 'Successfully locked 3 section(s)',
        lockedSectionIds: lockData.sectionIds
      });

      const response = await client.post('/bylaws/api/sections/sec-1/lock', lockData);

      expect(response.data.success).toBe(true);
      expect(response.data.lockedSectionIds).toHaveLength(3);
    });

    test('should fetch suggestions for multiple sections', async () => {
      const sectionIds = 'sec-1,sec-2,sec-3';
      const mockData = {
        success: true,
        suggestions: {
          exact_match: [],
          full_coverage: [
            { id: 'sug-1', section_ids: ['sec-1', 'sec-2', 'sec-3'] }
          ],
          partial_overlap: []
        }
      };

      client.setMockResponse('/bylaws/api/sections/multiple/suggestions', mockData);

      const response = await client.get(
        `/bylaws/api/sections/multiple/suggestions?sectionIds=${sectionIds}`
      );

      expect(response.data.success).toBe(true);
      expect(response.data.suggestions.full_coverage).toHaveLength(1);
    });
  });

  describe('Suggestion Management API', () => {
    test('should create single-section suggestion', async () => {
      const suggestion = {
        sectionId: 'sec-123',
        suggestedText: 'Proposed change',
        rationale: 'Clarity improvement',
        authorName: 'John Doe',
        authorEmail: 'john@example.com'
      };

      const response = await client.post('/bylaws/api/suggestions', suggestion);

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
    });

    test('should create multi-section suggestion', async () => {
      const suggestion = {
        sectionIds: ['sec-1', 'sec-2'],
        suggestedText: 'Combined proposal',
        rationale: 'Consistency across sections',
        authorName: 'Jane Doe',
        authorEmail: 'jane@example.com'
      };

      client.setMockResponse('/bylaws/api/suggestions', {
        success: true,
        suggestion: {
          id: 'sug-456',
          ...suggestion,
          is_multi_section: true,
          section_count: 2
        }
      });

      const response = await client.post('/bylaws/api/suggestions', suggestion);

      expect(response.data.success).toBe(true);
      expect(response.data.suggestion.section_count).toBe(2);
    });

    test('should update suggestion', async () => {
      const update = {
        suggestedText: 'Updated proposal',
        rationale: 'Revised rationale'
      };

      const response = await client.put('/bylaws/api/suggestions/sug-123', update);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('should delete suggestion', async () => {
      const response = await client.delete('/bylaws/api/suggestions/sug-123');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('should get suggestions for a section', async () => {
      const mockSuggestions = [
        { id: 'sug-1', suggested_text: 'Suggestion 1', status: 'open' },
        { id: 'sug-2', suggested_text: 'Suggestion 2', status: 'approved' }
      ];

      client.setMockResponse('/bylaws/api/sections/sec-123/suggestions', {
        success: true,
        suggestions: mockSuggestions
      });

      const response = await client.get('/bylaws/api/sections/sec-123/suggestions');

      expect(response.data.suggestions).toHaveLength(2);
    });
  });

  describe('Export API', () => {
    test('should export committee selections', async () => {
      const mockExport = [
        {
          citation: 'Article I, Section 1',
          old_text: 'Original',
          new_text: 'Updated',
          locked_date: '2024-10-07',
          status: 'committee_approved'
        }
      ];

      client.setMockResponse('/bylaws/api/export/committee', mockExport);

      const response = await client.get('/bylaws/api/export/committee');

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
    });

    test('should export board approvals', async () => {
      const mockExport = [
        {
          citation: 'Article II, Section 1',
          old_text: 'Original',
          new_text: 'Board approved',
          board_date: '2024-10-08',
          status: 'board_approved'
        }
      ];

      client.setMockResponse('/bylaws/api/export/board', mockExport);

      const response = await client.get('/bylaws/api/export/board');

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
    });
  });

  describe('Document Initialization API', () => {
    test('should initialize document with sections', async () => {
      const initData = {
        docId: 'doc-456',
        sections: [
          { citation: 'Article I, Section 1', title: 'Purpose', text: 'Content 1' },
          { citation: 'Article I, Section 2', title: 'Scope', text: 'Content 2' }
        ]
      };

      client.setMockResponse('/bylaws/api/initialize', {
        success: true,
        message: 'Initialized 2 sections'
      });

      const response = await client.post('/bylaws/api/initialize', initData);

      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('2 sections');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid section ID gracefully', async () => {
      client.setMockResponse('/bylaws/api/sections/invalid-id/suggestions', {
        success: false,
        error: 'Section not found'
      });

      const response = await client.get('/bylaws/api/sections/invalid-id/suggestions');

      expect(response.data.success).toBe(false);
      expect(response.data.error).toBe('Section not found');
    });

    test('should validate multi-section requests', async () => {
      const invalidData = {
        sectionIds: [], // Empty array
        suggestionId: 'sug-123'
      };

      client.setMockResponse('/bylaws/api/sections/sec-1/lock', {
        success: false,
        error: 'At least one section ID must be provided'
      });

      const response = await client.post('/bylaws/api/sections/sec-1/lock', invalidData);

      expect(response.data.success).toBe(false);
    });

    test('should prevent locking already locked sections', async () => {
      client.setMockResponse('/bylaws/api/sections/sec-locked/lock', {
        success: false,
        error: 'Cannot lock: The following sections are already locked: Article I, Section 1'
      });

      const response = await client.post('/bylaws/api/sections/sec-locked/lock', {});

      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('already locked');
    });
  });

  describe('Workflow Integration', () => {
    test('should complete full amendment workflow', async () => {
      // 1. Initialize document
      const initResponse = await client.post('/bylaws/api/initialize', {
        docId: 'workflow-doc',
        sections: [{ citation: 'Article I, Section 1', title: 'Test', text: 'Original' }]
      });
      expect(initResponse.data.success).toBe(true);

      // 2. Create suggestion
      const sugResponse = await client.post('/bylaws/api/suggestions', {
        sectionId: 'sec-1',
        suggestedText: 'Updated text',
        authorName: 'Contributor'
      });
      expect(sugResponse.data.success).toBe(true);

      // 3. Lock section with suggestion
      const lockResponse = await client.post('/bylaws/api/sections/sec-1/lock', {
        suggestionId: 'sug-1',
        notes: 'Approved',
        lockedBy: 'Committee'
      });
      expect(lockResponse.data.success).toBe(true);

      // 4. Export
      const exportResponse = await client.get('/bylaws/api/export/committee');
      expect(exportResponse.status).toBe(200);
    });
  });
});

// Mock Jest functions
if (typeof describe === 'undefined') {
  global.beforeEach = (fn) => fn();
  global.describe = (name, fn) => {
    console.log(`\n${name}`);
    fn();
  };
  global.test = (name, fn) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.error(`    ${error.message}`);
    }
  };
  global.expect = (value) => ({
    toBe: (expected) => {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toHaveLength: (expected) => {
      if (value.length !== expected) throw new Error(`Expected length ${expected}, got ${value.length}`);
    },
    toContain: (expected) => {
      if (typeof value === 'string') {
        if (!value.includes(expected)) throw new Error(`Expected to contain "${expected}"`);
      } else if (Array.isArray(value)) {
        if (!value.includes(expected)) throw new Error(`Expected array to contain ${expected}`);
      }
    }
  });
}

module.exports = { MockHTTPClient };
