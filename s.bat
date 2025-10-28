@echo off
REM ============================================
REM FINAL COMPLETE RESTART - ALL BUGS FIXED
REM ============================================
REM
REM This script ensures Node loads the latest code
REM Run this after the final git commit: b31318b
REM
REM ============================================

echo.
echo ================================================
echo   FINAL RESTART - ALL BUGS FIXED
echo ================================================
echo.
echo Fixes applied:
echo   - Migration 008c (RLS recursion fixed)
echo   - Migration 009 (RPC functions deployed)
echo   - All supabaseService.sql calls removed
echo   - NULL UUID parameters fixed
echo   - Move up/down endpoints added
echo.
echo ================================================
echo.

echo STEP 1: Killing ALL Node.js processes...
taskkill /F /IM node.exe /T 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   ^> SUCCESS: Node processes killed
) else (
    echo   ^> No Node processes found
)
echo.

echo STEP 2: Waiting for cleanup (5 seconds)...
timeout /t 5 /nobreak >nul
echo   ^> Cleanup complete
echo.

echo STEP 3: Clearing any cached modules...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache 2>nul
    echo   ^> Module cache cleared
) else (
    echo   ^> No cache to clear
)
echo.

echo ================================================
echo   STARTING FRESH SERVER
echo ================================================
echo.
echo Expected behavior after restart:
echo   [OK] Global Admin sees all orgs (no recursion)
echo   [OK] Indent works (no UUID errors)
echo   [OK] Dedent works (no UUID errors)
echo   [OK] Move up/down works (no .sql errors)
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul
echo.
echo ================================================

npm start
