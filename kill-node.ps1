# Kill all Node.js processes on Windows (PowerShell)
# Run this from project root: .\kill-node.ps1

Write-Host "Killing all Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Done! All Node processes killed." -ForegroundColor Green
Write-Host ""
Write-Host "Now restart with: npm start" -ForegroundColor Cyan
