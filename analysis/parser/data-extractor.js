#!/usr/bin/env node

const fs = require('fs');

/**
 * Enhanced data extractor for Kiro trace analysis
 * Focuses on extracting structured data for analysis
 */

class KiroTraceExtractor {
  constructor(traceFilePath) {
    this.traceFilePath = traceFilePath;
    this.data = {
      requests: [],
      responses: [],
      conversations: new Map(),
      toolUsage: [],
      systemEvents: [],
      apiSequences: [],
      promptTemplates: [],
      contextInjections: []
    };
  }

  // Decode binary chunks with better error handling
  decodeHexChunk(hexString) {
    try {
      const buffer = Buffer.from(hexString, 'hex');
      const text = buffer.toString('utf8');

      // Extract JSON objects more reliably
      const jsonObjects = [];
      let depth = 0;
      let start = -1;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (char === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            try {
              const jsonStr = text.substring(start, i + 1);
              const parsed = JSON.parse(jsonStr);
              jsonObjects.push(parsed);
            } catch (e) {
              // Skip malformed JSON
            }
            start = -1;
          }
        }
      }

      return {
        success: true,
        text: text,
        jsonObjects: jsonObjects,
        buffer: buffer
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        text: '',
        jsonObjects: [],
        buffer: null
      };
    }
  }

  // Extract prompt templates from system messages
  extractPromptTemplates(userMessage) {
    if (!userMessage) return [];

    const templates = [];

    // Look for common prompt patterns
    const patterns = [
      /You are operating in a workspace with files and folders\./,
      /I am providing you some additional guidance/,
      /## Included Rules \([^)]+\)/g,
      /<user-rule id=[^>]+>/g,
      /You are a Software engineering AI Agent/,
      /# Identity[\s\S]*?# Capabilities/,
      /These are the files in the directory/
    ];

    patterns.forEach((pattern, index) => {
      const matches = userMessage.match(pattern);
      if (matches) {
        templates.push({
          type: `template_${index}`,
          pattern: pattern.toString(),
          matches: matches,
          context: 'system_prompt'
        });
      }
    });

    return templates;
  }

  // Extract context injection patterns
  extractContextInjections(userMessage) {
    if (!userMessage) return [];

    const injections = [];

    // File tree context
    const fileTreeMatch = userMessage.match(/<fileTree>([\s\S]*?)<\/fileTree>/);
    if (fileTreeMatch) {
      injections.push({
        type: 'file_tree',
        content: fileTreeMatch[1],
        size: fileTreeMatch[1].length
      });
    }

    // User rules context
    const userRuleMatches = userMessage.match(/<user-rule id=([^>]+)>([\s\S]*?)<\/user-rule>/g);
    if (userRuleMatches) {
      userRuleMatches.forEach(match => {
        const idMatch = match.match(/id=([^>]+)/);
        injections.push({
          type: 'user_rule',
          ruleId: idMatch ? idMatch[1] : 'unknown',
          content: match,
          size: match.length
        });
      });
    }

    return injections;
  }

  // Process the trace file
  async process() {
    console.log('🔍 Processing Kiro trace file...');

    const lines = fs.readFileSync(this.traceFilePath, 'utf8').trim().split('\n');
    const requestMap = new Map();
    let currentRequest = null;

    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);

        switch (entry.type) {
          case 'request':
            currentRequest = {
              requestId: entry.requestId,
              timestamp: entry.timestamp,
              method: entry.method,
              host: entry.host,
              path: entry.path,
              headers: entry.headers,
              contentLength: entry.contentLength,
              chunks: [],
              toolUsage: [],
              assistantMessages: []
            };
            requestMap.set(entry.requestId, currentRequest);
            this.data.requests.push(currentRequest);
            break;

          case 'request_body_full':
            if (currentRequest) {
              currentRequest.conversationId = entry.conversationId;
              currentRequest.userMessage = entry.userMessage;
              currentRequest.bodySize = entry.bodySize;

              // Extract prompt templates and context injections
              const templates = this.extractPromptTemplates(entry.userMessage);
              const injections = this.extractContextInjections(entry.userMessage);

              this.data.promptTemplates.push(...templates);
              this.data.contextInjections.push(...injections);

              // Track conversation
              if (!this.data.conversations.has(entry.conversationId)) {
                this.data.conversations.set(entry.conversationId, {
                  id: entry.conversationId,
                  requests: [],
                  toolsUsed: new Set(),
                  messageCount: 0,
                  totalTokens: entry.bodySize || 0
                });
              }

              const conv = this.data.conversations.get(entry.conversationId);
              conv.requests.push(currentRequest);
              conv.messageCount++;
            }
            break;

          case 'response_headers':
            if (currentRequest) {
              currentRequest.responseStatus = entry.statusCode;
              currentRequest.responseHeaders = entry.headers;
              currentRequest.isChunked = entry.isChunked;
            }
            break;

          case 'streaming_chunk':
            if (currentRequest && entry.chunkHex) {
              const decoded = this.decodeHexChunk(entry.chunkHex);

              const chunkData = {
                chunkNumber: entry.chunkNumber,
                chunkSize: entry.chunkSize,
                timestamp: entry.timestamp,
                hasEventType: entry.hasEventType,
                hasAssistantEvent: entry.hasAssistantEvent,
                hasToolEvent: entry.hasToolEvent,
                decoded: decoded
              };

              currentRequest.chunks.push(chunkData);

              // Process extracted JSON for tool usage
              if (decoded.success && decoded.jsonObjects.length > 0) {
                decoded.jsonObjects.forEach(json => {
                  if (json.name && json.toolUseId) {
                    const toolUse = {
                      name: json.name,
                      toolUseId: json.toolUseId,
                      requestId: currentRequest.requestId,
                      conversationId: currentRequest.conversationId,
                      timestamp: entry.timestamp,
                      input: json.input || '',
                      chunkNumber: entry.chunkNumber
                    };

                    this.data.toolUsage.push(toolUse);
                    currentRequest.toolUsage.push(toolUse);

                    // Track in conversation
                    if (currentRequest.conversationId) {
                      const conv = this.data.conversations.get(currentRequest.conversationId);
                      if (conv) {
                        conv.toolsUsed.add(json.name);
                      }
                    }
                  }

                  if (json.content) {
                    currentRequest.assistantMessages.push({
                      content: json.content,
                      timestamp: entry.timestamp,
                      chunkNumber: entry.chunkNumber
                    });
                  }
                });
              }
            }
            break;

          case 'streaming_complete':
            if (currentRequest) {
              currentRequest.totalChunks = entry.totalChunks;
              currentRequest.hasAssistantEvents = entry.hasAssistantEvents;
              currentRequest.completed = true;

              // Create API sequence entry
              this.data.apiSequences.push({
                requestId: currentRequest.requestId,
                conversationId: currentRequest.conversationId,
                sequence: [
                  {
                    type: 'request',
                    timestamp: currentRequest.timestamp,
                    method: currentRequest.method,
                    endpoint: `${currentRequest.host}${currentRequest.path}`,
                    body: currentRequest.userMessage ? { userMessage: currentRequest.userMessage.substring(0, 500) + '...' } : {}
                  },
                  {
                    type: 'response',
                    timestamp: entry.timestamp,
                    status: currentRequest.responseStatus,
                    chunks: currentRequest.chunks.length,
                    toolsUsed: currentRequest.toolUsage.map(t => t.name),
                    assistantMessageCount: currentRequest.assistantMessages.length
                  }
                ]
              });
            }
            break;
        }
      } catch (e) {
        console.warn(`⚠️  Parse error on line ${i + 1}: ${e.message}`);
      }
    }

    console.log('✅ Processing complete!');
    return this.generateSummary();
  }

  // Generate analysis summary
  generateSummary() {
    const summary = {
      totalRequests: this.data.requests.length,
      totalConversations: this.data.conversations.size,
      totalToolUsage: this.data.toolUsage.length,
      totalPromptTemplates: this.data.promptTemplates.length,
      totalContextInjections: this.data.contextInjections.length,

      toolUsageStats: {},
      conversationStats: [],
      promptTemplateStats: {},
      contextInjectionStats: {}
    };

    // Tool usage statistics
    this.data.toolUsage.forEach(tool => {
      summary.toolUsageStats[tool.name] = (summary.toolUsageStats[tool.name] || 0) + 1;
    });

    // Conversation statistics
    this.data.conversations.forEach((conv, id) => {
      summary.conversationStats.push({
        id: id,
        requestCount: conv.requests.length,
        toolsUsed: Array.from(conv.toolsUsed),
        messageCount: conv.messageCount,
        totalTokens: conv.totalTokens
      });
    });

    // Prompt template statistics
    this.data.promptTemplates.forEach(template => {
      summary.promptTemplateStats[template.type] = (summary.promptTemplateStats[template.type] || 0) + 1;
    });

    // Context injection statistics
    this.data.contextInjections.forEach(injection => {
      summary.contextInjectionStats[injection.type] = (summary.contextInjectionStats[injection.type] || 0) + 1;
    });

    return summary;
  }

  // Export data for analysis
  exportData(outputPath = './analysis/extracted-data.json') {
    const exportData = {
      summary: this.generateSummary(),
      requests: this.data.requests,
      conversations: Array.from(this.data.conversations.entries()).map(([id, data]) => ({
        id,
        ...data,
        toolsUsed: Array.from(data.toolsUsed)
      })),
      toolUsage: this.data.toolUsage,
      apiSequences: this.data.apiSequences,
      promptTemplates: this.data.promptTemplates,
      contextInjections: this.data.contextInjections
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`📁 Data exported to ${outputPath}`);

    return exportData;
  }
}

// Main execution
if (require.main === module) {
  const extractor = new KiroTraceExtractor('./kiro_full_trace.jsonl');

  extractor.process()
    .then(summary => {
      console.log('\n📊 Analysis Summary:');
      console.log(`  Requests: ${summary.totalRequests}`);
      console.log(`  Conversations: ${summary.totalConversations}`);
      console.log(`  Tool Usage: ${summary.totalToolUsage}`);
      console.log(`  Prompt Templates: ${summary.totalPromptTemplates}`);
      console.log(`  Context Injections: ${summary.totalContextInjections}`);

      console.log('\n🔧 Tool Usage:');
      Object.entries(summary.toolUsageStats).forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count}`);
      });

      extractor.exportData();
    })
    .catch(error => {
      console.error('❌ Processing failed:', error);
    });
}

module.exports = KiroTraceExtractor;
