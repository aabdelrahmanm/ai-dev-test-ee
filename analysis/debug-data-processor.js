/**
 * Debug Data Processor
 * Processes all debug folder data and extracts structured information
 */

const fs = require('fs');
const path = require('path');

class DebugDataProcessor {
  constructor(debugFolderPath = 'debug') {
    this.debugFolderPath = debugFolderPath;
    this.data = {
      conversations: [],
      systemEvents: [],
      executionData: null,
      statistics: {
        totalChatFiles: 0,
        totalSystemEvents: 0,
        contextTypes: {},
        toolUsage: {},
        errorCount: 0
      }
    };
  }

  /**
   * Main processing function - processes all debug data
   */
  async processAllData() {
    console.log('Starting debug data processing...');

    try {
      // Process chat files
      await this.processChatFiles();

      // Process debug log
      await this.processDebugLog();

      // Process execution log
      await this.processExecutionLog();

      // Generate statistics
      this.generateStatistics();

      console.log('Debug data processing completed successfully');
      return this.data;
    } catch (error) {
      console.error('Error processing debug data:', error.message);
      this.data.statistics.errorCount++;
      return this.data;
    }
  }

  /**
   * Process all .chat files in the debug/chats directory
   */
  async processChatFiles() {
    const chatsDir = path.join(this.debugFolderPath, 'chats');

    if (!fs.existsSync(chatsDir)) {
      console.warn('Chats directory not found');
      return;
    }

    const chatFiles = fs.readdirSync(chatsDir).filter(file => file.endsWith('.chat'));
    console.log(`Processing ${chatFiles.length} chat files...`);

    for (const chatFile of chatFiles) {
      try {
        const filePath = path.join(chatsDir, chatFile);
        const chatData = this.parseChatFile(filePath);
        if (chatData) {
          this.data.conversations.push(chatData);
          this.data.statistics.totalChatFiles++;
        }
      } catch (error) {
        console.warn(`Error processing chat file ${chatFile}:`, error.message);
        this.data.statistics.errorCount++;
      }
    }
  }

  /**
   * Parse individual chat file and extract conversation data
   */
  parseChatFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const chatData = JSON.parse(content);

      const processedChat = {
        fileName: path.basename(filePath),
        executionId: chatData.executionId,
        actionId: chatData.actionId,
        context: this.processContext(chatData.context || []),
        messages: this.processMessages(chatData.messages || []),
        toolUsage: this.processToolUsage(chatData.toolUsage || []),
        metadata: {
          contextCount: (chatData.context || []).length,
          messageCount: (chatData.messages || []).length,
          toolCount: (chatData.toolUsage || []).length
        }
      };

