# Project Structure

## Root Level Organization

```
├── .github/                    # GitHub Actions workflows and templates
├── .kiro/                     # Kiro IDE configuration (specs, hooks, steering)
├── n8n-mcp-integration/       # MCP server for n8n integration
├── n8n-workflow/              # Visual workflow automation system
│   ├── backend/               # Express.js API server
│   └── frontend/              # React workflow builder UI
├── package.json               # Root dependencies (MCP SDK, Jest)
├── setup-automation.sh        # Quick setup script
└── README.md                  # Main documentation
```

## Component Architecture

### Main Template (Root)
- **GitHub Actions workflows** for AI-powered automation
- **Setup scripts** for quick configuration
- **Documentation** (README.md, SETUP.md, CLAUDE.md)
- **Root package.json** with shared dependencies

### n8n-workflow/ - Visual Workflow System
**Purpose:** Visual workflow builder similar to n8n's interface

**Structure:**
```
n8n-workflow/
├── backend/
│   ├── src/
│   │   ├── types/workflow.ts   # Core workflow data structures
│   │   └── index.ts           # Express server entry point
│   ├── package.json           # Backend dependencies
│   └── tsconfig.json          # TypeScript configuration
└── frontend/
    ├── src/                   # React components and logic
    ├── package.json           # Frontend dependencies (React, Vite)
    └── tsconfig.json          # Frontend TypeScript config
```

**Key Features:**
- Drag-and-drop workflow canvas
- Node-based workflow construction
- Real-time execution monitoring
- SQLite persistence layer

### n8n-mcp-integration/ - MCP Bridge
**Purpose:** Bridge between AI assistants and n8n via Model Context Protocol

**Structure:**
```
n8n-mcp-integration/
├── src/
│   └── index.ts              # MCP server implementation
├── package.json              # MCP SDK and Express dependencies
└── tsconfig.json             # TypeScript configuration
```

**Key Features:**
- MCP protocol implementation
- Programmatic workflow management
- AI-driven workflow operations
- Template-based deployment

## File Naming Conventions

**TypeScript Files:**
- Use camelCase for file names: `workflowManager.ts`
- Use PascalCase for type definitions: `WorkflowTypes.ts`
- Use kebab-case for component files: `workflow-builder.tsx`

**Configuration Files:**
- Use lowercase with extensions: `package.json`, `tsconfig.json`
- Use kebab-case for scripts: `setup-automation.sh`

**Documentation:**
- Use UPPERCASE for main docs: `README.md`, `SETUP.md`
- Use lowercase for specific docs: `requirements.md`, `design.md`

## Data Flow Architecture

**Workflow System:**
1. **Frontend (React)** → WebSocket → **Backend (Express)**
2. **Backend** → SQLite → **Persistence Layer**
3. **Backend** → Node Execution → **Workflow Engine**

**MCP Integration:**
1. **AI Assistant** → MCP Protocol → **MCP Server**
2. **MCP Server** → HTTP/WebSocket → **n8n Instance**
3. **n8n Instance** → Workflow Execution → **Results**

## Development Patterns

**Monorepo Structure:**
- Each component has its own `package.json` and dependencies
- Shared dependencies in root `package.json`
- Independent build and test processes per component

**TypeScript Organization:**
- Strict type checking enabled across all components
- Shared types in dedicated `types/` directories
- Interface-first development approach

**Testing Strategy:**
- Jest testing framework across all components
- Component-specific test configurations
- Watch mode for development workflow

**Build Process:**
- TypeScript compilation for backend services
- Vite bundling for React frontend
- Independent deployment capabilities per component