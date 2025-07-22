#!/usr/bin/env node

/**
 * Trace Context Extractor
 * Extracts context injection patterns from API trace data
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class TraceContextExtractor {
  constructor() {
    this.contextPatterns = {
      requestBodies: [],
      contextObjects: [],
      fileReferences: [],
      documentReferences: [],
      contextTransformations: []
    };

    this.processedRequests = 0;
    this.contextCount = 0;
  }

  /**
   * Process trace file line by line tot context patterns
   */
  async processTraceFile(filePath) {
    console.log('Processing trace file for context patterns...');

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber++;

      if (lineNumber % 1000 === 0) {
        console.log(`Processed ${lineNumber} lines...`);
      }

      try {
        const data = JSON.parse(line);
        this.processTraceEntry(data, lineNumber);
      } catch (error) {
        // Skip malformed JSON lines
        continue;
      }
    }

    console.log(`Completed processing ${lineNumber} lines`);
    return this.contextPatterns;
  }

  /**
   * Process individual trace entry for context patterns
   */
  processTraceEntry(entry, lineNumber) {
    const { type, requestId, conversationId } = entry;

    switch (type) {
      case 'request_body_full':
        this.extractRequestBodyContext(entry, lineNumber);
        break;
      case 'streaming_chunk':
        this.extractStreamingContext(entry, lineNumber);
        break;
      default:
        // Skip other entry types for context analysis
        break;
    }
  }

  /**
   * Extract context from request bodies
   */
  extractRequestBodyContext(entry, lineNumber) {
    const { requestId, conversationId, userMessage, bodySize } = entry;

    this.processedRequests++;

    // Look for context indicators in user messages
    if (userMessage) {
      const contextInfo = this.analyzeMessageForContext(userMessage, requestId, conversationId);
      if (contextInfo.hasContext) {
        this.contextPatterns.requestBodies.push({
          requestId,
          conversationId,
          lineNumber,
          bodySize,
          contextInfo
        });
        this.contextCount++;
      }
    }
  }

  /**
   * Extract context from streaming chunks
   */
  extractStreamingContext(entry, lineNumber) {
    const { requestId, chunkUtf8, hasAssistantEvent, hasToolEvent } = entry;

    if (chunkUtf8) {
      // Look for context references in streaming responses
      const contextRefs = this.findContextReferences(chunkUtf8);
      if (contextRefs.length > 0) {
        this.contextPatterns.contextObjects.push({
          requestId,
          lineNumber,
          chunkContent: chunkUtf8.substring(0, 200), // First 200 chars for analysis
          contextReferences: contextRefs,
          hasAssistantEvent,
          hasToolEvent
        });
      }
    }
  }

  /**
   * Analyze message content for context patterns
   */
  analyzeMessageForContext(message, requestId, conversationId) {
    const contextInfo = {
      hasContext: false,
      fileReferences: [],
      documentReferences: [],
      steeringReferences: [],
      contextTypes: [],
      contextKeywords: []
    };

    // Look for file references
    const filePatterns = [
      /\.kiro\/[^\s]+/g,
      /\.[a-zA-Z]{2,4}(?:\s|$)/g,
      /\/[^\s]+\.[a-zA-Z]{2,4}/g
    ];

    filePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        contextInfo.fileReferences.push(...matches);
        contextInfo.hasContext = true;
      }
    });

    // Look for document references
    const docPatterns = [
      /requirements\.md/gi,
      /design\.md/gi,
      /tasks\.md/gi,
      /README\.md/gi,
      /spec/gi,
      /documentation/gi
    ];

    docPatterns.forEach(pattern => {
      if (pattern.test(message)) {
        contextInfo.documentReferences.push(pattern.source);
        contextInfo.hasContext = true;
      }
    });

    // Look for steering references
    const steeringPatterns = [
      /steering/gi,
      /guidance/gi,
      /rules/gi,
      /instructions/gi
    ];

    steeringPatterns.forEach(pattern => {
      if (pattern.test(message)) {
        contextInfo.steeringReferences.push(pattern.source);
        contextInfo.hasContext = true;
      }
    });

    // Look for context keywords
    const contextKeywords = [
      'context', 'file', 'document', 'reference', 'include',
      'workspace', 'project', 'codebase', 'directory'
    ];

    contextKeywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword)) {
        contextInfo.contextKeywords.push(keyword);
        contextInfo.hasContext = true;
      }
    });

    // Categorize context types
    if (contextInfo.fileReferences.length > 0) contextInfo.contextTypes.push('file');
    if (contextInfo.documentReferences.length > 0) contextInfo.contextTypes.push('document');
    if (contextInfo.steeringReferences.length > 0) contextInfo.contextTypes.push('steering');

    return contextInfo;
  }

  /**
   * Find context references in streaming content
   */
  findContextReferences(content) {
    const references = [];

    // Look for JSON-like context objects
    const jsonPatterns = [
      /"type":\s*"(fileTree|file|steering|context)"/g,
      /"path":\s*"([^"]+)"/g,
      /"expandedPaths":\s*\[([^\]]+)\]/g
    ];

    jsonPatterns.forEach(pattern => {
      const matches = [...content.matchAll(pattern)];
      matches.forEach(match => {
        references.push({
          type: 'json_context',
          pattern: pattern.source,
          match: match[0],
          value: match[1] || match[0]
        });
      });
    });

    // Look for file path references
    const pathPattern = /\.kiro\/[^\s"]+/g;
    const pathMatches = [...content.matchAll(pathPattern)];
    pathMatches.forEach(match => {
      references.push({
        type: 'file_path',
        value: match[0]
      });
    });

    return references;
  }

  /**
   * Generate context injection report from trace data
   */
  generateTraceContextReport() {
    const report = {
      summary: {
        totalRequestsProcessed: this.processedRequests,
        requestsWithContext: this.contextPatterns.requestBodies.length,
        contextObjectsFound: this.contextPatterns.contextObjects.length,
        contextPercentage: this.processedRequests > 0 ?
          ((this.contextPatterns.requestBodies.length / this.processedRequests) * 100).toFixed(2) : 0
      },
      requestBodyContexts: this.contextPatterns.requestBodies,
      streamingContexts: this.contextPatterns.contextObjects,
      patterns: this.analyzeTracePatterns()
    };

    return report;
  }

  /**
   * Analyze patterns in trace context data
   */
  analyzeTracePatterns() {
    const patterns = {
      fileReferencePatterns: {},
      documentReferencePatterns: {},
      contextTypeDistribution: {},
      contextKeywordFrequency: {}
    };

    // Analyze request body contexts
    this.contextPatterns.requestBodies.forEach(req => {
      const { contextInfo } = req;

      // Count file reference patterns
      contextInfo.fileReferences.forEach(ref => {
        patterns.fileReferencePatterns[ref] = (patterns.fileReferencePatterns[ref] || 0) + 1;
      });

      // Count document reference patterns
      contextInfo.documentReferences.forEach(ref => {
        patterns.documentReferencePatterns[ref] = (patterns.documentReferencePatterns[ref] || 0) + 1;
      });

      // Count context types
      contextInfo.contextTypes.forEach(type => {
        patterns.contextTypeDistribution[type] = (patterns.contextTypeDistribution[type] || 0) + 1;
      });

      // Count context keywords
      contextInfo.contextKeywords.forEach(keyword => {
        patterns.contextKeywordFrequency[keyword] = (patterns.contextKeywordFrequency[keyword] || 0) + 1;
      });
    });

    return patterns;
  }
}

// Main execution
async function main() {
  try {
    console.log('Starting trace context extraction...');

    const traceFilePath = path.join(__dirname, '..', 'kiro_full_trace.jsonl');
    if (!fs.existsSync(traceFilePath)) {
      throw new Error(`Trace file not found: ${traceFilePath}`);
    }

    const extractor = new TraceContextExtractor();
    await extractor.processTraceFile(traceFilePath);

    const report = extractor.generateTraceContextReport();

    // Save results
    const outputPath = path.join(__dirname, 'trace-context-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Trace context analysis saved to: ${outputPath}`);

    // Print summary
    console.log('\n=== Trace Context Analysis Summary ===');
    console.log(`Total requests processed: ${report.summary.totalRequestsProcessed}`);
    console.log(`Requests with context: ${report.summary.requestsWithContext}`);
    console.log(`Context objects found: ${report.summary.contextObjectsFound}`);
    console.log(`Context percentage: ${report.summary.contextPercentage}%`);

    return report;

  } catch (error) {
    console.error('Error in trace context extraction:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { TraceContextExtractor };

// Run if called directly
if (require.main === module) {
  main();
}
