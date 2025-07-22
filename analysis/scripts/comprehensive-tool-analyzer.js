#!/usr/bin/env node

/**
 * Comprehensive Tool Usage Analyzer
 * Extracts and analyzes tool usage patterns from debug data and trace files
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveToolAnalyzer {
  constructor() {
    this.toolData = {
      toolCalls: [],
      toolStats: {},
      toolCategories: {
        'File Operations': [],
        'Directory Operations': [],
        'Search Operations': [],
        'System Commands': [],
        'Context Operations': [],
        'Task Management': [],
        'User Interaction': [],
        'Other': []
      },
      toolSequences: [],
      workflowPatterns: {},
      successRates: {},
      errorPatterns: []
    };

    // Define tool categories and patterns
    this.toolDefinitions = {
      'fsWrite': { category: 'File Operations', patterns: ['fsWrite', 'Created.*file', 'writing.*file'] },
      'fsAppend': { category: 'File Operations', patterns: ['fsAppend', 'appending.*file'] },
      'strReplace': { category: 'File Operations', patterns: ['strReplace', 'replacing.*text'] },
      'readFile': { category: 'File Operations', patterns: ['readFile', 'Reading.*file', '<file name='] },
      'readMultipleFiles': { category: 'File Operations', patterns: ['readMultipleFiles', 'Reading.*files'] },
      'deleteFile': { category: 'File Operations', patterns: ['deleteFile', 'deleting.*file'] },
      'listDirectory': { category: 'Directory Operations', patterns: ['listDirectory', 'I will list the files', 'listing.*directory'] },
      'fileSearch': { category: 'Search Operations', patterns: ['fileSearch', 'searching.*files'] },
      'grepSearch': { category: 'Search Operations', patterns: ['grepSearch', 'searching.*text'] },
      'executeBash': { category: 'System Commands', patterns: ['executeBash', 'Output:', 'Exit Code:', 'running.*command'] },
      'taskStatus': { category: 'Task Management', patterns: ['taskStatus', 'Task.*set to status'] },
      'userInput': { category: 'User Interaction', patterns: ['userInput', 'asking.*user'] },
      'fileTree': { category: 'Context Operations', patterns: ['<fileTree>', 'file tree', 'workspace.*structure'] },
      'contextInjection': { category: 'Context Operations', patterns: ['<file name=', 'context.*injection', 'steering'] }
    };
  }

  /**
   * Main analysis function
   */
  async analyze() {
    console.log('Starting comprehensive tool usage analysis...');

    try {
      // Process all available data sources
      await this.processDebugChats();
      await this.processExecutionLog();
      await this.processDebugLog();

      // Try to process trace data if available
      await this.processTraceData();

      // Analyze patterns
      this.analyzeToolPatterns();
      this.calculateStatistics();
      this.identifySequences();
      this.categorizeTools();

      // Generate results
      const results = this.generateResults();

      // Save analysis data
      await this.saveResults(results);

      console.log('Comprehensive tool usage analysis completed successfully');
      return results;

    } catch (error) {
      console.error('Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Process debug chat files
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
   * Extract tool usage from chat data
   */
  extractToolUsageFromChat(chatData, filename) {
    const { executionId, chat = [], context = [] } = chatData;

    // Process chat messages
    chat.forEach((message, index) => {
      this.extractToolsFromMessage(message, executionId, filename, index);
    });

    // Process context data
    context.forEach((ctx, index) => {
      this.extractToolsFromContext(ctx, executionId, filename, index);
    });
  }

  /**
   * Extract tools from individual messages
   */
  extractToolsFromMessage(message, executionId, filename, messageIndex) {
    if (!message.content) return;

    const content = message.content;
    const role = message.role;

    // Check each tool definition
    Object.entries(this.toolDefinitions).forEach(([toolName, definition]) => {
      definition.patterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(content)) {
          this.recordToolUsage({
            toolName,
            category: definition.category,
            executionId,
            filename,
            messageIndex,
            role,
            success: this.determineSuccess(content, toolName),
            context: this.extractContext(content, toolName),
            timestamp: new Date().toISOString(),
            source: 'chat'
          });
        }
      });
    });

    // Look for specific tool execution patterns
    this.extractSpecificToolPatterns(content, executionId, filename, messageIndex, role);
  }

  /**
   * Extract specific tool patterns
   */
  extractSpecificToolPatterns(content, executionId, filename, messageIndex, role) {
    // File tree operations
    if (content.includes('<fileTree>')) {
      this.recordToolUsage({
        toolName: 'listDirectory',
        category: 'Directory Operations',
        executionId,
        filename,
        messageIndex,
        role,
        success: true,
        context: 'fileTree display',
        timestamp: new Date().toISOString(),
        source: 'chat'
      });
    }

    // File content display
    const fileMatches = content.match(/<file name="([^"]+)"/g);
    if (fileMatches) {
      fileMatches.forEach(match => {
        const fileName = match.match(/name="([^"]+)"/)[1];
        this.recordToolUsage({
          toolName: 'readFile',
          category: 'File Operations',
          executionId,
          filename,
          messageIndex,
          role,
          success: true,
          context: `reading ${fileName}`,
          timestamp: new Date().toISOString(),
          source: 'chat'
        });
      });
    }

    // Command execution results
    if (content.includes('Output:') && content.includes('Exit Code:')) {
      this.recordToolUsage({
        toolName: 'executeBash',
        category: 'System Commands',
        executionId,
        filename,
        messageIndex,
        role,
        success: !content.includes('Exit Code: -1') && !content.includes('error'),
        context: 'command execution',
        timestamp: new Date().toISOString(),
        source: 'chat'
      });
    }

    // Task status updates
    if (content.includes('Task') && content.includes('set to status')) {
      this.recordToolUsage({
        toolName: 'taskStatus',
        category: 'Task Management',
        executionId,
        filename,
        messageIndex,
        role,
        success: true,
        context: 'task status update',
        timestamp: new Date().toISOString(),
        source: 'chat'
      });
    }
  }

  /**
   * Extract tools from context data
   */
  extractToolsFromContext(context, executionId, filename, contextIndex) {
    const { type, path: contextPath } = context;

    const contextToolMap = {
      'fileTree': { tool: 'listDirectory', category: 'Directory Operations' },
      'file': { tool: 'readFile', category: 'File Operations' },
      'steering': { tool: 'readFile', category: 'File Operations' }
    };

    if (contextToolMap[type]) {
      const { tool, category } = contextToolMap[type];
      this.recordToolUsage({
        toolName: tool,
        category,
        executionId,
        filename,
        contextIndex,
        success: true,
        context: `${type} context: ${contextPath || 'unknown'}`,
        timestamp: new Date().toISOString(),
        source: 'context'
      });
    }
  }

  /**
   * Process execution log
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

      if (Array.isArray(logData)) {
        logData.forEach((entry, index) => {
          this.extractToolsFromExecutionEntry(entry, index);
        });
      }

    } catch (error) {
      console.warn('Failed to process execution log:', error.message);
    }
  }

  /**
   * Extract tools from execution entry
   */
  extractToolsFromExecutionEntry(entry, index) {
    const { executionId, actions = [], documents = [], workflowType } = entry;

    // Process actions
    actions.forEach((action, actionIndex) => {
      if (action.type) {
        this.recordToolUsage({
          toolName: action.type,
          category: this.getCategoryForTool(action.type),
          executionId,
          actionIndex,
          success: action.status !== 'failed',
          context: `workflow: ${workflowType}`,
          timestamp: action.timestamp || new Date().toISOString(),
          source: 'execution-log'
        });
      }
    });

    // Process documents (indicates file reading)
    documents.forEach((doc, docIndex) => {
      this.recordToolUsage({
        toolName: 'readFile',
        category: 'File Operations',
        executionId,
        docIndex,
        success: true,
        context: `document: ${doc.path || doc.name}`,
        timestamp: new Date().toISOString(),
        source: 'execution-log'
      });
    });
  }

  /**
   * Process debug log
   */
  async processDebugLog() {
    const logPath = 'debug/debug.log';

    if (!fs.existsSync(logPath)) {
      console.warn('Debug log not found');
      return;
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        this.extractToolsFromLogLine(line, index);
      });

    } catch (error) {
      console.warn('Failed to process debug log:', error.message);
    }
  }

  /**
   * Extract tools from log line
   */
  extractToolsFromLogLine(line, lineIndex) {
    if (!line.trim()) return;

    // Look for tool-related log entries
    const toolPatterns = [
      { tool: 'executeBash', pattern: /executing.*command/i },
      { tool: 'readFile', pattern: /reading.*file/i },
      { tool: 'fsWrite', pattern: /writing.*file/i },
      { tool: 'taskStatus', pattern: /task.*status/i }
    ];

    toolPatterns.forEach(({ tool, pattern }) => {
      if (pattern.test(line)) {
        this.recordToolUsage({
          toolName: tool,
          category: this.getCategoryForTool(tool),
          lineIndex,
          success: !line.toLowerCase().includes('error') && !line.toLowerCase().includes('failed'),
          context: 'debug log',
          timestamp: this.extractTimestampFromLog(line),
          source: 'debug-log'
        });
      }
    });
  }

  /**
   * Process trace data if available
   */
  async processTraceData() {
    // Try to read from existing parsed data
    const tracePath = 'analysis/data/parsed-trace-data.json';

    if (!fs.existsSync(tracePath)) {
      console.warn('Parsed trace data not found, skipping trace analysis');
      return;
    }

    try {
      // Since the file is large, we'll read it in chunks or use a streaming approach
      console.log('Processing trace data (this may take a moment)...');

      // For now, we'll skip the large trace file processing
      // In a production system, we'd implement streaming JSON parsing
      console.log('Trace data processing skipped due to file size');

    } catch (error) {
      console.warn('Failed to process trace data:', error.message);
    }
  }

  /**
   * Record tool usage
   */
  recordToolUsage(usage) {
    this.toolData.toolCalls.push(usage);

    // Update statistics
    const toolName = usage.toolName;
    if (!this.toolData.toolStats[toolName]) {
      this.toolData.toolStats[toolName] = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        categories: new Set(),
        executionIds: new Set(),
        sources: new Set(),
        contexts: []
      };
    }

    const stats = this.toolData.toolStats[toolName];
    stats.totalCalls++;

    if (usage.success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    if (usage.category) stats.categories.add(usage.category);
    if (usage.executionId) stats.executionIds.add(usage.executionId);
    if (usage.source) stats.sources.add(usage.source);
    if (usage.context) stats.contexts.push(usage.context);
  }

  /**
   * Determine success from content
   */
  determineSuccess(content, toolName) {
    const errorIndicators = ['error', 'failed', 'cannot', 'unable', 'not found'];
    const successIndicators = ['success', 'completed', 'created', 'updated'];

    const lowerContent = content.toLowerCase();

    if (errorIndicators.some(indicator => lowerContent.includes(indicator))) {
      return false;
    }

    if (successIndicators.some(indicator => lowerContent.includes(indicator))) {
      return true;
    }

    // Default to true for most tools
    return true;
  }

  /**
   * Extract context from content
   */
  extractContext(content, toolName) {
    // Extract relevant context based on tool type
    if (toolName === 'readFile' && content.includes('<file name=')) {
      const match = content.match(/name="([^"]+)"/);
      return match ? `file: ${match[1]}` : 'file operation';
    }

    if (toolName === 'executeBash' && content.includes('command')) {
      return 'command execution';
    }

    return 'general usage';
  }

  /**
   * Get category for tool
   */
  getCategoryForTool(toolName) {
    for (const [tool, definition] of Object.entries(this.toolDefinitions)) {
      if (tool === toolName) {
        return definition.category;
      }
    }
    return 'Other';
  }

  /**
   * Extract timestamp from log line
   */
  extractTimestampFromLog(line) {
    const timestampMatch = line.match(/\[([\d-T:.Z]+)\]/);
    return timestampMatch ? timestampMatch[1] : new Date().toISOString();
  }

  /**
   * Analyze tool patterns
   */
  analyzeToolPatterns() {
    console.log('Analyzing tool patterns...');

    // Group by execution ID
    const executionGroups = {};
    this.toolData.toolCalls.forEach(call => {
      if (call.executionId) {
        if (!executionGroups[call.executionId]) {
          executionGroups[call.executionId] = [];
        }
        executionGroups[call.executionId].push(call);
      }
    });

    // Analyze patterns
    Object.entries(executionGroups).forEach(([executionId, calls]) => {
      const pattern = {
        executionId,
        toolSequence: calls.map(c => c.toolName),
        uniqueTools: [...new Set(calls.map(c => c.toolName))],
        totalCalls: calls.length,
        successRate: calls.filter(c => c.success).length / calls.length,
        categories: [...new Set(calls.map(c => c.category))],
        sources: [...new Set(calls.map(c => c.source))]
      };

      this.toolData.workflowPatterns[executionId] = pattern;
    });
  }

  /**
   * Calculate statistics
   */
  calculateStatistics() {
    console.log('Calculating statistics...');

    Object.entries(this.toolData.toolStats).forEach(([toolName, stats]) => {
      const successRate = stats.totalCalls > 0 ?
        (stats.successfulCalls / stats.totalCalls) * 100 : 0;

      this.toolData.successRates[toolName] = {
        successRate: Math.round(successRate * 100) / 100,
        totalCalls: stats.totalCalls,
        successfulCalls: stats.successfulCalls,
        failedCalls: stats.failedCalls,
        uniqueExecutions: stats.executionIds.size,
        categories: Array.from(stats.categories),
        sources: Array.from(stats.sources),
        commonContexts: this.getTopContexts(stats.contexts)
      };
    });
  }

  /**
   * Get top contexts for a tool
   */
  getTopContexts(contexts) {
    const contextCounts = {};
    contexts.forEach(context => {
      contextCounts[context] = (contextCounts[context] || 0) + 1;
    });

    return Object.entries(contextCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([context, count]) => ({ context, count }));
  }

  /**
   * Identify common sequences
   */
  identifySequences() {
    console.log('Identifying tool sequences...');

    const sequences = {};

    Object.values(this.toolData.workflowPatterns).forEach(pattern => {
      const sequence = pattern.toolSequence.join(' -> ');
      if (sequence.length > 0) {
        if (!sequences[sequence]) {
          sequences[sequence] = {
            pattern: sequence,
            count: 0,
            executionIds: [],
            avgSuccessRate: 0
          };
        }
        sequences[sequence].count++;
        sequences[sequence].executionIds.push(pattern.executionId);
        sequences[sequence].avgSuccessRate += pattern.successRate;
      }
    });

    // Calculate average success rates and sort
    Object.values(sequences).forEach(seq => {
      seq.avgSuccessRate = seq.avgSuccessRate / seq.count;
    });

    this.toolData.toolSequences = Object.values(sequences)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  /**
   * Categorize tools
   */
  categorizeTools() {
    console.log('Categorizing tools...');

    // Reset categories
    Object.keys(this.toolData.toolCategories).forEach(category => {
      this.toolData.toolCategories[category] = [];
    });

    // Categorize tools based on usage
    Object.keys(this.toolData.toolStats).forEach(toolName => {
      const category = this.getCategoryForTool(toolName);
      this.toolData.toolCategories[category].push({
        name: toolName,
        usage: this.toolData.successRates[toolName]
      });
    });

    // Sort tools within categories by usage
    Object.keys(this.toolData.toolCategories).forEach(category => {
      this.toolData.toolCategories[category].sort((a, b) => b.usage.totalCalls - a.usage.totalCalls);
    });
  }

  /**
   * Generate results
   */
  generateResults() {
    const totalCalls = this.toolData.toolCalls.length;
    const uniqueTools = Object.keys(this.toolData.toolStats).length;
    const uniqueExecutions = new Set(this.toolData.toolCalls.map(c => c.executionId).filter(Boolean)).size;

    return {
      summary: {
        totalToolCalls: totalCalls,
        uniqueTools,
        uniqueExecutions,
        categories: Object.keys(this.toolData.toolCategories).filter(cat =>
          this.toolData.toolCategories[cat].length > 0
        ).length,
        averageSuccessRate: this.calculateOverallSuccessRate(),
        mostUsedTool: this.getMostUsedTool(),
        dataSourcesCovered: this.getDataSourcesCovered()
      },
      toolStatistics: this.toolData.successRates,
      toolCategories: this.toolData.toolCategories,
      commonSequences: this.toolData.toolSequences,
      workflowPatterns: this.toolData.workflowPatterns,
      insights: this.generateInsights(),
      rawData: {
        totalCalls: totalCalls,
        callsWithErrors: this.toolData.toolCalls.filter(c => !c.success).length,
        sourcesAnalyzed: [...new Set(this.toolData.toolCalls.map(c => c.source))]
      }
    };
  }

  /**
   * Calculate overall success rate
   */
  calculateOverallSuccessRate() {
    const totalCalls = this.toolData.toolCalls.length;
    const successfulCalls = this.toolData.toolCalls.filter(c => c.success).length;
    return totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 10000) / 100 : 0;
  }

  /**
   * Get most used tool
   */
  getMostUsedTool() {
    let maxCalls = 0;
    let mostUsed = null;

    Object.entries(this.toolData.successRates).forEach(([tool, stats]) => {
      if (stats.totalCalls > maxCalls) {
        maxCalls = stats.totalCalls;
        mostUsed = tool;
      }
    });

    return mostUsed;
  }

  /**
   * Get data sources covered
   */
  getDataSourcesCovered() {
    return [...new Set(this.toolData.toolCalls.map(c => c.source))];
  }

  /**
   * Generate insights
   */
  generateInsights() {
    const insights = [];

    // Most used category
    const categoryUsage = {};
    Object.entries(this.toolData.toolCategories).forEach(([category, tools]) => {
      categoryUsage[category] = tools.reduce((sum, tool) => sum + tool.usage.totalCalls, 0);
    });

    const topCategory = Object.entries(categoryUsage)
      .sort((a, b) => b[1] - a[1])[0];

    if (topCategory) {
      insights.push(`Most used tool category: ${topCategory[0]} (${topCategory[1]} calls)`);
    }

    // Success rate insights
    const lowSuccessTools = Object.entries(this.toolData.successRates)
      .filter(([_, stats]) => stats.successRate < 80 && stats.totalCalls > 2)
      .map(([tool, _]) => tool);

    if (lowSuccessTools.length > 0) {
      insights.push(`Tools with lower success rates: ${lowSuccessTools.join(', ')}`);
    }

    // Common patterns
    if (this.toolData.toolSequences.length > 0) {
      const topSequence = this.toolData.toolSequences[0];
      insights.push(`Most common tool sequence: ${topSequence.pattern} (${topSequence.count} times)`);
    }

    return insights;
  }

  /**
   * Save results
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
  const analyzer = new ComprehensiveToolAnalyzer();
  analyzer.analyze()
    .then(results => {
      console.log('\n=== COMPREHENSIVE TOOL USAGE ANALYSIS ===');
      console.log(`Total tool calls analyzed: ${results.summary.totalToolCalls}`);
      console.log(`Unique tools identified: ${results.summary.uniqueTools}`);
      console.log(`Unique executions: ${results.summary.uniqueExecutions}`);
      console.log(`Tool categories: ${results.summary.categories}`);
      console.log(`Overall success rate: ${results.summary.averageSuccessRate}%`);
      console.log(`Most used tool: ${results.summary.mostUsedTool}`);
      console.log(`Data sources: ${results.summary.dataSourcesCovered.join(', ')}`);

      if (results.insights.length > 0) {
        console.log('\nKey Insights:');
        results.insights.forEach(insight => console.log(`- ${insight}`));
      }
    })
    .catch(error => {
      console.error('Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveToolAnalyzer;
