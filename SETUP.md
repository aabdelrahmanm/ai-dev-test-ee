# 🛠️ AI Automation Setup Guide

Complete setup instructions for enabling AI-powered development automation in your repository.

## 📋 Prerequisites

### Required Services & Access
- GitHub repository with Actions enabled
- Anthropic Claude API key
- GitHub Personal Access Token
- Basic knowledge of GitHub Actions

### System Dependencies (Self-Hosted Runner)
- **Docker** - Required for containerized AI agents
- **GitHub CLI (gh)** - Required for repository operations and automation
- **Python 3** - Required for prompt processing and workflow scripts
- **Node.js & npm** - Required for MCP agent management and orchestration
- **Claude Code CLI** - Required for AI automation (`@anthropic-ai/claude-code`)
- **inotify-tools** - Required for agent state monitoring (Ubuntu/Debian)

## 🔑 Required Secrets & Variables

### Repository Secrets
Navigate to: **Settings → Secrets and variables → Actions → Repository secrets**

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Claude API key | `sk-ant-api03-...` |
| `AI_DEV_TOKEN` | GitHub PAT with enhanced permissions | `ghp_...` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key ID for Bedrock integration | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Access Key for Bedrock integration | `your-aws-secret-key` |

### Repository Variables  
Navigate to: **Settings → Secrets and variables → Actions → Repository variables**

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `ANTHROPIC_MODEL` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Claude model to use |
| `ANTHROPIC_BASE_URL` | Your Bedrock proxy endpoint | Custom endpoint (if using Bedrock) |
| `CLAUDE_CODE_USE_BEDROCK` | `1` | Enable Bedrock integration |
| `AWS_REGION` | `us-east-1` | AWS region for Bedrock |
| `AI_DEV_ENABLED` | `true` | Master switch for AI automation |
| `MCP_LOG_LEVEL` | `error` | Logging level for MCP servers |

## 🚀 Quick Setup Methods

### Method 1: Interactive Setup Script

```bash
chmod +x setup-automation.sh
./setup-automation.sh
```

### Method 2: GitHub CLI Commands

```bash
# Set secrets
gh secret set ANTHROPIC_API_KEY
gh secret set AI_DEV_TOKEN
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY

# Set variables
gh variable set ANTHROPIC_MODEL --body "us.anthropic.claude-sonnet-4-20250514-v1:0"
gh variable set AI_DEV_ENABLED --body "true"
gh variable set CLAUDE_CODE_USE_BEDROCK --body "1"
gh variable set AWS_REGION --body "us-east-1"
gh variable set MCP_LOG_LEVEL --body "error"
```

### Method 3: Manual Web Interface

1. Go to your repository **Settings**
2. Navigate to **Secrets and variables → Actions**
3. Add each secret and variable from the tables above

## 🔧 GitHub Personal Access Token Setup

Your `AI_DEV_TOKEN` needs comprehensive permissions for full AI automation functionality:

### Required Repository Permissions (16 permissions):

| Permission | Access Level | Purpose |
|------------|-------------|---------|
| **Actions** | Read and write | Workflow management and execution |
| **Variables** | Read and write | Repository variables configuration |
| **Contents** | Read and write | File operations and repository content |
| **Deployments** | Read and write | Deployment management |
| **Discussions** | Read and write | Repository discussions management |
| **Environments** | Read and write | Environment configuration |
| **Issues** | Read and write | Issue creation, labeling, and management |
| **Merge queues** | Read and write | Merge queue operations |
| **Metadata** | Read-only | Repository metadata access |
| **Pull requests** | Read and write | PR creation, review, and management |
| **Repository security advisories** | Read and write | Security advisory management |
| **Custom properties** | Read and write | Custom repository properties |
| **Webhooks** | Read and write | Webhook configuration |
| **Secrets** | Read and write | Repository secrets management |
| **Commit statuses** | Read and write | Commit status updates |
| **Workflows** | Read and write | GitHub Actions workflow management |

### PAT Token Creation Steps:

1. **Go to**: https://github.com/settings/tokens/new
2. **Token name**: `AI-Dev-Automation-Token`
3. **Expiration**: Choose appropriate duration (recommend 90 days or longer)
4. **Select repository access**: 
   - Choose "Selected repositories" and select your AI automation repositories
   - OR choose "All repositories" if you plan to use across multiple repos
