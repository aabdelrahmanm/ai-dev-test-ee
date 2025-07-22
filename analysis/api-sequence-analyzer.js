#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== API Sequence Flow Analyzer ===\n');

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

// Helper function to read large JSON files in chunks
function readLargeJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

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

// Main function to analyze API sequences
function analyzeAPISequences() {
  console.log('Reading parsed trace data...');

  // Try to read the parsed trace data
  const parsedData = readLargeJsonFile('./analysis/parsed-trace-data.json');
  if (!parsedData || !parsedData.apiInteractions) {
    console.log('Could not read parsed trace data, trying to process raw trace...');
    return processRawTraceData();
  }

  console.log(`Processing ${parsedData.apiInteractions.length} API interactions...`);

  // Group interactions by conversation ID
  parsedData.apiInteractions.forEach(interaction => {
    const convId = interaction.conversationId || 'unknown';

    if (!apiSequences.conversations[convId]) {
      apiSequences.conversations[convId] = {
        interactions: [],
        operations: [],
        totalDuration: 0,
        startTime: null,
        endTime: null
      };
    }

    apiSequences.conversations[convId].interactions.push(interaction);

    // Update conversation timing
    const conv = apiSequences.conversations[convId];
    if (!conv.startTime || interaction.timestamp < conv.startTime) {
      conv.startTime = interaction.timestamp;
    }
    if (!conv.endTime || interaction.timestamp > conv.endTime) {
      conv.endTime = interaction.timestamp;
    }
  });

  // Process each conversation to identify operation sequences
  Object.keys(apiSequences.conversations).forEach(convId => {
    const conversation = apiSequences.conversations[convId];

    // Sort interactions by timestamp
    conversation.interactions.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Calculate total conversation duration
    if (conversation.startTime && conversation.endTime) {
      conversation.totalDuration = calculateDuration(
        conversation.startTime,
        conversation.endTime
      );
    }

    // Identify operation sequences
    const operations = identifyOperationSequences(conversation.interactions);
    conversation.operations = operations;

    // Add to global operation flows
    operations.forEach(operation => {
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

  // Calculate statistics
  calculateStatistics();

  return apiSequences;
}

// Function to identify operation sequences within a conversation
function identifyOperationSequences(interactions) {
  const operations = [];
  let currentOperation = null;

  interactions.forEach((interaction, index) => {
    const opType = identifyOperationType(interaction.request);

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
        errors: []
      };
    }

    // Add step to current operation
    const step = {
      stepNumber: currentOperation.steps.length + 1,
      timestamp: interaction.timestamp,
      request: {
        method: interaction.request?.method || 'UNKNOWN',
        endpoint: interaction.request?.path || 'unknown',
        headers: interaction.request?.headers || {},
        body: interaction.request?.body || null
      },
      response: {
        status: interaction.response?.status || 0,
        headers: interaction.response?.headers || {},
        body: interaction.response?.body || null,
        duration: interaction.duration || 0
      }
    };

    // Check for errors
    if (interaction.response?.status >= 400) {
      currentOperation.success = false;
      currentOperation.errors.push({
        step: step.stepNumber,
        status: interaction.response.status,
        error: interaction.response.body
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

// Function to process raw trace data if parsed data is not available
function processRawTraceData() {
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
    const conversations = new Map();

    lines.forEach((line, index) => {
      try {
        const entry = JSON.parse(line);

        if (entry.type === 'request') {
          requests.set(entry.requestId, {
            requestId: entry.requestId,
            timestamp: entry.timestamp,
            method: entry.method,
            path: entry.path,
            headers: entry.headers
          });
        } else if (entry.type === 'request_body_full') {
          const request = requests.get(entry.requestId);
          if (request) {
            request.body = entry;
            request.conversationId = entry.conversationId;

            // Add to conversation
            if (!conversations.has(entry.conversationId)) {
              conversations.set(entry.conversationId, []);
            }
            conversations.get(entry.conversationId).push(request);
          }
        }
      } catch (error) {
        // Skip malformed lines
      }
    });

    // Convert to our format
    conversations.forEach((interactions, convId) => {
      apiSequences.conversations[convId] = {
        interactions: interactions.map(req => ({
          requestId: req.requestId,
          conversationId: req.conversationId,
          timestamp: req.timestamp,
          request: {
            method: req.method,
            path: req.path,
            headers: req.headers,
            body: req.body
          },
          response: { status: 200 }, // Default for now
          duration: 0
        })),
        operations: [],
        totalDuration: 0,
        startTime: null,
        endTime: null
      };

      // Process operations for this conversation
      const operations = identifyOperationSequences(
        apiSequences.conversations[convId].interactions
      );
      apiSequences.conversations[convId].operations = operations;
    });

    calculateStatistics();
    return apiSequences;

  } catch (error) {
    console.error('Error processing raw trace data:', error.message);
    return null;
  }
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
      commonSteps: findCommonSteps(operations),
      examples: operations.slice(0, 3) // First 3 examples
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
        stepByStep: bestExample.steps.map(step => ({
          step: step.stepNumber,
          description: `${step.request.method} ${step.request.endpoint}`,
          request: {
            method: step.request.method,
            endpoint: step.request.endpoint,
            hasBody: !!step.request.body
          },
          response: {
            status: step.response.status,
            duration: step.response.duration
          }
        }))
      };
    }
  });

  return docs;
}

// Helper function to find common steps across operations
function findCommonSteps(operations) {
  if (operations.length === 0) return [];

  const stepPatterns = {};

  operations.forEach(op => {
    op.steps.forEach((step, index) => {
      const pattern = `${step.request.method} ${step.request.endpoint}`;
      const key = `step_${index}_${pattern}`;

      if (!stepPatterns[key]) {
        stepPatterns[key] = 0;
      }
      stepPatterns[key]++;
    });
  });

  // Return patterns that appear in at least 50% of operations
  const threshold = Math.ceil(operations.length * 0.5);
  return Object.keys(stepPatterns)
    .filter(key => stepPatterns[key] >= threshold)
    .map(key => ({
      pattern: key.replace(/^step_\d+_/, ''),
      frequency: stepPatterns[key],
      percentage: (stepPatterns[key] / operations.length * 100).toFixed(1)
    }));
}

// Main execution
if (require.main === module) {
  const sequences = analyzeAPISequences();

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

module.exports = { analyzeAPISequences, generateOperationFlowDocs };
