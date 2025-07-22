#!/usr/bin/env node

/**
 * Tool Examples Extractor
 * Extracts specific examples of tool usage from debug data
 */

const fs = require('fs');
const path = require('path');

class ToolExamplesExtractor {
  constructor() {
    this.examples = {
      toolExamples: {},
      errorExamples: {},
      successPatterns: {},
      usageContexts: {}
    };
  }

  async extractExamples() {
    console.log('Extracting tool usage examples...');

    try {
      await this.processDebugChats();
      await this.processExecutionLog();

      const results = this.generateExampleReport();
      await this.saveExamples(results);

      console.log('Tool examples extraction completed');
      return results;

    } catch (error) {
      console.error('Example extraction failed:', error.message);
      throw error;
    }
  }

  async processDebugChats() {
    const debugDir = 'debug/chats';

    if (!fs.existsSync(debugDir)) {
      return;
    }

    const chatFiles = fs.readdirSync(debugDir)
      .filter(file => file.endsWith('.chat'))
      .sort();

    for (const file of chatFiles) {
      try {
        const filePath = path.join(debugDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const chatData = JSON.parse(content);

        this.extractExamplesFromChat(chatData, file);

      } catch (error) {
        console.warn(`Failed to process ${file}:`, error.message);
      }
    }
  }

  extractExamplesFromChat(chatData, filename) {
    const { executionId, chat = [], context = [] } = chatData;

    // Extract examples from chat messages
    chat.forEach((message, index) => {
      if (message.role === 'tool' && message.content) {
        this.extractToolExampleFromMessage(message, executionId, filename, index);
      }
    });

    // Extract context examples
    context.forEach((ctx, index) => {
      this.extractContextExample(ctx, executionId, filename, index);
    });
  }

  extractToolExampleFromMessage(message, executionId, filename, messageIndex) {
    const content = message.content;

    // File tree examples
    if (content.includes('<fileTree>')) {
      this.addExample('listDirectory', {
        type: 'success',
        executionId,
        filename,
        messageIndex,
        example: this.truncateContent(content, 300),
        description: 'File tree display showing workspace structure'
      });
    }

    // File content examples
    const fileMatches = content.match(/<file name="([^"]+)"[^>]*>/g);
    if (fileMatches) {
      fileMatches.forEach(match => {
        const fileName = match.match(/name="([^"]+)"/)[1];
        this.addExample('readFile', {
          type: 'success',
          executionId,
          filename,
          messageIndex,
          example: this.truncateContent(match, 200),
          description: `Reading file: ${fileName}`,
          targetFile: fileName
        });
      });
    }

    // Command execution examples
    if (content.includes('Output:') && content.includes('Exit Code:')) {
      const isSuccess = !content.includes('Exit Code: -1');
      this.addExample('executeBash', {
        type: isSuccess ? 'success' : 'error',
        executionId,
        filename,
        messageIndex,
        example: this.truncateContent(content, 400),
        description: isSuccess ? 'Successful command execution' : 'Failed command execution'
      });
    }

