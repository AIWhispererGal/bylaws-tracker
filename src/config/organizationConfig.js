/**
 * Organization Configuration Loader
 * Loads organization-specific settings from multiple sources
 */

const path = require('path');
const fs = require('fs');

class OrganizationConfig {
  constructor() {
    this.configs = new Map();
    this.defaultConfigPath = path.join(process.cwd(), 'config', 'organization.json');
  }

  /**
   * Load organization configuration
   * Priority: Database > Config File > Environment Variables > Defaults
   */
  async loadConfig(organizationId, supabase = null) {
    // Check cache first
    if (this.configs.has(organizationId)) {
      return this.configs.get(organizationId);
    }

    let config = this.getDefaultConfig();

    // 1. Load from file if exists
    const fileConfig = this.loadFromFile(organizationId);
    if (fileConfig) {
      config = { ...config, ...fileConfig };
    }

    // 2. Load from environment variables
    const envConfig = this.loadFromEnvironment();
    config = { ...config, ...envConfig };

    // 3. Load from database (highest priority)
    if (supabase) {
      const dbConfig = await this.loadFromDatabase(organizationId, supabase);
      if (dbConfig) {
        config = { ...config, ...dbConfig };
      }
    }

    // Cache the merged config
    this.configs.set(organizationId, config);
    return config;
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      organizationId: null,
      organizationName: 'Default Organization',
      organizationType: 'general',

      // Terminology configuration
      terminology: {
        documentName: 'Document',
        sectionName: 'Section',
        articleName: 'Article',
        chapterName: 'Chapter',
        subsectionName: 'Subsection'
      },

      // Hierarchy configuration
      hierarchy: {
        levels: [
          {
            name: 'Article',
            type: 'article',
            numbering: 'roman',  // roman, numeric, alpha
            prefix: 'Article ',
            depth: 0
          },
          {
            name: 'Section',
            type: 'section',
            numbering: 'numeric',
            prefix: 'Section ',
            depth: 1
          }
        ],
        maxDepth: 5,
        allowNesting: true
      },

      // Numbering schemes
      numbering: {
        schemes: {
          roman: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'],
          numeric: (n) => String(n),
          alpha: (n) => String.fromCharCode(64 + n), // A, B, C...
          alphaLower: (n) => String.fromCharCode(96 + n) // a, b, c...
        },
        separator: '.',
        displayFormat: '{prefix}{number}'
      },

      // Workflow configuration
      workflow: {
        enabled: true,
        stages: [
          {
            name: 'Committee Review',
            order: 1,
            color: '#FFD700',
            icon: 'clipboard-check',
            permissions: ['committee_member', 'committee_chair', 'admin'],
            actions: ['approve', 'reject', 'edit', 'comment']
          },
          {
            name: 'Board Approval',
            order: 2,
            color: '#90EE90',
            icon: 'check-circle',
            permissions: ['board_member', 'admin'],
            actions: ['approve', 'reject', 'comment']
          }
        ],
        allowSkipStages: false,
        requireSequential: true
      },

      // Suggestion settings
      suggestions: {
        enabled: true,
        allowAnonymous: true,
        requireEmail: true,
        allowMultiSection: true,
        maxSectionsPerSuggestion: 10,
        votingEnabled: true,
        supportThreshold: 5
      },

      // Export settings
      export: {
        formats: ['json', 'pdf'],
        includeHistory: true,
        includeComments: false,
        anonymizeAuthors: false
      },

      // Integration settings
      integrations: {
        googleDocs: {
          enabled: true,
          autoSync: false,
          syncInterval: 3600000, // 1 hour in ms
          parseOnSync: true
        },
        email: {
          enabled: false,
          notifications: true
        }
      },

      // Security settings
      security: {
        requireAuth: false,
        allowPublicView: true,
        allowPublicSuggestions: true,
        enableRLS: true
      },

      // Display settings
      display: {
        theme: 'light',
        showLineNumbers: true,
        showDiff: true,
        highlightChanges: true,
        compactMode: false
      },

      // Feature flags
      features: {
        versionControl: true,
        auditLog: true,
        realTimeCollaboration: false,
        aiSuggestions: false
      }
    };
  }

  /**
   * Load configuration from file
   */
  loadFromFile(organizationId) {
    try {
      // Try organization-specific config first
      const orgConfigPath = path.join(
        process.cwd(),
        'config',
        `${organizationId}.json`
      );

      if (fs.existsSync(orgConfigPath)) {
        return JSON.parse(fs.readFileSync(orgConfigPath, 'utf-8'));
      }

      // Fall back to default config file
      if (fs.existsSync(this.defaultConfigPath)) {
        return JSON.parse(fs.readFileSync(this.defaultConfigPath, 'utf-8'));
      }

      return null;
    } catch (error) {
      console.error('Error loading config from file:', error);
      return null;
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment() {
    const config = {};

    if (process.env.ORG_NAME) {
      config.organizationName = process.env.ORG_NAME;
    }

    if (process.env.ORG_TYPE) {
      config.organizationType = process.env.ORG_TYPE;
    }

    if (process.env.WORKFLOW_STAGES) {
      try {
        config.workflow = {
          ...config.workflow,
          stages: JSON.parse(process.env.WORKFLOW_STAGES)
        };
      } catch (error) {
        console.error('Error parsing WORKFLOW_STAGES:', error);
      }
    }

    if (process.env.MAX_SUGGESTION_AGE) {
      config.suggestions = {
        ...config.suggestions,
        maxAge: parseInt(process.env.MAX_SUGGESTION_AGE)
      };
    }

    return config;
  }

  /**
   * Load configuration from database
   */
  async loadFromDatabase(organizationId, supabase) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('settings, hierarchy_config')
        .eq('id', organizationId)
        .single();

      if (error || !data) {
        return null;
      }

      // Build config from database, only including non-null values
      // This prevents null database values from overriding defaults
      const dbConfig = { ...data.settings };

      // Only include hierarchy if it's actually set in the database
      if (data.hierarchy_config) {
        dbConfig.hierarchy = data.hierarchy_config;
      }

      return dbConfig;
    } catch (error) {
      console.error('Error loading config from database:', error);
      return null;
    }
  }

  /**
   * Save configuration to database
   */
  async saveConfig(organizationId, config, supabase) {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          settings: config,
          hierarchy_config: config.hierarchy,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (!error) {
        // Update cache
        this.configs.set(organizationId, config);
      }

      return !error;
    } catch (error) {
      console.error('Error saving config to database:', error);
      return false;
    }
  }

  /**
   * Clear cached configuration
   */
  clearCache(organizationId = null) {
    if (organizationId) {
      this.configs.delete(organizationId);
    } else {
      this.configs.clear();
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    const errors = [];

    // Required fields
    if (!config.organizationName) {
      errors.push('Organization name is required');
    }

    // Validate hierarchy
    if (!config.hierarchy || !config.hierarchy.levels || config.hierarchy.levels.length === 0) {
      errors.push('At least one hierarchy level is required');
    }

    // Validate workflow
    if (config.workflow && config.workflow.enabled) {
      if (!config.workflow.stages || config.workflow.stages.length === 0) {
        errors.push('Workflow is enabled but no stages are defined');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new OrganizationConfig();
