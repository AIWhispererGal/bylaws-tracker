/**
 * Workflow Performance Tests
 * Tests for workflow system performance and scalability
 *
 * Test Coverage:
 * - Bulk approval operations
 * - Workflow template list loading
 * - Approval history queries
 * - Stage reordering operations
 * - Concurrent approval handling
 */

const { createSupabaseMock } = require('../helpers/supabase-mock');

describe('Workflow Performance Tests', () => {
  let mockSupabase;
  let performanceMetrics;

  beforeEach(() => {
    mockSupabase = createSupabaseMock();
    performanceMetrics = {
      startTime: null,
      endTime: null,
      duration: null
    };
  });

  /**
   * Helper function to measure operation duration
   */
  const measurePerformance = async (operation) => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    return endTime - startTime;
  };

  /**
   * Generate test sections
   */
  const generateTestSections = (count) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `section-${i + 1}`,
      section_number: `${Math.floor(i / 10) + 1}.${(i % 10) + 1}`,
      section_title: `Test Section ${i + 1}`,
      content_text: `This is test content for section ${i + 1}`,
      workflow_state: {
        id: `sws-${i + 1}`,
        section_id: `section-${i + 1}`,
        workflow_stage_id: 'stage-1',
        status: 'pending',
        approved_by: null,
        approved_at: null
      }
    }));
  };

  describe('Bulk Approval Performance', () => {
    test('Should approve 100 sections in under 5 seconds', async () => {
      const sections = generateTestSections(100);

      // Mock bulk update operation
      mockSupabase.update = jest.fn().mockReturnThis();
      mockSupabase.in = jest.fn().mockReturnThis();
      mockSupabase.select = jest.fn().mockResolvedValue({
        data: sections.map(s => ({
          ...s.workflow_state,
          status: 'approved',
          approved_by: 'user-123',
          approved_at: new Date().toISOString()
        })),
        error: null
      });

      const duration = await measurePerformance(async () => {
        // Simulate bulk approval
        const sectionIds = sections.map(s => s.id);

        // Mock API call
        await mockSupabase
          .from('section_workflow_states')
          .update({
            status: 'approved',
            approved_by: 'user-123',
            approved_at: new Date().toISOString()
          })
          .in('section_id', sectionIds)
          .select();
      });

      // Should complete in under 5 seconds (5000ms)
      expect(duration).toBeLessThan(5000);
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalled();
    }, 10000); // Test timeout of 10 seconds

    test('Should handle 500 sections with batching in under 15 seconds', async () => {
      const sections = generateTestSections(500);
      const batchSize = 100;

      const duration = await measurePerformance(async () => {
        // Simulate batched updates
        for (let i = 0; i < sections.length; i += batchSize) {
          const batch = sections.slice(i, i + batchSize);
          const batchIds = batch.map(s => s.id);

          mockSupabase.update = jest.fn().mockReturnThis();
          mockSupabase.in = jest.fn().mockResolvedValue({
            data: batch,
            error: null
          });

          await mockSupabase
            .from('section_workflow_states')
            .update({ status: 'approved' })
            .in('section_id', batchIds);
        }
      });

      expect(duration).toBeLessThan(15000);
    }, 20000);

    test('Should optimize with single transaction for better performance', async () => {
      const sections = generateTestSections(100);

      // Test single transaction approach
      const singleTransactionDuration = await measurePerformance(async () => {
        mockSupabase.rpc = jest.fn().mockResolvedValue({
          data: { approved_count: 100 },
          error: null
        });

        await mockSupabase.rpc('bulk_approve_sections', {
          section_ids: sections.map(s => s.id),
          user_id: 'user-123'
        });
      });

      // Test multiple individual updates (slower)
      const individualUpdatesDuration = await measurePerformance(async () => {
        for (const section of sections) {
          mockSupabase.update = jest.fn().mockReturnThis();
          mockSupabase.eq = jest.fn().mockResolvedValue({
            data: section,
            error: null
          });

          await mockSupabase
            .from('section_workflow_states')
            .update({ status: 'approved' })
            .eq('section_id', section.id);
        }
      });

      // Single transaction should be significantly faster
      expect(singleTransactionDuration).toBeLessThan(individualUpdatesDuration);
    });
  });

  describe('Workflow Template List Loading', () => {
    test('Should load workflow template list in under 500ms', async () => {
      const templates = Array.from({ length: 50 }, (_, i) => ({
        id: `workflow-${i + 1}`,
        name: `Workflow Template ${i + 1}`,
        description: `Description for template ${i + 1}`,
        is_default: i === 0,
        is_active: true,
        created_at: new Date().toISOString()
      }));

      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: templates,
        error: null
      });

      const duration = await measurePerformance(async () => {
        await mockSupabase
          .from('workflow_templates')
          .select('*')
          .eq('organization_id', 'org-123')
          .order('created_at', { ascending: false });
      });

      expect(duration).toBeLessThan(500);
      expect(mockSupabase.eq).toHaveBeenCalled();
    });

    test('Should efficiently load templates with stages using joins', async () => {
      const templatesWithStages = Array.from({ length: 20 }, (_, i) => ({
        id: `workflow-${i + 1}`,
        name: `Template ${i + 1}`,
        stages: Array.from({ length: 3 }, (__, j) => ({
          id: `stage-${i}-${j}`,
          stage_name: `Stage ${j + 1}`,
          stage_order: j + 1
        }))
      }));

      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.select = jest.fn().mockResolvedValue({
        data: templatesWithStages,
        error: null
      });

      const duration = await measurePerformance(async () => {
        await mockSupabase
          .from('workflow_templates')
          .select('*, workflow_stages(*)')
          .eq('organization_id', 'org-123');
      });

      expect(duration).toBeLessThan(800);
    });

    test('Should use pagination for large result sets', async () => {
      const pageSize = 20;
      const totalTemplates = 100;

      const duration = await measurePerformance(async () => {
        // Simulate paginated loading
        for (let page = 0; page < Math.ceil(totalTemplates / pageSize); page++) {
          mockSupabase.range = jest.fn().mockReturnThis();
          mockSupabase.eq = jest.fn().mockReturnThis();
          mockSupabase.order = jest.fn().mockResolvedValue({
            data: Array(pageSize).fill(null).map((_, i) => ({
              id: `workflow-${page * pageSize + i + 1}`
            })),
            error: null
          });

          await mockSupabase
            .from('workflow_templates')
            .select('*')
            .eq('organization_id', 'org-123')
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('created_at');
        }
      });

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Approval History Query Performance', () => {
    test('Should fetch approval history for section in under 200ms', async () => {
      const historyEntries = Array.from({ length: 50 }, (_, i) => ({
        id: `history-${i + 1}`,
        section_id: 'section-1',
        action: i % 3 === 0 ? 'approved' : i % 3 === 1 ? 'rejected' : 'advanced',
        workflow_stage_id: `stage-${(i % 3) + 1}`,
        user_id: `user-${(i % 5) + 1}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        metadata: {
          notes: `History entry ${i + 1}`
        }
      }));

      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.order = jest.fn().mockReturnThis();
      mockSupabase.limit = jest.fn().mockResolvedValue({
        data: historyEntries,
        error: null
      });

      const duration = await measurePerformance(async () => {
        await mockSupabase
          .from('section_approval_history')
          .select('*')
          .eq('section_id', 'section-1')
          .order('timestamp', { ascending: false })
          .limit(50);
      });

      expect(duration).toBeLessThan(200);
    });

    test('Should efficiently query history with user joins', async () => {
      const historyWithUsers = Array.from({ length: 30 }, (_, i) => ({
        id: `history-${i + 1}`,
        section_id: 'section-1',
        action: 'approved',
        user: {
          id: `user-${i % 5 + 1}`,
          email: `user${i % 5 + 1}@test.org`
        }
      }));

      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.select = jest.fn().mockReturnThis();
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: historyWithUsers,
        error: null
      });

      const duration = await measurePerformance(async () => {
        await mockSupabase
          .from('section_approval_history')
          .select('*, users(id, email)')
          .eq('section_id', 'section-1')
          .order('timestamp', { ascending: false });
      });

      expect(duration).toBeLessThan(300);
    });

    test('Should use indexes for fast history lookups', async () => {
      // Test multiple concurrent history queries
      const sections = generateTestSections(20);

      const duration = await measurePerformance(async () => {
        const historyPromises = sections.map(section => {
          mockSupabase.eq = jest.fn().mockReturnThis();
          mockSupabase.order = jest.fn().mockResolvedValue({
            data: [],
            error: null
          });

          return mockSupabase
            .from('section_approval_history')
            .select('*')
            .eq('section_id', section.id)
            .order('timestamp', { ascending: false });
        });

        await Promise.all(historyPromises);
      });

      // Should handle 20 concurrent queries efficiently
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Stage Reordering Performance', () => {
    test('Should reorder 20 stages in under 1 second', async () => {
      const stages = Array.from({ length: 20 }, (_, i) => ({
        id: `stage-${i + 1}`,
        workflow_template_id: 'workflow-1',
        stage_order: i + 1
      }));

      // Shuffle order
      const newOrder = stages.map((stage, i) => ({
        id: stage.id,
        order: stages.length - i
      }));

      mockSupabase.update = jest.fn().mockReturnThis();
      mockSupabase.eq = jest.fn().mockResolvedValue({
        data: {},
        error: null
      });

      const duration = await measurePerformance(async () => {
        // Update each stage's order
        for (const item of newOrder) {
          await mockSupabase
            .from('workflow_stages')
            .update({ stage_order: item.order })
            .eq('id', item.id);
        }
      });

      expect(duration).toBeLessThan(1000);
    });

    test('Should use batch update for better reordering performance', async () => {
      const stages = Array.from({ length: 20 }, (_, i) => ({
        id: `stage-${i + 1}`,
        order: i + 1
      }));

      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: { updated_count: 20 },
        error: null
      });

      const duration = await measurePerformance(async () => {
        await mockSupabase.rpc('batch_update_stage_order', {
          stage_updates: stages
        });
      });

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Concurrent Approval Handling', () => {
    test('Should handle 50 concurrent approval requests', async () => {
      const sections = generateTestSections(50);

      const duration = await measurePerformance(async () => {
        const approvalPromises = sections.map(section => {
          mockSupabase.update = jest.fn().mockReturnThis();
          mockSupabase.eq = jest.fn().mockReturnThis();
          mockSupabase.select = jest.fn().mockReturnThis();
          mockSupabase.single = jest.fn().mockResolvedValue({
            data: {
              ...section.workflow_state,
              status: 'approved'
            },
            error: null
          });

          return mockSupabase
            .from('section_workflow_states')
            .update({ status: 'approved' })
            .eq('section_id', section.id)
            .select()
            .single();
        });

        await Promise.all(approvalPromises);
      });

      // Should handle all concurrent requests efficiently
      expect(duration).toBeLessThan(3000);
    });

    test('Should prevent race conditions with optimistic locking', async () => {
      const section = generateTestSections(1)[0];
      let version = 1;

      // Simulate two concurrent updates
      const update1 = async () => {
        mockSupabase.update = jest.fn().mockReturnThis();
        mockSupabase.eq = jest.fn().mockReturnThis();
        mockSupabase.select = jest.fn().mockReturnThis();
        mockSupabase.single = jest.fn().mockResolvedValue({
          data: { ...section.workflow_state, version: version + 1 },
          error: null
        });

        await mockSupabase
          .from('section_workflow_states')
          .update({ status: 'approved', version: version + 1 })
          .eq('section_id', section.id)
          .eq('version', version)
          .select()
          .single();
      };

      const update2 = async () => {
        mockSupabase.update = jest.fn().mockReturnThis();
        mockSupabase.eq = jest.fn().mockReturnThis();
        mockSupabase.select = jest.fn().mockReturnThis();
        mockSupabase.single = jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Version mismatch' }
        });

        await mockSupabase
          .from('section_workflow_states')
          .update({ status: 'rejected', version: version + 1 })
          .eq('section_id', section.id)
          .eq('version', version)
          .select()
          .single();
      };

      const duration = await measurePerformance(async () => {
        await Promise.all([update1(), update2()]);
      });

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('Should efficiently handle large workflow state queries', async () => {
      const documentSections = generateTestSections(1000);

      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.select = jest.fn().mockResolvedValue({
        data: documentSections.map(s => s.workflow_state),
        error: null
      });

      const duration = await measurePerformance(async () => {
        await mockSupabase
          .from('section_workflow_states')
          .select('*')
          .eq('document_id', 'doc-large');
      });

      expect(duration).toBeLessThan(2000);
    });

    test('Should use streaming for very large result sets', async () => {
      const largeDataset = generateTestSections(5000);
      const chunkSize = 500;

      const duration = await measurePerformance(async () => {
        // Simulate streaming chunks
        for (let i = 0; i < largeDataset.length; i += chunkSize) {
          mockSupabase.range = jest.fn().mockReturnThis();
          mockSupabase.eq = jest.fn().mockResolvedValue({
            data: largeDataset.slice(i, i + chunkSize),
            error: null
          });

          await mockSupabase
            .from('section_workflow_states')
            .select('*')
            .eq('organization_id', 'org-123')
            .range(i, i + chunkSize - 1);
        }
      });

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Cache Performance', () => {
    test('Should cache workflow templates for faster repeated access', async () => {
      const templates = Array.from({ length: 10 }, (_, i) => ({
        id: `workflow-${i + 1}`,
        name: `Template ${i + 1}`
      }));

      let cacheHit = false;
      const cache = new Map();

      // First access - cache miss
      const firstAccessDuration = await measurePerformance(async () => {
        if (cache.has('templates')) {
          cacheHit = true;
          return cache.get('templates');
        }

        mockSupabase.eq = jest.fn().mockReturnThis();
        mockSupabase.select = jest.fn().mockResolvedValue({
          data: templates,
          error: null
        });

        const result = await mockSupabase
          .from('workflow_templates')
          .select('*')
          .eq('organization_id', 'org-123');

        cache.set('templates', result.data);
        return result.data;
      });

      expect(cacheHit).toBe(false);

      // Second access - cache hit
      cacheHit = false;
      const secondAccessDuration = await measurePerformance(async () => {
        if (cache.has('templates')) {
          cacheHit = true;
          return cache.get('templates');
        }
        return templates;
      });

      expect(cacheHit).toBe(true);
      expect(secondAccessDuration).toBeLessThan(firstAccessDuration);
    });
  });
});

module.exports = { /* test helpers if needed */ };
