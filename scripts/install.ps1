$ErrorActionPreference = "Stop"
Write-Host "`n  Odrive Wheel Pit House - Installation`n" -ForegroundColor Cyan

Write-Host "  [1/3] Verification Node.js..." -ForegroundColor Cyan
try { $v = node --version; Write-Host "  OK Node.js $v" -ForegroundColor Green }
catch { Write-Host "  X Node.js non trouve - https://nodejs.org" -ForegroundColor Red; exit 1 }

Write-Host "`n  [2/3] npm install..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  X npm install echoue" -ForegroundColor Red; exit 1 }
Write-Host "  OK Dependances installees" -ForegroundColor Green

Write-Host "`n  [3/3] Rebuild serialport..." -ForegroundColor Cyan
npm run rebuild
if ($LASTEXITCODE -ne 0) { Write-Host "  ! rebuild echoue - npm install -g windows-build-tools" -ForegroundColor Yellow }

Write-Host "`n  OK Termine !" -ForegroundColor Green
Write-Host "  Dev:   npm run dev" -ForegroundColor Cyan
Write-Host "  Build: npm run build:win`n" -ForegroundColor Cyan
