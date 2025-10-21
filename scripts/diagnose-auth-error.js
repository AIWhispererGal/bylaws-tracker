#!/usr/bin/env node

/**
 * DIAGNOSTIC SCRIPT: User Authentication Error Investigation
 * User ID: 2234d0d2-60d5-4f86-84b8-dd0dd44dc042
 *
 * This script:
 * - Runs diagnostic queries using Supabase client
 * - Mimics exact middleware query patterns
 * - Shows detailed output of what's missing
 * - Tests both service role and user context
 *
 * Usage:
 *   node scripts/diagnose-auth-error.js
 *
 * Requirements:
 *   - .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const USER_ID = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Helper functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

function logResult(label, value, status = 'info') {
    const statusColor = status === 'success' ? 'green' : status === 'error' ? 'red' : status === 'warning' ? 'yellow' : 'blue';
    console.log(`${colors.bright}${label}:${colors.reset} ${colors[statusColor]}${JSON.stringify(value, null, 2)}${colors.reset}`);
}

// Initialize Supabase client
let supabase;
try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    log('✓ Supabase client initialized with service role', 'green');
} catch (error) {
    log(`✗ Failed to initialize Supabase client: ${error.message}`, 'red');
    process.exit(1);
}

// Diagnostic functions
async function checkAuthUser() {
    logSection('1. CHECK AUTH.USERS TABLE');

    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            query: `SELECT id, email, created_at, email_confirmed_at, last_sign_in_at FROM auth.users WHERE id = '${USER_ID}'`
        });

        if (error) {
            // Fallback: Try direct auth admin API
            log('RPC failed, attempting direct query...', 'yellow');
            const { data: authData, error: authError } = await supabase.auth.admin.getUserById(USER_ID);

            if (authError) {
                logResult('Error', authError.message, 'error');
                return { exists: false, error: authError };
            }

            logResult('User exists in auth.users', authData, 'success');
            logResult('Account created', authData.created_at, 'info');
            logResult('Email confirmed', authData.email_confirmed_at || 'Not confirmed', authData.email_confirmed_at ? 'success' : 'warning');
            return { exists: true, data: authData };
        }

        if (!data || data.length === 0) {
            log('✗ User NOT found in auth.users', 'red');
            return { exists: false };
        }

        logResult('User found in auth.users', data[0], 'success');
        return { exists: true, data: data[0] };
    } catch (error) {
        logResult('Exception', error.message, 'error');
        return { exists: false, error };
    }
}

async function checkUserTypes() {
    logSection('2. CHECK USER_TYPES TABLE (MIDDLEWARE QUERY)');

    try {
        // This mimics the exact middleware query pattern
        const { data, error } = await supabase
            .from('user_types')
            .select('user_id, is_global_admin, created_at, updated_at')
            .eq('user_id', USER_ID)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                log('✗ NO user_types record found (ROOT CAUSE)', 'red');
                log('  This is why middleware fails!', 'red');
                return { exists: false, error: 'Record not found' };
            }
            logResult('Error', error, 'error');
            return { exists: false, error };
        }

        if (!data) {
            log('✗ user_types query returned null', 'red');
            return { exists: false };
        }

        log('✓ user_types record found', 'green');
        logResult('is_global_admin', data.is_global_admin, 'info');
        logResult('Record created', data.created_at, 'info');
        return { exists: true, data };
    } catch (error) {
        logResult('Exception', error.message, 'error');
        return { exists: false, error };
    }
}

async function checkUserOrganizations() {
    logSection('3. CHECK USER_ORGANIZATIONS TABLE');

    try {
        const { data, error } = await supabase
            .from('user_organizations')
            .select(`
                id,
                user_id,
                organization_id,
                role,
                created_at,
                organizations (
                    name,
                    subdomain
                )
            `)
            .eq('user_id', USER_ID);

        if (error) {
            logResult('Error', error, 'error');
            return { exists: false, error };
        }

        if (!data || data.length === 0) {
            log('✗ No organization memberships found', 'red');
            return { exists: false, count: 0 };
        }

        log(`✓ Found ${data.length} organization membership(s)`, 'green');
        data.forEach((membership, index) => {
            logResult(`Membership ${index + 1}`, {
                organization: membership.organizations?.name,
                role: membership.role,
                created: membership.created_at
            }, 'info');
        });

        return { exists: true, count: data.length, data };
    } catch (error) {
        logResult('Exception', error.message, 'error');
        return { exists: false, error };
    }
}

async function checkRLSPolicies() {
    logSection('4. CHECK RLS POLICIES ON USER_TYPES');

    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            query: `
                SELECT policyname, permissive, roles, cmd, qual
                FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'user_types'
                ORDER BY policyname
            `
        });

        if (error) {
            log('Unable to query RLS policies (requires elevated permissions)', 'yellow');
            logResult('Error', error.message, 'warning');
            return { checked: false };
        }

        if (!data || data.length === 0) {
            log('⚠ No RLS policies found on user_types table', 'yellow');
            return { checked: true, count: 0 };
        }

        log(`✓ Found ${data.length} RLS policy/policies`, 'green');
        data.forEach(policy => {
            logResult(`Policy: ${policy.policyname}`, {
                command: policy.cmd,
                roles: policy.roles,
                permissive: policy.permissive,
                using: policy.qual
            }, 'info');
        });

        return { checked: true, count: data.length, data };
    } catch (error) {
        logResult('Exception', error.message, 'error');
        return { checked: false, error };
    }
}

async function checkRLSEnabledStatus() {
    logSection('5. CHECK RLS ENABLED STATUS');

    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            query: `
                SELECT tablename, rowsecurity
                FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename IN ('user_types', 'user_organizations', 'organizations')
                ORDER BY tablename
            `
        });

        if (error) {
            log('Unable to query RLS status (requires elevated permissions)', 'yellow');
            return { checked: false };
        }

        if (!data) {
            log('No data returned', 'yellow');
            return { checked: false };
        }

        log('RLS Status:', 'blue');
        data.forEach(table => {
            const status = table.rowsecurity ? 'ENABLED' : 'DISABLED';
            const color = table.rowsecurity ? 'green' : 'yellow';
            logResult(`  ${table.tablename}`, status, color);
        });

        return { checked: true, data };
    } catch (error) {
        logResult('Exception', error.message, 'error');
        return { checked: false, error };
    }
}

async function checkOrphanedRecords() {
    logSection('6. CHECK FOR ORPHANED RECORDS');

    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            query: `
                SELECT
                    au.id,
                    au.email,
                    au.created_at,
                    CASE WHEN ut.user_id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as user_types_status,
                    CASE WHEN uo.user_id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as user_orgs_status
                FROM auth.users au
                LEFT JOIN public.user_types ut ON ut.user_id = au.id
                LEFT JOIN public.user_organizations uo ON uo.user_id = au.id
                WHERE au.id = '${USER_ID}'
            `
        });

        if (error) {
            log('Unable to check orphaned records', 'yellow');
            return { checked: false };
        }

        if (!data || data.length === 0) {
            log('✗ User not found in auth.users', 'red');
            return { checked: true, orphaned: true };
        }

        const record = data[0];
        logResult('User email', record.email, 'info');
        logResult('user_types status', record.user_types_status, record.user_types_status === 'EXISTS' ? 'success' : 'error');
        logResult('user_organizations status', record.user_orgs_status, record.user_orgs_status === 'EXISTS' ? 'success' : 'error');

        const isOrphaned = record.user_types_status === 'MISSING' || record.user_orgs_status === 'MISSING';

        if (isOrphaned) {
            log('\n⚠ ORPHANED RECORD DETECTED', 'yellow');
            log('  User exists in auth.users but missing required records', 'yellow');
        }

        return { checked: true, orphaned: isOrphaned, data: record };
    } catch (error) {
        logResult('Exception', error.message, 'error');
        return { checked: false, error };
    }
}

async function generateDiagnosisReport(results) {
    logSection('DIAGNOSIS REPORT');

    const authExists = results.auth.exists;
    const typesExists = results.types.exists;
    const orgsExists = results.orgs.exists && results.orgs.count > 0;

    log('\nRecord Status:', 'bright');
    logResult('  auth.users', authExists ? '✓ EXISTS' : '✗ MISSING', authExists ? 'success' : 'error');
    logResult('  user_types', typesExists ? '✓ EXISTS' : '✗ MISSING', typesExists ? 'success' : 'error');
    logResult('  user_organizations', orgsExists ? `✓ EXISTS (${results.orgs.count})` : '✗ MISSING', orgsExists ? 'success' : 'error');

    log('\nRoot Cause Analysis:', 'bright');
    if (!authExists) {
        log('  • User does not exist in auth.users - Invalid user ID or deleted account', 'red');
        log('  • CRITICAL: Cannot proceed without valid auth user', 'red');
    } else if (!typesExists) {
        log('  • User exists in auth.users but missing user_types record', 'red');
        log('  • THIS IS THE ROOT CAUSE of the middleware error', 'red');
        log('  • Likely cause: Trigger function failed or was not executed during registration', 'yellow');
    } else if (!orgsExists) {
        log('  • User has auth and user_types but no organization membership', 'yellow');
        log('  • User cannot access any organization-specific features', 'yellow');
    } else {
        log('  • All required records exist', 'green');
        log('  • The error may be caused by RLS policies or query context', 'yellow');
    }

    log('\nRecommended Action:', 'bright');
    if (!authExists) {
        log('  1. Verify the user ID is correct', 'blue');
        log('  2. Check if user account was deleted', 'blue');
        log('  3. Create new user if needed', 'blue');
    } else if (!typesExists) {
        log('  1. Create missing user_types record:', 'blue');
        log('     INSERT INTO public.user_types (user_id, is_global_admin)', 'cyan');
        log(`     VALUES ('${USER_ID}', false);`, 'cyan');
        log('  2. Verify trigger functions are working:', 'blue');
        log('     Check database/migrations for handle_new_user() function', 'cyan');
        log('  3. Test middleware again after creating record', 'blue');
    } else if (!orgsExists) {
        log('  1. Assign user to an organization:', 'blue');
        log('     INSERT INTO public.user_organizations (user_id, organization_id, role)', 'cyan');
        log(`     VALUES ('${USER_ID}', '<org-id>', 'member');`, 'cyan');
    } else {
        log('  1. Review RLS policies on user_types table', 'blue');
        log('  2. Check if middleware is using correct authentication context', 'blue');
        log('  3. Verify Supabase client configuration', 'blue');
    }
}

// Main execution
async function main() {
    log('\n' + '═'.repeat(60), 'bright');
    log('USER AUTHENTICATION ERROR DIAGNOSTIC TOOL', 'bright');
    log('═'.repeat(60) + '\n', 'bright');

    logResult('User ID', USER_ID, 'info');
    logResult('Supabase URL', SUPABASE_URL, 'info');
    log('');

    const results = {
        auth: await checkAuthUser(),
        types: await checkUserTypes(),
        orgs: await checkUserOrganizations(),
        rls: await checkRLSPolicies(),
        rlsEnabled: await checkRLSEnabledStatus(),
        orphaned: await checkOrphanedRecords()
    };

    await generateDiagnosisReport(results);

    logSection('DIAGNOSTIC COMPLETE');
    log('Results stored in memory for BLACKSMITH agent', 'green');
    log('\nNext steps:', 'bright');
    log('  1. Review diagnosis report above', 'blue');
    log('  2. Apply recommended fixes', 'blue');
    log('  3. Run this script again to verify', 'blue');
    log('  4. Test middleware authentication', 'blue');

    console.log('\n');
}

// Run diagnostics
main().catch(error => {
    log('\n✗ DIAGNOSTIC SCRIPT FAILED', 'red');
    console.error(error);
    process.exit(1);
});
