#!/usr/bin/env node
/**
 * Verification Script for All Three Fixes
 *
 * Checks:
 * 1. Only 1 organization created (session lock worked)
 * 2. User properly linked to organization (service role RLS bypass worked)
 * 3. User has owner role with can_manage_users permission
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFixes() {
    console.log('\n🔍 VERIFICATION REPORT\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Test 1: Check for duplicate/orphaned organizations
    console.log('📋 TEST 1: Session Lock (Duplicate Org Prevention)\n');

    const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (orgsError) {
        console.log('❌ Error fetching organizations:', orgsError.message);
    } else {
        console.log(`   Total recent orgs: ${orgs.length}`);

        // Group by name to find duplicates
        const nameGroups = {};
        orgs.forEach(org => {
            if (!nameGroups[org.name]) {
                nameGroups[org.name] = [];
            }
            nameGroups[org.name].push(org);
        });

        const duplicates = Object.entries(nameGroups).filter(([_, orgs]) => orgs.length > 1);

        if (duplicates.length > 0) {
            console.log('\n   ⚠️  DUPLICATES FOUND:');
            duplicates.forEach(([name, orgs]) => {
                console.log(`      "${name}" created ${orgs.length} times:`);
                orgs.forEach(org => {
                    console.log(`         - ${org.id} at ${org.created_at}`);
                });
            });
            console.log('\n   ❌ Session lock may not be working!\n');
        } else {
            console.log('   ✅ No duplicate organizations found!\n');
        }
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // Test 2: Check user_organizations links
    console.log('📋 TEST 2: Service Role RLS Bypass (User Link Success)\n');

    const { data: links, error: linksError } = await supabase
        .from('user_organizations')
        .select(`
            id,
            user_id,
            organization_id,
            role,
            is_active,
            organizations!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (linksError) {
        console.log('❌ Error fetching user_organizations:', linksError.message);
    } else {
        console.log(`   Total recent links: ${links.length}`);

        if (links.length === 0) {
            console.log('   ❌ No user_organizations links found!');
            console.log('      Service role RLS bypass may have failed.\n');
        } else {
            console.log('   ✅ User successfully linked to organizations!\n');
            links.forEach(link => {
                console.log(`      User ${link.user_id.substring(0, 8)}... → ${link.organizations.name}`);
                console.log(`         Role: ${link.role}, Active: ${link.is_active}\n`);
            });
        }
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // Test 3: Check owner permissions
    console.log('📋 TEST 3: Permission System (Owner Has can_manage_users)\n');

    const { data: ownerRole, error: roleError } = await supabase
        .from('organization_roles')
        .select('id, role_code, role_name, hierarchy_level, org_permissions')
        .eq('role_code', 'owner')
        .single();

    if (roleError) {
        console.log('❌ Error fetching owner role:', roleError.message);
    } else {
        const canManageUsers = ownerRole.org_permissions?.can_manage_users;
        console.log(`   Owner role: "${ownerRole.role_name}"`);
        console.log(`   Hierarchy level: ${ownerRole.hierarchy_level}`);
        console.log(`   can_manage_users: ${canManageUsers}`);

        if (canManageUsers === true) {
            console.log('\n   ✅ Owner has can_manage_users permission!\n');
        } else {
            console.log('\n   ❌ Owner missing can_manage_users permission!\n');
        }
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // Check RPC functions exist
    console.log('📋 BONUS: Verify RPC Functions Exist\n');

    const { data: functions, error: funcError } = await supabase
        .rpc('pg_get_functiondef', {
            funcid: 'user_has_org_permission'::regproc
        })
        .catch(() => ({ data: null, error: 'Function does not exist' }));

    if (functions) {
        console.log('   ✅ RPC function user_has_org_permission exists!\n');
    } else {
        console.log('   ❌ RPC function user_has_org_permission NOT FOUND!\n');
        console.log('      Run migration 006_fix_permission_functions.sql\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary
    console.log('📊 SUMMARY\n');
    console.log('   Expected Results After Fixes:');
    console.log('   ✅ Only 1 organization created per submission');
    console.log('   ✅ User_organizations link created without RLS errors');
    console.log('   ✅ Owner role has can_manage_users: true');
    console.log('   ✅ Owner can access /admin/users page\n');

    console.log('═══════════════════════════════════════════════════════════\n');
}

verifyFixes().catch(console.error);
