#!/usr/bin/env node

/**
 * Decision-Making Pattern Analyzer
 * Analyzes Kiro's decision-making and inference patterns frrace and debug data
 */

const fs = require('fs');
const path = require('path');

class DecisionMakingAnalyzer {
  constructor() {
    this.analysisResults = {
      decisionPatterns: [],
      inferenceFrequency: {},
      decisionTriggers: [],
      branchingLogic: [],
      executionFlows: [],
      statistics: {}
    };
  }

  /**
   * Load and process all available data sources
   */
  loadData() {
    const dataDir = path.join(__dirname, '../data');

    try {
      // Load API sequence data
      this.apiSequenceData = this.loadJsonFile(path.join(dataDir, 'api-sequence-analysis.json'));

      // Load debug processed data (truncated but still useful)
      this.debugData = this.loadJsonFile(path.join(dataDir, 'debug-processed-data.json'));

      // Load context injection analysis
      this.contextData = this.loadJsonFile(path.join(dataDir, 'context-injection-analysis.json'));

      console.log('✓ Loaded data sources successfully');
      return true;
    } catch (error) {
      console.error('Error loading data:', error.message);
      return false;
    }
  }

  /**
   * Load JSON file with error handling
   */
  loadJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not load ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Analyze decision-making patterns from API sequences
   */
  analyzeDecisionPatterns() {
    console.log('\n🔍 Analyzing decision-making patterns...');

    if (!this.apiSequenceData?.conversations) {
      console.warn('No API sequence data available');
      return;
    }

    const patterns = [];

    Object.entries(this.apiSequenceData.conversations).forEach(([convId, conversation]) => {
      if (!conversation.interactions) return;

      // Analyze each interaction sequence
      conversation.interactions.forEach((interaction, index) => {
        const pattern = this.analyzeInteractionDecision(interaction, index, conversation.interactions);
        if (pattern) {
          patterns.push(pattern);
        }
      });
    });

    this.analysisResults.decisionPatterns = patterns;
    console.log(`✓ Found ${patterns.length} decision patterns`);
  }

  /**
   * Analyze a single interaction for decision patterns
   */
  analyzeInteractionDecision(interaction, index, allInteractions) {
    const pattern = {
      conversationId: interaction.conversationId,
      requestId: interaction.requestId,
      timestamp: interaction.timestamp,
      decisionType: this.identifyDecisionType(interaction),
      triggers: this.identifyTriggers(interaction),
      nextActions: this.identifyNextActions(interaction, index, allInteractions),
      toolUsage: this.extractToolUsage(interaction),
      responseTime: this.calculateResponseTime(interaction)
    };

    return pattern;
  }

  /**
   * Identify the type of decision being made
   */
  identifyDecisionType(interaction) {
    const userMessage = interaction.request?.body?.userMessage || '';
    const systemPrompt = interaction.request?.body?.systemPrompt || '';

    // Analyze message content to determine decision type
    if (userMessage.includes('create a hook')) {
      return 'hook-creation';
    } else if (userMessage.includes('spec') || systemPrompt.includes('spec')) {
      return 'spec-generation';
    } else if (userMessage.includes('file was just edited')) {
      return 'file-change-response';
    } else if (interaction.response?.chunks?.some(chunk => chunk.hasToolEvent)) {
      return 'tool-execution';
    } else {
      return 'general-response';
    }
  }

  /**
   * Identify triggers that caused this decision
   */
  identifyTriggers(interaction) {
    const triggers = [];
    const userMessage = interaction.request?.body?.userMessage || '';

    // File system triggers
    if (userMessage.includes('file was just edited')) {
      triggers.push({
        type: 'file-change',
        source: 'file-system-event',
        details: this.extractFileChangeDetails(userMessage)
      });
    }

    // User input triggers
    if (userMessage.includes('Can you create')) {
      triggers.push({
        type: 'user-request',
        source: 'direct-user-input',
        intent: 'creation-request'
      });
    }

    // Context triggers
    if (userMessage.includes('These are the files in the directory')) {
      triggers.push({
        type: 'context-injection',
        source: 'file-tree-context',
        scope: 'workspace-overview'
      });
    }

    return triggers;
  }

