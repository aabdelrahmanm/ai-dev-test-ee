#!/usr/bin/env node

/**
 * Refined Prompt Template Extractor
 *
 * Focuses on extracting clean, actionable prompt templates with better
 * variable detection and pattern matching
 */

const fs = require('fs');
const path = require('path');

class RefinedPromptExtractor {
  constructor() {
    this.templates = [];
    this.patterns = {
      // Clean variable patterns - only simple placeholders
      cleanVariables: [
        /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,  // {{variable_name}}
        /\[([a-zA-Z_][a-zA-Z0-9_\s]*)\]/g,     // [variable name]
        /<([a-zA-Z_][a-zA-Z0-9_]*?)>/g         // <variable>
      ],

      // Template section markers
      sectionMarkers: [
        { name: 'identity', pattern: /^# Identity$/m },
        { name: 'capabilities', pattern: /^# Capabilities$/m },
        { name: 'rules', pattern: /^# Rules$/m },
        { name: 'response_style', pattern: /^# Response style$/m },
        { name: 'system_info', pattern: /^# System Information$/m },
        { name: 'goal', pattern: /^# Goal$/m },
        { name: 'context', pattern: /^# Current Context$/m }
      ],

      // Context injection patterns
      contextPatterns: [
        { name: 'file_tree', pattern: /<fileTree>.*?<\/fileTree>/s },
        { name: 'steering_rules', pattern: /## Included Rules \([^)]+\)/g },
        { name: 'user_rule', pattern: /<user-rule id=[^>]+>.*?<\/user-rule>/s },
        { name: 'file_content', pattern: /<file name="[^"]*"[^>]*>/g }
      ]
    };
  }

  /**
   * Extract clean templates from debug data
   */
  extractFromDebugData(debugData) {
    console.log('Extracting refined templates from debug data...');

    if (!debugData.conversations) {
      console.warn('No conversations found in debug data');
      return;
    }

    // Process steering content first
    const steeringContent = new Map();
    debugData.conversations.forEach(conversation => {
      if (conversation.context) {
        conversation.context.forEach(ctx => {
          if (ctx.type === 'steering' && ctx.content && ctx.id) {
            steeringContent.set(ctx.id, ctx.content);
          }
        });
      }
    });

    // Extract steering templates
    steeringContent.forEach((content, id) => {
      this.extractSteeringTemplate(content, id);
    });

    console.log(`Processed ${steeringContent.size} steering files`);
  }

  /**
   * Process chat files directly for system prompts
   */
  extractFromChatFiles(chatDir = 'debug/chats') {
    console.log('Processing chat files for system prompts...');

    if (!fs.existsSync(chatDir)) {
      console.warn(`Chat directory not found: ${chatDir}`);
      return;
    }

    const chatFiles = fs.readdirSync(chatDir).filter(f => f.endsWith('.chat'));
    console.log(`Found ${chatFiles.length} chat files`);

    chatFiles.forEach(file => {
      try {
        const chatPath = path.join(chatDir, file);
        const chatData = JSON.parse(fs.readFileSync(chatPath, 'utf8'));

        if (chatData.chat && Array.isArray(chatData.chat)) {
          chatData.chat.forEach((message, index) => {
            if (message.content && typeof message.content === 'string') {
              this.extractSystemPromptSections(message.content, `${file}:${index}`);
            }
          });
        }
      } catch (error) {
        console.warn(`Could not process chat file ${file}: ${error.message}`);
      }
    });
  }

  /**
   * Extract steering template with clean structure
   */
  extractSteeringTemplate(content, steeringId) {
    const template = {
      type: 'steering_rule',
      id: steeringId,
      name: this.extractSteeringName(content),
      template: this.cleanSteeringTemplate(content),
      variables: this.extractCleanVariables(content),
      usageCount: 1,
      examples: [content.substring(0, 500)],
      contexts: ['steering'],
      metadata: {
        length: content.length,
        sections: this.identifySections(content)
      }
    };

    this.templates.push(template);
  }

  /**
   * Extract system prompt sections with better structure
   */
  extractSystemPromptSections(content, source) {
    // Extract each major section as a separate template
    this.patterns.sectionMarkers.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        const sectionContent = this.extractSection(content, pattern);
        if (sectionContent && sectionContent.length > 50) {
          const template = {
            type: `system_${name}`,
            template: this.cleanTemplate(sectionContent),
            variables: this.extractCleanVariables(sectionContent),
            usageCount: 1,
            examples: [sectionContent],
            contexts: [source],
            metadata: {
              length: sectionContent.length,
              hasVariables: this.extractCleanVariables(sectionContent).length > 0
            }
          };
          this.templates.push(template);
        }
      }
    });

    // Extract context injection patterns
    this.patterns.contextPatterns.forEach(({ name, pattern }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const template = {
            type: `context_${name}`,
            template: this.createContextTemplate(match, name),
            variables: this.extractCleanVariables(match),
            usageCount: 1,
            examples: [match.substring(0, 300)],
            contexts: [source],
            metadata: {
              patternType: name,
              originalLength: match.length
            }
          };
          this.templates.push(template);
        });
      }
    });
  }

  /**
   * Extract only clean, meaningful variables
   */
  extractCleanVariables(content) {
    const variables = new Set();

    this.patterns.cleanVariables.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const variable = match[1].trim();
        // Filter out noise - only keep reasonable variable names
        if (this.isValidVariable(variable)) {
          variables.add(variable);
        }
      }
    });

