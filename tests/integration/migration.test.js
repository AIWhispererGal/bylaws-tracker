/**
 * Data Migration Tests
 * Tests schema migration with data preservation
 */

// Mock migration utilities
class MigrationManager {
  constructor() {
    this.migrations = [];
    this.currentVersion = '1.0.0';
  }

  async addMigration(migration) {
    this.migrations.push(migration);
  }

  async runMigrations(targetVersion) {
    const results = [];

    for (const migration of this.migrations) {
      if (this.shouldRunMigration(migration, targetVersion)) {
        const result = await migration.up();
        results.push({
          version: migration.version,
          success: true,
          result
        });
        this.currentVersion = migration.version;
      }
    }

    return results;
  }

  shouldRunMigration(migration, targetVersion) {
    return this.compareVersions(migration.version, this.currentVersion) > 0 &&
           this.compareVersions(migration.version, targetVersion) <= 0;
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
  }

  async rollback() {
    const lastMigration = this.migrations[this.migrations.length - 1];
    if (lastMigration && lastMigration.down) {
      await lastMigration.down();
      return true;
    }
    return false;
  }
}

// Mock database for testing
class MockDatabase {
  constructor() {
    this.tables = {
      bylaw_sections: [],
      bylaw_suggestions: [],
      organizations: []
    };
    this.schema = {
      bylaw_sections: ['id', 'doc_id', 'section_citation', 'original_text']
    };
  }

  async addColumn(table, column, type = 'string') {
    if (!this.schema[table].includes(column)) {
      this.schema[table].push(column);
      // Add column to existing rows with null value
      this.tables[table].forEach(row => {
        row[column] = null;
      });
    }
  }

  async createTable(tableName, columns) {
    this.tables[tableName] = [];
    this.schema[tableName] = columns;
  }

  async insert(table, data) {
    this.tables[table].push({ ...data });
  }

  async update(table, filter, updates) {
    this.tables[table].forEach(row => {
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (row[key] !== value) matches = false;
      }
      if (matches) {
        Object.assign(row, updates);
      }
    });
  }

  async select(table, filter = {}) {
    return this.tables[table].filter(row => {
      for (const [key, value] of Object.entries(filter)) {
        if (row[key] !== value) return false;
      }
      return true;
    });
  }

  async count(table) {
    return this.tables[table].length;
  }
}

