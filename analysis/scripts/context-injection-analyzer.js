#!/usr/bin/env node

/**
 * Context Injection Analyzer
 * Analyzes context injection mechanisms and patterns from debug data
 */

const fs = require('fs');
const path = require('path');

class ContextInjectionAnalyzer {
  constructor() {
    this.contextPatterns = {
      sources: {},
      types: {},
      frequency: {},
      transformations: [],
      injectionMechanisms: {}
    };

    this.contextFlows = [];
    this.contextSources = new Set();
    this.contextTypes = new Set();
  }

  /**
   * Analyze context injection patterns from debug data
   */
  analyzeContextInjection(debugData) {
    console.log('Analyzing context injection patterns...');

    const conversations = debugData.conversations || [];

    conversations.forEach((conv, index) => {
      this.analyzeConversationContext(conv, index);
    });

    this.generateContextStatistics();
    return this.contextPatterns;
  }

  /**
   * Analyze context in a single conversation
   */
  analyzeConversationContext(conversation, convIndex) {
    const { context = [], executionId, fileName } = conversation;

    // Track context flow for this conversation
    const contextFlow = {
      conversationId: executionId,
      fileName: fileName,
      contextCount: context.length,
      contextTypes: [],
      filePaths: [],
      steeringRules: 0,
      fileTreeExpansions: [],
      transformations: []
    };

    context.forEach((ctx, ctxIndex) => {
      this.analyzeContextItem(ctx, contextFlow, convIndex, ctxIndex);
    });

    this.contextFlows.push(contextFlow);
  }

  /**
   * Analyze individual context item
   */
  analyzeContextItem(contextItem, contextFlow, convIndex, ctxIndex) {
    const { type, path: filePath, expandedPaths = [], hasContent, target } = contextItem;

    // Track context types
    this.contextTypes.add(type);
    contextFlow.contextTypes.push(type);

    // Count context type frequency
    this.contextPatterns.types[type] = (this.contextPatterns.types[type] || 0) + 1;

    // Analyze different context types
    switch (type) {
      case 'fileTree':
        this.analyzeFileTreeContext(contextItem, contextFlow);
        break;
      case 'file':
        this.analyzeFileContext(contextItem, contextFlow);
        break;
      case 'steering':
        this.analyzeSteeringContext(contextItem, contextFlow);
        break;
      default:
        this.analyzeGenericContext(contextItem, contextFlow);
    }

    // Track context sources
    if (filePath) {
      this.contextSources.add(filePath);
      contextFlow.filePaths.push(filePath);

      // Categorize file sources
      const sourceCategory = this.categorizeFileSource(filePath);
      this.contextPatterns.sources[sourceCategory] = (this.contextPatterns.sources[sourceCategory] || 0) + 1;
    }
  }

  /**
   * Analyze file tree context injection
   */
  analyzeFileTreeContext(contextItem, contextFlow) {
    const { expandedPaths = [], target } = contextItem;

    contextFlow.fileTreeExpansions = expandedPaths;

    // Track expansion patterns
    expandedPaths.forEach(path => {
      const category = this.categorizeFileSource(path);
      this.contextPatterns.sources[category] = (this.contextPatterns.sources[category] || 0) + 1;
    });

    // Track target depth
    if (target) {
      this.contextPatterns.injectionMechanisms.fileTreeTarget =
        this.contextPatterns.injectionMechanisms.fileTreeTarget || [];
      this.contextPatterns.injectionMechanisms.fileTreeTarget.push(target);
    }
  }

  /**
   * Analyze file context injection
   */
  analyzeFileContext(contextItem, contextFlow) {
    const { path: filePath, hasContent } = contextItem;

    if (filePath) {
      // Track file inclusion patterns
      const fileType = this.getFileType(filePath);
      this.contextPatterns.injectionMechanisms.fileInclusion =
        this.contextPatterns.injectionMechanisms.fileInclusion || {};
      this.contextPatterns.injectionMechanisms.fileInclusion[fileType] =
        (this.contextPatterns.injectionMechanisms.fileInclusion[fileType] || 0) + 1;

      // Track content inclusion
      if (hasContent !== undefined) {
        this.contextPatterns.injectionMechanisms.contentInclusion =
          this.contextPatterns.injectionMechanisms.contentInclusion || { withContent: 0, withoutContent: 0 };

        if (hasContent) {
          this.contextPatterns.injectionMechanisms.contentInclusion.withContent++;
        } else {
          this.contextPatterns.injectionMechanisms.contentInclusion.withoutContent++;
        }
      }
    }
  }

