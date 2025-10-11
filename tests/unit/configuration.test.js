/**
 * Configuration System Tests
 * Tests configurable workflows, stages, and organization settings
 */

const fs = require('fs');
const path = require('path');

// Mock configuration loader
class ConfigurationManager {
  constructor(source = 'env') {
    this.source = source;
    this.config = {};
  }

  load(configData) {
    if (typeof configData === 'object') {
      this.config = configData;
    }
    return this.config;
  }

  get(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }

  set(key, value) {
    this.config[key] = value;
    return this;
  }

  validate() {
    const required = ['organizationId', 'workflowStages'];
    const missing = required.filter(key => !this.config[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
  }

  getWorkflowStages() {
    return this.config.workflowStages || [];
  }

  getStageByName(name) {
    const stages = this.getWorkflowStages();
    return stages.find(s => s.name === name);
  }
}

// Workflow validator
function validateWorkflowStages(stages) {
  if (!Array.isArray(stages)) {
    return { valid: false, error: 'Stages must be an array' };
  }

  if (stages.length < 1 || stages.length > 5) {
    return { valid: false, error: 'Must have 1-5 workflow stages' };
  }

  for (const stage of stages) {
    if (!stage.name || typeof stage.name !== 'string') {
      return { valid: false, error: 'Each stage must have a name' };
    }
  }

  return { valid: true };
}

describe('Configuration System', () => {
  describe('Configuration Loading', () => {
    test('should load configuration from object', () => {
      const config = new ConfigurationManager();
      const testConfig = {
        organizationId: 'org-123',
        organizationName: 'Test Org',
        workflowStages: [
          { name: 'Draft', permissions: ['member'] },
          { name: 'Review', permissions: ['committee'] }
        ]
      };

      config.load(testConfig);

      expect(config.get('organizationId')).toBe('org-123');
      expect(config.get('organizationName')).toBe('Test Org');
    });

    test('should provide default values for missing keys', () => {
      const config = new ConfigurationManager();
      config.load({ organizationId: 'org-123' });

      expect(config.get('missingKey', 'default')).toBe('default');
    });

    test('should load from environment variables', () => {
      const config = new ConfigurationManager('env');

      // Mock environment
      process.env.ORG_ID = 'env-org-123';

      config.load({
        organizationId: process.env.ORG_ID
      });

      expect(config.get('organizationId')).toBe('env-org-123');

      delete process.env.ORG_ID;
    });
  });

  describe('Configuration Validation', () => {
    test('should validate required fields', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: []
      });

      expect(() => config.validate()).not.toThrow();
    });

    test('should throw error for missing required fields', () => {
      const config = new ConfigurationManager();
      config.load({ organizationId: 'org-123' });

      expect(() => config.validate()).toThrow('Missing required configuration');
    });

    test('should validate workflow stages structure', () => {
      const valid = validateWorkflowStages([
        { name: 'Draft' },
        { name: 'Review' }
      ]);

      expect(valid.valid).toBe(true);
    });

    test('should reject invalid workflow stages', () => {
      const invalid = validateWorkflowStages('not-an-array');

      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('array');
    });

    test('should enforce stage count limits', () => {
      const tooMany = Array.from({ length: 6 }, (_, i) => ({ name: `Stage${i}` }));
      const result = validateWorkflowStages(tooMany);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('1-5');
    });
  });

