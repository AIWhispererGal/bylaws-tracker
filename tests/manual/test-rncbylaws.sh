#!/bin/bash

# Manual Test Script for RNCBYLAWS_2024.docx
# Run this script to test the fixes manually

set -e  # Exit on error

echo "🧪 RNCBYLAWS_2024.docx Testing Script"
echo "======================================"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Server is not running on port 3000"
    echo "   Start the server with: npm start"
    exit 1
fi

echo "✓ Server is running"
echo ""

# Check if test document exists
TEST_DOC="/mnt/c/Users/mgall/OneDrive/Desktop/RNCBYLAWS_2024.docx"
if [ ! -f "$TEST_DOC" ]; then
    echo "❌ Test document not found: $TEST_DOC"
    exit 1
fi

echo "✓ Test document found"
echo "  Path: $TEST_DOC"
echo "  Size: $(ls -lh "$TEST_DOC" | awk '{print $5}')"
echo ""

# Run automated tests
echo "🚀 Running Automated Tests..."
echo "======================================"
echo ""

# Test 1: Context-aware parser
echo "📝 Test 1: Context-Aware Parser"
npm test -- tests/integration/context-aware-parser.test.js --verbose

echo ""
echo "======================================"
echo ""

# Test 2: Setup wizard schema
echo "📝 Test 2: Setup Wizard Schema"
npm test -- tests/integration/setup-wizard-schema.test.js --verbose

echo ""
echo "======================================"
echo ""

# Test 3: Full integration
echo "📝 Test 3: Full Integration"
npm test -- tests/integration/full-integration.test.js --verbose

echo ""
echo "======================================"
echo ""
echo "✅ All Automated Tests Complete!"
echo ""
echo "📋 Manual Testing Instructions:"
echo "======================================"
echo ""
echo "1. Open browser: http://localhost:3000"
echo ""
echo "2. Test Setup Wizard:"
echo "   - Create new organization"
echo "   - Set custom level names:"
echo "     * Level 1: 'Chapter' / 'Roman'"
echo "     * Level 2: 'Clause' / 'Letters'"
echo "   - Upload: $TEST_DOC"
echo "   - Should complete WITHOUT errors"
echo ""
echo "3. Test Admin Dashboard:"
echo "   - Login as admin"
echo "   - Upload document: $TEST_DOC"
echo "   - Should parse successfully"
echo "   - Check for 'depth jumped' errors (should be NONE)"
echo ""
echo "4. Verify in Database:"
echo "   - Check document_sections table"
echo "   - All depths should be 0-9"
echo "   - Custom names should appear in citations"
echo ""
echo "======================================"
echo ""