  /**
   * Extract file change details from user message
   */
  extractFileChangeDetails(message) {
    const fileMatch = message.match(/file was just edited: (.+)/);
    const diffMatch = message.match(/<diff>(.*?)<\/diff>/s);

    return {
      file: fileMatch ? fileMatch[1] : null,
      hasDiff: !!diffMatch,
      diffSize: diffMatch ? diffMatch[1].length : 0
    };
  }

  /**
   * Identify what actions follow this decision
   */
  identifyNextActions(interaction, index, allInteractions) {
    const nextActions = [];

    // Look at response chunks for immediate actions
    if (interaction.response?.chunks) {
      interaction.response.chunks.forEach(chunk => {
        if (chunk.hasToolEvent) {
          nextActions.push({
            type: 'tool-execution',
            timing: 'immediate',
            chunkNumber: chunk.chunkNumber
          });
        }
        if (chunk.hasAssistantEvent) {
          nextActions.push({
            type: 'assistant-response',
            timing: 'immediate',
            chunkNumber: chunk.chunkNumber
          });
        }
      });
    }

    // Look at next interaction for follow-up actions
    if (index < allInteractions.length - 1) {
      const nextInteraction = allInteractions[index + 1];
      const timeDiff = new Date(nextInteraction.timestamp) - new Date(interaction.timestamp);

      nextActions.push({
        type: 'follow-up-interaction',
        timing: 'delayed',
        delay: timeDiff,
        nextDecisionType: this.identifyDecisionType(nextInteraction)
      });
    }

    return nextActions;
  }

  /**
   * Extract tool usage patterns from interaction
   */
  extractToolUsage(interaction) {
    const toolUsage = {
      toolEvents: 0,
      assistantEvents: 0,
      totalChunks: 0,
      toolToAssistantRatio: 0
    };

    if (interaction.response?.chunks) {
      toolUsage.totalChunks = interaction.response.chunks.length;
      toolUsage.toolEvents = interaction.response.chunks.filter(c => c.hasToolEvent).length;
      toolUsage.assistantEvents = interaction.response.chunks.filter(c => c.hasAssistantEvent).length;

      if (toolUsage.assistantEvents > 0) {
        toolUsage.toolToAssistantRatio = toolUsage.toolEvents / toolUsage.assistantEvents;
      }
    }

    return toolUsage;
  }

  /**
   * Calculate response time for the interaction
   */
  calculateResponseTime(interaction) {
    if (!interaction.response?.chunks || interaction.response.chunks.length === 0) {
      return null;
    }

    const startTime = new Date(interaction.timestamp);
    const firstChunk = interaction.response.chunks[0];
    const lastChunk = interaction.response.chunks[interaction.response.chunks.length - 1];

    return {
      timeToFirstChunk: new Date(firstChunk.timestamp) - startTime,
      totalResponseTime: new Date(lastChunk.timestamp) - startTime,
      chunkCount: interaction.response.chunks.length
    };
  }

  /**
   * Analyze inference frequency patterns
   */
  analyzeInferenceFrequency() {
    console.log('\n📊 Analyzing inference frequency patterns...');

    const frequency = {
      byDecisionType: {},
      byTriggerType: {},
      byTimeOfDay: {},
      multipleInferences: []
    };

    this.analysisResults.decisionPatterns.forEach(pattern => {
      // Count by decision type
      frequency.byDecisionType[pattern.decisionType] =
        (frequency.byDecisionType[pattern.decisionType] || 0) + 1;

      // Count by trigger type
      pattern.triggers.forEach(trigger => {
        frequency.byTriggerType[trigger.type] =
          (frequency.byTriggerType[trigger.type] || 0) + 1;
      });

      // Analyze time patterns
      const hour = new Date(pattern.timestamp).getHours();
      frequency.byTimeOfDay[hour] = (frequency.byTimeOfDay[hour] || 0) + 1;

      // Identify multiple inferences (high tool usage)
      if (pattern.toolUsage.toolEvents > 5) {
        frequency.multipleInferences.push({
          requestId: pattern.requestId,
          toolEvents: pattern.toolUsage.toolEvents,
          decisionType: pattern.decisionType
        });
      }
    });

    this.analysisResults.inferenceFrequency = frequency;
    console.log(`✓ Analyzed ${this.analysisResults.decisionPatterns.length} inference patterns`);
  }

