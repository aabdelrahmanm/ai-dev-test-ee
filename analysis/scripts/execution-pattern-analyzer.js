#!/usr/bin/env node

/**
 * Execution Pattern Analyzer
 * Analyzes execution patterns from debug logs to understand agent invocation and decision flow
 */

const fs = require('fs');
const path = require('path');

class ExecutionPatternAnalyzer {
  constructor() {
    this.executionPatterns = [];
    this.agentInvocations = [];
    this.hookTriggers = [];
    this.queueManagement = [];
  }

  /**
   * Load debug data
   */
  loadDebugData() {
    try {
      // Load debug processed data
      const debugDataPath = path.join(__dirname, '../data/debug-processed-data.json');
      this.debugData = JSON.parse(fs.readFileSync(debugDataPath, 'utf8'));

      // Load execution log
      const execLogPath = path.join(__dirname, '../../debug/execution-log.json');
      this.executionLog = JSON.parse(fs.readFileSync(execLogPath, 'utf8'));

      console.log('✓ Loaded debug data successfully');
      return true;
    } catch (error) {
      console.error('Error loading debug data:', error.message);
      return false;
    }
  }

  /**
   * Analyze agent invocation patterns from system events
   */
  analyzeAgentInvocations() {
    console.log('\n🔍 Analyzing agent invocation patterns...');

    if (!this.debugData.systemEvents) {
      console.warn('No system events available');
      return;
    }

    const invocations = [];
    const queueEvents = [];

    this.debugData.systemEvents.forEach(event => {
      const message = event.message;
// Agent invocation events
      if (message.includes('AgentIterator] Invoking agent')) {
        invocations.push({
          timestamp: event.timestamp,
          component: event.component,
          type: 'agent-invocation',
          rawMessage: message
        });
      }

      // Agent triggering events
      if (message.includes('Triggered new agent:')) {
        const agentTypeMatch = message.match(/Triggered new agent: ([^\s]+)/);
        const autonomyMatch = message.match(/autonomyMode=([^)]+)/);

        invocations.push({
          timestamp: event.timestamp,
          component: event.component,
          type: 'agent-trigger',
          agentType: agentTypeMatch ? agentTypeMatch[1] : 'unknown',
          autonomyMode: autonomyMatch ? autonomyMatch[1] : 'unknown',
          rawMessage: message
        });
      }

      // Queue management events
      if (message.includes('Progressing model queue')) {
        const queueDataMatch = message.match(/\{([^}]+)\}/);
        let queueData = {};

        if (queueDataMatch) {
          try {
            queueData = JSON.parse('{' + queueDataMatch[1] + '}');
          } catch (e) {
            // Ignore parse errors
          }
        }

        queueEvents.push({
          timestamp: event.timestamp,
          component: event.component,
          type: 'queue-management',
          queueData: queueData,
          rawMessage: message
        });
      }

      // Hook events
      if (message.includes('Hook running, starting trigger handler')) {
        const hookDataMatch = message.match(/\{([^}]+)\}/);
        let hookData = {};

        if (hookDataMatch) {
          try {
            hookData = JSON.parse('{' + hookDataMatch[1] + '}');
          } catch (e) {
            // Ignore parse errors
          }
        }

        invocations.push({
          timestamp: event.timestamp,
          component: event.component,
          type: 'hook-trigger',
          hookData: hookData,
          rawMessage: message
        });
      }
    });

    this.agentInvocations = invocations;
    this.queueManagement = queueEvents;

    console.log(`✓ Found ${invocations.length} agent invocation events`);
    console.log(`✓ Found ${queueEvents.length} queue management events`);
  }

  /**
   * Analyze execution flow patterns
   */
  analyzeExecutionFlows() {
    console.log('\n🌊 Analyzing execution flow patterns...');

    // Group events by execution sequence
    const executionSequences = this.groupEventsByExecution();

    // Analyze each sequence
    const flowPatterns = [];

    Object.entries(executionSequences).forEach(([key, events]) => {
      const pattern = this.analyzeExecutionSequence(events);
      if (pattern) {
        flowPatterns.push(pattern);
      }
    });

    this.executionPatterns = flowPatterns;
    console.log(`✓ Analyzed ${flowPatterns.length} execution flow patterns`);
  }

  /**
   * Group events by execution context
   */
  groupEventsByExecution() {
    const sequences = {};

    // Sort all events by timestamp
    const allEvents = [...this.agentInvocations, ...this.queueManagement]
      .filter(event => event.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Group events into execution sequences
    let currentSequence = [];
    let sequenceId = 0;

    allEvents.forEach((event, index) => {
      currentSequence.push(event);

      // End sequence on queue completion or significant time gap
      const nextEvent = allEvents[index + 1];
      if (!nextEvent ||
          (event.type === 'queue-management' && event.queueData.activeExecution === false) ||
          (nextEvent && new Date(nextEvent.timestamp) - new Date(event.timestamp) > 60000)) {

        sequences[`sequence_${sequenceId++}`] = [...currentSequence];
        currentSequence = [];
      }
    });

    return sequences;
  }

  /**
   * Analyze a single execution sequence
   */
  analyzeExecutionSequence(events) {
    if (events.length === 0) return null;

    const pattern = {
      sequenceId: events[0].timestamp,
      startTime: events[0].timestamp,
      endTime: events[events.length - 1].timestamp,
      duration: new Date(events[events.length - 1].timestamp) - new Date(events[0].timestamp),
      eventCount: events.length,
      agentInvocations: events.filter(e => e.type === 'agent-invocation').length,
      agentTriggers: events.filter(e => e.type === 'agent-trigger').length,
      hookTriggers: events.filter(e => e.type === 'hook-trigger').length,
      queueEvents: events.filter(e => e.type === 'queue-management').length,
      executionType: this.determineExecutionType(events),
      decisionPoints: this.identifyDecisionPoints(events),
      inferencePattern: this.analyzeInferencePattern(events)
    };

    return pattern;
  }

  /**
   * Determine the type of execution based on events
   */
  determineExecutionType(events) {
    const triggerEvents = events.filter(e => e.type === 'agent-trigger');

    if (triggerEvents.length > 0) {
      return triggerEvents[0].agentType || 'unknown';
    }

    const hookEvents = events.filter(e => e.type === 'hook-trigger');
    if (hookEvents.length > 0) {
      return 'hook-triggered';
    }

    return 'direct-invocation';
  }

  /**
   * Identify decision points in the execution sequence
   */
  identifyDecisionPoints(events) {
    const decisionPoints = [];

    // Agent invocations are decision points
    events.filter(e => e.type === 'agent-invocation').forEach(event => {
      decisionPoints.push({
        timestamp: event.timestamp,
        type: 'agent-decision',
        context: 'llm-inference'
      });
    });

    // Hook triggers are decision points
    events.filter(e => e.type === 'hook-trigger').forEach(event => {
      decisionPoints.push({
        timestamp: event.timestamp,
        type: 'hook-decision',
        context: 'event-response',
        hookId: event.hookData.hook
      });
    });

    return decisionPoints;
  }

  /**
   * Analyze inference patterns within the sequence
   */
  analyzeInferencePattern(events) {
    const invocations = events.filter(e => e.type === 'agent-invocation');

    if (invocations.length === 0) {
      return { type: 'no-inference', count: 0 };
    }

    if (invocations.length === 1) {
      return { type: 'single-inference', count: 1 };
    }

    // Calculate time gaps between invocations
    const gaps = [];
    for (let i = 1; i < invocations.length; i++) {
      const gap = new Date(invocations[i].timestamp) - new Date(invocations[i-1].timestamp);
      gaps.push(gap);
    }

    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

    return {
      type: 'multiple-inference',
      count: invocations.length,
      averageGap: avgGap,
      totalInferenceTime: gaps.reduce((sum, gap) => sum + gap, 0),
      pattern: avgGap < 1000 ? 'rapid-fire' : avgGap < 10000 ? 'sequential' : 'deliberate'
    };
  }

  /**
   * Generate execution pattern insights
   */
  generateInsights() {
    console.log('\n💡 Generating execution pattern insights...');

    const insights = {
      totalExecutions: this.executionPatterns.length,
      averageExecutionDuration: this.calculateAverageExecutionDuration(),
      inferencePatterns: this.analyzeInferencePatterns(),
      executionTypes: this.analyzeExecutionTypes(),
      decisionFrequency: this.analyzeDecisionFrequency(),
      queueBehavior: this.analyzeQueueBehavior()
    };

    return insights;
  }

  /**
   * Calculate average execution duration
   */
  calculateAverageExecutionDuration() {
    if (this.executionPatterns.length === 0) return 0;

    const totalDuration = this.executionPatterns.reduce((sum, pattern) => sum + pattern.duration, 0);
    return Math.round(totalDuration / this.executionPatterns.length);
  }

  /**
   * Analyze inference patterns across all executions
   */
  analyzeInferencePatterns() {
    const patterns = {
      singleInference: 0,
      multipleInference: 0,
      rapidFire: 0,
      sequential: 0,
      deliberate: 0
    };

    this.executionPatterns.forEach(pattern => {
      const inference = pattern.inferencePattern;

      if (inference.type === 'single-inference') {
        patterns.singleInference++;
      } else if (inference.type === 'multiple-inference') {
        patterns.multipleInference++;

        if (inference.pattern === 'rapid-fire') patterns.rapidFire++;
        else if (inference.pattern === 'sequential') patterns.sequential++;
        else if (inference.pattern === 'deliberate') patterns.deliberate++;
      }
    });

    return patterns;
  }

  /**
   * Analyze execution types
   */
  analyzeExecutionTypes() {
    const types = {};

    this.executionPatterns.forEach(pattern => {
      types[pattern.executionType] = (types[pattern.executionType] || 0) + 1;
    });

    return types;
  }

  /**
   * Analyze decision frequency
   */
  analyzeDecisionFrequency() {
    const totalDecisions = this.executionPatterns.reduce((sum, pattern) =>
      sum + pattern.decisionPoints.length, 0);

    const avgDecisionsPerExecution = this.executionPatterns.length > 0 ?
      totalDecisions / this.executionPatterns.length : 0;

    return {
      totalDecisions,
      averagePerExecution: Math.round(avgDecisionsPerExecution * 100) / 100,
      maxDecisionsInSingleExecution: Math.max(...this.executionPatterns.map(p => p.decisionPoints.length))
    };
  }

  /**
   * Analyze queue behavior
   */
  analyzeQueueBehavior() {
    const queueStates = {
      active: 0,
      inactive: 0,
      queued: 0
    };

    this.queueManagement.forEach(event => {
      if (event.queueData.activeExecution === true) {
        queueStates.active++;
      } else {
        queueStates.inactive++;
      }

      if (event.queueData.queueSize > 0) {
        queueStates.queued++;
      }
    });

    return queueStates;
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n📝 Generating execution pattern report...');

    const insights = this.generateInsights();

    const report = {
      title: "Kiro Execution Pattern Analysis",
      timestamp: new Date().toISOString(),
      summary: {
        totalExecutions: insights.totalExecutions,
        averageDuration: `${insights.averageExecutionDuration}ms`,
        primaryExecutionType: Object.entries(insights.executionTypes)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown',
        inferenceComplexity: insights.inferencePatterns.multipleInference > insights.inferencePatterns.singleInference ? 'high' : 'low'
      },
      executionPatterns: this.executionPatterns,
      agentInvocations: this.agentInvocations,
      queueManagement: this.queueManagement,
      insights: insights
    };

    // Save report
    const reportPath = path.join(__dirname, '../data/execution-pattern-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`✓ Report saved to ${reportPath}`);
    return report;
  }

  /**
   * Run the complete analysis
   */
  async run() {
    console.log('🚀 Starting Execution Pattern Analysis\n');

    if (!this.loadDebugData()) {
      console.error('❌ Failed to load debug data');
      return false;
    }

    this.analyzeAgentInvocations();
    this.analyzeExecutionFlows();

    const report = this.generateReport();

    console.log('\n✅ Execution pattern analysis complete!');
    console.log(`📊 Analyzed ${report.summary.totalExecutions} execution sequences`);
    console.log(`⏱️ Average execution duration: ${report.summary.averageDuration}`);
    console.log(`🎯 Primary execution type: ${report.summary.primaryExecutionType}`);
    console.log(`🧠 Inference complexity: ${report.summary.inferenceComplexity}`);

    return true;
  }
}

// Run the analyzer if called directly
if (require.main === module) {
  const analyzer = new ExecutionPatternAnalyzer();
  analyzer.run().catch(console.error);
}

module.exports = ExecutionPatternAnalyzer;
