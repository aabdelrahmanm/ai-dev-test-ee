#!/usr/bin/env node

const fs = require('fs');

// Read the trace file
const traceFile = './kiro_full_trace.jsonl';
const lines = fs.readFileSync(traceFile, 'utf8').trim().split('\n');

console.log('=== Kiro Streaming Trace Analysis (Fixed) ===\n');

// Storage for parsed data
const parsedData = {
  apiInteractions: [],
  conversations: {},
  statistics: {
    totalRequests: 0,
    totalConversations: 0,
    toolUsageCount: {},
    errorCount: 0
  }
};

// Helper function to decode hex to buffer and extract JSON
function decodeHexChunk(hexString) {
  try {
    const buffer = Buffer.from(hexString, 'hex');

    // AWS event stream format parsing
    // Look for JSON content after the headers
    const bufferStr = buffer.toString('utf8');

    // Extract JSON objects from the buffer
    const jsonMatches = [];
    let braceCount = 0;
    let jsonStart = -1;

    for (let i = 0; i < bufferStr.length; i++) {
      if (bufferStr[i] === '{') {
        if (braceCount === 0) {
          jsonStart = i;
        }
        braceCount++;
      } else if (bufferStr[i] === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          try {
            const jsonStr = bufferStr.substring(jsonStart, i + 1);
            const parsed = JSON.parse(jsonStr);
            jsonMatches.push(parsed);
          } catch (e) {
            // Skip invalid JSON
          }
          jsonStart = -1;
        }
      }
    }

    return {
      rawBuffer: buffer,
      decodedText: bufferStr,
      extractedJson: jsonMatches
    };
  } catch (e) {
    return {
      rawBuffer: null,
      decodedText: '',
      extractedJson: [],
      error: e.message
    };
  }
}

// Helper function to reconstruct messages from chunks
function reconstructMessage(chunks) {
  const messageFragments = [];
  const toolData = [];

  chunks.forEach(chunk => {
    if (chunk.extractedJson) {
      chunk.extractedJson.forEach(json => {
        if (json.content) {
          messageFragments.push(json.content);
        }
        if (json.name && json.toolUseId) {
          toolData.push(json);
        }
        if (json.input) {
          // Find corresponding tool and add input
          const tool = toolData.find(t => t.toolUseId === json.toolUseId);
          if (tool) {
            tool.input = (tool.input || '') + json.input;
          }
        }
      });
    }
  });

  return {
    fullMessage: messageFragments.join(''),
    toolUsage: toolData
  };
}

// Process each line
const requestMap = new Map();
let currentRequest = null;

