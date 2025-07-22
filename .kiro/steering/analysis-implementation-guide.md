# Analysis Implementation Guide

## Code Structure and Patterns

**File Organization:**
- Create analysis scripts in a dedicated `analysis/` directory
- Keep parser fixes and enhancements in `analysis/parser/`
- Store analysis functions in `analysis/analyzers/`
- Generate reports in `analysis/reports/`

**Data Processing Pattern:**
```javascript
// Standard pattern for all analysis functions
function analyzeData(inputData) {
  const results = [];
  
  try {
    // Process data with error handling
    inputData.forEach(item => {
      try {
        const analyzed = processItem(item);
        if (analyzed) results.push(analyzed);
      } catch (e) {
        console.warn(`Skipping item due to error: ${e.message}`);
      }
    });
  } catch (e) {
    console.error(`Analysis failed: ${e.message}`);
  }
  
  return results;
}
```

## Trace Parser Requirements

**Binary Data Handling:**
- The existing parser has issues with binary streaming chunks
- Need to properly decode hex data and reconstruct messages
- Handle incomplete chunks and message fragmentation
- Extract complete JSON payloads from streaming responses

**Key Fixes Needed:**
```javascript
// Fix binary chunk processing
function processBinaryChunk(chunkHex) {
  // Convert hex to buffer and decode properly
  const buffer = Buffer.from(chunkHex, 'hex');
  // Handle AWS event stream format
  // Extract JSON content from binary wrapper
}
```

## Pattern Extraction Guidelines

**Prompt Template Detection:**
- Look for repeated text patterns in system messages
- Identify variable placeholders: `[variable]`, `{variable}`, `{{variable}}`
- Find common prefixes and suffixes in prompts
- Group similar prompts by content similarity

**Context Injection Analysis:**
- Search for context objects in request bodies
- Track file references and document paths
- Identify context transformation patterns
- Map context flow between interactions

**API Sequence Correlation:**
- Group requests by conversationId and timestamp
- Identify operation boundaries (start/end patterns)
- Document request/response pairs with timing
- Create step-by-step operation flows

## Report Generation Standards

**Report Structure:**
```markdown
# [Report Title]

## Executive Summary
- Key findings in bullet points
- Most important insights
- Recommendations

## Detailed Analysis
- Comprehensive findings with examples
- Data tables and statistics
- Pattern descriptions

## Examples
- Concrete examples of discovered patterns
- Sample data and code snippets
- Visual representations where helpful

## Appendix
- Raw data summaries
- Technical details
- Data quality notes
```

**Data Presentation:**
- Include actual examples from the data
- Show before/after for parser fixes
- Use tables for statistics and counts
- Provide code snippets for key patterns