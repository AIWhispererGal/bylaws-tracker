#!/usr/bin/env node
/**
 * Database Detective: Ordinal Value Diagnostic Tool
 * Investigates whether ordinals are correctly assigned in the database
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseOrdinals() {
  console.log('🔍 DATABASE DETECTIVE: Ordinal Value Investigation\n');
  console.log('=' .repeat(70));

  try {
    // Step 1: Find most recent document
    console.log('\n📄 Step 1: Finding most recent document...');
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (docError) throw docError;
    if (!docs || docs.length === 0) {
      console.log('❌ No documents found in database');
      return;
    }

    const doc = docs[0];
    console.log(`✓ Found: "${doc.title}"`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Created: ${doc.created_at}`);

    // Step 2: Get sections and check ordinal values
    console.log('\n📊 Step 2: Checking ordinal values...');
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, section_number, section_title, ordinal, depth, path_ordinals, parent_section_id')
      .eq('document_id', doc.id)
      .order('ordinal', { ascending: true })
      .limit(30);

    if (sectionsError) throw sectionsError;

    console.log(`\nFirst 30 sections (ordered by 'ordinal' field):`);
    console.log('-'.repeat(70));
    console.log('Ord | Depth | Section Number | Title');
    console.log('-'.repeat(70));

    sections.forEach((s, idx) => {
      const num = (s.section_number || 'N/A').padEnd(15);
      const title = (s.section_title || '(Untitled)').substring(0, 30);
      console.log(`${String(s.ordinal).padStart(3)} | ${s.depth}     | ${num} | ${title}`);
    });

    // Step 3: Check for duplicates
    console.log('\n🔎 Step 3: Checking for duplicate ordinals...');
    const ordinals = sections.map(s => s.ordinal);
    const uniqueOrdinals = new Set(ordinals);

    if (ordinals.length === uniqueOrdinals.size) {
      console.log('✓ No duplicate ordinals detected');
    } else {
      console.log('⚠️  DUPLICATE ORDINALS FOUND!');
      const duplicates = ordinals.filter((val, idx) => ordinals.indexOf(val) !== idx);
      console.log('   Duplicates:', [...new Set(duplicates)]);
    }

    // Step 4: Check if ordinals are sequential
    console.log('\n📈 Step 4: Checking if ordinals are sequential...');
    const expectedOrdinals = Array.from({ length: sections.length }, (_, i) => i + 1);
    const actualOrdinals = sections.map(s => s.ordinal).slice(0, sections.length);

    const isSequential = JSON.stringify(expectedOrdinals) === JSON.stringify(actualOrdinals);

    if (isSequential) {
      console.log('✓ Ordinals are sequential (1, 2, 3, ...)');
    } else {
      console.log('❌ Ordinals are NOT sequential!');
      console.log('   Expected:', expectedOrdinals.slice(0, 10), '...');
      console.log('   Actual:  ', actualOrdinals.slice(0, 10), '...');
    }

    // Step 5: Check path_ordinals integrity
    console.log('\n🔗 Step 5: Checking path_ordinals integrity...');
    let pathIssues = 0;
    sections.forEach(s => {
      const expectedLength = s.depth + 1;
      const actualLength = s.path_ordinals ? s.path_ordinals.length : 0;

      if (actualLength !== expectedLength) {
        pathIssues++;
        if (pathIssues <= 3) { // Only show first 3
          console.log(`⚠️  Section "${s.section_number}": path_ordinals length is ${actualLength}, expected ${expectedLength}`);
        }
      }
    });

    if (pathIssues === 0) {
      console.log('✓ All path_ordinals have correct length');
    } else {
      console.log(`❌ Found ${pathIssues} sections with incorrect path_ordinals`);
    }

    // Step 6: ROOT CAUSE ANALYSIS
    console.log('\n' + '='.repeat(70));
    console.log('🎯 ROOT CAUSE ANALYSIS');
    console.log('='.repeat(70));

    // Check where ordinals are assigned in the parser
    console.log('\n📝 Parser Analysis:');
    console.log('   The parsers (wordParser.js, textParser.js) assign:');
    console.log('   ordinal: index + 1  (line 663 in wordParser, 623 in textParser)');
    console.log('   This means parsers create sequential ordinals: 1, 2, 3...');

    console.log('\n📝 Storage Analysis (sectionStorage.js):');
    console.log('   Line 31: ordinal: section.ordinal');
    console.log('   Line 148: ordinal: ordinal (recalculated from siblings)');
    console.log('   ⚠️  PROBLEM FOUND: sectionStorage.js RECALCULATES ordinals!');

    console.log('\n🔍 The Smoking Gun:');
    console.log('   sectionStorage.js buildHierarchy() method recalculates ordinals');
    console.log('   based on siblings at each depth level (lines 124-140).');
    console.log('   This OVERWRITES the sequential parser ordinals!');

    console.log('\n💡 Expected Behavior:');
    console.log('   Parser assigns: ordinal = index + 1 (sequential)');
    console.log('   Database should have: 1, 2, 3, 4, 5...');

    console.log('\n🐛 Actual Behavior:');
    console.log('   sectionStorage recalculates ordinals based on sibling position');
    console.log('   This creates: Article I (ordinal=1), Section 1 (ordinal=1),');
    console.log('                 Section 2 (ordinal=2), Article II (ordinal=2)');
    console.log('   Result: Multiple sections get same ordinal!');

    console.log('\n✅ Solution:');
    console.log('   Option 1: Remove ordinal recalculation in sectionStorage.js');
    console.log('   Option 2: Query should use path_ordinals instead of ordinal');
    console.log('   Option 3: Add global_ordinal field for document-wide sequence');

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

diagnoseOrdinals();
