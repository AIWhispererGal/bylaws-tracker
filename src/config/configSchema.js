/**
 * Configuration Schema Validation
 * Validates organization and workflow configurations
 */

const Joi = require('joi');

/**
 * Hierarchy level schema
 */
const hierarchyLevelSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  numbering: Joi.string().valid('roman', 'numeric', 'alpha', 'alphaLower').required(),
  prefix: Joi.string().allow('').default(''),
  depth: Joi.number().integer().min(0).required()
});

/**
 * Workflow stage schema
 */
const workflowStageSchema = Joi.object({
  name: Joi.string().required(),
  order: Joi.number().integer().min(1).required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#CCCCCC'),
  icon: Joi.string().allow('').default(''),
  permissions: Joi.array().items(Joi.string()).default([]),
  actions: Joi.array().items(Joi.string()).default(['approve', 'reject', 'comment']),
  canLock: Joi.boolean().default(false),
  canEdit: Joi.boolean().default(false),
  canApprove: Joi.boolean().default(true),
  requiresApproval: Joi.boolean().default(true)
});

/**
 * Complete organization configuration schema
 */
const organizationConfigSchema = Joi.object({
  organizationId: Joi.string().uuid().allow(null),
  organizationName: Joi.string().required(),
  organizationType: Joi.string().default('general'),

  terminology: Joi.object({
    documentName: Joi.string().default('Document'),
    sectionName: Joi.string().default('Section'),
    articleName: Joi.string().default('Article'),
    chapterName: Joi.string().default('Chapter'),
    subsectionName: Joi.string().default('Subsection')
  }).default(),

  hierarchy: Joi.object({
    levels: Joi.array().items(hierarchyLevelSchema).min(1).required(),
    maxDepth: Joi.number().integer().min(1).max(20).default(10),
    allowNesting: Joi.boolean().default(true)
  }).required(),

  numbering: Joi.object({
    separator: Joi.string().max(5).default('.'),
    displayFormat: Joi.string().default('{prefix}{number}')
  }).default(),

  workflow: Joi.object({
    enabled: Joi.boolean().default(true),
    stages: Joi.array().items(workflowStageSchema).min(1),
    allowSkipStages: Joi.boolean().default(false),
    requireSequential: Joi.boolean().default(true)
  }).default(),

  suggestions: Joi.object({
    enabled: Joi.boolean().default(true),
    allowAnonymous: Joi.boolean().default(true),
    requireEmail: Joi.boolean().default(true),
    allowMultiSection: Joi.boolean().default(true),
    maxSectionsPerSuggestion: Joi.number().integer().min(1).max(100).default(10),
    votingEnabled: Joi.boolean().default(true),
    supportThreshold: Joi.number().integer().min(0).default(5)
  }).default(),

  export: Joi.object({
    formats: Joi.array().items(Joi.string().valid('json', 'pdf', 'markdown', 'docx')).default(['json']),
    includeHistory: Joi.boolean().default(true),
    includeComments: Joi.boolean().default(false),
    anonymizeAuthors: Joi.boolean().default(false)
  }).default(),

  integrations: Joi.object({
    googleDocs: Joi.object({
      enabled: Joi.boolean().default(false),
      autoSync: Joi.boolean().default(false),
      syncInterval: Joi.number().integer().min(60000).default(3600000),
      parseOnSync: Joi.boolean().default(true)
    }).default(),
    email: Joi.object({
      enabled: Joi.boolean().default(false),
      notifications: Joi.boolean().default(false)
    }).default()
  }).default(),

  security: Joi.object({
    requireAuth: Joi.boolean().default(false),
    allowPublicView: Joi.boolean().default(true),
    allowPublicSuggestions: Joi.boolean().default(true),
    enableRLS: Joi.boolean().default(true)
  }).default(),

  display: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').default('light'),
    showLineNumbers: Joi.boolean().default(true),
    showDiff: Joi.boolean().default(true),
    highlightChanges: Joi.boolean().default(true),
    compactMode: Joi.boolean().default(false)
  }).default(),

  features: Joi.object({
    versionControl: Joi.boolean().default(true),
    auditLog: Joi.boolean().default(true),
    realTimeCollaboration: Joi.boolean().default(false),
    aiSuggestions: Joi.boolean().default(false)
  }).default()
});

/**
 * Validate organization configuration
 */
function validateOrganizationConfig(config) {
  const { error, value } = organizationConfigSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      })),
      value: null
    };
  }

  return {
    valid: true,
    errors: [],
    value
  };
}

/**
 * Validate workflow configuration
 */
function validateWorkflowConfig(config) {
  const workflowSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('').default(''),
    stages: Joi.array().items(workflowStageSchema).min(1).required(),
    allowSkipStages: Joi.boolean().default(false),
    requireSequential: Joi.boolean().default(true)
  });

  const { error, value } = workflowSchema.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      })),
      value: null
    };
  }

  // Additional validation: ensure stage orders are sequential
  const orders = value.stages.map(s => s.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      return {
        valid: false,
        errors: [{
          field: 'stages',
          message: `Stage orders must be sequential starting from 1. Found gap at order ${i + 1}`
        }],
        value: null
      };
    }
  }

  return {
    valid: true,
    errors: [],
    value
  };
}

/**
 * Validate hierarchy configuration
 */
function validateHierarchyConfig(config) {
  const hierarchySchema = Joi.object({
    levels: Joi.array().items(hierarchyLevelSchema).min(1).required(),
    maxDepth: Joi.number().integer().min(1).max(20).default(10),
    allowNesting: Joi.boolean().default(true)
  });

  const { error, value } = hierarchySchema.validate(config, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      })),
      value: null
    };
  }

  // Additional validation: ensure depths are sequential
  const depths = value.levels.map(l => l.depth).sort((a, b) => a - b);
  for (let i = 0; i < depths.length; i++) {
    if (depths[i] !== i) {
      return {
        valid: false,
        errors: [{
          field: 'levels',
          message: `Level depths must be sequential starting from 0. Found gap at depth ${i}`
        }],
        value: null
      };
    }
  }

  // Ensure maxDepth is at least as high as the deepest level
  const maxLevelDepth = Math.max(...depths);
  if (value.maxDepth < maxLevelDepth) {
    return {
      valid: false,
      errors: [{
        field: 'maxDepth',
        message: `maxDepth (${value.maxDepth}) must be at least ${maxLevelDepth} to accommodate all defined levels`
      }],
      value: null
    };
  }

  return {
    valid: true,
    errors: [],
    value
  };
}

module.exports = {
  validateOrganizationConfig,
  validateWorkflowConfig,
  validateHierarchyConfig,
  organizationConfigSchema,
  workflowStageSchema,
  hierarchyLevelSchema
};
