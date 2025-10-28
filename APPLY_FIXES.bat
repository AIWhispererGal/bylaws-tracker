@echo off
echo ========================================
echo APPLYING FIXES - October 27, 2025
echo ========================================
echo.
echo TWO FIXES APPLIED:
echo.
echo 1. Global Admin Section Permissions
echo    - File: views/dashboard/document-viewer.ejs
echo    - Fixed: Line 673 permission check
echo    - Result: Global admins can now see edit buttons
echo.
echo 2. Depth Storage Trigger
echo    - File: database/migrations/025_fix_depth_trigger.sql
echo    - Fix: Preserve parser's depth value
echo    - Action: YOU NEED TO APPLY THIS MANUALLY!
echo.
echo ========================================
echo NEXT STEPS:
echo ========================================
echo.
echo 1. Apply migration 025 in Supabase SQL Editor
echo    See: database/migrations/APPLY_025_FIX_DEPTH.md
echo.
echo 2. Restart server: npm start
echo.
echo 3. Re-upload a document (old ones have depth=0)
echo.
echo 4. Test section operations:
echo    - indent/dedent
echo    - up/down
echo    - split/join
echo.
echo 5. Verify depth is recorded correctly:
echo    Check document_sections table for varying depth values
echo.
echo ========================================
pause
