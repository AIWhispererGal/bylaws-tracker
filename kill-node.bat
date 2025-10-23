@echo off
REM Kill all Node.js processes on Windows
REM Run this from project root: kill-node.bat

echo Killing all Node.js processes...
taskkill /F /IM node.exe /T
echo.
echo Done! All Node processes killed.
echo.
echo Now restart with: npm start
pause
