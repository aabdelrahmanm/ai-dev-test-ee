# Prompt Template Extraction Guide

## Template Identification Strategy

**Common Prompt Patterns in Kiro:**
Based on the analysis requirements, look for these template types:

1. **System Prompts:** Instructions that define agent behavior
2. **Context Injection Prompts:** Templates for including file/document context
3. **Tool Usage Prompts:** Templates for tool invocation instructions
4. **Workflow Prompts:** Templates for specific workflow types (spec generation, code analysis)
5. **Error Handling Prompts:** Templates for error recovery and guidance

## Template Extraction Techniques

**String Pattern Matching:**
```javascript
// Look for common prefixes that indicate templates
const commonPrefixes = [
  "You are operating in a workspace",
  "I am providing you some additional guidance",
  "These are the files in the directory",
  "You are a Software engineering AI Agent",
  "## Included Rules",
  "<user-rule id=",
  "# Identity",
  "# Capabilities"
];

// Extract variable placeholders
const variablePatterns = [
  /\[([^\]]+)\]/g,           // [variable]
  /\{([^}]+)\}/g,            // {variable}
  /\{\{([^}]+)\}\}/g,        // {{variable}}
  /<([^>]+)>/g,              // <variable>
  /\$\{([^}]+)\}/g           // ${variable}
];
```

**Template Reconstruction:**
1. Find messages with similar structure but different content
2. Identify the stable parts (template) vs variable parts
3. Extract variable names and types
4. Create template with placeholder syntax
5. Validate template by applying to examples

## Context Template Analysis

**File Context Templates:**
Look for patterns like:
```
"You are operating in a workspace with files and folders. Below is the known structure..."
"<fileTree>...</fileTree>"
"These are the open files I'm looking at"
```

**Steering Rule Templates:**
```
"## Included Rules (filename.md)"
"I am providing you some additional guidance..."
"<user-rule id=filename.md>"
```

**Spec-Related Templates:**
```
"You are an agent that specializes in working with Specs in Kiro..."
"Here is the workflow you need to follow:"
"<workflow-definition>..."
```

## Prompt Effectiveness Analysis

**Correlation Metrics:**
- Success rate of operations following specific prompts
- Response quality indicators
- Tool usage success rates
- Error rates by prompt type

**Template Validation:**
```javascript
function validateTemplate(template, examples) {
  const validation = {
    coverage: 0,        // % of examples that match template
    accuracy: 0,        // How well template reconstructs examples
    variables: [],      // Identified variable placeholders
    confidence: 0       // Overall confidence in template
  };
  
  examples.forEach(example => {
    // Test if template can generate this example
    // Measure reconstruction accuracy
    // Identify variable values
  });
  
  return validation;
}
```

## System Prompt Categories

**Agent Identity Prompts:**
- Role definitions and capabilities
- Behavioral guidelines and constraints
- Communication style instructions

**Technical Instruction Prompts:**
- Code formatting and best practices
- Tool usage guidelines
- Error handling procedures

**Context Management Prompts:**
- File system navigation instructions
- Document reference handling
- Context preservation guidelines

**Workflow-Specific Prompts:**
- Spec creation workflows
- Code analysis procedures
- Report generation instructions

## Output Format

**Template Documentation:**
```markdown
## Template: [Template Name]

**Type:** [System/Context/Tool/Workflow]
**Usage Frequency:** [Number] times
**Success Rate:** [Percentage]

**Template:**
```
[Template text with {{variables}} marked]
```

**Variables:**
- `{{variable1}}`: Description and type
- `{{variable2}}`: Description and type

**Examples:**
1. [Actual usage example 1]
2. [Actual usage example 2]

**Context:** Used in [specific scenarios/workflows]
```