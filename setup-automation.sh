#!/bin/bash

echo "🤖 AI Automation Setup Wizard"
echo "==============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI not found.${NC}"
    echo "Please install GitHub CLI: https://cli.github.com/"
    echo ""
    echo "Installation commands:"
    echo "  macOS: brew install gh"
    echo "  Ubuntu: sudo apt install gh"  
    echo "  Windows: winget install GitHub.cli"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository.${NC}"
    echo "Please run this script from your repository root directory."
    exit 1
fi

echo -e "${BLUE}📋 Setting up AI automation for your repository...${NC}"
echo ""

# Get repository info
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)
echo -e "${BLUE}Repository:${NC} $REPO_OWNER/$REPO_NAME"
echo ""

# Set up secrets
echo -e "${YELLOW}🔑 Setting up repository secrets...${NC}"
echo ""

# Anthropic API Key
echo "Enter your Anthropic API key (sk-ant-...):"
echo -n "ANTHROPIC_API_KEY: "
read -s ANTHROPIC_KEY
echo ""
if [[ -n "$ANTHROPIC_KEY" ]]; then
    gh secret set ANTHROPIC_API_KEY --body "$ANTHROPIC_KEY"
    echo -e "${GREEN}✅ ANTHROPIC_API_KEY set${NC}"
else
    echo -e "${RED}❌ ANTHROPIC_API_KEY cannot be empty${NC}"
    exit 1
fi

echo ""

# GitHub Personal Access Token
echo "Enter your GitHub Personal Access Token (ghp_...):"
echo "Required permissions: Contents(write), Issues(write), Pull requests(write), Actions(read)"
echo -n "AI_DEV_TOKEN: "
read -s GITHUB_TOKEN
echo ""
if [[ -n "$GITHUB_TOKEN" ]]; then
    gh secret set AI_DEV_TOKEN --body "$GITHUB_TOKEN"
    echo -e "${GREEN}✅ AI_DEV_TOKEN set${NC}"
else
    echo -e "${RED}❌ AI_DEV_TOKEN cannot be empty${NC}"
    exit 1
fi

echo ""

# AWS credentials for Bedrock
echo "Enter your AWS Access Key ID:"
echo -n "AWS_ACCESS_KEY_ID: "
read -s AWS_KEY_ID
echo ""
if [[ -n "$AWS_KEY_ID" ]]; then
    gh secret set AWS_ACCESS_KEY_ID --body "$AWS_KEY_ID"
    echo -e "${GREEN}✅ AWS_ACCESS_KEY_ID set${NC}"
else
    echo -e "${RED}❌ AWS_ACCESS_KEY_ID cannot be empty${NC}"
    exit 1
fi

echo ""

echo "Enter your AWS Secret Access Key:"
echo -n "AWS_SECRET_ACCESS_KEY: "
read -s AWS_SECRET_KEY
echo ""
if [[ -n "$AWS_SECRET_KEY" ]]; then
    gh secret set AWS_SECRET_ACCESS_KEY --body "$AWS_SECRET_KEY"
    echo -e "${GREEN}✅ AWS_SECRET_ACCESS_KEY set${NC}"
else
    echo -e "${RED}❌ AWS_SECRET_ACCESS_KEY cannot be empty${NC}"
    exit 1
fi

echo ""

# Set up repository variables
echo -e "${YELLOW}⚙️ Setting up repository variables...${NC}"

# Required variables
gh variable set ANTHROPIC_MODEL --body "us.anthropic.claude-sonnet-4-20250514-v1:0"
echo -e "${GREEN}✅ ANTHROPIC_MODEL set${NC}"

gh variable set AI_DEV_ENABLED --body "true"
echo -e "${GREEN}✅ AI_DEV_ENABLED set${NC}"

gh variable set CLAUDE_CODE_USE_BEDROCK --body "1"
echo -e "${GREEN}✅ CLAUDE_CODE_USE_BEDROCK set${NC}"

gh variable set AWS_REGION --body "us-east-1"
echo -e "${GREEN}✅ AWS_REGION set${NC}"

gh variable set MCP_LOG_LEVEL --body "error"
echo -e "${GREEN}✅ MCP_LOG_LEVEL set${NC}"

echo ""

# Optional: Bedrock configuration
echo -e "${YELLOW}🔧 Optional: Bedrock Configuration${NC}"
echo "Do you want to configure a custom Bedrock endpoint? (y/N):"
read -n 1 -r BEDROCK_CONFIG
echo ""

if [[ $BEDROCK_CONFIG =~ ^[Yy]$ ]]; then
    echo "Enter your Bedrock proxy endpoint URL:"
    echo -n "ANTHROPIC_BASE_URL: "
    read BEDROCK_URL
    if [[ -n "$BEDROCK_URL" ]]; then
        gh variable set ANTHROPIC_BASE_URL --body "$BEDROCK_URL"
        echo -e "${GREEN}✅ ANTHROPIC_BASE_URL set${NC}"
    fi
fi

echo ""

# Validation
echo -e "${BLUE}🔍 Validating configuration...${NC}"

# Check if secrets exist (we can't read them, but we can check if they're set)
SECRET_CHECK=$(gh secret list --json name -q '.[] | select(.name=="ANTHROPIC_API_KEY") | .name')
if [[ "$SECRET_CHECK" == "ANTHROPIC_API_KEY" ]]; then
    echo -e "${GREEN}✅ ANTHROPIC_API_KEY configured${NC}"