  /**
   * Map decision tree and branching logic
   */
  mapDecisionTree() {
    console.log('\n🌳 Mapping decision tree and branching logic...');

    const branchingLogic = [];
    const executionFlows = {};

    // Group patterns by conversation to see decision flows
    const conversationFlows = {};
    this.analysisResults.decisionPatterns.forEach(pattern => {
      if (!conversationFlows[pattern.conversationId]) {
        conversationFlows[pattern.conversationId] = [];
      }
      conversationFlows[pattern.conversationId].push(pattern);
    });

    // Analyze each conversation flow
    Object.entries(conversationFlows).forEach(([convId, patterns]) => {
      patterns.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const flow = {
        conversationId: convId,
        steps: patterns.length,
        decisionSequence: patterns.map(p => p.decisionType),
        branchingPoints: this.identifyBranchingPoints(patterns),
        totalDuration: this.calculateFlowDuration(patterns)
      };

      executionFlows[convId] = flow;

      // Extract branching logic
      for (let i = 0; i < patterns.length - 1; i++) {
        const current = patterns[i];
        const next = patterns[i + 1];

        branchingLogic.push({
          from: current.decisionType,
          to: next.decisionType,
          trigger: next.triggers[0]?.type || 'unknown',
          timeDelta: new Date(next.timestamp) - new Date(current.timestamp)
        });
      }
    });

    this.analysisResults.branchingLogic = branchingLogic;
    this.analysisResults.executionFlows = executionFlows;

    console.log(`✓ Mapped ${Object.keys(executionFlows).length} execution flows`);
  }

  /**
   * Identify branching points in a conversation flow
   */
  identifyBranchingPoints(patterns) {
    const branchingPoints = [];

    for (let i = 0; i < patterns.length - 1; i++) {
      const current = patterns[i];
      const next = patterns[i + 1];

      // A branching point is where decision type changes significantly
      if (current.decisionType !== next.decisionType) {
        branchingPoints.push({
          position: i,
          from: current.decisionType,
          to: next.decisionType,
          trigger: next.triggers[0]?.type,
          complexity: current.toolUsage.toolEvents + next.toolUsage.toolEvents
        });
      }
    }

    return branchingPoints;
  }

  /**
   * Calculate total duration of a conversation flow
   */
  calculateFlowDuration(patterns) {
    if (patterns.length < 2) return 0;

    const start = new Date(patterns[0].timestamp);
    const end = new Date(patterns[patterns.length - 1].timestamp);
    return end - start;
  }

  /**
   * Generate comprehensive statistics
   */
  generateStatistics() {
    console.log('\n📈 Generating statistics...');

    const stats = {
      totalDecisions: this.analysisResults.decisionPatterns.length,
      uniqueConversations: new Set(this.analysisResults.decisionPatterns.map(p => p.conversationId)).size,
      averageResponseTime: this.calculateAverageResponseTime(),
      mostCommonDecisionType: this.findMostCommon(this.analysisResults.inferenceFrequency.byDecisionType),
      mostCommonTrigger: this.findMostCommon(this.analysisResults.inferenceFrequency.byTriggerType),
      complexDecisions: this.analysisResults.inferenceFrequency.multipleInferences.length,
      branchingFrequency: this.calculateBranchingFrequency()
    };

    this.analysisResults.statistics = stats;
    console.log(`✓ Generated comprehensive statistics`);
  }

