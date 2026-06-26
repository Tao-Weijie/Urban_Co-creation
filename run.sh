#!/bin/bash
# Setup and Run Script for Urban Co-creation (macOS/Linux)

echo -e "\033[0;36m  Urban Co-creation Auto-Setup & Runner  \033[0m"

# 1. Check & Install Frontend Dependencies (Node.js)
if [ ! -d "node_modules" ]; then
    echo -e "\033[0;33m[1/2] Node.js dependencies (node_modules) not found. Installing...\033[0m"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mError: npm install failed.\033[0m"
        exit 1
    fi
else
    echo -e "\033[0;32m[1/2] Node.js dependencies are already installed.\033[0m"
fi

# 2. Start Frontend Server (Next.js)
echo -e "\033[0;32m[2/2] Starting Frontend (Next.js) server...\033[0m"
echo -e "\033[0;36mPress Ctrl+C in this terminal to stop the server.\033[0m"
echo -e "\033[0;37m-----------------------------------------\033[0m"

npm run dev
