#!/usr/bin/env node

/**
 * Prompt Template Extractor
 *
 * Extracts and analyzes prompt templates from Kiro system data including:
 * - System prompts and identity definitions
 * - Context injection patterns
 * - Tool usage prompts
 * - Workflow-specific templates
 * - Steering rule templates
 */

const fs = require('fs');
const path = require('path');

class PromptTemplateExtractor {
  constructor() {
    this.templates = [];
    this.patterns = {
      // Variable placeholder patterns
      variables: [
        /\[([^\]]+)\]/g,           // [variable]
        /\{([^}]+)\}/g,            // {variable}
        /\{\{([^}]+)\}\}/g,        // {{variable}}
        /<([^>]+)>/g,              // <variable>
        /\$\{([^}]+)\}/g           // ${variable}
      ],

      // Common prompt prefixes that indicate templates
      commonPrefixes: [
        "You are operating in a workspace",
        "I am providing you some additional guidance",
        "These are the files in the directory",
        "You are a Software engineering AI Agent",
        "## Included Rules",
        "<user-rule id=",
        "# Identity",
        "# Capabilities",
        "# Rules",
        "# Response style",
        "# System Information",
        "# Goal",
        "# Current Context",
        "You are Kiro, an AI assistant",
        "When users ask about Kiro",
        "You are managed by an autonomous process"
      ],

      // Context injection patterns
      contextPatterns: [
        /<fileTree>/g,
        /<\/fileTree>/g,
        /<file name=/g,
        /<folder name=/g,
        /type: "fileTree"/g,
        /type: "file"/g,
        /type: "steering"/g,
        /expandedPaths/g,
        /openedFiles/g
      ]
    };
  }

  /**
   * Extract templates from debug data
   */
  extractFromDebugData(debugData) {
    console.log('Extracting templates from debug data...');

    if (!debugData.conversations) {
      console.warn('No conversations found in debug data');
      return;
    }

    debugData.conversations.forEach((conversation, index) => {
      console.log(`Processing conversation ${index + 1}/${debugData.conversations.length}: ${conversation.fileName}`);

      // Extract from context (steering rules, file content)
      if (conversation.context) {
        conversation.context.forEach(ctx => {
          if (ctx.type === 'steering' && ctx.content) {
            this.extractSteeringTemplates(ctx.content, ctx.id || 'unknown');
          }
        });
      }

      // Extract from messages if available
      if (conversation.messages && conversation.messages.length > 0) {
        conversation.messages.forEach(message => {
          if (message.content) {
            this.extractSystemPrompts(message.content, conversation.fileName);
          }
        });
      }
    });
  }

  /**
   * Extract templates from trace data
   */
  extractFromTraceData(traceData) {
    console.log('Extracting templates from trace data...');

    if (!traceData || !Array.isArray(traceData)) {
      console.warn('Invalid trace data format');
      return;
    }

    traceData.forEach((entry, index) => {
      if (index % 1000 === 0) {
        console.log(`Processing trace entry ${index + 1}/${traceData.length}`);
      }

      // Extract from request bodies
      if (entry.type === 'request_body_full' && entry.body) {
        this.extractFromRequestBody(entry.body, entry.requestId);
      }

      // Extract from streaming responses
      if (entry.type === 'streaming_chunk' && entry.reconstructedContent) {
        this.extractFromStreamingContent(entry.reconstructedContent, entry.requestId);
      }
    });
  }

  /**
   * Extract steering rule templates
   */
  extractSteeringTemplates(content, steeringId) {
    const template = {
      type: 'steering',
      id: steeringId,
      template: content,
      variables: this.extractVariables(content),
      usageCount: 1,
      examples: [content],
      contexts: ['steering']
    };

    this.templates.push(template);
  }

  /**
   * Extract system prompts and identity templates
   */
  extractSystemPrompts(content, source) {
    // Look for system identity prompts
    if (content.includes('# Identity') || content.includes('You are Kiro')) {
      const template = {
        type: 'system_identity',
        template: this.extractIdentityTemplate(content),
        variables: this.extractVariables(content),
        usageCount: 1,
        examples: [content],
        contexts: [source],
        source: source
      };
      this.templates.push(template);
    }

    // Look for capability definitions
    if (content.includes('# Capabilities')) {
      const template = {
        type: 'system_capabilities',
        template: this.extractCapabilitiesTemplate(content),
        variables: this.extractVariables(content),
        usageCount: 1,
        examples: [content],
        contexts: [source],
        source: source
      };
      this.templates.push(template);
    }

    // Look for rules sections
    if (content.includes('# Rules')) {
      const template = {
        type: 'system_rules',
        template: this.extractRulesTemplate(content),
        variables: this.extractVariables(content),
        usageCount: 1,
        examples: [content],
        contexts: [source],
        source: source
      };
      this.templates.push(template);
    }

    // Look for context injection templates
    if (content.includes('<fileTree>') || content.includes('You are operating in a workspace')) {
      const template = {
        type: 'context_injection',
        template: this.extractContextTemplate(content),
        variables: this.extractVariables(content),
        usageCount: 1,
        examples: [content],
        contexts: [source],
        source: source
      };
      this.templates.push(template);
    }
  }

  /**
   * Extract templates from request bodies
   */
  extractFromRequestBody(body, requestId) {
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return; // Skip invalid JSON
      }
    }

    if (body.messages && Array.isArray(body.messages)) {
      body.messages.forEach(message => {
        if (message.content && typeof message.content === 'string') {
          this.extractSystemPrompts(message.content, `request_${requestId}`);
        }
      });
    }
  }

  /**
   * Extract templates from streaming content
   */
  extractFromStreamingContent(content, requestId) {
    if (typeof content === 'string' && content.length > 100) {
      // Look for tool usage patterns
      if (content.includes('antml:function_calls') || content.includes('antml:invoke')) {
        const template = {
          type: 'tool_usage',
          template: this.extractToolTemplate(content),
          variables: this.extractVariables(content),
          usageCount: 1,
          examples: [content.substring(0, 500) + '...'],
          contexts: [`response_${requestId}`],
          source: `response_${requestId}`
        };
        this.templates.push(template);
      }
    }
  }

  /**
   * Extract variables from content using regex patterns
   */
  extractVariables(content) {
    const variables = new Set();

    this.patterns.variables.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        variables.add(match[1]);
      }
    });

    return Array.from(variables);
  }

  /**
   * Extract identity template structure
   */
  extractIdentityTemplate(content) {
    const lines = content.split('\n');
    const template = [];
    let inIdentitySection = false;

    for (const line of lines) {
      if (line.includes('# Identity')) {
        inIdentitySection = true;
        template.push('# Identity');
        continue;
      }

      if (inIdentitySection) {
        if (line.startsWith('# ') && !line.includes('Identity')) {
          break; // End of identity section
        }

        if (line.includes('You are Kiro')) {
          template.push('You are {{assistant_name}}, an AI assistant and IDE built to assist developers.');
        } else if (line.includes('When users ask about')) {
          template.push('When users ask about {{assistant_name}}, respond with information about yourself in first person.');
        } else {
          template.push(line);
        }
      }
    }

    return template.join('\n');
  }

  /**
   * Extract capabilities template structure
   */
  extractCapabilitiesTemplate(content) {
    const lines = content.split('\n');
    const template = [];
    let inCapabilitiesSection = false;

    for (const line of lines) {
      if (line.includes('# Capabilities')) {
        inCapabilitiesSection = true;
        template.push('# Capabilities');
        continue;
      }

      if (inCapabilitiesSection) {
        if (line.startsWith('# ') && !line.includes('Capabilities')) {
          break;
        }
        template.push(line);
      }
    }

    return template.join('\n');
  }

  /**
   * Extract rules template structure
   */
  extractRulesTemplate(content) {
    const lines = content.split('\n');
    const template = [];
    let inRulesSection = false;

    for (const line of lines) {
      if (line.includes('# Rules')) {
        inRulesSection = true;
        template.push('# Rules');
        continue;
      }

      if (inRulesSection) {
        if (line.startsWith('# ') && !line.includes('Rules')) {
          break;
        }
        template.push(line);
      }
    }

    return template.join('\n');
  }

  /**
   * Extract context injection template
   */
  extractContextTemplate(content) {
    if (content.includes('<fileTree>')) {
      return `You are operating in a workspace with files and folders. Below is the known structure of the workspace.

<fileTree>
{{file_tree_content}}
</fileTree>`;
    }

    if (content.includes('## Included Rules')) {
      return `## Included Rules ({{rule_filename}})

I am providing you some additional guidance that you should follow for your entire execution.

<user-rule id={{rule_id}}>
{{rule_content}}
</user-rule>`;
    }

    return content;
  }

  /**
   * Extract tool usage template
   */
  extractToolTemplate(content) {
    if (content.includes('antml:function_calls')) {
      return `<function_calls>
<invoke name="{{tool_name}}">
<parameter name="{{parameter_name}}">{{parameter_value}}
`;
    }

    return content.substring(0, 200) + '...';
  }

  /**
   * Group similar templates and identify variations
   */
  groupSimilarTemplates() {
    console.log('Grouping similar templates...');

    const groups = {};

    this.templates.forEach(template => {
      const key = template.type;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(template);
    });

    // Merge similar templates within each group
    Object.keys(groups).forEach(type => {
      groups[type] = this.mergeSimilarTemplates(groups[type]);
    });

    return groups;
  }

  /**
   * Merge templates that are very similar
   */
  mergeSimilarTemplates(templates) {
    const merged = [];

    templates.forEach(template => {
      const existing = merged.find(m =>
        this.calculateSimilarity(m.template, template.template) > 0.8
      );

      if (existing) {
        existing.usageCount += template.usageCount;
        existing.examples.push(...template.examples);
        existing.contexts.push(...template.contexts);
        existing.variables = [...new Set([...existing.variables, ...template.variables])];
      } else {
        merged.push(template);
      }
    });

    return merged;
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Generate comprehensive analysis report
   */
  generateReport() {
    const groupedTemplates = this.groupSimilarTemplates();
    const report = {
      summary: {
        totalTemplates: this.templates.length,
        uniqueTemplates: Object.values(groupedTemplates).reduce((sum, group) => sum + group.length, 0),
        templateTypes: Object.keys(groupedTemplates),
        totalVariables: [...new Set(this.templates.flatMap(t => t.variables))].length
      },
      templates: groupedTemplates,
      analysis: this.analyzeTemplatePatterns(groupedTemplates)
    };

    return report;
  }

  /**
   * Analyze template patterns and effectiveness
   */
  analyzeTemplatePatterns(groupedTemplates) {
    const analysis = {
      mostUsedTemplates: [],
      commonVariables: {},
      templateComplexity: {},
      contextUsage: {}
    };

    // Find most used templates
    Object.values(groupedTemplates).flat().forEach(template => {
      analysis.mostUsedTemplates.push({
        type: template.type,
        usageCount: template.usageCount,
        variableCount: template.variables.length
      });
    });

    analysis.mostUsedTemplates.sort((a, b) => b.usageCount - a.usageCount);
    analysis.mostUsedTemplates = analysis.mostUsedTemplates.slice(0, 10);

    // Analyze common variables
    this.templates.forEach(template => {
      template.variables.forEach(variable => {
        analysis.commonVariables[variable] = (analysis.commonVariables[variable] || 0) + 1;
      });
    });

    // Analyze template complexity
    Object.keys(groupedTemplates).forEach(type => {
      const templates = groupedTemplates[type];
      analysis.templateComplexity[type] = {
        count: templates.length,
        avgVariables: templates.reduce((sum, t) => sum + t.variables.length, 0) / templates.length,
        avgLength: templates.reduce((sum, t) => sum + t.template.length, 0) / templates.length
      };
    });

    // Analyze context usage
    this.templates.forEach(template => {
      template.contexts.forEach(context => {
        analysis.contextUsage[context] = (analysis.contextUsage[context] || 0) + 1;
      });
    });

    return analysis;
  }

  /**
   * Save analysis results to files
   */
  async saveResults(outputDir = 'analysis') {
    const report = this.generateReport();

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save detailed JSON report
    const jsonPath = path.join(outputDir, 'prompt-templates-analysis.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`Saved detailed analysis to ${jsonPath}`);

    // Save markdown report
    const markdownPath = path.join(outputDir, 'prompt-templates-report.md');
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`Saved markdown report to ${markdownPath}`);

    return report;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let markdown = `# Prompt Template Analysis Report

## Executive Summary

- **Total Templates Extracted:** ${report.summary.totalTemplates}
- **Unique Template Types:** ${report.summary.uniqueTemplates}
- **Template Categories:** ${report.summary.templateTypes.join(', ')}
- **Total Variables Identified:** ${report.summary.totalVariables}

## Template Categories

`;

    Object.keys(report.templates).forEach(type => {
      const templates = report.templates[type];
      markdown += `### ${type.replace(/_/g, ' ').toUpperCase()}

**Count:** ${templates.length} templates
**Usage:** ${templates.reduce((sum, t) => sum + t.usageCount, 0)} total occurrences

`;

      templates.slice(0, 3).forEach((template, index) => {
        markdown += `#### Template ${index + 1}

**Variables:** ${template.variables.length > 0 ? template.variables.join(', ') : 'None'}
**Usage Count:** ${template.usageCount}
**Contexts:** ${[...new Set(template.contexts)].join(', ')}

\`\`\`
${template.template.substring(0, 300)}${template.template.length > 300 ? '...' : ''}
\`\`\`

`;
      });
    });

    markdown += `## Analysis Insights

### Most Used Templates

`;

    report.analysis.mostUsedTemplates.forEach((template, index) => {
      markdown += `${index + 1}. **${template.type}** - ${template.usageCount} uses, ${template.variableCount} variables\n`;
    });

    markdown += `
### Common Variables

`;

    Object.entries(report.analysis.commonVariables)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([variable, count]) => {
        markdown += `- **${variable}**: ${count} occurrences\n`;
      });

    markdown += `
### Template Complexity by Type

`;

    Object.entries(report.analysis.templateComplexity).forEach(([type, stats]) => {
      markdown += `- **${type}**: ${stats.count} templates, avg ${stats.avgVariables.toFixed(1)} variables, avg ${stats.avgLength.toFixed(0)} chars\n`;
    });

    markdown += `
### Context Usage Patterns

`;

    Object.entries(report.analysis.contextUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([context, count]) => {
        markdown += `- **${context}**: ${count} occurrences\n`;
      });

    return markdown;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('Starting Prompt Template Extraction...');

  const extractor = new PromptTemplateExtractor();

  try {
    // Load debug data
    const debugDataPath = 'analysis/debug-processed-data.json';
    if (fs.existsSync(debugDataPath)) {
      console.log('Loading debug data...');
      const debugData = JSON.parse(fs.readFileSync(debugDataPath, 'utf8'));
      extractor.extractFromDebugData(debugData);
    } else {
      console.warn(`Debug data not found at ${debugDataPath}`);
    }

    // Load trace data (if available and not too large)
    const traceDataPath = 'analysis/parsed-trace-data.json';
    if (fs.existsSync(traceDataPath)) {
      console.log('Loading trace data...');
      try {
        const traceData = JSON.parse(fs.readFileSync(traceDataPath, 'utf8'));
        extractor.extractFromTraceData(traceData);
      } catch (error) {
        console.warn(`Could not load trace data: ${error.message}`);
      }
    } else {
      console.warn(`Trace data not found at ${traceDataPath}`);
    }

    // Process chat files directly for additional prompt content
    const chatDir = 'debug/chats';
    if (fs.existsSync(chatDir)) {
      console.log('Processing chat files directly...');
      const chatFiles = fs.readdirSync(chatDir).filter(f => f.endsWith('.chat'));

      chatFiles.forEach(file => {
        try {
          const chatPath = path.join(chatDir, file);
          const chatData = JSON.parse(fs.readFileSync(chatPath, 'utf8'));

          if (chatData.chat && Array.isArray(chatData.chat)) {
            chatData.chat.forEach(message => {
              if (message.content && typeof message.content === 'string') {
                extractor.extractSystemPrompts(message.content, file);
              }
            });
          }
        } catch (error) {
          console.warn(`Could not process chat file ${file}: ${error.message}`);
        }
      });
    }

    // Generate and save results
    console.log('Generating analysis report...');
    const report = await extractor.saveResults();

    console.log('\n=== EXTRACTION COMPLETE ===');
    console.log(`Total templates extracted: ${report.summary.totalTemplates}`);
    console.log(`Unique template types: ${report.summary.templateTypes.length}`);
    console.log(`Template categories: ${report.summary.templateTypes.join(', ')}`);
    console.log('\nReports saved to:');
    console.log('- analysis/prompt-templates-analysis.json');
    console.log('- analysis/prompt-templates-report.md');

  } catch (error) {
    console.error('Error during extraction:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = PromptTemplateExtractor;
