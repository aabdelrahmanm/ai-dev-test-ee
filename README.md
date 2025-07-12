# 🤖 AI-Powered Development Automation Template

This template provides advanced AI automation for GitHub repositories, enabling intelligent issue resolution and PR management using Claude AI with multi-agent orchestration.

## ✨ Features

- 🎯 **Intelligent Issue Resolution**: Claude analyzes issues and coordinates specialized agents
- 🔍 **Automated PR Reviews**: Comprehensive code review with automated fixes
- 🤝 **Multi-Agent Coordination**: SWE agents and test agents working together
- 🚀 **Workflow Automation**: End-to-end automation from issue creation to PR merge
- 🛡️ **Safety First**: Comprehensive validation and commit requirements

## 🚀 Quick Start

1. **Use this template** to create a new repository
2. **Run the setup script**: `./setup-automation.sh`
3. **Create a test issue** with the `claude-task` label
4. **Watch the AI magic happen** ✨

## 📚 Documentation

- [**SETUP.md**](SETUP.md) - Detailed setup and configuration guide
- [**CLAUDE.md**](CLAUDE.md) - Project-specific AI instructions (customize for your project)

## 🔧 What's Included

### Core Workflows
- `claude-issue.yml` - Handles issue analysis and resolution
- `claude-pr.yml` - Manages PR reviews and improvements
- `Dockerfile` - Container setup for Claude Code execution

### AI System Components
- **Orchestrator Prompts** - Master coordination logic
- **Agent Manager System** - Multi-agent coordination via MCP
- **Specialized Agents** - SWE and Test agent templates
- **Support Scripts** - Python utilities for prompt management

## ⚙️ Requirements

- GitHub repository with Actions enabled
- Anthropic Claude API access
- GitHub Personal Access Token with appropriate permissions
- Self-hosted runner (recommended for optimal performance)

## 🔒 Security

- All API keys stored as GitHub secrets
- Private template ensures your automation logic stays secure
- Comprehensive validation prevents unauthorized changes

## 🔄 Updating from Template

When the template receives improvements, you can update your existing repositories:

### Method 1: Fetch Template Updates (Recommended)

```bash
# Add template as remote (one-time setup)
git remote add template https://github.com/YOUR_USERNAME/ai-dev-template.git

# Fetch latest template changes
git fetch template

# Merge template updates (resolve conflicts if needed)
git merge template/main --allow-unrelated-histories

# If conflicts occur, resolve them:
# - Review conflicted files
# - Choose template version for setup files: git checkout --theirs filename
# - Commit the merge: git commit -m "feat: Update from template"

# Push updates
git push origin main
```

### Method 2: Manual File Updates

```bash
# Copy specific updated files from template repo
curl -o .github/workflows/setup-check.yml https://raw.githubusercontent.com/YOUR_USERNAME/ai-dev-template/main/.github/workflows/setup-check.yml
curl -o SETUP.md https://raw.githubusercontent.com/YOUR_USERNAME/ai-dev-template/main/SETUP.md
# ... repeat for other files

# Commit updates
git add .
git commit -m "feat: Update setup files from template"
git push origin main
```

### Recommended Update Schedule
- **Check for updates**: Monthly or when issues arise
- **Critical fixes**: Apply immediately (security, workflow fixes)
- **Feature updates**: Apply when convenient
- **Breaking changes**: Review carefully before applying

## 🆘 Support

For issues with the template:
1. Check the [SETUP.md](SETUP.md) troubleshooting section
2. Review workflow logs in the Actions tab
3. Ensure all required secrets and variables are configured
4. Check for template updates if experiencing issues

---

**Note**: This template contains advanced AI automation. Please review and customize the `CLAUDE.md` file for your specific project needs before enabling automation.