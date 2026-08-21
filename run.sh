#!/bin/bash

# Exit on any error
set -e

PORT=3000

echo "========================================="
echo "Starting Slack Help Bot Setup"
echo "========================================="

# 1) Load environment variables
echo "📁 Loading environment variables from .env..."
if [ -f .env ]; then
    set -o allexport
    source .env
    set +o allexport
    echo "✅ Environment variables loaded"
else
    echo "⚠️  .env file not found! Please create one."
    exit 1
fi

# 2) Load nvm
echo "🔧 Loading nvm..."
export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    echo "✅ nvm loaded"
else
    echo "❌ nvm not found at $NVM_DIR"
    echo "   Please install nvm"
    exit 1
fi

# 3) Use the repo's Node version
echo "🔧 Setting up Node version..."
nvm install
nvm use
echo "✅ Node version set"

# 4) Login to Azure
echo "☁️  Logging into Azure..."
if command -v az &> /dev/null; then
    az account show &> /dev/null || az login
    echo "✅ Azure logged in"
else
    echo "⚠️  Azure CLI not found! Skipping Azure login."
fi

# 5) Free port 3000 if already in use
echo "🔍 Checking port $PORT..."

PID=$(lsof -ti :$PORT 2>/dev/null || true)

if [ -n "$PID" ]; then
    echo "⚠️  Port $PORT is already in use."
    echo "🛑 Stopping process: $PID"
    kill $PID 2>/dev/null || true

    # Give the process a moment to exit
    sleep 1

    # Force kill if still running
    if lsof -ti :$PORT >/dev/null 2>&1; then
        echo "⚠️  Process did not stop gracefully. Force killing..."
        kill -9 $(lsof -ti :$PORT) 2>/dev/null || true
    fi

    echo "✅ Port $PORT is now available"
else
    echo "✅ Port $PORT is available"
fi

# 6) Install dependencies
echo "📦 Installing dependencies..."
npm install

# 7) Start application
echo "🚀 Starting the application..."

npm start