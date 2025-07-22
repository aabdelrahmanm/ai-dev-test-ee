# Trace Parser Specifications

## Current Parser Issues

**Binary Data Problems:**
The existing `/tmp/parse-streaming-trace.js` has several issues:
- Binary chunks are not properly decoded
- Streaming messages are fragmented and not reconstructed
- JSON extraction from binary wrappers is incomplete
- Tool usage data is partially extracted

**Required Fixes:**
1. Proper hex-to-buffer conversion for binary chunks
2. AWS event stream format handling
3. Complete message reconstruction from fragments
4. Full JSON payload extraction

## Expected Data Structure

**Trace File Format:**
Each line in `kiro_full_trace.jsonl` contains one of these types:
```javascript
// Request initiation
{
  "type": "request",
  "requestId": "unique_id",
  "timestamp": "ISO_string",
  "method": "POST",
  "host": "hostname",
  "path": "/api/path",
  "headers": {},
  "contentLength": "number"
}

// Request body (may be split across multiple entries)
{
  "type": "request_body_full",
  "requestId": "unique_id",
  "timestamp": "ISO_string",
  "bodySize": number,
  "conversationId": "conv_id",
  "userMessage": "message_content"
}

// Response headers
{
  "type": "response_headers",
  "requestId": "unique_id",
  "timestamp": "ISO_string",
  "statusCode": 200,
  "headers": {},
  "isChunked": true
}

// Streaming chunks (binary data)
{
  "type": "streaming_chunk",
  "requestId": "unique_id",
  "timestamp": "ISO_string",
  "chunkNumber": 1,
  "chunkSize": number,
  "chunkHex": "hex_string",
  "chunkUtf8": "partial_utf8",
  "hasEventType": boolean,
  "hasAssistantEvent": boolean,
  "hasToolEvent": boolean
}
```

## Parser Enhancement Requirements

**Data Extraction Goals:**
1. **Complete API Interactions:** Full request/response pairs with timing
2. **Tool Usage:** All tool invocations with inputs and outputs
3. **Assistant Messages:** Complete assistant responses reconstructed from chunks
4. **Conversation Flow:** Linked interactions by conversation ID
5. **System Prompts:** All system-level prompts and templates

**Output Data Structure:**
```javascript
const parsedData = {
  apiInteractions: [
    {
      requestId: 'string',
      conversationId: 'string',
      timestamp: 'string',
      request: {
        method: 'string',
        endpoint: 'string',
        headers: {},
        body: {}
      },
      response: {
        status: number,
        headers: {},
        body: {},
        chunks: []
      },
      duration: number,
      toolUsage: [],
      assistantMessages: []
    }
  ],
  conversations: {
    'conv_id': {
      interactions: [],
      totalDuration: number,
      toolsUsed: [],
      messageCount: number
    }
  },
  statistics: {
    totalRequests: number,
    totalConversations: number,
    toolUsageCount: {},
    errorCount: number
  }
};
```

## Binary Data Handling

**AWS Event Stream Format:**
The binary chunks follow AWS event stream format with headers and payloads:
- Event type headers (e.g., "toolUseEvent", "assistantResponseEvent")
- Content type headers
- Message type headers
- JSON payloads embedded in binary structure

**Decoding Process:**
1. Convert hex string to buffer
2. Parse AWS event stream headers
3. Extract JSON payload from event data
4. Reconstruct complete messages from fragments
5. Correlate with request context