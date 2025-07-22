#!/usr/bin/env node

const fs = require('fs');

// Read the trace file
const traceFile = '/tmp/kiro_full_trace.jsonl';
const lines = fs.readFileSync(traceFile, 'utf8').trim().split('\n');

console.log('=== Kiro Streaming Trace Analysis ===\n');

lines.forEach(line => {
  try {
    const entry = JSON.parse(line);
    
    if (entry.type === 'request') {
      console.log(`\n[${entry.timestamp}] REQUEST ${entry.requestId}`);
      console.log(`  ${entry.method} ${entry.host}${entry.path}`);
    } else if (entry.type === 'request_body') {
      console.log(`  User message: "${entry.userMessage}"`);
      console.log(`  Conversation ID: ${entry.conversationId}`);
    } else if (entry.type === 'response_headers') {
      console.log(`  Response: ${entry.statusCode} ${entry.headers['content-type']}`);
    } else if (entry.type === 'streaming_chunk' || entry.type === 'streaming_complete') {
      const content = entry.content || entry.fullResponse;
      
      // Extract assistantResponseEvent content
      const assistantMatches = [...content.matchAll(/"content":"([^"]+)"/g)];
      if (assistantMatches.length > 0) {
        const fullMessage = assistantMatches.map(m => m[1]).join('');
        console.log(`  Assistant: "${fullMessage}"`);
      }
      
      // Extract toolUseEvent
      const toolNameMatch = content.match(/"name":"([^"]+)"/);
      const toolIdMatch = content.match(/"toolUseId":"([^"]+)"/);
      if (toolNameMatch && toolIdMatch) {
        console.log(`  Tool Use: ${toolNameMatch[1]} (${toolIdMatch[1]})`);
        
        // Extract all input chunks
        const inputMatches = [...content.matchAll(/"input":"([^"]*)"/g)];
        if (inputMatches.length > 0) {
          const fullInput = inputMatches.map(m => m[1]).join('');
          // Unescape the JSON string
          try {
            const unescaped = JSON.parse(`"${fullInput}"`);
            console.log(`  Tool Input: ${unescaped}`);
          } catch (e) {
            console.log(`  Tool Input (raw): ${fullInput}`);
          }
        }
      }
      
      if (entry.type === 'streaming_complete') {
        console.log(`  Total chunks: ${entry.totalChunks}`);
        console.log(`  Has assistant events: ${entry.hasAssistantEvents}`);
      }
    }
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});

console.log('\n=== Summary ===');
console.log(`Total entries: ${lines.length}`);

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
