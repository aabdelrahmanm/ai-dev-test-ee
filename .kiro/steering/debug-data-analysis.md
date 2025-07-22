# Debug Data Analysis Guide

## Debug Folder Structure

**Available Files:**
- `debug/debug.log` - System event logs with timestamps and components
- `debug/execution-log.json` - Detailed execution data with workflow information
- `debug/chats/*.chat` - Individual conversation files with context and messages
- `debug/.kiro/` - Additional Kiro-specific debug data

## Debug Log Analysis

**Log Format Pattern:**
```
[timestamp] [level] [component] message {metadata}
```

**Key Components to Track:**
- `agent-controller` - Agent execution management
- `notification-service` - System notifications
- `storage` - Data persistence operations
- `AgentIterator` - Agent iteration and invocation
- `ChatFile` - Chat file operations

**Analysis Goals:**
1. Extract system events and their frequency
2. Identify error patterns and failure modes
3. Track agent execution flows and timing
4. Map component interactions and dependencies

## Chat File Analysis

**Chat File Structure:**
```javascript
{
  "executionId": "string",
  "actionId": "string",
  "context": [
    {
      "type": "fileTree|file|...",
      "path": "string",
      "content": "..."
    }
  ],
  "messages": [],
  "toolUsage": []
}
```

**Context Types to Extract:**
- `fileTree` - File system context with expanded paths
- `file` - Individual file content and references
- `steering` - Steering rule applications
- `spec` - Specification document references

**Analysis Objectives:**
1. Map context injection patterns and sources
2. Identify most frequently referenced files and paths
3. Track context evolution throughout conversations
4. Analyze tool usage patterns and success rates

## Execution Log Analysis

**Key Data Points:**
- `workflowType` - Type of workflow being executed
- `status` - Current execution status
- `input.data.prompt` - The prompt that triggered execution
- `documents` - Context documents provided to the agent
- `autonomyMode` - Execution mode (Autopilot, Supervised)
- `actions` - Actions taken during execution

**Pattern Extraction:**
1. **Workflow Patterns:** Common workflow types and their characteristics
2. **Context Patterns:** How context documents are selected and used
3. **Prompt Patterns:** Common prompt structures and templates
4. **Execution Patterns:** Success/failure patterns and timing

## Context Injection Analysis

**Context Sources:**
- File system references (paths, content)
- Steering rules and guidelines
- Specification documents
- Previous conversation history
- Tool outputs and results

**Injection Mechanisms:**
- Direct file inclusion in context
- Template-based context construction
- Dynamic context selection based on relevance
- Context transformation and filtering

**Analysis Framework:**
```javascript
function analyzeContextInjection(chatData) {
  const patterns = {
    sources: {},      // Where context comes from
    types: {},        // Types of context injected
    frequency: {},    // How often each type is used
    effectiveness: {} // Success correlation with context types
  };
  
  // Analyze each conversation for context patterns
  chatData.forEach(chat => {
    chat.context.forEach(ctx => {
      // Track context source and type
      // Measure context usage effectiveness
      // Identify transformation patterns
    });
  });
  
  return patterns;
}
```