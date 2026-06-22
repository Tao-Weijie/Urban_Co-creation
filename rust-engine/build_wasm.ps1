# PowerShell script to compile Rust game engine to WebAssembly and copy output to Next.js public directory

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Building Rust Game Engine to WebAssembly..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. The cargo project directory is where this script resides
$WasmGameDir = $PSScriptRoot
Push-Location $WasmGameDir

# 2. Check if wasm-pack is installed
if (-not (Get-Command "wasm-pack" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] 'wasm-pack' is not installed. Please install it first:" -ForegroundColor Red
    Write-Host "Run: cargo install wasm-pack" -ForegroundColor Yellow
    Pop-Location
    Exit 1
}

# 3. Run wasm-pack build targeting the web
Write-Host "Compiling crate using wasm-pack..." -ForegroundColor Yellow
wasm-pack build --target web --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] wasm-pack build failed." -ForegroundColor Red
    Pop-Location
    Exit 1
}

# 4. Copy build artifacts to public folder (located in the project root's public/wasm)
$PublicWasmDir = Join-Path $PSScriptRoot "../public/wasm"
if (-not (Test-Path $PublicWasmDir)) {
    New-Item -ItemType Directory -Path $PublicWasmDir -Force | Out-Null
}

Write-Host "Copying compiled WASM artifacts to public/wasm/..." -ForegroundColor Yellow
Copy-Item -Path "pkg/urban_cocreation.js" -Destination $PublicWasmDir -Force
Copy-Item -Path "pkg/urban_cocreation_bg.wasm" -Destination $PublicWasmDir -Force

Pop-Location

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Build Succeeded! WASM artifacts are ready in public/wasm/." -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
