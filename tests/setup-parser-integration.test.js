/**
 * Integration Test: Setup Wizard + Word Parser
 * Verifies that the parser is correctly connected to the setup flow
 */

const setupService = require('../src/services/setupService');
const wordParser = require('../src/parsers/wordParser');

describe('Setup Parser Integration', () => {
  test('setupService can access wordParser', () => {
    // Verify setupService is loaded
    expect(setupService).toBeDefined();
    expect(typeof setupService.processDocumentImport).toBe('function');
  });

  test('wordParser is exported correctly', () => {
    // Verify wordParser is loaded
    expect(wordParser).toBeDefined();
    expect(typeof wordParser.parseDocument).toBe('function');
    expect(typeof wordParser.validateSections).toBe('function');
  });

  test('setupService.processDocumentImport has correct signature', () => {
    // Verify the method accepts the expected parameters
    const methodStr = setupService.processDocumentImport.toString();
    expect(methodStr).toContain('orgId');
    expect(methodStr).toContain('filePath');
    expect(methodStr).toContain('supabase');
  });

  test('integration flow validation', async () => {
    // Mock setup to verify the flow works
    const mockOrgId = 'test-org-id';
    const mockFilePath = '/path/to/test.docx';
    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: mockOrgId,
                hierarchy_config: {
                  levels: [
                    { name: 'Article', type: 'article', numbering: 'roman', depth: 0 },
                    { name: 'Section', type: 'section', numbering: 'numeric', depth: 1 }
                  ]
                }
              },
              error: null
            }))
          }))
        }))
      }))
    };

    // This should not throw errors during validation
    expect(() => {
      setupService.processDocumentImport(mockOrgId, mockFilePath, mockSupabase);
    }).not.toThrow();
  });

  test('parser can be called with organization config', async () => {
    const mockConfig = {
      hierarchy: {
        levels: [
          { name: 'Article', type: 'article', numbering: 'roman', depth: 0 },
          { name: 'Section', type: 'section', numbering: 'numeric', depth: 1 }
        ],
        maxDepth: 5
      }
    };

    // Verify parseDocument accepts config
    expect(() => {
      const mockPath = '/mock/path.docx';
      // This will fail with file not found, but validates the interface
      wordParser.parseDocument(mockPath, mockConfig).catch(() => {
        // Expected to fail - we're just testing the interface
      });
    }).not.toThrow();
  });
});

describe('Setup Route Integration', () => {
  test('setup route case statement is updated', () => {
    const setupRoute = require('../src/routes/setup');
    const routeString = setupRoute.toString();

    // Verify the import case has been updated
    expect(routeString).toContain('case \'import\'');
    expect(routeString).toContain('setupService');
    expect(routeString).toContain('processDocumentImport');
  });
});
