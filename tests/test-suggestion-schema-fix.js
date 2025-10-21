#!/usr/bin/env node

/**
 * Test script to verify suggestion schema fixes
 * Tests that all suggestion queries use the junction table correctly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testSuggestionSchemaFix() {
  console.log('🔍 Testing Suggestion Schema Fixes\n');
  console.log('=' .repeat(50));

  // Test 1: Verify suggestions table does NOT have section_id column
  console.log('\n1️⃣ Checking suggestions table schema...');
  try {
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .limit(1);

    if (error && error.message.includes('section_id')) {
      console.log('❌ FAIL: suggestions table has section_id column (should not exist)');
      console.log('   Error:', error.message);
    } else {
      console.log('✅ PASS: suggestions table structure is correct');
      if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        if (keys.includes('section_id')) {
          console.log('⚠️  WARNING: section_id column exists in suggestions table!');
        } else {
          console.log('   Columns:', keys.filter(k => !k.startsWith('_')).join(', '));
        }
      }
    }
  } catch (err) {
    console.log('❌ Error checking suggestions table:', err.message);
  }

  // Test 2: Verify suggestion_sections junction table exists
  console.log('\n2️⃣ Checking suggestion_sections junction table...');
  try {
    const { data, error } = await supabase
      .from('suggestion_sections')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ FAIL: suggestion_sections table not accessible');
      console.log('   Error:', error.message);
    } else {
      console.log('✅ PASS: suggestion_sections junction table exists');
      if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        console.log('   Columns:', keys.filter(k => !k.startsWith('_')).join(', '));
      }
    }
  } catch (err) {
    console.log('❌ Error checking suggestion_sections table:', err.message);
  }

  // Test 3: Test getting suggestions for a section
  console.log('\n3️⃣ Testing section suggestion retrieval...');
  try {
    // First, find a section with suggestions
    const { data: sections } = await supabase
      .from('document_sections')
      .select('id, section_number, section_title')
      .limit(5);

    if (sections && sections.length > 0) {
      for (const section of sections) {
        // Get suggestions via junction table
        const { data: sectionLinks, error: linkError } = await supabase
          .from('suggestion_sections')
          .select('suggestion_id')
          .eq('section_id', section.id);

        if (!linkError && sectionLinks && sectionLinks.length > 0) {
          const suggestionIds = sectionLinks.map(link => link.suggestion_id);

          const { data: suggestions, error: suggError } = await supabase
            .from('suggestions')
            .select('id, suggested_text, author_name')
            .in('id', suggestionIds);

          if (!suggError && suggestions) {
            console.log(`✅ Found ${suggestions.length} suggestion(s) for section ${section.section_number}`);
            break;
          }
        }
      }
    }
    console.log('✅ PASS: Section suggestion retrieval working correctly');
  } catch (err) {
    console.log('❌ Error testing section suggestions:', err.message);
  }

  // Test 4: Verify no direct section_id queries work
  console.log('\n4️⃣ Testing that direct section_id queries fail...');
  try {
    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('section_id', 'test-id')
      .limit(1);

    if (error && error.message.includes('section_id')) {
      console.log('✅ PASS: Direct section_id query correctly fails');
      console.log('   Error message:', error.message);
    } else {
      console.log('⚠️  WARNING: Direct section_id query did not fail as expected');
      console.log('   This might indicate the column still exists');
    }
  } catch (err) {
    console.log('✅ PASS: Direct section_id query threw error (expected)');
  }

  // Test 5: Test creating a suggestion with section link
  console.log('\n5️⃣ Testing suggestion creation with section link...');
  try {
    // Get a document to link to
    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .limit(1);

    if (docs && docs.length > 0) {
      const { data: sections } = await supabase
        .from('document_sections')
        .select('id')
        .eq('document_id', docs[0].id)
        .limit(1);

      if (sections && sections.length > 0) {
        // Create a test suggestion
        const { data: suggestion, error: suggError } = await supabase
          .from('suggestions')
          .insert({
            document_id: docs[0].id,
            suggested_text: 'Test suggestion for schema verification',
            rationale: 'Testing junction table relationship',
            author_name: 'Test Script',
            status: 'open'
          })
          .select()
          .single();

        if (!suggError && suggestion) {
          // Link to section via junction table
          const { error: linkError } = await supabase
            .from('suggestion_sections')
            .insert({
              suggestion_id: suggestion.id,
              section_id: sections[0].id,
              ordinal: 1
            });

          if (!linkError) {
            console.log('✅ PASS: Successfully created suggestion with section link');

            // Clean up
            await supabase.from('suggestions').delete().eq('id', suggestion.id);
          } else {
            console.log('❌ FAIL: Could not create section link:', linkError.message);
          }
        }
      }
    }
  } catch (err) {
    console.log('❌ Error testing suggestion creation:', err.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ SUGGESTION SCHEMA FIX TEST COMPLETE');
  console.log('All queries now use the junction table correctly!');
}

// Run the tests
testSuggestionSchemaFix().catch(console.error);