  /**
   * Calculate average response time across all interactions
   */
  calculateAverageResponseTime() {
    const responseTimes = this.analysisResults.decisionPatterns
      .map(p => p.responseTime?.totalResponseTime)
      .filter(t => t !== null && t !== undefined);

    if (responseTimes.length === 0) return null;

    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average);
  }

  /**
   * Find most common item in frequency object
   */
  findMostCommon(frequencyObj) {
    if (!frequencyObj || Object.keys(frequencyObj).length === 0) return null;

    return Object.entries(frequencyObj)
      .sort(([,a], [,b]) => b - a)[0];
  }

  /**
   * Calculate how often branching occurs
   */
  calculateBranchingFrequency() {
    const totalTransitions = this.analysisResults.branchingLogic.length;
    const branchingTransitions = this.analysisResults.branchingLogic
      .filter(branch => branch.from !== branch.to).length;

    return totalTransitions > 0 ? branchingTransitions / totalTransitions : 0;
  }

  /**
   * Generate the analysis report
   */
  generateReport() {
    console.log('\n📝 Generating decision-making analysis report...');

    const report = {
      title: "Kiro Decision-Making and Inference Pattern Analysis",
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      decisionPatterns: this.analysisResults.decisionPatterns,
      inferenceFrequency: this.analysisResults.inferenceFrequency,
      branchingLogic: this.analysisResults.branchingLogic,
      executionFlows: this.analysisResults.executionFlows,
      statistics: this.analysisResults.statistics,
      insights: this.generateInsights()
    };

    // Save the report
    const reportPath = path.join(__dirname, '../data/decision-making-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`✓ Report saved to ${reportPath}`);
    return report;
  }

  /**
   * Generate executive summary
   */
  generateSummary() {
    const stats = this.analysisResults.statistics;

    return {
      totalDecisions: stats.totalDecisions,
      conversationsAnalyzed: stats.uniqueConversations,
      averageResponseTime: `${stats.averageResponseTime}ms`,
      primaryDecisionType: stats.mostCommonDecisionType?.[0] || 'unknown',
      primaryTrigger: stats.mostCommonTrigger?.[0] || 'unknown',
      branchingFrequency: `${Math.round(stats.branchingFrequency * 100)}%`,
      complexDecisions: stats.complexDecisions
    };
  }

  /**
   * Generate key insights from the analysis
   */
  generateInsights() {
    const insights = [];
    const stats = this.analysisResults.statistics;
    const frequency = this.analysisResults.inferenceFrequency;

    // Decision type insights
    if (stats.mostCommonDecisionType) {
      insights.push({
        category: 'Decision Types',
        finding: `Most common decision type is "${stats.mostCommonDecisionType[0]}" (${stats.mostCommonDecisionType[1]} occurrences)`,
        implication: 'This indicates the primary use case for Kiro in the analyzed sessions'
      });
    }

    // Trigger insights
    if (stats.mostCommonTrigger) {
      insights.push({
        category: 'Triggers',
        finding: `Most common trigger is "${stats.mostCommonTrigger[0]}" (${stats.mostCommonTrigger[1]} occurrences)`,
        implication: 'This shows how users primarily interact with Kiro'
      });
    }

    // Complexity insights
    if (frequency.multipleInferences.length > 0) {
      const avgComplexity = frequency.multipleInferences.reduce((sum, item) => sum + item.toolEvents, 0) / frequency.multipleInferences.length;
      insights.push({
        category: 'Complexity',
        finding: `${frequency.multipleInferences.length} decisions required multiple inferences (avg ${Math.round(avgComplexity)} tool events)`,
        implication: 'Complex decisions trigger multiple LLM inferences and tool usage'
      });
    }

    // Branching insights
    if (stats.branchingFrequency > 0.5) {
      insights.push({
        category: 'Branching Logic',
        finding: `High branching frequency (${Math.round(stats.branchingFrequency * 100)}%)`,
        implication: 'Kiro frequently changes decision types based on context and triggers'
      });
    }

    return insights;
  }

  /**
   * Run the complete analysis
   */
  async run() {
    console.log('🚀 Starting Kiro Decision-Making Pattern Analysis\n');

    // Load data
    if (!this.loadData()) {
      console.error('❌ Failed to load required data');
      return false;
    }

    // Run analysis steps
    this.analyzeDecisionPatterns();
    this.analyzeInferenceFrequency();
    this.mapDecisionTree();
    this.generateStatistics();

    // Generate report
    const report = this.generateReport();

    console.log('\n✅ Analysis complete!');
    console.log(`📊 Analyzed ${report.summary.totalDecisions} decisions across ${report.summary.conversationsAnalyzed} conversations`);
    console.log(`⚡ Average response time: ${report.summary.averageResponseTime}`);
    console.log(`🎯 Primary decision type: ${report.summary.primaryDecisionType}`);
    console.log(`🔄 Branching frequency: ${report.summary.branchingFrequency}`);

    return true;
  }
}

// Run the analyzer if called directly
if (require.main === module) {
  const analyzer = new DecisionMakingAnalyzer();
  analyzer.run().catch(console.error);
}

module.exports = DecisionMakingAnalyzer;
