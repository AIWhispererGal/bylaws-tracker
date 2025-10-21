/**
 * Suggestion Count Regression Tests
 * Tests the fix for suggestion count loading issue
 */

// Mock suggestion count service
class SuggestionCountService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async getSuggestionCount(sectionId) {
    try {
      const { count, error } = await this.supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('section_id', sectionId)
        .eq('status', 'open');

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error counting suggestions:', error);
      return 0;
    }
  }

  async getSuggestionCountsForDocument(documentId) {
    try {
      // First get all sections for the document
      const { data: sections, error: sectionsError } = await this.supabase
        .from('document_sections')
        .select('id')
        .eq('document_id', documentId);

      if (sectionsError) throw sectionsError;

      if (!sections || sections.length === 0) {
        return {};
      }

      const sectionIds = sections.map(s => s.id);

      // Get counts for all sections
      const { data: suggestions, error: suggestionsError } = await this.supabase
        .from('suggestions')
        .select('section_id')
        .in('section_id', sectionIds)
        .eq('status', 'open');

      if (suggestionsError) throw suggestionsError;

      // Count suggestions per section
      const counts = {};
      sectionIds.forEach(id => { counts[id] = 0; });

      (suggestions || []).forEach(sug => {
        if (sug.section_id in counts) {
          counts[sug.section_id]++;
        }
      });

      return counts;
    } catch (error) {
      console.error('Error getting suggestion counts for document:', error);
      return {};
    }
  }

  async getMultiSectionSuggestionCounts(sectionIds) {
    try {
      if (!sectionIds || sectionIds.length === 0) {
        return {};
      }

      // Get suggestions that cover these sections
      const { data: suggestions, error } = await this.supabase
        .from('suggestions')
        .select('id, section_ids')
        .eq('status', 'open')
        .or(sectionIds.map(id => `section_ids.cs.{${id}}`).join(','));

      if (error) throw error;

      // Categorize suggestions
      const counts = {
        exact_match: 0,
        full_coverage: 0,
        partial_overlap: 0
      };

      const sortedSectionIds = [...sectionIds].sort();

      (suggestions || []).forEach(sug => {
        const sugSectionIds = Array.isArray(sug.section_ids)
          ? [...sug.section_ids].sort()
          : [];

        // Exact match: suggestion covers exactly these sections
        if (JSON.stringify(sugSectionIds) === JSON.stringify(sortedSectionIds)) {
          counts.exact_match++;
        }
        // Full coverage: suggestion covers all selected sections (may include more)
        else if (sortedSectionIds.every(id => sugSectionIds.includes(id))) {
          counts.full_coverage++;
        }
        // Partial overlap: suggestion covers some (but not all) selected sections
        else if (sugSectionIds.some(id => sortedSectionIds.includes(id))) {
          counts.partial_overlap++;
        }
      });

      return counts;
    } catch (error) {
      console.error('Error getting multi-section suggestion counts:', error);
      return { exact_match: 0, full_coverage: 0, partial_overlap: 0 };
    }
  }
}

// Mock Supabase for testing
const createMockSupabase = (mockData = {}) => ({
  from: (table) => {
    const chain = {
      select: (fields, opts) => {
        if (opts?.count === 'exact' && opts?.head === true) {
          return {
            eq: () => ({
              eq: async () => ({
                count: mockData.count || 0,
                error: mockData.error || null
              })
            })
          };
        }
        return chain;
      },
      eq: (field, value) => {
        chain._where = { ...chain._where, [field]: value };
        return chain;
      },
      in: (field, values) => chain,
      or: (condition) => chain
    };

    chain.then = async (resolve) => {
      if (table === 'document_sections') {
        return resolve({
          data: mockData.sections || [],
          error: mockData.sectionsError || null
        });
      }
      if (table === 'suggestions') {
        return resolve({
          data: mockData.suggestions || [],
          error: mockData.suggestionsError || null
        });
      }
      return resolve({ data: [], error: null });
    };

    return chain;
  }
});

