/**
 * Supabase Setup Helper
 *
 * Provides utilities for validating Supabase connections,
 * creating database schema, and initializing the database
 * for first-time deployments.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

/**
 * Validate Supabase credentials and connection
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} supabaseKey - Supabase anon/public key
 * @returns {Promise<Object>} Validation result
 */
async function validateConnection(supabaseUrl, supabaseKey) {
  try {
    // Validate URL format
    if (!supabaseUrl || !supabaseUrl.includes('.supabase.co')) {
      return {
        valid: false,
        error: 'Invalid Supabase URL format. Expected: https://yourproject.supabase.co'
      };
    }

    // Validate key format (JWT should start with 'eyJ')
    if (!supabaseKey || !supabaseKey.startsWith('eyJ')) {
      return {
        valid: false,
        error: 'Invalid Supabase key format. Should be a JWT token starting with "eyJ"'
      };
    }

    if (supabaseKey.length < 100) {
      return {
        valid: false,
        error: 'Supabase key appears too short. Please copy the entire key.'
      };
    }

    // Create test client
    const testClient = createClient(supabaseUrl, supabaseKey);

    // Try a simple query to test authentication
    // We don't care if the table exists, just if auth works
    const { error } = await testClient
      .from('bylaw_sections')
      .select('id')
      .limit(1);

    // Check for authentication errors
    if (error) {
      // If error is about table not existing, that's OK
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return {
          valid: true,
          message: 'Connection successful! Database tables will be created in the next step.',
          tablesExist: false
        };
      }

      // If error is about JWT/auth, credentials are wrong
      if (error.message.includes('JWT') || error.message.includes('authorization')) {
        return {
          valid: false,
          error: 'Authentication failed. Please check your Supabase URL and key.'
        };
      }

      // Other errors
      return {
        valid: false,
        error: `Connection test failed: ${error.message}`
      };
    }

    // Success - tables exist and connection works
    return {
      valid: true,
      message: 'Connection successful! Database tables already exist.',
      tablesExist: true
    };

  } catch (err) {
    return {
      valid: false,
      error: `Connection error: ${err.message}`
    };
  }
}

/**
 * Check if database tables exist
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} Tables status
 */
async function checkTablesExist(supabase) {
  try {
    const tables = ['bylaw_sections', 'bylaw_suggestions', 'bylaw_votes'];
    const results = {};

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      results[table] = !error || !error.message.includes('does not exist');
    }

    const allExist = Object.values(results).every(exists => exists);

    return {
      success: true,
      allExist,
      tables: results
    };

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get the SQL schema file content
 * @returns {Promise<string>} SQL schema content
 */
async function getSchemaSQL() {
  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const sql = await fs.readFile(schemaPath, 'utf8');
    return sql;
  } catch (err) {
    throw new Error(`Failed to read schema file: ${err.message}`);
  }
}

/**
 * Get migration SQL files
 * @returns {Promise<Array>} List of migration files with content
 */
async function getMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = await fs.readdir(migrationsDir);

    const sqlFiles = files.filter(f => f.endsWith('.sql'));
    const migrations = [];

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = await fs.readFile(filePath, 'utf8');

      migrations.push({
        name: file,
        path: filePath,
        content
      });
    }

    return migrations.sort((a, b) => a.name.localeCompare(b.name));

  } catch (err) {
    console.warn('No migrations directory found:', err.message);
    return [];
  }
}

/**
 * Generate instructions for manual schema creation
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} sql - SQL schema content
 * @returns {Object} Instructions for user
 */
function generateManualInstructions(supabaseUrl, sql) {
  // Extract project ID from URL
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'your-project';

  return {
    method: 'manual',
    steps: [
      {
        step: 1,
        title: 'Open Supabase SQL Editor',
        description: 'Open your Supabase project\'s SQL Editor',
        action: `Go to: https://supabase.com/dashboard/project/${projectId}/sql/new`
      },
      {
        step: 2,
        title: 'Copy SQL Schema',
        description: 'Copy the SQL schema provided below',
        sql: sql
      },
      {
        step: 3,
        title: 'Paste and Run',
        description: 'Paste the SQL into the editor and click "Run"',
        note: 'You should see a success message: "Success. No rows returned"'
      },
      {
        step: 4,
        title: 'Verify Tables',
        description: 'Check that tables were created',
        action: 'Go to Table Editor and look for: bylaw_sections, bylaw_suggestions, bylaw_votes'
      }
    ],
    sqlEditorUrl: `https://supabase.com/dashboard/project/${projectId}/sql/new`,
    tableEditorUrl: `https://supabase.com/dashboard/project/${projectId}/editor`
  };
}

