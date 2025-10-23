@echo off
REM Complete clean restart script for Windows
REM This kills Node, clears cache, and restarts fresh

echo ========================================
echo STEP 1: Killing all Node.js processes
echo ========================================
taskkill /F /IM node.exe /T 2>nul
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Node processes killed
) else (
    echo No Node processes found or already killed
)
echo.

echo ========================================
echo STEP 2: Waiting for processes to cleanup
echo ========================================
timeout /t 3 /nobreak >nul
echo Done waiting
echo.

echo ========================================
echo STEP 3: Clearing Node module cache
echo ========================================
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo Cache cleared
) else (
    echo No cache found
)
echo.

echo ========================================
echo STEP 4: Starting fresh server
echo ========================================
echo Starting npm...
npm start