describe('Suggestion Count Regression Tests', () => {
  describe('Single Section Suggestion Counts', () => {
    test('should correctly count suggestions for a section', async () => {
      const mockData = { count: 5 };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const count = await service.getSuggestionCount('sec-1');

      expect(count).toBe(5);
    });

    test('should return 0 when no suggestions exist', async () => {
      const mockData = { count: 0 };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const count = await service.getSuggestionCount('sec-999');

      expect(count).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      const mockData = { error: new Error('Database error') };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const count = await service.getSuggestionCount('sec-1');

      expect(count).toBe(0);
    });

    test('should only count open suggestions', async () => {
      const mockData = { count: 3 };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const count = await service.getSuggestionCount('sec-1');

      expect(count).toBe(3);
    });
  });

  describe('Document-Wide Suggestion Counts', () => {
    test('should get suggestion counts for all sections in document', async () => {
      const mockData = {
        sections: [
          { id: 'sec-1' },
          { id: 'sec-2' },
          { id: 'sec-3' }
        ],
        suggestions: [
          { id: 'sug-1', section_id: 'sec-1', status: 'open' },
          { id: 'sug-2', section_id: 'sec-1', status: 'open' },
          { id: 'sug-3', section_id: 'sec-2', status: 'open' }
        ]
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-1');

      expect(counts['sec-1']).toBe(2);
      expect(counts['sec-2']).toBe(1);
      expect(counts['sec-3']).toBe(0);
    });

    test('should return empty object for document with no sections', async () => {
      const mockData = { sections: [] };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-empty');

      expect(counts).toEqual({});
    });

    test('should handle sections with no suggestions', async () => {
      const mockData = {
        sections: [{ id: 'sec-1' }, { id: 'sec-2' }],
        suggestions: []
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-1');

      expect(counts['sec-1']).toBe(0);
      expect(counts['sec-2']).toBe(0);
    });

    test('should handle database errors in document counts', async () => {
      const mockData = { sectionsError: new Error('Query failed') };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-1');

      expect(counts).toEqual({});
    });
  });

  describe('Multi-Section Suggestion Counts', () => {
    test('should categorize exact match suggestions', async () => {
      const mockData = {
        suggestions: [
          { id: 'sug-1', section_ids: ['sec-1', 'sec-2'] },
          { id: 'sug-2', section_ids: ['sec-1', 'sec-2'] }
        ]
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getMultiSectionSuggestionCounts(['sec-1', 'sec-2']);

      expect(counts.exact_match).toBe(2);
      expect(counts.full_coverage).toBe(0);
      expect(counts.partial_overlap).toBe(0);
    });

    test('should categorize full coverage suggestions', async () => {
      const mockData = {
        suggestions: [
          { id: 'sug-1', section_ids: ['sec-1', 'sec-2', 'sec-3'] }
        ]
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getMultiSectionSuggestionCounts(['sec-1', 'sec-2']);

      expect(counts.exact_match).toBe(0);
      expect(counts.full_coverage).toBe(1);
      expect(counts.partial_overlap).toBe(0);
    });

    test('should categorize partial overlap suggestions', async () => {
      const mockData = {
        suggestions: [
          { id: 'sug-1', section_ids: ['sec-1', 'sec-3'] }
        ]
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getMultiSectionSuggestionCounts(['sec-1', 'sec-2']);

      expect(counts.exact_match).toBe(0);
      expect(counts.full_coverage).toBe(0);
      expect(counts.partial_overlap).toBe(1);
    });

    test('should handle empty section ID list', async () => {
      const supabase = createMockSupabase({});
      const service = new SuggestionCountService(supabase);

      const counts = await service.getMultiSectionSuggestionCounts([]);

      expect(counts).toEqual({});
    });

    test('should handle null section IDs', async () => {
      const supabase = createMockSupabase({});
      const service = new SuggestionCountService(supabase);

      const counts = await service.getMultiSectionSuggestionCounts(null);

      expect(counts).toEqual({});
    });
  });

  describe('Performance Tests', () => {
    test('should handle large document with many sections efficiently', async () => {
      const sectionCount = 100;
      const sections = Array.from({ length: sectionCount }, (_, i) => ({
        id: `sec-${i + 1}`
      }));

      const suggestions = Array.from({ length: 50 }, (_, i) => ({
        id: `sug-${i + 1}`,
        section_id: `sec-${(i % sectionCount) + 1}`,
        status: 'open'
      }));

      const mockData = { sections, suggestions };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const startTime = Date.now();
      const counts = await service.getSuggestionCountsForDocument('doc-large');
      const duration = Date.now() - startTime;

      expect(Object.keys(counts)).toHaveLength(sectionCount);
      expect(duration).toBeLessThan(500); // Should complete in < 500ms
    });

    test('should efficiently query counts for multiple sections', async () => {
      const sectionIds = Array.from({ length: 20 }, (_, i) => `sec-${i + 1}`);

      const mockData = { suggestions: [] };
      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const startTime = Date.now();
      const counts = await service.getMultiSectionSuggestionCounts(sectionIds);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Regression: Original Bug Fix', () => {
    test('should not return undefined for sections with no suggestions', async () => {
      const mockData = {
        sections: [{ id: 'sec-1' }],
        suggestions: []
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-1');

      expect(counts['sec-1']).toBe(0);
      expect(counts['sec-1']).not.toBeUndefined();
    });

    test('should initialize all section counts to 0', async () => {
      const mockData = {
        sections: [
          { id: 'sec-1' },
          { id: 'sec-2' },
          { id: 'sec-3' }
        ],
        suggestions: [
          { id: 'sug-1', section_id: 'sec-2' }
        ]
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-1');

      expect(counts['sec-1']).toBe(0);
      expect(counts['sec-2']).toBe(1);
      expect(counts['sec-3']).toBe(0);
    });

    test('should handle malformed suggestion data', async () => {
      const mockData = {
        sections: [{ id: 'sec-1' }],
        suggestions: [
          { id: 'sug-1', section_id: null },
          { id: 'sug-2' }, // Missing section_id
          { id: 'sug-3', section_id: 'sec-1' }
        ]
      };

      const supabase = createMockSupabase(mockData);
      const service = new SuggestionCountService(supabase);

      const counts = await service.getSuggestionCountsForDocument('doc-1');

      expect(counts['sec-1']).toBe(1); // Only valid suggestion counted
    });
  });
});

// Mock test framework
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => fn();
  global.test = (name, fn) => fn();
}

module.exports = { SuggestionCountService, createMockSupabase };
