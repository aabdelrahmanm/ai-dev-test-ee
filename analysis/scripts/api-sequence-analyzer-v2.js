#!/usr/bin/env node

const fs = require('fs');

console.log('=== API Sequence Flow Analyzer v2 ===\n');

// Storage for API sequences
const apiSequences = {
  conversations: {},
  operationFlows: {},
  statistics: {
    totalConversations: 0,
    totalOperations: 0,
    operationTypes: {},
    averageOperationDuration: 0
  }
};

// Helper function to extract operation type from request
function identifyOperationType(request) {
  if (!request || !request.path) return 'unknown';

  const path = request.path.toLowerCase();
  const method = request.method || 'GET';
  const host = request.host || '';

  // AWS CodeWhisperer API patterns
  if (host.includes('codewhisperer') && path.includes('/generateassistantresponse')) {
    return 'ai-assistant-chat';
  }

  // Common Kiro operation patterns
  if (path.includes('/hooks') && method === 'POST') return 'create-hook';
  if (path.includes('/hooks') && method === 'GET') return 'list-hooks';
  if (path.includes('/hooks') && method === 'DELETE') return 'delete-hook';
  if (path.includes('/specs') && method === 'POST') return 'create-spec';
  if (path.includes('/specs') && method === 'GET') return 'get-spec';
  if (path.includes('/chat') && method === 'POST') return 'chat-interaction';
  if (path.includes('/execute') && method === 'POST') return 'execute-task';
  if (path.includes('/files') && method === 'GET') return 'read-file';
  if (path.includes('/files') && method === 'POST') return 'write-file';
  if (path.includes('/workspace') && method === 'GET') return 'get-workspace';

  // Generic classification
  if (host.includes('amazonaws.com')) return `aws-${method.toLowerCase()}`;

  return `${method.toLowerCase()}-${path.split('/')[1] || 'unknown'}`;
}

// Helper function to calculate duration between timestamps
function calculateDuration(startTime, endTime) {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return end.getTime() - start.getTime();
  } catch (error) {
    return 0;
  }
}

// Function to extract tool usage from streaming chunks
function extractToolUsage(chunks) {
  const toolEvents = [];

  chunks.forEach(chunk => {
    if (chunk.hasToolEvent) {
      toolEvents.push({
        chunkNumber: chunk.chunkNumber,
        timestamp: chunk.timestamp,
        type: 'tool_event'
      });
    }
    if (chunk.hasAssistantEvent) {
      toolEvents.push({
        chunkNumber: chunk.chunkNumber,
        timestamp: chunk.timestamp,
        type: 'assistant_event'
      });
    }
  });

  return toolEvents;
}

