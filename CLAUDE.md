# AI-Powered Development Automation Template

This template provides advanced AI automation for GitHub repositories, enabling intelligent issue resolution and PR management using Claude AI with multi-agent orchestration.

## 🎯 Active Workflows Overview

### 1. Issue Resolution Workflow (`claude-issue.yml`)
**Purpose**: Handles GitHub issue analysis, implementation, and automated PR creation.

**Triggers**:
- Issues labeled with `claude-task`
- Manual workflow dispatch for specific issues

**Key Features**:
- **Multi-agent orchestration** using MCP agent manager
- **Comprehensive issue analysis** and solution planning
- **Automated PR creation** with linked issue resolution
- **Self-hosted runner execution** with full tool access
- **Progress tracking** with agent state monitoring

**Workflow Steps**:
1. Checkout repository and setup environment
2. Launch Claude Code with orchestrator prompt
3. Analyze issue and coordinate specialized agents (SWE, Test)
4. Implement solution with proper testing
5. Create PR with detailed description and link to issue
6. Apply appropriate labels and manage workflow state

### 2. Pull Request Review Workflow (`claude-pr.yml`)
**Purpose**: Provides intelligent PR review, analysis, and automated improvements.

**Triggers**:
- PR events: `opened`, `synchronize`, `ready_for_review`
- PR labeled with `claude-task`
- Manual workflow dispatch for specific PRs

**Key Features**:
- **Comprehensive code review** with security and quality analysis
- **Automated fix suggestions** and implementation
- **Multi-agent collaboration** for complex changes
- **Integration testing** and validation
- **Review feedback** and iteration support

**Workflow Steps**:
1. Checkout PR branch and analyze changes
2. Run specialized review agents for different aspects
3. Provide detailed feedback and suggestions
4. Implement fixes if requested and safe
5. Update PR with review comments and status
6. Coordinate with issue workflows when applicable

### 3. Setup Validation Workflow (`setup-check.yml`)
**Purpose**: Automated setup, configuration validation, and environment preparation.

**Triggers**:
- Push to main branch (setup files only)
- Manual workflow dispatch
- First-time repository setup

**Key Features**:
- **Automated environment configuration** for self-hosted runners
- **Comprehensive validation** of secrets, variables, and dependencies
- **Repository label creation** (`claude-task`, `ai-dev`, `claude-working`)
- **System dependency checking** (Docker, inotify-tools)
- **Setup completion tracking** with intelligent re-run detection

**Configuration Tasks**:
1. Configure runner environment variables (`CLAUDE_CODE_USE_BEDROCK`)
2. Install monitoring tools (`agents-monitor` script)
3. Validate all required secrets and variables
4. Check system dependencies and provide installation guidance
5. Create required repository labels for automation
6. Mark setup as complete to prevent unnecessary re-runs

## 🤖 Multi-Agent System Architecture

### Agent Manager (MCP-based)
- **Orchestration**: Coordinates multiple specialized agents
- **State Management**: Tracks agent progress and communication
- **Resource Allocation**: Manages computational resources
- **Error Handling**: Provides robust error recovery and reporting

### Specialized Agents
- **SWE Agent**: Software engineering tasks, code implementation
- **Test Agent**: Testing, validation, and quality assurance
- **Review Agent**: Code review, security analysis, best practices

### Agent Communication
- **State Files**: JSON-based state tracking in `_tmp/agent_state/`
- **Progress Monitoring**: Real-time agent status updates
- **Coordination Messages**: Inter-agent communication and handoffs

## 🏷️ Label System

### Automation Labels
- `claude-task`: Triggers AI automation workflows
- `claude-working`: Indicates active AI processing (prevents conflicts)
- `ai-dev`: General AI development and automation marker

### Workflow Management
- Labels are automatically managed by workflows
- Concurrency control prevents multiple simultaneous runs
- Progress tracking through label states

## ⚙️ Configuration & Environment

### Required Secrets
- `ANTHROPIC_API_KEY`: Claude AI API access
- `AI_DEV_TOKEN`: GitHub Personal Access Token with comprehensive permissions

### Required Variables
- `AI_DEV_ENABLED`: Master switch for automation (`true`/`false`)
- `ANTHROPIC_MODEL`: Claude model identifier
- `AWS_REGION`: AWS region for Bedrock integration
- `MCP_LOG_LEVEL`: Logging level for agent communication

### Optional Configuration
- `ANTHROPIC_BASE_URL`: Custom Bedrock proxy endpoint
- `CLAUDE_CODE_USE_BEDROCK`: Enable Bedrock integration

## 🔧 System Requirements

### Self-Hosted Runner Environment
- **Docker**: Required for containerized agent execution
- **inotify-tools**: Required for file system monitoring
- **GitHub CLI**: Required for repository operations
- **Git**: Required for version control operations

### Automated Setup
- Environment variables automatically configured in `~/.profile`
- Monitoring scripts installed in `~/.local/bin/agents-monitor`
- PATH automatically updated for tool access
- System validation with dependency checking

## 🚀 Workflow Execution Flow

### Issue Resolution Flow
1. **Issue Created** with `claude-task` label
2. **claude-issue.yml** triggered automatically
3. **Multi-agent analysis** and solution planning
4. **Implementation** with proper testing and validation
5. **PR Creation** with detailed description and issue linking
6. **Review process** can trigger claude-pr.yml if needed

### PR Review Flow
1. **PR Events** trigger claude-pr.yml workflow
2. **Comprehensive analysis** of changes and impact
3. **Multi-agent review** covering different aspects
4. **Feedback provision** with actionable suggestions
5. **Automated fixes** if requested and safe
6. **Integration** with CI/CD and testing workflows

## 🛡️ Safety & Security Features

### Validation & Checks
- **Comprehensive input validation** before agent execution
- **Security scanning** of code changes and suggestions
- **Permission verification** for all automated actions
- **State consistency** checks and error recovery

### Concurrency Control
- **Label-based locking** prevents simultaneous executions
- **Agent state tracking** ensures proper coordination
- **Resource management** prevents system overload
- **Graceful error handling** with proper cleanup

## 📊 Monitoring & Observability

### Agent Monitoring
- **Real-time state tracking** via file system monitoring
- **Progress reporting** with detailed status updates
- **Error logging** and diagnostic information
- **Performance metrics** and execution timing

### Workflow Visibility
- **Comprehensive logging** in GitHub Actions
- **Status updates** through labels and comments
- **Integration** with GitHub's native monitoring
- **Debug mode** available through configuration

## 🎯 Best Practices for AI Automation

### Issue Writing
- **Clear problem statements** for better AI understanding
- **Specific requirements** and acceptance criteria
- **Context information** about the codebase and constraints
- **Priority and urgency** indicators when relevant

### PR Management
- **Descriptive titles** and detailed descriptions
- **Clear change rationale** and impact assessment
- **Testing information** and validation steps
- **Breaking change** notifications when applicable

### System Maintenance
- **Regular template updates** to get latest improvements
- **Monitoring system health** and performance metrics
- **Periodic review** of automation effectiveness
- **Security audit** of configurations and access

---

**Note**: This system provides advanced AI automation capabilities. Customize the agent prompts and system behavior based on your specific project requirements and coding standards.