#!/bin/bash

# Exit on any error
set -e

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

# 2) Load nvm (critical fix)
echo "🔧 Loading nvm..."
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
    echo "✅ nvm loaded"
else
    echo "❌ nvm not found at $NVM_DIR"
    echo "   Please install nvm: https://github.com/nvm-sh/nvm"
    exit 1
fi

# 3) Use the repo's Node version
echo "🔧 Setting up Node version..."
nvm install
nvm use
echo "✅ Node version set"

# 4) (Optional) Login to Azure for AI features
echo "☁️  Logging into Azure..."
if command -v az &> /dev/null; then
    az account show &> /dev/null || az login
    echo "✅ Azure logged in"
else
    echo "⚠️  Azure CLI not found! Skipping Azure login."
    echo "   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli"
fi

# 5) Install dependencies & start
echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting the application..."
npm start

echo "========================================="
echo "✅ Application is running"
echo "========================================="