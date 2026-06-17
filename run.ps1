# Setup and Run Script for Urban Co-creation (Windows)
# This script configures the local node_modules, creates a Python virtual environment, installs requirements, and runs both servers.

Write-Host "  Urban Co-creation Auto-Setup & Runner  " -ForegroundColor Cyan

# 1. Check & Install Frontend Dependencies (Node.js)
if (-not (Test-Path "node_modules")) {
    Write-Host "[1/3] Node.js dependencies (node_modules) not found. Installing..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: npm install failed." -ForegroundColor Red
        Exit $LASTEXITCODE
    }
}
else {
    Write-Host "[1/3] Node.js dependencies are already installed." -ForegroundColor Green
}

# 2. Check & Setup Python Virtual Environment (.venv)
if (-not (Test-Path ".venv")) {
    Write-Host "[2/3] Python virtual environment (.venv) not found. Creating..." -ForegroundColor Yellow
    # Try using 'py', fallback to 'python' if needed
    try {
        py -m venv .venv
    }
    catch {
        python -m venv .venv
    }
    
    if (-not (Test-Path ".venv")) {
        Write-Host "Error: Failed to create Python virtual environment. Please install Python." -ForegroundColor Red
        Exit 1
    }
    
    Write-Host "Virtual environment created. Installing backend/requirements.txt..." -ForegroundColor Yellow
    & .venv\Scripts\pip install -r backend/requirements.txt
}
else {
    Write-Host "[2/3] Python virtual environment (.venv) already exists." -ForegroundColor Green
    Write-Host "Ensuring requirements are up-to-date..." -ForegroundColor Yellow
    & .venv\Scripts\pip install -r backend/requirements.txt
}

# 3. Start Frontend & Backend Servers Concurrently
Write-Host "[3/3] Starting Frontend (Next.js) & Backend (FastAPI) servers..." -ForegroundColor Green
Write-Host "Press Ctrl+C in this terminal to stop both servers." -ForegroundColor Cyan
Write-Host "-----------------------------------------" -ForegroundColor Gray

# Run the concurrent dev script from npm
npm run dev:all