lines.forEach((line, index) => {
  try {
    const entry = JSON.parse(line);

    if (entry.type === 'request') {
      console.log(`\n[${entry.timestamp}] REQUEST ${entry.requestId}`);
      console.log(`  ${entry.method} ${entry.host}${entry.path}`);

      currentRequest = {
        requestId: entry.requestId,
        timestamp: entry.timestamp,
        method: entry.method,
        endpoint: `${entry.host}${entry.path}`,
        headers: entry.headers,
        chunks: [],
        toolUsage: [],
        assistantMessages: []
      };

      requestMap.set(entry.requestId, currentRequest);
      parsedData.statistics.totalRequests++;

    } else if (entry.type === 'request_body_full') {
      console.log(`  User message: "${entry.userMessage ? entry.userMessage.substring(0, 100) + '...' : 'N/A'}"`);
      console.log(`  Conversation ID: ${entry.conversationId}`);

      if (currentRequest) {
        currentRequest.conversationId = entry.conversationId;
        currentRequest.userMessage = entry.userMessage;
        currentRequest.bodySize = entry.bodySize;
      }

      // Track conversations
      if (!parsedData.conversations[entry.conversationId]) {
        parsedData.conversations[entry.conversationId] = {
          interactions: [],
          totalDuration: 0,
          toolsUsed: [],
          messageCount: 0
        };
        parsedData.statistics.totalConversations++;
      }

    } else if (entry.type === 'response_headers') {
      console.log(`  Response: ${entry.statusCode} ${entry.headers['content-type'] || 'unknown'}`);

      if (currentRequest) {
        currentRequest.responseStatus = entry.statusCode;
        currentRequest.responseHeaders = entry.headers;
        currentRequest.isChunked = entry.isChunked;
      }

    } else if (entry.type === 'streaming_chunk') {
      // Process binary chunk
      const decoded = decodeHexChunk(entry.chunkHex);

      if (currentRequest) {
        currentRequest.chunks.push({
          chunkNumber: entry.chunkNumber,
          chunkSize: entry.chunkSize,
          timestamp: entry.timestamp,
          decoded: decoded,
          hasEventType: entry.hasEventType,
          hasAssistantEvent: entry.hasAssistantEvent,
          hasToolEvent: entry.hasToolEvent
        });
      }

      // Extract and display content immediately
      if (decoded.extractedJson.length > 0) {
        decoded.extractedJson.forEach(json => {
          if (json.content) {
            console.log(`  Assistant chunk: "${json.content}"`);
          }
          if (json.name && json.toolUseId) {
            console.log(`  Tool Use: ${json.name} (${json.toolUseId})`);

            // Track tool usage statistics
            parsedData.statistics.toolUsageCount[json.name] =
              (parsedData.statistics.toolUsageCount[json.name] || 0) + 1;
          }
          if (json.input && json.toolUseId) {
            try {
              // Try to parse the input as JSON
              const inputData = JSON.parse(`"${json.input}"`);
              console.log(`  Tool Input: ${inputData.substring(0, 200)}${inputData.length > 200 ? '...' : ''}`);
            } catch (e) {
              console.log(`  Tool Input (raw): ${json.input.substring(0, 200)}${json.input.length > 200 ? '...' : ''}`);
            }
          }
        });
      }

    } else if (entry.type === 'streaming_complete') {
      console.log(`  Total chunks: ${entry.totalChunks}`);
      console.log(`  Has assistant events: ${entry.hasAssistantEvents}`);

      if (currentRequest) {
        // Reconstruct complete message from chunks
        const reconstructed = reconstructMessage(currentRequest.chunks);
        currentRequest.fullMessage = reconstructed.fullMessage;
        currentRequest.toolUsage = reconstructed.toolUsage;

        // Add to conversation data
        if (currentRequest.conversationId && parsedData.conversations[currentRequest.conversationId]) {
          parsedData.conversations[currentRequest.conversationId].interactions.push(currentRequest);
          parsedData.conversations[currentRequest.conversationId].messageCount++;

          // Track tools used in this conversation
          reconstructed.toolUsage.forEach(tool => {
            if (!parsedData.conversations[currentRequest.conversationId].toolsUsed.includes(tool.name)) {
              parsedData.conversations[currentRequest.conversationId].toolsUsed.push(tool.name);
            }
          });
        }

        // Add to main interactions list
        parsedData.apiInteractions.push(currentRequest);
      }
    }
  } catch (e) {
    console.error(`Parse error on line ${index + 1}:`, e.message);
    parsedData.statistics.errorCount++;
  }
});

console.log('\n=== Enhanced Summary ===');
console.log(`Total entries: ${lines.length}`);
console.log(`Successfully parsed requests: ${parsedData.statistics.totalRequests}`);
console.log(`Unique conversations: ${parsedData.statistics.totalConversations}`);
console.log(`Parse errors: ${parsedData.statistics.errorCount}`);

// Count by type
const typeCounts = {};
lines.forEach(line => {
  try {
    const entry = JSON.parse(line);
    typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
  } catch (e) {}
});

console.log('\nEntry types:');
Object.entries(typeCounts).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log('\nTool usage statistics:');
Object.entries(parsedData.statistics.toolUsageCount).forEach(([tool, count]) => {
  console.log(`  ${tool}: ${count} times`);
});

console.log('\nConversation summary:');
Object.entries(parsedData.conversations).forEach(([convId, data]) => {
  console.log(`  ${convId}: ${data.interactions.length} interactions, tools: [${data.toolsUsed.join(', ')}]`);
});

// Export parsed data for further analysis
fs.writeFileSync('./analysis/parsed-trace-data.json', JSON.stringify(parsedData, null, 2));
console.log('\n✅ Parsed data exported to ./analysis/parsed-trace-data.json');