/**
 * Initialize database with sample data (optional)
 * @param {Object} supabase - Supabase client instance
 * @param {string} docId - Document ID for sample data
 * @returns {Promise<Object>} Initialization result
 */
async function initializeSampleData(supabase, docId = 'sample-doc') {
  try {
    // Check if data already exists
    const { data: existing, error: checkError } = await supabase
      .from('bylaw_sections')
      .select('id')
      .eq('doc_id', docId)
      .limit(1);

    if (checkError) {
      throw new Error(`Failed to check for existing data: ${checkError.message}`);
    }

    if (existing && existing.length > 0) {
      return {
        success: true,
        message: 'Sample data already exists',
        skipped: true
      };
    }

    // Insert sample section
    const sampleSection = {
      doc_id: docId,
      section_citation: 'Article I, Section 1',
      section_title: 'Name',
      original_text: 'The name of this organization shall be the Bylaws Amendment Tracker.',
      article_number: 1,
      section_number: 1
    };

    const { data: section, error: sectionError } = await supabase
      .from('bylaw_sections')
      .insert(sampleSection)
      .select()
      .single();

    if (sectionError) {
      throw new Error(`Failed to insert sample section: ${sectionError.message}`);
    }

    return {
      success: true,
      message: 'Sample data initialized successfully',
      sectionId: section.id
    };

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Test database operations (CRUD)
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} Test results
 */
async function testDatabaseOperations(supabase) {
  const testId = `test-${Date.now()}`;
  const results = {
    create: false,
    read: false,
    update: false,
    delete: false
  };

  try {
    // Test CREATE
    const { data: created, error: createError } = await supabase
      .from('bylaw_sections')
      .insert({
        doc_id: testId,
        section_citation: 'Test Section',
        section_title: 'Test',
        original_text: 'This is a test section.'
      })
      .select()
      .single();

    if (createError) throw new Error(`CREATE failed: ${createError.message}`);
    results.create = true;

    const testSectionId = created.id;

    // Test READ
    const { data: read, error: readError } = await supabase
      .from('bylaw_sections')
      .select('*')
      .eq('id', testSectionId)
      .single();

    if (readError) throw new Error(`READ failed: ${readError.message}`);
    results.read = true;

    // Test UPDATE
    const { error: updateError } = await supabase
      .from('bylaw_sections')
      .update({ section_title: 'Updated Test' })
      .eq('id', testSectionId);

    if (updateError) throw new Error(`UPDATE failed: ${updateError.message}`);
    results.update = true;

    // Test DELETE
    const { error: deleteError } = await supabase
      .from('bylaw_sections')
      .delete()
      .eq('id', testSectionId);

    if (deleteError) throw new Error(`DELETE failed: ${deleteError.message}`);
    results.delete = true;

    return {
      success: true,
      message: 'All database operations working correctly',
      operations: results
    };

  } catch (err) {
    return {
      success: false,
      error: err.message,
      operations: results
    };
  }
}

/**
 * Get database statistics
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} Database statistics
 */
async function getDatabaseStats(supabase) {
  try {
    const stats = {};

    // Count sections
    const { count: sectionCount, error: sectionError } = await supabase
      .from('bylaw_sections')
      .select('*', { count: 'exact', head: true });

    stats.sections = sectionError ? 0 : sectionCount;

    // Count suggestions
    const { count: suggestionCount, error: suggestionError } = await supabase
      .from('bylaw_suggestions')
      .select('*', { count: 'exact', head: true });

    stats.suggestions = suggestionError ? 0 : suggestionCount;

    // Count votes
    const { count: voteCount, error: voteError } = await supabase
      .from('bylaw_votes')
      .select('*', { count: 'exact', head: true });

    stats.votes = voteError ? 0 : voteCount;

    return {
      success: true,
      stats
    };

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  validateConnection,
  checkTablesExist,
  getSchemaSQL,
  getMigrations,
  generateManualInstructions,
  initializeSampleData,
  testDatabaseOperations,
  getDatabaseStats
};
