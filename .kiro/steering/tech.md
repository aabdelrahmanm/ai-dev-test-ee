# Technology Stack

## Core Technologies

**Runtime Environment:**
- Node.js 18+ (required for all components)
- TypeScript 5.x for type safety and modern JavaScript features
- Python 3 for AI automation scripts and prompt processing

**AI & Automation:**
- Anthropic Claude API for AI-powered development assistance
- Model Context Protocol (MCP) SDK for AI tool integration
- Claude Code CLI for AI automation workflows
- GitHub Actions for CI/CD and workflow orchestration

## Project Structure

**Main Template:**
- GitHub Actions workflows for AI automation
- Docker containers for isolated AI agent execution
- Shell scripts for setup and configuration
- Python utilities for prompt management

**n8n Workflow System:**
- **Backend:** Express.js REST API with TypeScript
- **Frontend:** React 18 with Vite build system and TypeScript
- **Database:** SQLite3 for workflow persistence
- **Real-time:** WebSocket connections for live updates

**n8n MCP Integration:**
- Express.js server with MCP SDK integration
- WebSocket support for real-time n8n communication
- Axios for HTTP client operations

## Key Dependencies

**Shared:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `jest` - Testing framework across all components
- `typescript` - Type checking and compilation

**Backend Specific:**
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `helmet` - Security middleware
- `joi` - Input validation
- `winston` - Logging (MCP integration)
- `sqlite3` - Database (workflow system)
- `ws` - WebSocket implementation
- `node-cron` - Task scheduling
- `axios` - HTTP client

**Frontend Specific:**
- `react` & `react-dom` - UI framework
- `react-dnd` - Drag and drop for workflow builder
- `react-router-dom` - Client-side routing
- `vite` - Build tool and dev server

## Common Commands

**Development:**
```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:watch

# Development servers
npm run dev          # Frontend (Vite)
npm run dev          # Backend (ts-node-dev with hot reload)

# Build for production
npm run build        # TypeScript compilation
npm run build        # Frontend (Vite build)
```

**Testing:**
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage reports (MCP integration)
npm run test:coverage
```

**Code Quality:**
```bash
# Linting (MCP integration)
npm run lint
npm run lint:fix

# Formatting (MCP integration)
npm run format
```

**AI Automation Setup:**
```bash
# Quick setup
./setup-automation.sh

# Manual GitHub CLI setup
gh secret set ANTHROPIC_API_KEY
gh variable set AI_DEV_ENABLED --body "true"
```

## Architecture Patterns

- **Microservices:** Separate backend/frontend for n8n workflow system
- **Event-driven:** WebSocket communication for real-time updates
- **Type-safe:** Full TypeScript coverage with strict type checking
- **Validation:** Joi schemas for input validation
- **Security:** Helmet middleware and CORS configuration
- **Logging:** Structured logging with Winston
- **Testing:** Jest with comprehensive test coverage
- **AI Integration:** MCP protocol for standardized AI tool communication