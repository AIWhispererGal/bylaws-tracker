/**
 * Generalized Amendment Tracker - Main Module Index
 *
 * Exports all configuration, parsing, and utility modules
 * for easy import throughout the application.
 */

// Configuration modules
const organizationConfig = require('./config/organizationConfig');
const workflowConfig = require('./config/workflowConfig');
const hierarchyConfig = require('./config/hierarchyConfig');
const configSchema = require('./config/configSchema');

// Parser modules
const wordParser = require('./parsers/wordParser');
const hierarchyDetector = require('./parsers/hierarchyDetector');
const numberingSchemes = require('./parsers/numberingSchemes');

// Export all modules
module.exports = {
  // Configuration
  config: {
    organization: organizationConfig,
    workflow: workflowConfig,
    hierarchy: hierarchyConfig,
    schema: configSchema
  },

  // Parsers
  parsers: {
    word: wordParser,
    hierarchyDetector: hierarchyDetector,
    numberingSchemes: numberingSchemes
  },

  // Convenience exports (flat)
  organizationConfig,
  workflowConfig,
  hierarchyConfig,
  configSchema,
  wordParser,
  hierarchyDetector,
  numberingSchemes
};
