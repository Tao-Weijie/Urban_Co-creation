# Setup and Run Script for Urban Co-creation (Windows)
# This script configures the local node_modules and runs the frontend server.

Write-Host "  Urban Co-creation Auto-Setup & Runner  " -ForegroundColor Cyan

# 1. Check & Install Frontend Dependencies (Node.js)
if (-not (Test-Path "node_modules")) {
    Write-Host "[1/2] Node.js dependencies (node_modules) not found. Installing..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: npm install failed." -ForegroundColor Red
        Exit $LASTEXITCODE
    }
}
else {
    Write-Host "[1/2] Node.js dependencies are already installed." -ForegroundColor Green
}

# 2. Start Frontend Server (Next.js)
Write-Host "[2/2] Starting Frontend (Next.js) server..." -ForegroundColor Green
Write-Host "Press Ctrl+C in this terminal to stop the server." -ForegroundColor Cyan
Write-Host "-----------------------------------------" -ForegroundColor Gray

# Run the dev script from npm
npm run dev
