#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=============================================="
echo "Building Rust Game Engine to WebAssembly (Mac/Linux)..."
echo "=============================================="

# 1. Navigate to the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# 2. Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "[ERROR] 'wasm-pack' is not installed. Please install it first."
    echo "Run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    echo "Or: npm install -g wasm-pack"
    exit 1
fi

# 3. Run wasm-pack build targeting the web
echo "Compiling crate using wasm-pack..."
wasm-pack build --target web --release

# 4. Copy build artifacts to public folder
PUBLIC_WASM_DIR="../public/wasm"
mkdir -p "$PUBLIC_WASM_DIR"

echo "Copying compiled WASM artifacts to public/wasm/..."
cp pkg/urban_cocreation.js "$PUBLIC_WASM_DIR/"
cp pkg/urban_cocreation_bg.wasm "$PUBLIC_WASM_DIR/"

echo ""
echo "=============================================="
echo "Build Succeeded! WASM artifacts are ready in public/wasm/."
echo "=============================================="