  /**
   * Analyze steering context injection
   */
  analyzeSteeringContext(contextItem, contextFlow) {
    const { hasContent } = contextItem;

    contextFlow.steeringRules++;

    // Track steering injection patterns
    this.contextPatterns.injectionMechanisms.steering =
      this.contextPatterns.injectionMechanisms.steering || { total: 0, withContent: 0 };

    this.contextPatterns.injectionMechanisms.steering.total++;

    if (hasContent) {
      this.contextPatterns.injectionMechanisms.steering.withContent++;
    }
  }

  /**
   * Analyze generic context types
   */
  analyzeGenericContext(contextItem, contextFlow) {
    // Track unknown context types for further investigation
    this.contextPatterns.injectionMechanisms.unknown =
      this.contextPatterns.injectionMechanisms.unknown || [];

    this.contextPatterns.injectionMechanisms.unknown.push({
      type: contextItem.type,
      hasPath: !!contextItem.path,
      hasContent: !!contextItem.hasContent,
      hasExpandedPaths: !!(contextItem.expandedPaths && contextItem.expandedPaths.length > 0)
    });
  }

  /**
   * Categorize file sources by type
   */
  categorizeFileSource(filePath) {
    if (!filePath) return 'unknown';

    if (filePath.includes('.kiro/steering/')) return 'steering';
    if (filePath.includes('.kiro/specs/')) return 'specs';
    if (filePath.includes('.kiro/hooks/')) return 'hooks';
    if (filePath.includes('.kiro/')) return 'kiro-config';
    if (filePath.endsWith('.md')) return 'documentation';
    if (filePath.endsWith('.json')) return 'configuration';
    if (filePath.endsWith('.js') || filePath.endsWith('.ts')) return 'code';

    return 'other';
  }

  /**
   * Get file type from path
   */
  getFileType(filePath) {
    if (!filePath) return 'unknown';

    const ext = path.extname(filePath).toLowerCase();
    if (ext) return ext.substring(1); // Remove the dot

    return 'no-extension';
  }

  /**
   * Generate context statistics and patterns
   */
  generateContextStatistics() {
    // Calculate context injection frequency
    this.contextPatterns.frequency = {
      totalConversations: this.contextFlows.length,
      totalContextItems: this.contextFlows.reduce((sum, flow) => sum + flow.contextCount, 0),
      averageContextPerConversation: this.contextFlows.length > 0 ?
        (this.contextFlows.reduce((sum, flow) => sum + flow.contextCount, 0) / this.contextFlows.length).toFixed(2) : 0,
      contextTypeDistribution: { ...this.contextPatterns.types },
      sourceDistribution: { ...this.contextPatterns.sources }
    };

    // Analyze context transformation patterns
    this.analyzeContextTransformations();

    // Identify common context patterns
    this.identifyCommonPatterns();
  }

  /**
   * Analyze context transformations between interactions
   */
  analyzeContextTransformations() {
    const transformations = [];

    // Compare context between consecutive conversations
    for (let i = 1; i < this.contextFlows.length; i++) {
      const prev = this.contextFlows[i - 1];
      const curr = this.contextFlows[i];

      const transformation = {
        from: prev.fileName,
        to: curr.fileName,
        contextChange: {
          added: curr.contextTypes.filter(type => !prev.contextTypes.includes(type)),
          removed: prev.contextTypes.filter(type => !curr.contextTypes.includes(type)),
          maintained: curr.contextTypes.filter(type => prev.contextTypes.includes(type))
        },
        pathChanges: {
          added: curr.filePaths.filter(path => !prev.filePaths.includes(path)),
          removed: prev.filePaths.filter(path => !curr.filePaths.includes(path)),
          maintained: curr.filePaths.filter(path => prev.filePaths.includes(path))
        }
      };

      transformations.push(transformation);
    }

    this.contextPatterns.transformations = transformations;
  }