    return Array.from(variables);
  }

  /**
   * Check if a variable name is valid and not noise
   */
  isValidVariable(variable) {
    // Skip very long strings (likely not variables)
    if (variable.length > 50) return false;

    // Skip strings with special characters that indicate they're not variables
    if (variable.includes('"') || variable.includes('\n') || variable.includes('{')) return false;

    // Skip common noise patterns
    const noisePatterns = [
      /^https?:\/\//,  // URLs
      /^\d+$/,         // Pure numbers
      /^[A-Z_]+$/,     // All caps (likely constants, not template vars)
    ];

    return !noisePatterns.some(pattern => pattern.test(variable));
  }

  /**
   * Extract a section from content based on header pattern
   */
  extractSection(content, headerPattern) {
    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = lines.length;

    // Find section start
    for (let i = 0; i < lines.length; i++) {
      if (headerPattern.test(lines[i])) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) return null;

    // Find section end (next header or end of content)
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('# ') && !lines[i].includes('##')) {
        endIndex = i;
        break;
      }
    }

    return lines.slice(startIndex, endIndex).join('\n').trim();
  }

  /**
   * Clean template content by removing excessive whitespace and normalizing
   */
  cleanTemplate(content) {
    return content
      .replace(/\n\s*\n\s*\n/g, '\n\n')  // Remove excessive line breaks
      .replace(/^\s+|\s+$/g, '')         // Trim whitespace
      .replace(/\s+$/gm, '');            // Remove trailing spaces on lines
  }

  /**
   * Clean steering template and extract key structure
   */
  cleanSteeringTemplate(content) {
    // Extract the main content, removing front matter if present
    const lines = content.split('\n');
    let contentStart = 0;

    // Skip front matter or comments
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#') && !lines[i].startsWith('<!---')) {
        contentStart = i;
        break;
      }
    }

    return lines.slice(contentStart).join('\n').trim();
  }

  /**
   * Extract steering rule name from content
   */
  extractSteeringName(content) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('# ')) {
        return line.substring(2).trim();
      }
    }
    return 'Unknown';
  }

  /**
   * Create a template for context injection patterns
   */
  createContextTemplate(match, patternType) {
    switch (patternType) {
      case 'file_tree':
        return `<fileTree>
{{file_tree_content}}
</fileTree>`;

      case 'steering_rules':
        return `## Included Rules ({{rule_filename}})

I am providing you some additional guidance that you should follow for your entire execution.

<user-rule id={{rule_id}}>
{{rule_content}}
</user-rule>`;

      case 'file_content':
        return `<file name="{{filename}}" language="{{language}}">
<content>
{{file_content}}
</content>
</file>`;

      default:
        return match.substring(0, 200) + (match.length > 200 ? '...' : '');
    }
  }

  /**
   * Identify sections in content
   */
  identifySections(content) {
    const sections = [];
    this.patterns.sectionMarkers.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        sections.push(name);
      }
    });
    return sections;
  }

  /**
   * Group and deduplicate similar templates
   */
  groupAndDeduplicate() {
    console.log('Grouping and deduplicating templates...');

    const groups = {};

    // Group by type
    this.templates.forEach(template => {
      const key = template.type;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(template);
    });

    // Deduplicate within each group
    Object.keys(groups).forEach(type => {
      groups[type] = this.deduplicateTemplates(groups[type]);
    });

    return groups;
  }

  /**
   * Deduplicate templates that are very similar
   */
  deduplicateTemplates(templates) {
    const deduplicated = [];

    templates.forEach(template => {
      const existing = deduplicated.find(existing =>
        this.calculateSimilarity(existing.template, template.template) > 0.9
      );

      if (existing) {
        // Merge with existing
        existing.usageCount += template.usageCount;
        existing.examples.push(...template.examples);
        existing.contexts.push(...template.contexts);
        existing.variables = [...new Set([...existing.variables, ...template.variables])];
      } else {
        deduplicated.push(template);
      }
    });

    return deduplicated;
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
   * Calculate Levenshtein distance
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
    const groupedTemplates = this.groupAndDeduplicate();

    const report = {
      summary: {
        totalTemplatesExtracted: this.templates.length,
        uniqueTemplatesAfterDedup: Object.values(groupedTemplates).reduce((sum, group) => sum + group.length, 0),
        templateTypes: Object.keys(groupedTemplates),
        totalVariables: [...new Set(this.templates.flatMap(t => t.variables))].length,
        extractionTimestamp: new Date().toISOString()
      },
      templates: groupedTemplates,
      analysis: this.analyzeTemplates(groupedTemplates),
      recommendations: this.generateRecommendations(groupedTemplates)
    };

    return report;
  }

  /**
   * Analyze template patterns
   */
  analyzeTemplates(groupedTemplates) {
    const analysis = {
      templatesByType: {},
      mostCommonVariables: {},
      templateComplexity: {},
      usagePatterns: {}
    };

    // Analyze by type
    Object.keys(groupedTemplates).forEach(type => {
      const templates = groupedTemplates[type];
      analysis.templatesByType[type] = {
        count: templates.length,
        totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0),
        avgVariables: templates.reduce((sum, t) => sum + t.variables.length, 0) / templates.length,
        avgLength: templates.reduce((sum, t) => sum + t.template.length, 0) / templates.length
      };
    });

    // Find common variables
    this.templates.forEach(template => {
      template.variables.forEach(variable => {
        analysis.mostCommonVariables[variable] = (analysis.mostCommonVariables[variable] || 0) + 1;
      });
    });

    return analysis;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(groupedTemplates) {
    const recommendations = [];

    // Check template coverage
    const systemTypes = Object.keys(groupedTemplates).filter(type => type.startsWith('system_'));
    if (systemTypes.length < 3) {
      recommendations.push({
        type: 'coverage',
        message: 'Consider extracting more system prompt sections (identity, capabilities, rules, etc.)',
        priority: 'medium'
      });
    }

    // Check for context templates
    const contextTypes = Object.keys(groupedTemplates).filter(type => type.startsWith('context_'));
    if (contextTypes.length === 0) {
      recommendations.push({
        type: 'context',
        message: 'No context injection templates found - check if context patterns are being detected',
        priority: 'high'
      });
    }

    // Check variable usage
    const totalVariables = [...new Set(this.templates.flatMap(t => t.variables))].length;
    if (totalVariables < 5) {
      recommendations.push({
        type: 'variables',
        message: 'Few template variables detected - consider expanding variable detection patterns',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Save results with better organization
   */
  async saveResults(outputDir = 'analysis') {
    const report = this.generateReport();

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save detailed JSON report
    const jsonPath = path.join(outputDir, 'refined-prompt-templates.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`Saved refined analysis to ${jsonPath}`);

    // Save markdown report
    const markdownPath = path.join(outputDir, 'refined-prompt-report.md');
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`Saved refined markdown report to ${markdownPath}`);

    return report;
  }

  /**
   * Generate clean markdown report
   */
  generateMarkdownReport(report) {
    let markdown = `# Refined Prompt Template Analysis

## Executive Summary

- **Templates Extracted:** ${report.summary.totalTemplatesExtracted}
- **Unique Templates:** ${report.summary.uniqueTemplatesAfterDedup}
- **Template Types:** ${report.summary.templateTypes.length}
- **Clean Variables:** ${report.summary.totalVariables}
- **Analysis Date:** ${new Date(report.summary.extractionTimestamp).toLocaleDateString()}

## Template Categories

`;

    Object.keys(report.templates).forEach(type => {
      const templates = report.templates[type];
      const stats = report.analysis.templatesByType[type];

      markdown += `### ${type.replace(/_/g, ' ').toUpperCase()}

**Templates:** ${stats.count} | **Usage:** ${stats.totalUsage} | **Avg Variables:** ${stats.avgVariables.toFixed(1)} | **Avg Length:** ${stats.avgLength.toFixed(0)} chars

`;

      templates.slice(0, 2).forEach((template, index) => {
        markdown += `#### ${template.name || `Template ${index + 1}`}

**Variables:** ${template.variables.join(', ') || 'None'}
**Usage:** ${template.usageCount} times
**Contexts:** ${[...new Set(template.contexts)].length} different contexts

\`\`\`
${template.template.substring(0, 400)}${template.template.length > 400 ? '\n...' : ''}
\`\`\`

`;
      });
    });

    // Add analysis insights
    markdown += `## Key Insights

### Most Common Variables

`;

    Object.entries(report.analysis.mostCommonVariables)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .forEach(([variable, count]) => {
        markdown += `- **${variable}**: ${count} occurrences\n`;
      });

    markdown += `
### Template Complexity by Type

`;

    Object.entries(report.analysis.templatesByType)
      .sort(([,a], [,b]) => b.totalUsage - a.totalUsage)
      .forEach(([type, stats]) => {
        markdown += `- **${type}**: ${stats.count} templates, ${stats.totalUsage} total usage\n`;
      });

    // Add recommendations
    if (report.recommendations.length > 0) {
      markdown += `
## Recommendations

`;
      report.recommendations.forEach(rec => {
        markdown += `- **${rec.type.toUpperCase()}** (${rec.priority}): ${rec.message}\n`;
      });
    }

    return markdown;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting Refined Prompt Template Extraction...');

  const extractor = new RefinedPromptExtractor();

  try {
    // Load debug data
    const debugDataPath = 'analysis/debug-processed-data.json';
    if (fs.existsSync(debugDataPath)) {
      console.log('Loading debug data...');
      const debugData = JSON.parse(fs.readFileSync(debugDataPath, 'utf8'));
      extractor.extractFromDebugData(debugData);
    }

    // Process chat files directly
    extractor.extractFromChatFiles();

    // Generate and save results
    console.log('Generating refined analysis...');
    const report = await extractor.saveResults();

    console.log('\n=== REFINED EXTRACTION COMPLETE ===');
    console.log(`Templates extracted: ${report.summary.totalTemplatesExtracted}`);
    console.log(`Unique templates: ${report.summary.uniqueTemplatesAfterDedup}`);
    console.log(`Template types: ${report.summary.templateTypes.join(', ')}`);
    console.log(`Clean variables: ${report.summary.totalVariables}`);

    if (report.recommendations.length > 0) {
      console.log(`\nRecommendations: ${report.recommendations.length}`);
      report.recommendations.forEach(rec => {
        console.log(`  - ${rec.message}`);
      });
    }

    console.log('\nRefined reports saved to:');
    console.log('- analysis/refined-prompt-templates.json');
    console.log('- analysis/refined-prompt-report.md');

  } catch (error) {
    console.error('Error during refined extraction:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = RefinedPromptExtractor;