      return processedChat;
    } catch (error) {
      console.warn(`Failed to parse chat file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Process context data from chat files
   */
  processContext(contextArray) {
    const processedContext = [];

    contextArray.forEach((ctx, index) => {
      try {
        const contextItem = {
          index,
          type: ctx.type,
          path: ctx.path || null,
          target: ctx.target || null,
          expandedPaths: ctx.expandedPaths || [],
          openedFiles: ctx.openedFiles || [],
          hasContent: !!ctx.content
        };

        // Track context types for statistics
        if (!this.data.statistics.contextTypes[ctx.type]) {
          this.data.statistics.contextTypes[ctx.type] = 0;
        }
        this.data.statistics.contextTypes[ctx.type]++;

        processedContext.push(contextItem);
      } catch (error) {
        console.warn(`Error processing context item ${index}:`, error.message);
      }
    });

    return processedContext;
  }

  /**
   * Process messages from chat files
   */
  processMessages(messagesArray) {
    const processedMessages = [];

    messagesArray.forEach((msg, index) => {
      try {
        const messageItem = {
          index,
          role: msg.role,
          content: msg.content ? msg.content.substring(0, 500) : null, // Truncate for storage
          contentLength: msg.content ? msg.content.length : 0,
          timestamp: msg.timestamp || null,
          type: msg.type || 'text'
        };

        processedMessages.push(messageItem);
      } catch (error) {
        console.warn(`Error processing message ${index}:`, error.message);
      }
    });

    return processedMessages;
  }

  /**
   * Process tool usage data from chat files
   */
  processToolUsage(toolUsageArray) {
    const processedTools = [];

    toolUsageArray.forEach((tool, index) => {
      try {
        const toolItem = {
          index,
          name: tool.name,
          input: tool.input ? Object.keys(tool.input) : [],
          output: tool.output ? (typeof tool.output === 'string' ? tool.output.substring(0, 200) : 'object') : null,
          timestamp: tool.timestamp || null,
          success: tool.success !== false // Default to true if not specified
        };

        // Track tool usage for statistics
        if (!this.data.statistics.toolUsage[tool.name]) {
          this.data.statistics.toolUsage[tool.name] = 0;
        }
        this.data.statistics.toolUsage[tool.name]++;

        processedTools.push(toolItem);
      } catch (error) {
        console.warn(`Error processing tool usage ${index}:`, error.message);
      }
    });

    return processedTools;
  }

  /**
   * Process debug.log file and extract system events
   */
  async processDebugLog() {
    const logPath = path.join(this.debugFolderPath, 'debug.log');

    if (!fs.existsSync(logPath)) {
      console.warn('Debug log file not found');
      return;
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      console.log(`Processing ${lines.length} log lines...`);

      lines.forEach((line, index) => {
        try {
          const event = this.parseLogLine(line, index);
          if (event) {
            this.data.systemEvents.push(event);
            this.data.statistics.totalSystemEvents++;
          }
        } catch (error) {
          console.warn(`Error parsing log line ${index}:`, error.message);
        }
      });
    } catch (error) {
      console.error('Error processing debug log:', error.message);
      this.data.statistics.errorCount++;
    }
  }

  /**
   * Parse individual log line and extract event data
   */
  parseLogLine(line, lineNumber) {
    // Skip empty lines and headers
    if (!line.trim() || line.includes('Kiro Version:') || line.includes('Platform:') || line.includes('---') || line.includes('Agent Logs:')) {
      return null;
    }

    // Parse log format: [timestamp] [level] [component] message {metadata}
    const logPattern = /^\[([^\]]+)\]\s+\[([^\]]+)\](?:\s+\[([^\]]+)\])?\s+(.+)$/;
    const match = line.match(logPattern);

    if (match) {
      const [, timestamp, level, component, message] = match;

      return {
        lineNumber,
        timestamp: new Date(timestamp),
        level,
        component: component || 'unknown',
        message: message.trim(),
        rawLine: line
      };
    } else {
      // Handle non-standard log lines
      return {
        lineNumber,
        timestamp: null,
        level: 'unknown',
        component: 'unknown',
        message: line.trim(),
        rawLine: line
      };
    }
  }

  /**
   * Process execution-log.json file
   */
  async processExecutionLog() {
    const logPath = path.join(this.debugFolderPath, 'execution-log.json');

    if (!fs.existsSync(logPath)) {
      console.warn('Execution log file not found');
      return;
    }

    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const executionData = JSON.parse(content);

      this.data.executionData = {
        executionId: executionData.executionId,
        workflowType: executionData.workflowType,
        status: executionData.status,
        startTime: new Date(executionData.startTime),
        autonomyMode: executionData.autonomyMode,
        hookId: executionData.hookId,
        chatSessionId: executionData.chatSessionId,
        title: executionData.title,
        input: {
          prompt: executionData.input?.data?.prompt ? executionData.input.data.prompt.substring(0, 1000) : null,
          promptLength: executionData.input?.data?.prompt?.length || 0,
          documentsCount: executionData.input?.documents?.length || 0,
          documentPaths: (executionData.input?.documents || []).map(doc => doc.path)
        },
        actions: (executionData.actions || []).map((action, index) => ({
          index,
          type: action.type || 'unknown',
          timestamp: action.timestamp ? new Date(action.timestamp) : null,
          hasData: !!action.data
        }))
      };

      console.log('Execution log processed successfully');
    } catch (error) {
      console.error('Error processing execution log:', error.message);
      this.data.statistics.errorCount++;
    }
  }

  /**
   * Generate summary statistics
   */
  generateStatistics() {
    // Calculate additional statistics
    this.data.statistics.averageContextPerChat = this.data.statistics.totalChatFiles > 0
      ? Math.round(this.data.conversations.reduce((sum, chat) => sum + chat.metadata.contextCount, 0) / this.data.statistics.totalChatFiles)
      : 0;

    this.data.statistics.averageMessagesPerChat = this.data.statistics.totalChatFiles > 0
      ? Math.round(this.data.conversations.reduce((sum, chat) => sum + chat.metadata.messageCount, 0) / this.data.statistics.totalChatFiles)
      : 0;

    this.data.statistics.totalToolInvocations = Object.values(this.data.statistics.toolUsage).reduce((sum, count) => sum + count, 0);

    // System events by component
    this.data.statistics.eventsByComponent = {};
    this.data.systemEvents.forEach(event => {
      if (!this.data.statistics.eventsByComponent[event.component]) {
        this.data.statistics.eventsByComponent[event.component] = 0;
      }
      this.data.statistics.eventsByComponent[event.component]++;
    });

    // System events by level
    this.data.statistics.eventsByLevel = {};
    this.data.systemEvents.forEach(event => {
      if (!this.data.statistics.eventsByLevel[event.level]) {
        this.data.statistics.eventsByLevel[event.level] = 0;
      }
      this.data.statistics.eventsByLevel[event.level]++;
    });
  }

  /**
   * Save processed data to JSON file
   */
  saveToFile(outputPath = 'analysis/debug-processed-data.json') {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(this.data, null, 2));
      console.log(`Processed data saved to ${outputPath}`);
    } catch (error) {
      console.error('Error saving processed data:', error.message);
    }
  }

  /**
   * Print summary of processed data
   */
  printSummary() {
    console.log('\n=== DEBUG DATA PROCESSING SUMMARY ===');
    console.log(`Total chat files processed: ${this.data.statistics.totalChatFiles}`);
    console.log(`Total system events: ${this.data.statistics.totalSystemEvents}`);
    console.log(`Total tool invocations: ${this.data.statistics.totalToolInvocations}`);
    console.log(`Processing errors: ${this.data.statistics.errorCount}`);

    console.log('\nContext types:');
    Object.entries(this.data.statistics.contextTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\nTop tools used:');
    Object.entries(this.data.statistics.toolUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count}`);
      });

    console.log('\nSystem events by component:');
    Object.entries(this.data.statistics.eventsByComponent)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([component, count]) => {
        console.log(`  ${component}: ${count}`);
      });
  }
}

module.exports = DebugDataProcessor;
