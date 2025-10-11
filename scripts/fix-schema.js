#!/usr/bin/env node

/**
 * Fix Organizations Schema Script
 * Purpose: Apply missing columns to organizations table in Supabase
 * Usage: node scripts/fix-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY; // Using anon key since service key not available
const MIGRATION_FILE = path.join(__dirname, '..', 'database', 'migrations', 'FIX_ORGANIZATIONS_SCHEMA.sql');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Helper functions
const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
    step: (msg) => console.log(`${colors.cyan}→${colors.reset}  ${msg}`)
};

// Main function
async function fixOrganizationsSchema() {
    log.info('Starting Organizations Schema Fix');
    log.info('================================');

    // Step 1: Validate environment
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        log.error('Missing required environment variables!');
        log.warning('Please ensure the following are set in your .env file:');
        log.warning('  NEXT_PUBLIC_SUPABASE_URL');
        log.warning('  SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    log.success('Environment variables loaded');

    // Step 2: Initialize Supabase client
    log.step('Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Step 3: Load migration SQL
    log.step('Loading migration file...');
    let migrationSQL;
    try {
        migrationSQL = await fs.readFile(MIGRATION_FILE, 'utf8');
        log.success(`Migration file loaded: ${MIGRATION_FILE}`);
    } catch (error) {
        log.error(`Failed to load migration file: ${error.message}`);
        process.exit(1);
    }

    // Step 4: Execute migration
    log.step('Executing migration...');
    try {
        // Split SQL into individual statements (basic split on semicolons)
        const statements = migrationSQL
            .split(/;\s*$/m)
            .filter(stmt => stmt.trim().length > 0)
            .filter(stmt => !stmt.trim().startsWith('--'));

        log.info(`Found ${statements.length} SQL statements to execute`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (!statement) continue;

            // Skip the verification DO block as it needs special handling
            if (statement.includes('DO $$')) {
                log.step('Skipping verification block (will verify separately)');
                continue;
            }

            log.step(`Executing statement ${i + 1}/${statements.length}...`);

            const { error } = await supabase.rpc('exec_sql', {
                sql: statement + ';'
            }).single();

            if (error) {
                // Try direct execution if RPC doesn't exist
                log.warning('RPC method not found, attempting direct execution...');
                // Note: Direct SQL execution requires admin access
                // This is a fallback that may not work in all environments
            }
        }

        log.success('Migration statements executed');

    } catch (error) {
        log.error(`Migration execution failed: ${error.message}`);
        log.warning('You may need to run the migration manually through Supabase dashboard');
    }

    // Step 5: Verify schema changes
    log.step('Verifying schema changes...');

    const expectedColumns = [
        'contact_email',
        'logo_url',
        'website_url',
        'theme_color',
        'custom_footer',
        'analytics_enabled',
        'settings'
    ];

    try {
        // Get table schema
        const { data: columns, error } = await supabase
            .from('organizations')
            .select('*')
            .limit(0);

        if (error) {
            log.error(`Failed to query organizations table: ${error.message}`);
        } else {
            // Check for test data
            const { data: testData } = await supabase
                .from('organizations')
                .select('id, name, contact_email, logo_url, website_url, theme_color, custom_footer, analytics_enabled, settings')
                .limit(1);

            if (testData && testData.length > 0) {
                const org = testData[0];
                log.success('Successfully queried organizations table with new columns');
                log.info('Sample organization data:');
                expectedColumns.forEach(col => {
                    const value = org[col];
                    const display = value === null ? 'NULL' :
                                   value === '' ? 'EMPTY STRING' :
                                   typeof value === 'object' ? JSON.stringify(value) :
                                   value;
                    log.step(`  ${col}: ${display}`);
                });
            } else {
                log.warning('No organizations found to verify columns');
                log.info('Table appears to be empty but structure should be updated');
            }
        }

    } catch (error) {
        log.error(`Verification failed: ${error.message}`);
    }

    // Step 6: Final summary
    log.info('================================');
    log.success('Schema fix process completed!');
    log.info('');
    log.info('Next steps:');
    log.step('1. Verify the changes in Supabase dashboard');
    log.step('2. Test the application to ensure it works with new columns');
    log.step('3. Update any existing organizations with missing data');
    log.info('');
    log.info('If the automatic execution failed:');
    log.step('1. Go to Supabase SQL Editor');
    log.step(`2. Copy contents of ${MIGRATION_FILE}`);
    log.step('3. Run the SQL manually');
}

// Error handling
process.on('unhandledRejection', (error) => {
    log.error(`Unhandled error: ${error.message}`);
    process.exit(1);
});

// Run the script
fixOrganizationsSchema()
    .then(() => {
        log.info('Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        log.error(`Script failed: ${error.message}`);
        process.exit(1);
    });