// Main function to process raw trace data
function processTraceData() {
  console.log('Processing raw trace data...');

  try {
    const traceFile = './kiro_full_trace.jsonl';
    if (!fs.existsSync(traceFile)) {
      console.error('Trace file not found');
      return null;
    }

    const lines = fs.readFileSync(traceFile, 'utf8').trim().split('\n');
    console.log(`Processing ${lines.length} trace lines...`);

    const requests = new Map();
    const responses = new Map();
    const conversations = new Map();

    // Parse all trace entries
    lines.forEach((line, index) => {
      try {
        const entry = JSON.parse(line);

        if (entry.type === 'request') {
          requests.set(entry.requestId, {
            requestId: entry.requestId,
            timestamp: entry.timestamp,
            method: entry.method,
            path: entry.path,
            host: entry.host,
            headers: entry.headers,
            body: null,
            conversationId: null
          });
        } else if (entry.type === 'request_body_full') {
          const request = requests.get(entry.requestId);
          if (request) {
            request.body = {
              size: entry.bodySize,
              conversationId: entry.conversationId,
              userMessage: entry.userMessage ? entry.userMessage.substring(0, 200) + '...' : null,
              systemPrompt: entry.systemPrompt ? entry.systemPrompt.substring(0, 200) + '...' : null
            };
            request.conversationId = entry.conversationId;
          }
        } else if (entry.type === 'response_headers') {
          responses.set(entry.requestId, {
            requestId: entry.requestId,
            timestamp: entry.timestamp,
            statusCode: entry.statusCode,
            headers: entry.headers,
            isChunked: entry.isChunked,
            chunks: []
          });
        } else if (entry.type === 'streaming_chunk') {
          if (!responses.has(entry.requestId)) {
            responses.set(entry.requestId, {
              requestId: entry.requestId,
              timestamp: entry.timestamp,
              statusCode: 200,
              headers: {},
   chunks: []
            });
          }
          const response = responses.get(entry.requestId);
          response.chunks.push({
            chunkNumber: entry.chunkNumber,
            timestamp: entry.timestamp,
            size: entry.chunkSize,
            hasToolEvent: entry.hasToolEvent,
            hasAssistantEvent: entry.hasAssistantEvent
          });
        }
      } catch (error) {
        console.warn(`Skipping malformed line ${index + 1}: ${error.message}`);
      }
    });

    console.log(`Found ${requests.size} requests and ${responses.size} responses`);

    // Combine requests and responses, group by conversation
    requests.forEach((request, requestId) => {
      if (request.conversationId) {
        const response = responses.get(requestId) || {
          statusCode: 200,
          headers: {},
          chunks: [],
          timestamp: request.timestamp
        };

        const interaction = {
          requestId: request.requestId,
          conversationId: request.conversationId,
          timestamp: request.timestamp,
          request: {
            method: request.method,
            path: request.path,
            host: request.host,
            endpoint: `${request.host}${request.path}`,
            headers: request.headers,
            body: request.body
          },
          response: {
            status: response.statusCode,
            headers: response.headers,
            chunks: response.chunks || [],
            toolEvents: extractToolUsage(response.chunks || [])
          },
          duration: response.timestamp ?
            calculateDuration(request.timestamp, response.timestamp) : 0,
          operationType: identifyOperationType(request)
        };

        if (!conversations.has(request.conversationId)) {
          conversations.set(request.conversationId, []);
        }
        conversations.get(request.conversationId).push(interaction);
      }
    });

    console.log(`Found ${conversations.size} conversations`);

    // Convert to our format and identify operation sequences
    conversations.forEach((interactions, convId) => {
      // Sort interactions by timestamp
      interactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      apiSequences.conversations[convId] = {
        interactions: interactions,
        operations: [],
        totalDuration: 0,
        startTime: null,
        endTime: null,
        operationTypes: {}
      };

      // Calculate conversation timing
      if (interactions.length > 0) {
        apiSequences.conversations[convId].startTime = interactions[0].timestamp;
        apiSequences.conversations[convId].endTime = interactions[interactions.length - 1].timestamp;
        apiSequences.conversations[convId].totalDuration = calculateDuration(
          interactions[0].timestamp,
          interactions[interactions.length - 1].timestamp
        );
      }

      // Identify operation sequences
      const operations = identifyOperationSequences(interactions);
      apiSequences.conversations[convId].operations = operations;

      // Count operation types in this conversation
      interactions.forEach(interaction => {
        const opType = interaction.operationType;
        if (!apiSequences.conversations[convId].operationTypes[opType]) {
          apiSequences.conversations[convId].operationTypes[opType] = 0;
        }
        apiSequences.conversations[convId].operationTypes[opType]++;
      });
    });

    // Generate operation flows
    generateOperationFlows();

    // Calculate statistics
    calculateStatistics();

    return apiSequences;

  } catch (error) {
    console.error('Error processing trace data:', error.message);
    return null;
  }
}

// Function to identify operation sequences within a conversation
function identifyOperationSequences(interactions) {
  const operations = [];
  let currentOperation = null;

  interactions.forEach((interaction, index) => {
    const opType = interaction.operationType;

    // Start new operation or continue existing one
    if (!currentOperation || currentOperation.type !== opType) {
      // Finish previous operation
      if (currentOperation) {
        currentOperation.endTime = interactions[index - 1].timestamp;
        currentOperation.duration = calculateDuration(
          currentOperation.startTime,
          currentOperation.endTime
        );
        operations.push(currentOperation);
      }

      // Start new operation
      currentOperation = {
        type: opType,
        startTime: interaction.timestamp,
        endTime: null,
        duration: 0,
        steps: [],
        success: true,
        errors: [],
        toolUsage: []
      };
    }

    // Add step to current operation
    const step = {
      stepNumber: currentOperation.steps.length + 1,
      timestamp: interaction.timestamp,
      request: {
        method: interaction.request.method,
        endpoint: interaction.request.endpoint,
        hasBody: !!interaction.request.body,
        bodySize: interaction.request.body?.size || 0
      },
      response: {
        status: interaction.response.status,
        chunkCount: interaction.response.chunks.length,
        toolEvents: interaction.response.toolEvents.length,
        duration: interaction.duration
      }
    };

    // Check for errors
    if (interaction.response.status >= 400) {
      currentOperation.success = false;
      currentOperation.errors.push({
        step: step.stepNumber,
        status: interaction.response.status,
        timestamp: interaction.timestamp
      });
    }

    // Track tool usage
    if (interaction.response.toolEvents.length > 0) {
      currentOperation.toolUsage.push({
        step: step.stepNumber,
        toolEvents: interaction.response.toolEvents.length,
        timestamp: interaction.timestamp
      });
    }

    currentOperation.steps.push(step);
  });

  // Finish last operation
  if (currentOperation) {
    currentOperation.endTime = interactions[interactions.length - 1].timestamp;
    currentOperation.duration = calculateDuration(
      currentOperation.startTime,
      currentOperation.endTime
    );
    operations.push(currentOperation);
  }

  return operations;
}