else
    echo -e "${RED}❌ ANTHROPIC_API_KEY not found${NC}"
fi

TOKEN_CHECK=$(gh secret list --json name -q '.[] | select(.name=="AI_DEV_TOKEN") | .name')
if [[ "$TOKEN_CHECK" == "AI_DEV_TOKEN" ]]; then
    echo -e "${GREEN}✅ AI_DEV_TOKEN configured${NC}"
else
    echo -e "${RED}❌ AI_DEV_TOKEN not found${NC}"
fi

AWS_KEY_CHECK=$(gh secret list --json name -q '.[] | select(.name=="AWS_ACCESS_KEY_ID") | .name')
if [[ "$AWS_KEY_CHECK" == "AWS_ACCESS_KEY_ID" ]]; then
    echo -e "${GREEN}✅ AWS_ACCESS_KEY_ID configured${NC}"
else
    echo -e "${RED}❌ AWS_ACCESS_KEY_ID not found${NC}"
fi

AWS_SECRET_CHECK=$(gh secret list --json name -q '.[] | select(.name=="AWS_SECRET_ACCESS_KEY") | .name')
if [[ "$AWS_SECRET_CHECK" == "AWS_SECRET_ACCESS_KEY" ]]; then
    echo -e "${GREEN}✅ AWS_SECRET_ACCESS_KEY configured${NC}"
else
    echo -e "${RED}❌ AWS_SECRET_ACCESS_KEY not found${NC}"
fi

# Check variables
ENABLED_CHECK=$(gh variable list --json name,value -q '.[] | select(.name=="AI_DEV_ENABLED") | .value')
if [[ "$ENABLED_CHECK" == "true" ]]; then
    echo -e "${GREEN}✅ AI_DEV_ENABLED configured${NC}"
else
    echo -e "${RED}❌ AI_DEV_ENABLED not configured properly${NC}"
fi

echo ""

# Configure host runner environment
echo -e "${YELLOW}🏃‍♂️ Configuring host runner environment...${NC}"

# Check if we're on a self-hosted runner (usually has specific environment indicators)
if [[ -n "$RUNNER_NAME" ]] || [[ -n "$GITHUB_ACTIONS" ]] || [[ "$USER" == "runner" ]] || [[ -d "/home/runner" ]]; then
    echo "Self-hosted runner environment detected"
    
    # Add environment variables to ~/.profile if not already present
    PROFILE_FILE="$HOME/.profile"
    
    # Create .profile if it doesn't exist
    if [[ ! -f "$PROFILE_FILE" ]]; then
        touch "$PROFILE_FILE"
        echo "Created $PROFILE_FILE"
    fi
    
    # Check if CLAUDE_CODE_USE_BEDROCK is already configured
    if ! grep -q "CLAUDE_CODE_USE_BEDROCK" "$PROFILE_FILE"; then
        echo "" >> "$PROFILE_FILE"
        echo "# AI Automation Environment Variables" >> "$PROFILE_FILE"
        echo "export CLAUDE_CODE_USE_BEDROCK=1" >> "$PROFILE_FILE"
        echo "declare -r CLAUDE_CODE_USE_BEDROCK=1" >> "$PROFILE_FILE"
        echo -e "${GREEN}✅ Added CLAUDE_CODE_USE_BEDROCK to ~/.profile${NC}"
        
        # Also export for current session
        export CLAUDE_CODE_USE_BEDROCK=1
        echo -e "${GREEN}✅ Environment variable set for current session${NC}"
    else
        echo -e "${BLUE}ℹ️  CLAUDE_CODE_USE_BEDROCK already configured in ~/.profile${NC}"
    fi
    
    # Source the profile to make changes effective
    if [[ -f "$PROFILE_FILE" ]]; then
        source "$PROFILE_FILE" 2>/dev/null || true
        echo -e "${GREEN}✅ Sourced ~/.profile${NC}"
    fi
    
    echo -e "${YELLOW}⚠️  Note: You may need to restart your runner service for changes to take full effect${NC}"
else
    echo -e "${BLUE}ℹ️  Not running on a self-hosted runner - skipping host environment configuration${NC}"
    echo -e "${BLUE}ℹ️  If you're setting up a self-hosted runner, manually add to ~/.profile:${NC}"
    echo "    export CLAUDE_CODE_USE_BEDROCK=1"
    echo "    declare -r CLAUDE_CODE_USE_BEDROCK=1"
fi

echo ""

# Final instructions
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Create a test issue with the 'claude-task' label"
echo "2. Add some description like: 'Please help me understand this repository'"
echo "3. Watch the Actions tab for workflow execution"
echo "4. Review SETUP.md for troubleshooting if needed"
echo ""

echo -e "${BLUE}Useful commands:${NC}"
echo "  Create labels: gh label create 'claude-task' --description 'Trigger AI automation' --color '1f77b4'"
echo "  Test issue:   gh issue create --title 'Test AI Automation' --body 'Please analyze this repository' --label 'claude-task'"
echo "  View logs:    gh run list"
echo "  Check config: gh secret list && gh variable list"
echo ""

echo -e "${YELLOW}⚠️  Important:${NC}"
echo "- Review and customize CLAUDE.md for your project"
echo "- Consider setting up a self-hosted runner for optimal performance"
echo "- Check the SETUP.md file for advanced configuration options"
echo ""

echo -e "${GREEN}Happy automating! 🚀${NC}"