  describe('Workflow Configuration', () => {
    test('should support 1 stage workflow', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: [
          { name: 'Approval', permissions: ['board'] }
        ]
      });

      const stages = config.getWorkflowStages();
      expect(stages).toHaveLength(1);
      expect(stages[0].name).toBe('Approval');
    });

    test('should support 2 stage workflow (committee/board)', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: [
          { name: 'Committee Review', permissions: ['committee'] },
          { name: 'Board Approval', permissions: ['board'] }
        ]
      });

      const stages = config.getWorkflowStages();
      expect(stages).toHaveLength(2);
    });

    test('should support 5 stage workflow', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: [
          { name: 'Draft', permissions: ['member'] },
          { name: 'Review', permissions: ['committee'] },
          { name: 'Legal Check', permissions: ['legal'] },
          { name: 'Board Review', permissions: ['board'] },
          { name: 'Final Approval', permissions: ['president'] }
        ]
      });

      const stages = config.getWorkflowStages();
      expect(stages).toHaveLength(5);
    });

    test('should support custom stage names', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: [
          { name: 'Community Input', permissions: ['public'] },
          { name: 'Executive Review', permissions: ['exec'] },
          { name: 'Shareholder Vote', permissions: ['shareholders'] }
        ]
      });

      const stage = config.getStageByName('Community Input');
      expect(stage).toBeDefined();
      expect(stage.permissions).toContain('public');
    });
  });

  describe('Organization-Specific Configuration', () => {
    test('should configure neighborhood council workflow', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'nc-001',
        organizationType: 'neighborhood_council',
        workflowStages: [
          { name: 'Community Draft', permissions: ['member'], publicComment: true },
          { name: 'Committee Review', permissions: ['committee'] },
          { name: 'Board Vote', permissions: ['board'], quorumRequired: 0.5 }
        ]
      });

      const stages = config.getWorkflowStages();
      expect(stages[0].publicComment).toBe(true);
      expect(stages[2].quorumRequired).toBe(0.5);
    });

    test('should configure corporate governance workflow', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'corp-001',
        organizationType: 'corporation',
        workflowStages: [
          { name: 'Executive Draft', permissions: ['executive'] },
          { name: 'Legal Review', permissions: ['legal'], required: true },
          { name: 'Board Approval', permissions: ['board'], votingThreshold: 0.75 }
        ]
      });

      const legalStage = config.getStageByName('Legal Review');
      expect(legalStage.required).toBe(true);
    });

    test('should configure academic policy workflow', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'univ-001',
        organizationType: 'university',
        workflowStages: [
          { name: 'Faculty Draft', permissions: ['faculty'] },
          { name: 'Department Review', permissions: ['department_chair'] },
          { name: 'Senate Approval', permissions: ['senate'], publicRecord: true }
        ]
      });

      const senateStage = config.getStageByName('Senate Approval');
      expect(senateStage.publicRecord).toBe(true);
    });
  });

  describe('Dynamic Configuration Updates', () => {
    test('should allow runtime configuration changes', () => {
      const config = new ConfigurationManager();
      config.load({ organizationId: 'org-123', workflowStages: [] });

      config.set('workflowStages', [
        { name: 'New Stage', permissions: ['admin'] }
      ]);

      expect(config.getWorkflowStages()).toHaveLength(1);
    });

    test('should support configuration merging', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: [{ name: 'Draft' }]
      });

      const newStages = [
        { name: 'Draft' },
        { name: 'Review' }
      ];

      config.set('workflowStages', newStages);

      expect(config.getWorkflowStages()).toHaveLength(2);
    });
  });

  describe('Configuration Persistence', () => {
    test('should serialize configuration to JSON', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        workflowStages: [{ name: 'Test' }]
      });

      const json = JSON.stringify(config.config);
      const parsed = JSON.parse(json);

      expect(parsed.organizationId).toBe('org-123');
    });

    test('should support configuration versioning', () => {
      const config = new ConfigurationManager();
      config.load({
        version: '2.0.0',
        organizationId: 'org-123',
        workflowStages: []
      });

      expect(config.get('version')).toBe('2.0.0');
    });
  });

  describe('Hierarchy Configuration', () => {
    test('should configure custom hierarchy labels', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        hierarchyConfig: {
          level1: 'Part',
          level2: 'Section',
          level3: 'Subsection'
        },
        workflowStages: []
      });

      const hierarchy = config.get('hierarchyConfig');
      expect(hierarchy.level1).toBe('Part');
      expect(hierarchy.level2).toBe('Section');
    });

    test('should configure numbering schemes', () => {
      const config = new ConfigurationManager();
      config.load({
        organizationId: 'org-123',
        numberingConfig: {
          level1: 'roman',   // I, II, III
          level2: 'decimal', // 1, 2, 3
          level3: 'alpha'    // a, b, c
        },
        workflowStages: []
      });

      const numbering = config.get('numberingConfig');
      expect(numbering.level1).toBe('roman');
    });
  });
});

// Mock Jest functions
if (typeof describe === 'undefined') {
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
      if (!value.includes(expected)) throw new Error(`Expected to contain ${expected}`);
    },
    toBeDefined: () => {
      if (value === undefined) throw new Error('Expected to be defined');
    },
    not: {
      toThrow: () => {
        try {
          value();
        } catch (e) {
          throw new Error('Expected not to throw');
        }
      }
    },
    toThrow: (expectedMessage) => {
      try {
        value();
        throw new Error('Expected to throw');
      } catch (e) {
        if (expectedMessage && !e.message.includes(expectedMessage)) {
          throw new Error(`Expected error message to contain "${expectedMessage}", got "${e.message}"`);
        }
      }
    }
  });
}

module.exports = { ConfigurationManager, validateWorkflowStages };