describe('Migration Tests', () => {
  let db;
  let migrationManager;

  beforeEach(() => {
    db = new MockDatabase();
    migrationManager = new MigrationManager();
  });

  describe('Schema Migration', () => {
    test('should add organization_id to existing tables', async () => {
      // Setup existing data
      await db.insert('bylaw_sections', {
        id: '1',
        doc_id: 'doc-123',
        section_citation: 'Article I, Section 1',
        original_text: 'Original text'
      });

      // Run migration
      const migration = {
        version: '2.0.0',
        up: async () => {
          await db.addColumn('bylaw_sections', 'organization_id', 'uuid');
          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      // Verify column added
      expect(db.schema.bylaw_sections).toContain('organization_id');

      // Verify existing data preserved
      const sections = await db.select('bylaw_sections');
      expect(sections[0].original_text).toBe('Original text');
      expect(sections[0].organization_id).toBeNull(); // Default null
    });

    test('should create organizations table', async () => {
      const migration = {
        version: '2.0.0',
        up: async () => {
          await db.createTable('organizations', [
            'id', 'name', 'type', 'configuration', 'created_at'
          ]);
          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      expect(db.tables.organizations).toBeDefined();
      expect(db.schema.organizations).toContain('name');
    });
  });

  describe('Data Preservation', () => {
    test('should preserve all existing sections', async () => {
      // Insert test data
      const testSections = [
        { id: '1', doc_id: 'doc-1', section_citation: 'Article I', original_text: 'Text 1' },
        { id: '2', doc_id: 'doc-1', section_citation: 'Article II', original_text: 'Text 2' },
        { id: '3', doc_id: 'doc-1', section_citation: 'Article III', original_text: 'Text 3' }
      ];

      for (const section of testSections) {
        await db.insert('bylaw_sections', section);
      }

      const beforeCount = await db.count('bylaw_sections');

      // Run migration
      const migration = {
        version: '2.0.0',
        up: async () => {
          await db.addColumn('bylaw_sections', 'organization_id', 'uuid');
          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      const afterCount = await db.count('bylaw_sections');

      expect(afterCount).toBe(beforeCount);
      expect(afterCount).toBe(3);
    });

    test('should preserve section text content', async () => {
      const originalText = 'This is the original bylaw text that must be preserved exactly.';

      await db.insert('bylaw_sections', {
        id: '1',
        doc_id: 'doc-1',
        section_citation: 'Article I',
        original_text: originalText
      });

      // Run migration
      const migration = {
        version: '2.0.0',
        up: async () => {
          await db.addColumn('bylaw_sections', 'organization_id', 'uuid');
          await db.addColumn('bylaw_sections', 'new_field', 'string');
          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      const sections = await db.select('bylaw_sections', { id: '1' });
      expect(sections[0].original_text).toBe(originalText);
    });

    test('should migrate to default organization', async () => {
      await db.insert('bylaw_sections', {
        id: '1',
        doc_id: 'doc-1',
        section_citation: 'Article I',
        original_text: 'Text'
      });

      const migration = {
        version: '2.0.0',
        up: async () => {
          // Create organizations table
          await db.createTable('organizations', ['id', 'name', 'type']);

          // Add default org
          const defaultOrgId = 'org-default';
          await db.insert('organizations', {
            id: defaultOrgId,
            name: 'Default Organization',
            type: 'neighborhood_council'
          });

          // Add organization_id column
          await db.addColumn('bylaw_sections', 'organization_id', 'uuid');

          // Migrate existing data
          await db.update('bylaw_sections', {}, { organization_id: defaultOrgId });

          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      const sections = await db.select('bylaw_sections');
      expect(sections[0].organization_id).toBe('org-default');

      const orgs = await db.select('organizations');
      expect(orgs).toHaveLength(1);
      expect(orgs[0].name).toBe('Default Organization');
    });
  });

  describe('Migration Rollback', () => {
    test('should support rollback functionality', async () => {
      const migration = {
        version: '2.0.0',
        up: async () => {
          await db.addColumn('bylaw_sections', 'organization_id', 'uuid');
          return { success: true };
        },
        down: async () => {
          // Remove column (simplified for test)
          db.schema.bylaw_sections = db.schema.bylaw_sections.filter(
            col => col !== 'organization_id'
          );
          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      expect(db.schema.bylaw_sections).toContain('organization_id');

      await migrationManager.rollback();

      expect(db.schema.bylaw_sections).not.toContain('organization_id');
    });
  });

  describe('Version Management', () => {
    test('should track migration version', async () => {
      expect(migrationManager.currentVersion).toBe('1.0.0');

      const migration = {
        version: '2.0.0',
        up: async () => ({ success: true })
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      expect(migrationManager.currentVersion).toBe('2.0.0');
    });

    test('should run migrations in order', async () => {
      const executionOrder = [];

      const migrations = [
        {
          version: '1.1.0',
          up: async () => {
            executionOrder.push('1.1.0');
            return { success: true };
          }
        },
        {
          version: '1.2.0',
          up: async () => {
            executionOrder.push('1.2.0');
            return { success: true };
          }
        },
        {
          version: '2.0.0',
          up: async () => {
            executionOrder.push('2.0.0');
            return { success: true };
          }
        }
      ];

      for (const migration of migrations) {
        await migrationManager.addMigration(migration);
      }

      await migrationManager.runMigrations('2.0.0');

      expect(executionOrder).toHaveLength(3);
      expect(executionOrder[0]).toBe('1.1.0');
      expect(executionOrder[1]).toBe('1.2.0');
      expect(executionOrder[2]).toBe('2.0.0');
    });

    test('should skip already applied migrations', async () => {
      migrationManager.currentVersion = '1.5.0';

      const executionOrder = [];

      const migrations = [
        {
          version: '1.1.0',
          up: async () => {
            executionOrder.push('1.1.0');
            return { success: true };
          }
        },
        {
          version: '1.6.0',
          up: async () => {
            executionOrder.push('1.6.0');
            return { success: true };
          }
        }
      ];

      for (const migration of migrations) {
        await migrationManager.addMigration(migration);
      }

      await migrationManager.runMigrations('2.0.0');

      expect(executionOrder).toHaveLength(1);
      expect(executionOrder[0]).toBe('1.6.0');
    });
  });

  describe('Data Integrity', () => {
    test('should maintain referential integrity', async () => {
      // Setup related data
      await db.insert('bylaw_sections', {
        id: 'sec-1',
        doc_id: 'doc-1',
        section_citation: 'Article I',
        original_text: 'Text'
      });

      await db.createTable('bylaw_suggestions', [
        'id', 'section_id', 'suggested_text'
      ]);

      await db.insert('bylaw_suggestions', {
        id: 'sug-1',
        section_id: 'sec-1',
        suggested_text: 'Suggestion'
      });

      // Run migration
      const migration = {
        version: '2.0.0',
        up: async () => {
          await db.addColumn('bylaw_sections', 'organization_id', 'uuid');
          await db.addColumn('bylaw_suggestions', 'organization_id', 'uuid');

          const defaultOrgId = 'org-default';
          await db.update('bylaw_sections', {}, { organization_id: defaultOrgId });
          await db.update('bylaw_suggestions', {}, { organization_id: defaultOrgId });

          return { success: true };
        }
      };

      await migrationManager.addMigration(migration);
      await migrationManager.runMigrations('2.0.0');

      // Verify relationships preserved
      const suggestions = await db.select('bylaw_suggestions', { section_id: 'sec-1' });
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggested_text).toBe('Suggestion');
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
    toBeDefined: () => {
      if (value === undefined) throw new Error('Expected to be defined');
    },
    toBeNull: () => {
      if (value !== null) throw new Error('Expected to be null');
    },
    toContain: (expected) => {
      if (Array.isArray(value)) {
        if (!value.includes(expected)) throw new Error(`Expected array to contain ${expected}`);
      }
    },
    not: {
      toContain: (expected) => {
        if (Array.isArray(value) && value.includes(expected)) {
          throw new Error(`Expected array not to contain ${expected}`);
        }
      }
    }
  });
}

module.exports = { MigrationManager, MockDatabase };