// Function to generate operation flows
function generateOperationFlows() {
  Object.keys(apiSequences.conversations).forEach(convId => {
    const conversation = apiSequences.conversations[convId];

    conversation.operations.forEach(operation => {
      const opType = operation.type;
      if (!apiSequences.operationFlows[opType]) {
        apiSequences.operationFlows[opType] = [];
      }
      apiSequences.operationFlows[opType].push({
        conversationId: convId,
        ...operation
      });
    });
  });
}

// Function to calculate statistics
function calculateStatistics() {
  apiSequences.statistics.totalConversations = Object.keys(apiSequences.conversations).length;

  let totalOperations = 0;
  let totalDuration = 0;

  Object.values(apiSequences.conversations).forEach(conv => {
    totalOperations += conv.operations.length;
    totalDuration += conv.totalDuration;

    conv.operations.forEach(op => {
      if (!apiSequences.statistics.operationTypes[op.type]) {
        apiSequences.statistics.operationTypes[op.type] = 0;
      }
      apiSequences.statistics.operationTypes[op.type]++;
    });
  });

  apiSequences.statistics.totalOperations = totalOperations;
  apiSequences.statistics.averageOperationDuration = totalOperations > 0
    ? totalDuration / totalOperations
    : 0;
}

// Function to generate detailed operation flow documentation
function generateOperationFlowDocs() {
  const docs = {
    operationTypes: {},
    examples: {},
    patterns: {}
  };

  Object.keys(apiSequences.operationFlows).forEach(opType => {
    const operations = apiSequences.operationFlows[opType];

    docs.operationTypes[opType] = {
      count: operations.length,
      averageDuration: operations.reduce((sum, op) => sum + op.duration, 0) / operations.length,
      successRate: operations.filter(op => op.success).length / operations.length,
      averageSteps: operations.reduce((sum, op) => sum + op.steps.length, 0) / operations.length,
      toolUsageRate: operations.filter(op => op.toolUsage.length > 0).length / operations.length,
      examples: operations.slice(0, 2) // First 2 examples
    };

    // Find the most complete example
    const bestExample = operations.reduce((best, current) =>
      current.steps.length > (best?.steps.length || 0) ? current : best
    );

    if (bestExample) {
      docs.examples[opType] = {
        conversationId: bestExample.conversationId,
        duration: bestExample.duration,
        success: bestExample.success,
        stepCount: bestExample.steps.length,
        toolUsage: bestExample.toolUsage.length,
        stepByStep: bestExample.steps.map(step => ({
          step: step.stepNumber,
          description: `${step.request.method} ${step.request.endpoint}`,
          request: {
            method: step.request.method,
            endpoint: step.request.endpoint,
            hasBody: step.request.hasBody,
            bodySize: step.request.bodySize
          },
          response: {
            status: step.response.status,
            chunkCount: step.response.chunkCount,
            toolEvents: step.response.toolEvents,
            duration: step.response.duration
          }
        }))
      };
    }
  });

  return docs;
}

// Main execution
if (require.main === module) {
  const sequences = processTraceData();

  if (sequences) {
    // Save the analysis results
    fs.writeFileSync(
      './analysis/api-sequence-analysis.json',
      JSON.stringify(sequences, null, 2)
    );

    // Generate operation flow documentation
    const flowDocs = generateOperationFlowDocs();
    fs.writeFileSync(
      './analysis/api-operation-flows.json',
      JSON.stringify(flowDocs, null, 2)
    );

    console.log('\n=== API Sequence Analysis Complete ===');
    console.log(`Total conversations: ${sequences.statistics.totalConversations}`);
    console.log(`Total operations: ${sequences.statistics.totalOperations}`);
    console.log(`Operation types found: ${Object.keys(sequences.statistics.operationTypes).length}`);
    console.log('\nOperation type breakdown:');
    Object.entries(sequences.statistics.operationTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} operations`);
    });

    console.log('\nFiles generated:');
    console.log('  - analysis/api-sequence-analysis.json');
    console.log('  - analysis/api-operation-flows.json');
  } else {
    console.error('Failed to analyze API sequences');
  }
}

module.exports = { processTraceData, generateOperationFlowDocs };
