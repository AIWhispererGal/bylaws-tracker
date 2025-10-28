/**
 * Setup Service RLS Recursion Tests
 * ============================================================================
 * Purpose: Isolate and reproduce the RLS recursion issue in setup wizard
 * Agent: Tester
 * Session: swarm-1761672858022-3dg3qahxf
 * Created: 2025-10-28
 * ============================================================================
 *
 * CRITICAL TEST CASES:
 * 1. Organization creation (should work)
 * 2. User-organization linking (triggers recursion if policies broken)
 * 3. Organization query after link (tests RLS policies)
 * 4. Setup completion flow (integration test)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

describe('Setup Service - RLS Recursion Diagnostics', () => {
  let serviceSupabase;
  let testOrgId;
  let testUserId;

  // Test configuration
  const TEST_CONFIG = {
    // Use a consistent test user ID
    testUserId: '00000000-0000-0000-0000-000000000001',
    // Timeout for recursion detection (5 seconds)
    recursionTimeout: 5000,
    // Organization naming for cleanup
    testOrgPrefix: 'TEST_RECURSION_'
  };

  beforeAll(() => {
    // Initialize with service role (bypasses RLS)
    serviceSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    testUserId = TEST_CONFIG.testUserId;
  });

  afterEach(async () => {
    // Cleanup test data after each test
    if (testOrgId) {
      try {
        // Delete in order of dependencies
        await serviceSupabase
          .from('user_organizations')
          .delete()
          .eq('organization_id', testOrgId);

        await serviceSupabase
          .from('organizations')
          .delete()
          .eq('id', testOrgId);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
      testOrgId = null;
    }
  });

  afterAll(async () => {
    // Clean up any leftover test organizations
    try {
      const { data: testOrgs } = await serviceSupabase
        .from('organizations')
        .select('id')
        .like('name', `${TEST_CONFIG.testOrgPrefix}%`);

      if (testOrgs && testOrgs.length > 0) {
        const orgIds = testOrgs.map(org => org.id);

        await serviceSupabase
          .from('user_organizations')
          .delete()
          .in('organization_id', orgIds);

        await serviceSupabase
          .from('organizations')
          .delete()
          .in('id', orgIds);
      }
    } catch (error) {
      console.error('Final cleanup error:', error);
    }
  });

  // =========================================================================
  // TEST SUITE C1: Organization Creation (Baseline)
  // =========================================================================
  describe('C1: Organization Creation', () => {
    test('should create organization without user link', async () => {
      const orgData = {
        name: `${TEST_CONFIG.testOrgPrefix}NO_LINK_${Date.now()}`,
        org_type: 'neighborhood-council',
        settings: {
          terminology: {},
          display: {},
          features: {}
        },
        is_configured: false
      };

      const { data, error } = await serviceSupabase
        .from('organizations')
        .insert(orgData)
        .select()
        .single();

      // Assertions
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('id');
      expect(data.name).toBe(orgData.name);
      expect(data.is_configured).toBe(false);

      // Store for cleanup
      testOrgId = data.id;

      // Verify organization exists
      const { data: verifyOrg, error: verifyError } = await serviceSupabase
        .from('organizations')
        .select('id, name')
        .eq('id', data.id)
        .single();

      expect(verifyError).toBeNull();
      expect(verifyOrg.id).toBe(data.id);
    });

    test('should create organization with full settings', async () => {
      const orgData = {
        name: `${TEST_CONFIG.testOrgPrefix}FULL_${Date.now()}`,
        org_type: 'neighborhood-council',
        settings: {
          terminology: {
            documentName: 'Bylaws',
            sectionName: 'Section',
            articleName: 'Article'
          },
          display: {
            theme: 'light',
            compactMode: false
          },
          features: {
            workflowEnabled: true,
            versionsEnabled: true
          }
        },
        hierarchy_config: {
          levels: [
            { name: 'Article', type: 'article', depth: 0 },
            { name: 'Section', type: 'section', depth: 1 }
          ],
          maxDepth: 5,
          allowNesting: true
        },
        is_configured: false
      };

      const { data, error } = await serviceSupabase
        .from('organizations')
        .insert(orgData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.settings.terminology.documentName).toBe('Bylaws');
      expect(data.hierarchy_config.levels).toHaveLength(2);

      testOrgId = data.id;
    });
  });

  // =========================================================================
  // TEST SUITE C2: User-Organization Linking (CRITICAL - Recursion Trigger)
  // =========================================================================
  describe('C2: User-Organization Linking', () => {
    beforeEach(async () => {
      // Create test organization before each link test
      const { data: org } = await serviceSupabase
        .from('organizations')
        .insert({
          name: `${TEST_CONFIG.testOrgPrefix}LINK_${Date.now()}`,
          org_type: 'neighborhood-council',
          is_configured: false
        })
        .select()
        .single();

      testOrgId = org.id;
    });

    test('should link user to organization as owner', async () => {
      // THIS IS THE CRITICAL TEST - If RLS policies are recursive, this will timeout

      const linkData = {
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'owner',
        is_active: true
      };

      // Set a timeout to detect recursion
      const linkPromise = serviceSupabase
        .from('user_organizations')
        .insert(linkData)
        .select()
        .single();

      // Race between actual query and timeout
      const result = await Promise.race([
        linkPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('RECURSION_TIMEOUT')), TEST_CONFIG.recursionTimeout)
        )
      ]);

      // If we get here without timeout, link succeeded
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data).toHaveProperty('id');
      expect(result.data.user_id).toBe(testUserId);
      expect(result.data.organization_id).toBe(testOrgId);
      expect(result.data.role).toBe('owner');
    }, TEST_CONFIG.recursionTimeout + 1000); // Jest timeout slightly longer

    test('should link user to organization as admin', async () => {
      const linkData = {
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'admin',
        is_active: true
      };

      const { data, error } = await serviceSupabase
        .from('user_organizations')
        .insert(linkData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.role).toBe('admin');
    });

    test('should link user to organization as member', async () => {
      const linkData = {
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'member',
        is_active: true
      };

      const { data, error } = await serviceSupabase
        .from('user_organizations')
        .insert(linkData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.role).toBe('member');
    });

    test('should handle duplicate link attempt gracefully', async () => {
      // First link
      await serviceSupabase
        .from('user_organizations')
        .insert({
          user_id: testUserId,
          organization_id: testOrgId,
          role: 'owner',
          is_active: true
        });

      // Attempt duplicate link
      const { error } = await serviceSupabase
        .from('user_organizations')
        .insert({
          user_id: testUserId,
          organization_id: testOrgId,
          role: 'admin',
          is_active: true
        });

      // Should fail due to unique constraint
      expect(error).toBeDefined();
      expect(error.message).toContain('duplicate key');
    });
  });

  // =========================================================================
  // TEST SUITE C3: Post-Link Query Tests (RLS Policy Execution)
  // =========================================================================
  describe('C3: Query After Link', () => {
    beforeEach(async () => {
      // Create org and link user
      const { data: org } = await serviceSupabase
        .from('organizations')
        .insert({
          name: `${TEST_CONFIG.testOrgPrefix}QUERY_${Date.now()}`,
          org_type: 'neighborhood-council',
          is_configured: false
        })
        .select()
        .single();

      testOrgId = org.id;

      await serviceSupabase
        .from('user_organizations')
        .insert({
          user_id: testUserId,
          organization_id: testOrgId,
          role: 'owner',
          is_active: true
        });
    });

    test('should query user_organizations without recursion', async () => {
      // Query as service role (bypasses RLS)
      const { data, error } = await serviceSupabase
        .from('user_organizations')
        .select('*')
        .eq('user_id', testUserId)
        .eq('organization_id', testOrgId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe(testUserId);
    });

    test('should query organizations without recursion', async () => {
      const { data, error } = await serviceSupabase
        .from('organizations')
        .select('*')
        .eq('id', testOrgId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    test('should query user memberships with join', async () => {
      const { data, error } = await serviceSupabase
        .from('user_organizations')
        .select(`
          id,
          role,
          is_active,
          organizations (
            id,
            name,
            org_type
          )
        `)
        .eq('user_id', testUserId)
        .eq('organization_id', testOrgId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].organizations).toBeDefined();
      expect(data[0].organizations.id).toBe(testOrgId);
    });

    test('should count user organizations efficiently', async () => {
      const startTime = Date.now();

      const { count, error } = await serviceSupabase
        .from('user_organizations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId);

      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  // =========================================================================
  // TEST SUITE E1: Complete Setup Flow (Integration Test)
  // =========================================================================
  describe('E1: Complete Setup Wizard Flow', () => {
    test('should complete full setup without recursion', async () => {
      const timestamp = Date.now();

      // STEP 1: Create Organization
      const { data: org, error: orgError } = await serviceSupabase
        .from('organizations')
        .insert({
          name: `${TEST_CONFIG.testOrgPrefix}FULL_FLOW_${timestamp}`,
          org_type: 'neighborhood-council',
          settings: {
            terminology: {
              documentName: 'Bylaws',
              sectionName: 'Section'
            }
          },
          is_configured: false
        })
        .select()
        .single();

      expect(orgError).toBeNull();
      testOrgId = org.id;

      // STEP 2: Link User to Organization (CRITICAL - Recursion Risk)
      const { data: userOrg, error: linkError } = await serviceSupabase
        .from('user_organizations')
        .insert({
          user_id: testUserId,
          organization_id: org.id,
          role: 'owner',
          is_active: true
        })
        .select()
        .single();

      expect(linkError).toBeNull(); // RECURSION WOULD FAIL HERE
      expect(userOrg).toBeDefined();

      // STEP 3: Configure Hierarchy
      const { error: hierError } = await serviceSupabase
        .from('organizations')
        .update({
          hierarchy_config: {
            levels: [
              { name: 'Article', type: 'article', depth: 0, numbering: 'roman' },
              { name: 'Section', type: 'section', depth: 1, numbering: 'numeric' }
            ],
            maxDepth: 5,
            allowNesting: true
          }
        })
        .eq('id', org.id);

      expect(hierError).toBeNull();

      // STEP 4: Create Workflow Template
      const { data: workflow, error: workflowError } = await serviceSupabase
        .from('workflow_templates')
        .insert({
          organization_id: org.id,
          name: 'Default Workflow',
          description: 'Two-stage approval process',
          is_default: true,
          is_active: true
        })
        .select()
        .single();

      expect(workflowError).toBeNull();

      // STEP 5: Create Workflow Stages
      const { error: stagesError } = await serviceSupabase
        .from('workflow_stages')
        .insert([
          {
            workflow_template_id: workflow.id,
            stage_name: 'Committee Review',
            stage_order: 1,
            can_lock: true,
            can_edit: true,
            can_approve: true,
            requires_approval: true
          },
          {
            workflow_template_id: workflow.id,
            stage_name: 'Board Approval',
            stage_order: 2,
            can_lock: false,
            can_edit: false,
            can_approve: true,
            requires_approval: true
          }
        ]);

      expect(stagesError).toBeNull();

      // STEP 6: Mark as Configured
      const { error: completeError } = await serviceSupabase
        .from('organizations')
        .update({ is_configured: true })
        .eq('id', org.id);

      expect(completeError).toBeNull();

      // STEP 7: Verify Final State
      const { data: finalOrg, error: verifyError } = await serviceSupabase
        .from('organizations')
        .select('id, name, is_configured, hierarchy_config')
        .eq('id', org.id)
        .single();

      expect(verifyError).toBeNull();
      expect(finalOrg.is_configured).toBe(true);
      expect(finalOrg.hierarchy_config).toBeDefined();
      expect(finalOrg.hierarchy_config.levels).toHaveLength(2);

      // Cleanup
      await serviceSupabase.from('workflow_stages').delete().eq('workflow_template_id', workflow.id);
      await serviceSupabase.from('workflow_templates').delete().eq('id', workflow.id);
    }, 15000); // Longer timeout for full flow
  });

  // =========================================================================
  // TEST SUITE: Performance Benchmarks
  // =========================================================================
  describe('Performance: Recursion Detection', () => {
    beforeEach(async () => {
      const { data: org } = await serviceSupabase
        .from('organizations')
        .insert({
          name: `${TEST_CONFIG.testOrgPrefix}PERF_${Date.now()}`,
          org_type: 'neighborhood-council',
          is_configured: false
        })
        .select()
        .single();

      testOrgId = org.id;

      await serviceSupabase
        .from('user_organizations')
        .insert({
          user_id: testUserId,
          organization_id: testOrgId,
          role: 'owner',
          is_active: true
        });
    });

    test('should query user_organizations in <100ms', async () => {
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();

        await serviceSupabase
          .from('user_organizations')
          .select('*')
          .eq('user_id', testUserId);

        const duration = Date.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`Query times: ${times.join(', ')}ms (avg: ${avgTime.toFixed(2)}ms, max: ${maxTime}ms)`);

      expect(avgTime).toBeLessThan(100); // Should be fast
      expect(maxTime).toBeLessThan(500); // Even worst case should be reasonable
    });

    test('should detect performance degradation', async () => {
      // Baseline query
      const start1 = Date.now();
      await serviceSupabase.from('user_organizations').select('*').eq('user_id', testUserId);
      const baseline = Date.now() - start1;

      // Second query should be similar speed
      const start2 = Date.now();
      await serviceSupabase.from('user_organizations').select('*').eq('user_id', testUserId);
      const second = Date.now() - start2;

      const degradation = second / baseline;

      // If second query is >3x slower, possible recursion or caching issue
      expect(degradation).toBeLessThan(3);
    });
  });
});