    // Error examples
    if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed')) {
      this.addErrorExample(content, executionId, filename, messageIndex);
    }

    // Task status examples
    if (content.includes('Task') && content.includes('set to status')) {
      this.addExample('taskStatus', {
        type: 'success',
        executionId,
        filename,
        messageIndex,
        example: this.truncateContent(content, 200),
        description: 'Task status update'
      });
    }
  }

  extractContextExample(context, executionId, filename, contextIndex) {
    const { type, path: contextPath, content } = context;

    if (type === 'file' && contextPath) {
      this.addExample('readFile', {
        type: 'context',
        executionId,
        filename,
        contextIndex,
        example: `File context: ${contextPath}`,
        description: `File loaded into context: ${contextPath}`,
        targetFile: contextPath
      });
    }

    if (type === 'fileTree') {
      this.addExample('listDirectory', {
        type: 'context',
        executionId,
        filename,
        contextIndex,
        example: 'FileTree context loaded',
        description: 'Directory structure loaded into context'
      });
    }

    if (type === 'steering' && content) {
      this.addExample('contextInjection', {
        type: 'context',
        executionId,
        filename,
        contextIndex,
        example: this.truncateContent(content, 200),
        description: 'Steering rule injection'
      });
    }
  }

  async processExecutionLog() {
    const logPath = 'debug/execution-log.json';

    if (!fs.existsSync(logPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const logData = JSON.parse(content);

      if (Array.isArray(logData)) {
        logData.forEach((entry, index) => {
          this.extractExamplesFromExecutionEntry(entry, index);
        });
      }

    } catch (error) {
      console.warn('Failed to process execution log:', error.message);
    }
  }

  extractExamplesFromExecutionEntry(entry, index) {
    const { executionId, actions = [], documents = [], workflowType, input } = entry;

    // Extract action examples
    actions.forEach((action, actionIndex) => {
      if (action.type && action.details) {
        this.addExample(action.type, {
          type: action.status === 'failed' ? 'error' : 'success',
          executionId,
          actionIndex,
          example: JSON.stringify(action.details, null, 2),
          description: `${action.type} in ${workflowType} workflow`,
          workflowType
        });
      }
    });

    // Extract document examples
    documents.forEach((doc, docIndex) => {
      this.addExample('readFile', {
        type: 'execution',
        executionId,
        docIndex,
        example: `Document: ${doc.path || doc.name}`,
        description: `Document loaded for ${workflowType} workflow`,
        targetFile: doc.path || doc.name,
        workflowType
      });
    });

    // Extract input examples
    if (input && input.data && input.data.prompt) {
      this.addExample('userInput', {
        type: 'execution',
        executionId,
        example: this.truncateContent(input.data.prompt, 300),
        description: `User prompt for ${workflowType} workflow`,
        workflowType
      });
    }
  }

  addExample(toolName, example) {
    if (!this.examples.toolExamples[toolName]) {
      this.examples.toolExamples[toolName] = [];
    }

    this.examples.toolExamples[toolName].push(example);

    // Track usage contexts
    if (example.workflowType) {
      if (!this.examples.usageContexts[toolName]) {
        this.examples.usageContexts[toolName] = new Set();
      }
      this.examples.usageContexts[toolName].add(example.workflowType);
    }

    // Track success patterns
    if (example.type === 'success') {
      if (!this.examples.successPatterns[toolName]) {
        this.examples.successPatterns[toolName] = [];
      }
      this.examples.successPatterns[toolName].push(example.description);
    }
  }

  addErrorExample(content, executionId, filename, messageIndex) {
    const errorType = this.classifyError(content);

    if (!this.examples.errorExamples[errorType]) {
      this.examples.errorExamples[errorType] = [];
    }

    this.examples.errorExamples[errorType].push({
      executionId,
      filename,
      messageIndex,
      example: this.truncateContent(content, 300),
      description: `${errorType} error example`
    });
  }

  classifyError(content) {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('file not found') || lowerContent.includes('cannot open')) {
      return 'FileNotFound';
    }
    if (lowerContent.includes('permission') || lowerContent.includes('access denied')) {
      return 'PermissionError';
    }
    if (lowerContent.includes('syntax') || lowerContent.includes('parse')) {
      return 'SyntaxError';
    }
    if (lowerContent.includes('network') || lowerContent.includes('connection')) {
      return 'NetworkError';
    }
    if (lowerContent.includes('timeout')) {
      return 'TimeoutError';
    }

    return 'GeneralError';
  }

  truncateContent(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  generateExampleReport() {
    // Convert Sets to Arrays for serialization
    const usageContexts = {};
    Object.entries(this.examples.usageContexts).forEach(([tool, contexts]) => {
      usageContexts[tool] = Array.from(contexts);
    });

    return {
      summary: {
        toolsWithExamples: Object.keys(this.examples.toolExamples).length,
        totalExamples: Object.values(this.examples.toolExamples).reduce((sum, examples) => sum + examples.length, 0),
        errorTypes: Object.keys(this.examples.errorExamples).length,
        totalErrors: Object.values(this.examples.errorExamples).reduce((sum, errors) => sum + errors.length, 0)
      },
      toolExamples: this.examples.toolExamples,
      errorExamples: this.examples.errorExamples,
      successPatterns: this.examples.successPatterns,
      usageContexts: usageContexts,
      insights: this.generateInsights()
    };
  }

  generateInsights() {
    const insights = [];

    // Most documented tool
    const toolCounts = Object.entries(this.examples.toolExamples)
      .map(([tool, examples]) => ({ tool, count: examples.length }))
      .sort((a, b) => b.count - a.count);

    if (toolCounts.length > 0) {
      insights.push(`Most documented tool: ${toolCounts[0].tool} (${toolCounts[0].count} examples)`);
    }

    // Most common error type
    const errorCounts = Object.entries(this.examples.errorExamples)
      .map(([type, errors]) => ({ type, count: errors.length }))
      .sort((a, b) => b.count - a.count);

    if (errorCounts.length > 0) {
      insights.push(`Most common error type: ${errorCounts[0].type} (${errorCounts[0].count} occurrences)`);
    }

    // Tools with multiple contexts
    const multiContextTools = Object.entries(this.examples.usageContexts)
      .filter(([_, contexts]) => contexts.size > 1)
      .map(([tool, contexts]) => ({ tool, contexts: contexts.size }));

    if (multiContextTools.length > 0) {
      insights.push(`Tools used in multiple contexts: ${multiContextTools.map(t => t.tool).join(', ')}`);
    }

    return insights;
  }

  async saveExamples(results) {
    const outputPath = 'analysis/data/tool-examples.json';

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Examples saved to ${outputPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  const extractor = new ToolExamplesExtractor();
  extractor.extractExamples()
    .then(results => {
      console.log('\n=== TOOL EXAMPLES EXTRACTION ===');
      console.log(`Tools with examples: ${results.summary.toolsWithExamples}`);
      console.log(`Total examples: ${results.summary.totalExamples}`);
      console.log(`Error types: ${results.summary.errorTypes}`);
      console.log(`Total errors: ${results.summary.totalErrors}`);

      if (results.insights.length > 0) {
        console.log('\nInsights:');
        results.insights.forEach(insight => console.log(`- ${insight}`));
      }
    })
    .catch(error => {
      console.error('Extraction failed:', error);
      process.exit(1);
    });
}

module.exports = ToolExamplesExtractor;
