#!/bin/bash
# Quick Fix Script for Setup Wizard
# Fixes the AJAX/Redirect mismatch in 4 POST routes

echo "🔧 Applying Setup Wizard Fixes..."
echo ""

# Backup original file
if [ ! -f "src/routes/setup.js.backup" ]; then
    echo "📦 Creating backup: src/routes/setup.js.backup"
    cp src/routes/setup.js src/routes/setup.js.backup
else
    echo "⚠️  Backup already exists, skipping..."
fi

echo ""
echo "✏️  Applying fixes..."

# Fix #1: Organization POST (line ~104)
sed -i "s|res\.redirect('/setup/document-type');|res.json({ success: true, redirectUrl: '/setup/document-type' });|g" src/routes/setup.js

# Fix #2: Document-Type POST (line ~155)  
sed -i "s|res\.redirect('/setup/workflow');|res.json({ success: true, redirectUrl: '/setup/workflow' });|g" src/routes/setup.js

# Fix #3: Workflow POST (line ~215)
sed -i "s|res\.redirect('/setup/import');|res.json({ success: true, redirectUrl: '/setup/import' });|g" src/routes/setup.js

# Fix #4: Import POST (line ~295)
sed -i "s|res\.redirect('/setup/processing');|res.json({ success: true, redirectUrl: '/setup/processing' });|g" src/routes/setup.js

echo "✅ All fixes applied!"
echo ""
echo "📋 Summary:"
echo "   - Organization form: res.redirect → res.json ✓"
echo "   - Document-type form: res.redirect → res.json ✓"
echo "   - Workflow form: res.redirect → res.json ✓"
echo "   - Import form: res.redirect → res.json ✓"
echo ""
echo "🚀 Next steps:"
echo "   1. Restart server: npm start"
echo "   2. Test wizard: http://172.31.239.231:3000/setup"
echo "   3. Check browser console for errors"
echo "   4. Verify database record creation"
echo ""
echo "💾 Backup saved to: src/routes/setup.js.backup"