  /**
   * Identify common context injection patterns
   */
  identifyCommonPatterns() {
    const patterns = {
      commonContextCombinations: {},
      steeringUsagePatterns: {},
      fileTreeExpansionPatterns: {},
      contextEvolutionPatterns: {}
    };

    // Find common context type combinations
    this.contextFlows.forEach(flow => {
      const combination = flow.contextTypes.sort().join(',');
      patterns.commonContextCombinations[combination] =
        (patterns.commonContextCombinations[combination] || 0) + 1;
    });

    // Analyze steering usage patterns
    const steeringCounts = this.contextFlows.map(flow => flow.steeringRules);
    patterns.steeringUsagePatterns = {
      min: Math.min(...steeringCounts),
      max: Math.max(...steeringCounts),
      average: (steeringCounts.reduce((a, b) => a + b, 0) / steeringCounts.length).toFixed(2),
      distribution: steeringCounts.reduce((acc, count) => {
        acc[count] = (acc[count] || 0) + 1;
        return acc;
      }, {})
    };

    // Analyze file tree expansion patterns
    const expansionCounts = this.contextFlows
      .filter(flow => flow.fileTreeExpansions.length > 0)
      .map(flow => flow.fileTreeExpansions.length);

    if (expansionCounts.length > 0) {
      patterns.fileTreeExpansionPatterns = {
        min: Math.min(...expansionCounts),
        max: Math.max(...expansionCounts),
        average: (expansionCounts.reduce((a, b) => a + b, 0) / expansionCounts.length).toFixed(2),
        totalConversationsWithExpansions: expansionCounts.length
      };
    }

    this.contextPatterns.commonPatterns = patterns;
  }

  /**
   * Generate detailed context injection report
   */
  generateReport() {
    const report = {
      summary: {
        totalConversations: this.contextFlows.length,
        totalContextItems: this.contextPatterns.frequency.totalContextItems,
        uniqueContextTypes: Array.from(this.contextTypes),
        uniqueContextSources: Array.from(this.contextSources).length
      },
      contextTypes: this.contextPatterns.types,
      contextSources: this.contextPatterns.sources,
      injectionMechanisms: this.contextPatterns.injectionMechanisms,
      contextFlows: this.contextFlows,
      transformations: this.contextPatterns.transformations,
      patterns: this.contextPatterns.commonPatterns,
      statistics: this.contextPatterns.frequency
    };

    return report;
  }
}

// Main execution
async function main() {
  try {
    console.log('Starting context injection analysis...');

    // Load debug data
    const debugDataPath = path.join(__dirname, 'debug-processed-data.json');
    if (!fs.existsSync(debugDataPath)) {
      throw new Error(`Debug data file not found: ${debugDataPath}`);
    }

    const debugData = JSON.parse(fs.readFileSync(debugDataPath, 'utf8'));
    console.log(`Loaded debug data with ${debugData.conversations?.length || 0} conversations`);

    // Create analyzer and run analysis
    const analyzer = new ContextInjectionAnalyzer();
    const patterns = analyzer.analyzeContextInjection(debugData);

    // Generate comprehensive report
    const report = analyzer.generateReport();

    // Save results
    const outputPath = path.join(__dirname, 'context-injection-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Context injection analysis saved to: ${outputPath}`);

    // Generate summary statistics
    console.log('\n=== Context Injection Analysis Summary ===');
    console.log(`Total conversations analyzed: ${report.summary.totalConversations}`);
    console.log(`Total context items: ${report.summary.totalContextItems}`);
    console.log(`Unique context types: ${report.summary.uniqueContextTypes.join(', ')}`);
    console.log(`Unique context sources: ${report.summary.uniqueContextSources}`);
    console.log(`Average context per conversation: ${report.statistics.averageContextPerConversation}`);

    console.log('\nContext type distribution:');
    Object.entries(report.contextTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\nContext source distribution:');
    Object.entries(report.contextSources).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });

    return report;

  } catch (error) {
    console.error('Error in context injection analysis:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { ContextInjectionAnalyzer };

// Run if called directly
if (require.main === module) {
  main();
}
