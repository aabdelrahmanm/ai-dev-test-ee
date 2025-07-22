#!/usr/bin/env node

/**
 * Tool Usage Analyzer
 * Extracts and analyzes tool usage patterns from debug data and trace files
 */

const fs = require('fs');
const path = require('path');

class ToolUsageAnalyzer {
  constructor() {
    this.toolUsageData = {
      toolCalls: [],
      toolStats: {},
      toolCategories: {},
      toolSequences: [],
      workflowPatterns: {},
      successRates: {},
      errorPatterns: []
    };
  }

  /**
   * Main analysis function
   */
  async analyze() {
    console.log('Starting tool usage analysis...');

    try {
      // Process debug chat files
      await this.processDebugChats();

      // Process execution log
      await this.processExecutionLog();

      // Analyze patterns
      this.analyzeToolPatterns();
      this.categorizeTools();
      this.calculateStatistics();
      this.identifySequences();

      // Generate results
      const results = this.generateResults();

      // Save analysis data
      await this.saveResults(results);

      console.log('Tool usage analysis completed successfully');
      return results;

    } catch (error) {
      console.error('Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Process debug chat files to extract tool usage
   */
  async processDebugChats() {
    const debugDir = 'debug/chats';

    if (!fs.existsSync(debugDir)) {
      console.warn('Debug chats directory not found');
      return;
    }

    const chatFiles = fs.readdirSync(debugDir)
      .filter(file => file.endsWith('.chat'))
      .sort();

    console.log(`Processing ${chatFiles.length} chat files...`);

    for (const file of chatFiles) {
      try {
        const filePath = path.join(debugDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const chatData = JSON.parse(content);

        this.extractToolUsageFromChat(chatData, file);

      } catch (error) {
        console.warn(`Failed to process ${file}:`, error.message);
      }
    }
  }

  /**
   * Extract tool usage from individual chat data
   */
  extractToolUsageFromChat(chatData, filename) {
    const { executionId, chat = [], context = [] } = chatData;

    // Extract tool calls from chat messages
    chat.forEach((message, index) => {
      if (message.role === 'tool' && message.content) {
        this.extractToolCallFromMessage(message, executionId, filename, index);
      }

      // Look for tool invocations in bot messages
      if (message.role === 'bot' && message.content) {
        this.extractToolInvocationsFromBotMessage(message, executionId, filename, index);
      }
    });

    // Extract context-related tool usage
    context.forEach((ctx, index) => {
      this.extractToolUsageFromContext(ctx, executionId, filename, index);
    });
  }

  /**
   * Extract tool calls from tool messages
   */
  extractToolCallFromMessage(message, executionId, filename, messageIndex) {
    try {
      // Tool messages often contain execution results
      const content = message.content;

      // Look for common tool patterns
      const toolPatterns = [
        { name: 'fileTree', pattern: /<fileTree>/ },
        { name: 'file', pattern: /<file name="([^"]+)"/ },
        { name: 'execution', pattern: /Tool ran without output/ },
        { name: 'error', pattern: /Failed to|Error:|cannot/ }
      ];
Patterns.forEach(({ name, pattern }) => {
        if (pattern.test(content)) {
          this.recordToolCall({
            toolName: name,
            executionId,
            filename,
            messageIndex,
            success: !name.includes('error'),
            content: content.substring(0, 200) + '...',
            timestamp: new Date().toISOString()
          });
        }
      });

    } catch (error) {
      console.warn('Failed to extract tool call:', error.message);
    }
  }

  /**
   * Extract tool invocations from bot messages
   */
  extractToolInvocationsFromBotMessage(message, executionId, filename, messageIndex) {
    const content = message.content;

    // Look for tool invocation patterns in bot responses
    const invocationPatterns = [
      { name: 'fsWrite', pattern: /fsWrite|writing.*file/i },
      { name: 'fsAppend', pattern: /fsAppend|appending.*file/i },
      { name: 'strReplace', pattern: /strReplace|replacing.*text/i },
      { name: 'readFile', pattern: /readFile|reading.*file/i },
      { name: 'listDirectory', pattern: /listDirectory|listing.*directory/i },
      { name: 'executeBash', pattern: /executeBash|running.*command/i },
      { name: 'grepSearch', pattern: /grepSearch|searching.*files/i }
    ];

    invocationPatterns.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        this.recordToolCall({
          toolName: name,
          executionId,
          filename,
          messageIndex,
          success: true,
          invocationType: 'planned',
          content: content.substring(0, 200) + '...',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Extract tool usage from context data
   */
  extractToolUsageFromContext(context, executionId, filename, contextIndex) {
    const { type, path: contextPath } = context;

    // Context types indicate tool usage
    const contextToolMap = {
      'fileTree': 'listDirectory',
      'file': 'readFile',
      'steering': 'readFile'
    };

    if (contextToolMap[type]) {
      this.recordToolCall({
        toolName: contextToolMap[type],
        executionId,
        filename,
        contextIndex,
        success: true,
        contextType: type,
        contextPath,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Process execution log for additional tool usage data
   */
  async processExecutionLog() {
    const logPath = 'debug/execution-log.json';

    if (!fs.existsSync(logPath)) {
      console.warn('Execution log not found');
      return;
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const logData = JSON.parse(content);

      // Extract tool usage from execution data
      if (Array.isArray(logData)) {
        logData.forEach((entry, index) => {
          this.extractToolUsageFromExecutionEntry(entry, index);
        });
      }

    } catch (error) {
      console.warn('Failed to process execution log:', error.message);
    }
  }

  /**
   * Extract tool usage from execution log entry
   */
  extractToolUsageFromExecutionEntry(entry, index) {
    const { executionId, actions = [], documents = [] } = entry;

    // Actions often indicate tool usage
    actions.forEach((action, actionIndex) => {
      if (action.type) {
        this.recordToolCall({
          toolName: action.type,
          executionId,
          actionIndex,
          success: action.status !== 'failed',
          source: 'execution-log',
          timestamp: action.timestamp || new Date().toISOString()
        });
      }
    });

    // Documents indicate file reading tools
    documents.forEach((doc, docIndex) => {
      this.recordToolCall({
        toolName: 'readFile',
        executionId,
        docIndex,
        success: true,
        source: 'execution-log',
        documentPath: doc.path || doc.name,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Record a tool call
   */
  recordToolCall(toolCall) {
    this.toolUsageData.toolCalls.push(toolCall);

    // Update statistics
    const toolName = toolCall.toolName;
    if (!this.toolUsageData.toolStats[toolName]) {
      this.toolUsageData.toolStats[toolName] = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        contexts: new Set(),
        executionIds: new Set()
      };
    }

    const stats = this.toolUsageData.toolStats[toolName];
    stats.totalCalls++;

    if (toolCall.success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    if (toolCall.executionId) {
      stats.executionIds.add(toolCall.executionId);
    }

    if (toolCall.contextType) {
      stats.contexts.add(toolCall.contextType);
    }
  }

  /**
   * Analyze tool usage patterns
   */
  analyzeToolPatterns() {
    console.log('Analyzing tool patterns...');

    // Group tool calls by execution ID
    const executionGroups = {};
    this.toolUsageData.toolCalls.forEach(call => {
      if (call.executionId) {
        if (!executionGroups[call.executionId]) {
          executionGroups[call.executionId] = [];
        }
        executionGroups[call.executionId].push(call);
      }
    });

    // Analyze patterns within executions
    Object.entries(executionGroups).forEach(([executionId, calls]) => {
      this.analyzeExecutionPattern(executionId, calls);
    });
  }

  /**
   * Analyze tool usage pattern for a single execution
   */
  analyzeExecutionPattern(executionId, calls) {
    const pattern = {
      executionId,
      toolSequence: calls.map(c => c.toolName),
      uniqueTools: [...new Set(calls.map(c => c.toolName))],
      totalCalls: calls.length,
      successRate: calls.filter(c => c.success).length / calls.length
    };

    this.toolUsageData.workflowPatterns[executionId] = pattern;
  }

  /**
   * Categorize tools by function
   */
  categorizeTools() {
    console.log('Categorizing tools...');

    const categories = {
      'File Operations': ['fsWrite', 'fsAppend', 'readFile', 'strReplace', 'deleteFile'],
      'Directory Operations': ['listDirectory', 'fileSearch'],
      'Search Operations': ['grepSearch', 'fileSearch'],
      'System Commands': ['executeBash'],
      'Context Operations': ['fileTree', 'file', 'steering'],
      'Task Management': ['taskStatus'],
      'User Interaction': ['userInput']
    };

    // Categorize each tool
    Object.keys(this.toolUsageData.toolStats).forEach(toolName => {
      let category = 'Other';

      for (const [cat, tools] of Object.entries(categories)) {
        if (tools.includes(toolName)) {
          category = cat;
          break;
        }
      }

      if (!this.toolUsageData.toolCategories[category]) {
        this.toolUsageData.toolCategories[category] = [];
      }

      this.toolUsageData.toolCategories[category].push(toolName);
    });
  }

  /**
   * Calculate success rates and statistics
   */
  calculateStatistics() {
    console.log('Calculating statistics...');

    Object.entries(this.toolUsageData.toolStats).forEach(([toolName, stats]) => {
      const successRate = stats.totalCalls > 0 ?
        (stats.successfulCalls / stats.totalCalls) * 100 : 0;

      this.toolUsageData.successRates[toolName] = {
        successRate: Math.round(successRate * 100) / 100,
        totalCalls: stats.totalCalls,
        successfulCalls: stats.successfulCalls,
        failedCalls: stats.failedCalls,
        uniqueExecutions: stats.executionIds.size,
        contexts: Array.from(stats.contexts)
      };
    });
  }

  /**
   * Identify common tool sequences
   */
  identifySequences() {
    console.log('Identifying tool sequences...');

    const sequences = {};

    Object.values(this.toolUsageData.workflowPatterns).forEach(pattern => {
      const sequence = pattern.toolSequence.join(' -> ');
      if (!sequences[sequence]) {
        sequences[sequence] = {
          pattern: sequence,
          count: 0,
          executionIds: []
        };
      }
      sequences[sequence].count++;
      sequences[sequence].executionIds.push(pattern.executionId);
    });

    // Sort by frequency
    this.toolUsageData.toolSequences = Object.values(sequences)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 sequences
  }

  /**
   * Generate analysis results
   */
  generateResults() {
    return {
      summary: {
        totalToolCalls: this.toolUsageData.toolCalls.length,
        uniqueTools: Object.keys(this.toolUsageData.toolStats).length,
        uniqueExecutions: new Set(this.toolUsageData.toolCalls.map(c => c.executionId)).size,
        categories: Object.keys(this.toolUsageData.toolCategories).length
      },
      toolStatistics: this.toolUsageData.successRates,
      toolCategories: this.toolUsageData.toolCategories,
      commonSequences: this.toolUsageData.toolSequences,
      workflowPatterns: this.toolUsageData.workflowPatterns,
      rawData: {
        totalCalls: this.toolUsageData.toolCalls.length,
        callsWithErrors: this.toolUsageData.toolCalls.filter(c => !c.success).length
      }
    };
  }

  /**
   * Save analysis results
   */
  async saveResults(results) {
    const outputPath = 'analysis/data/tool-usage-analysis.json';

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Convert Sets to Arrays for JSON serialization
    const serializable = JSON.parse(JSON.stringify(results, (key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));

    fs.writeFileSync(outputPath, JSON.stringify(serializable, null, 2));
    console.log(`Results saved to ${outputPath}`);
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new ToolUsageAnalyzer();
  analyzer.analyze()
    .then(results => {
      console.log('\nAnalysis Summary:');
      console.log(`- Total tool calls: ${results.summary.totalToolCalls}`);
      console.log(`- Unique tools: ${results.summary.uniqueTools}`);
      console.log(`- Unique executions: ${results.summary.uniqueExecutions}`);
      console.log(`- Tool categories: ${results.summary.categories}`);
    })
    .catch(error => {
      console.error('Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = ToolUsageAnalyzer;