5. **Repository permissions**: Select all 16 permissions listed above
6. **Generate token** and copy it immediately (you won't see it again!)

### Account Permissions:
- ✅ **user:email** (read) - User identification for commit attribution

**⚠️ Important Notes:**
- Store the token securely - it provides extensive repository access
- The AI automation system requires these comprehensive permissions to function properly
- Consider using a dedicated service account for production deployments
- Regularly rotate tokens for security best practices

## 🏃‍♂️ Self-Hosted Runner Setup

### 1. System Dependencies Installation (Ubuntu/Debian)

```bash
# Update system packages
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Add runner user to docker group (replace with actual username)
sudo usermod -aG docker $USER

# Install GitHub CLI
sudo apt-get install -y gh

# Install Python 3 (usually pre-installed on Ubuntu)
sudo apt-get install -y python3 python3-pip

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install file monitoring tools
sudo apt-get install -y inotify-tools

# Install Claude Code CLI (required for AI automation)
npm install -g @anthropic-ai/claude-code

# Authenticate Claude Code CLI (REQUIRED - CLI won't work without this)
claude  # Run this command and follow the authentication prompts
# This will prompt you to enter your Anthropic API key and configure the CLI

# Verify installations
docker --version
gh --version
python3 --version
node --version
npm --version
claude --version
inotifywait --help

# Note: You may need to logout/login or restart for docker group changes to take effect
```

### 2. GitHub Runner Setup

1. **Set up self-hosted runner** in repository settings
2. **Monitoring tools and scripts are automatically installed** by the setup-check workflow:
   ```bash
   # These are automatically installed by setup-check.yml workflow:
   # - ~/.local/bin/agents-monitor script with timeout and cleanup logic
   # - ~/.local/bin added to PATH automatically
   # - Proper permissions and executable setup (no sudo required)
   ```

   **Note**: The workflow installs monitoring tools in user space (`~/.local/bin`) to avoid requiring sudo access. System-level tools like `inotify-tools` may need manual installation by a system administrator if not already available.

4. **Environment variables are automatically configured**:
   ```bash
   # These environment variables are automatically added to ~/.profile
   # by the setup-check.yml workflow - no manual configuration needed!
   export CLAUDE_CODE_USE_BEDROCK=1
   declare -r CLAUDE_CODE_USE_BEDROCK=1
   ```

   **Note**: The `setup-check.yml` workflow automatically configures the required environment variables in `~/.profile` when it runs on your self-hosted runner. No manual setup required!

5. **Authenticate Claude Code CLI** (CRITICAL STEP):
   ```bash
   # Run claude command to authenticate (this is REQUIRED)
   claude
   # Follow the prompts to enter your Anthropic API key
   # This configures the CLI for use in the AI automation workflows
   ```
   
   **⚠️ Important**: The Claude Code CLI must be authenticated on your self-hosted runner, otherwise the AI automation workflows will fail. Make sure to run the `claude` command and provide your API key during the setup process.
   
   **TODO**: This authentication step could potentially be automated in the `setup-check.yml` workflow in a future update to streamline the setup process.

## ✅ Testing Your Setup

### 1. Validate Configuration
The template includes `.github/workflows/setup-check.yml` which automatically:

- ✅ **Configures self-hosted runner environment** (adds CLAUDE_CODE_USE_BEDROCK to ~/.profile)
- ✅ **Validates all secrets and variables** are properly configured
- ✅ **Checks for required workflow files** and agent system components
- ✅ **Verifies agents-monitor tool** availability
- ✅ **Provides comprehensive setup status** and troubleshooting guidance

The workflow runs automatically on push/PR and can be triggered manually via workflow_dispatch.

### 2. Create Test Issue
1. Create new issue in your repository
2. Add label: `claude-task`
3. Write: "Please help me understand this repository structure"
4. Watch Actions tab for workflow execution

### 3. Monitor Workflow Logs
- Go to **Actions** tab
- Click on running workflow
- Check logs for successful Claude interaction

## 🔍 Troubleshooting

### Common Issues

**Issue**: Workflows not triggering
- ✅ Check `AI_DEV_ENABLED` is set to `true`
- ✅ Verify issue has `claude-task` label
- ✅ Ensure workflows are enabled in Actions settings

**Issue**: Claude API errors  
- ✅ Verify `ANTHROPIC_API_KEY` is valid
- ✅ Check API key has sufficient credits
- ✅ Confirm `ANTHROPIC_MODEL` is correct

**Issue**: GitHub API errors
- ✅ Verify `AI_DEV_TOKEN` permissions
- ✅ Check token hasn't expired
- ✅ Ensure repository access is granted

**Issue**: System Dependencies Missing
- ✅ **Docker not found**: Install Docker and add user to docker group
  ```bash
  sudo apt-get install docker.io
  sudo usermod -aG docker $USER
  sudo systemctl start docker
  ```
- ✅ **GitHub CLI not found**: Install GitHub CLI
  ```bash
  sudo apt-get install gh
  ```
- ✅ **Python 3 not found**: Install Python 3
  ```bash
  sudo apt-get install python3 python3-pip
  ```
- ✅ **Node.js/npm not found**: Install Node.js and npm
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install nodejs
  ```
- ✅ **File monitoring tools missing**: Install inotify-tools
  ```bash
  sudo apt-get install inotify-tools
  ```
- ✅ **Claude Code CLI not found**: Install and authenticate Claude Code CLI
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude  # Run to authenticate (enter your Anthropic API key when prompted)
  claude --version  # Verify installation
  ```
- ✅ **Docker daemon not accessible**: Check docker group membership
  ```bash
  groups $USER  # Should include 'docker'
  # If not, run: sudo usermod -aG docker $USER
  # Then restart runner service
  ```

**Issue**: Agent coordination fails
- ✅ Check self-hosted runner is online
- ✅ Verify `agents-monitor` script is installed
- ✅ Review MCP server logs in workflow
- ✅ Ensure Docker containers can be created

### Debug Mode

Enable verbose logging by setting:
```bash
gh variable set MCP_LOG_LEVEL --body "debug"
```

### Getting Help

1. **Check workflow logs** in Actions tab
2. **Review setup validation** results
3. **Verify all secrets/variables** are configured
4. **Test with simple issue** first

## 📂 Project Customization

### Update CLAUDE.md
Edit `CLAUDE.md` to include:
- Project-specific context
- Coding standards and conventions  
- Architecture guidelines
- Domain knowledge

### Creating Custom AI Agents

The AI automation system supports multiple specialized agents that the orchestrator can delegate tasks to. To create a new agent:

#### Step 1: Register Agent in Configuration
Edit `.github/mcp-servers/agent-manager/config.json` and add your new agent to the `agents` section:

```json
{
  "agents": {
    "swe_agent": {
      "name": "Software Engineering Agent",
      "description": "Handles code implementation, bug fixes, and technical tasks",
      "prompt_template": "swe_agent.md"
    },
    "test_agent": {
      "name": "Testing Agent", 
      "description": "Writes and runs tests, handles QA tasks",
      "prompt_template": "test_agent.md"
    },
    "your_custom_agent": {
      "name": "Your Custom Agent Name",
      "description": "Brief description of what this agent does",
      "prompt_template": "your_custom_agent.md"
    }
  }
}
```

#### Step 2: Create Agent Prompt Template
Create a new file `.github/mcp-servers/agent-manager/prompt-templates/your_custom_agent.md` with your agent's specialized instructions:

```markdown
# Your Custom Agent Name

You are a specialized AI agent focused on [specific domain/task].

## Primary Responsibilities
- Task 1: Description
- Task 2: Description  
- Task 3: Description

## Guidelines
- Follow project conventions in CLAUDE.md
- Always commit changes with clear messages
- Provide detailed explanations for complex operations

## Tools Available
- All standard Claude Code tools
- Specialized tools: [list any specific tools this agent should prioritize]

## Success Criteria
Define what constitutes successful completion of tasks for this agent.
```

#### Step 3: Agent Activation
Once configured, the orchestrator can delegate tasks to your new agent using:
```
@claude Please use the your_custom_agent to handle this specialized task
```

#### Available Default Agents
- **swe_agent**: Software engineering, code implementation, bug fixes
- **test_agent**: Test writing, QA, validation tasks

### Modify Existing Agent Templates
Customize existing agent behavior by editing:
- `.github/mcp-servers/agent-manager/prompt-templates/swe_agent.md`
- `.github/mcp-servers/agent-manager/prompt-templates/test_agent.md`

## 🔄 Keeping Template Updated

This template receives regular updates. To get latest improvements:

1. **Check for template updates** periodically
2. **Review changelog** for breaking changes
3. **Test updates** in development environment first
4. **Update your repositories** as needed

---

## 🎉 You're Ready!

Once setup is complete:
- Create issues with `claude-task` label for AI assistance
- Submit PRs and get automated reviews
- Watch multi-agent coordination in action
- Enjoy AI-powered development! 🚀