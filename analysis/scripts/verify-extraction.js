#!/usr/bin/env node

/**
 * Verification script for prompt template extraction
 * Validates the extracted templates and provides quality metrics
 */

const fs = require('fs');

function verifyExtraction() {
  console.log('Verifying prompt template extraction...');

  // Load the analysis results
  const analysisPath = 'analysis/prompt-templates-analysis.json';
  if (!fs.existsSync(analysisPath)) {
    console.error('Analysis file not found. Run the extractor first.');
    return;
  }

  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

  console.log('\n=== EXTRACTION VERIFICATION ===');
  console.log(`Total templates extracted: ${analysis.summary.totalTemplates}`);
  console.log(`Unique template types: ${analysis.summary.uniqueTemplates}`);
  console.log(`Template categories: ${analysis.summary.templateTypes.join(', ')}`);

  // Verify template quality
  console.log('\n=== TEMPLATE QUALITY ANALYSIS ===');

  Object.keys(analysis.templates).forEach(type => {
    const templates = analysis.templates[type];
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  - Count: ${templates.length}`);
    console.log(`  - Total usage: ${templates.reduce((sum, t) => sum + t.usageCount, 0)}`);

    templates.forEach((template, index) => {
      console.log(`  Template ${index + 1}:`);
      console.log(`    - Usage count: ${template.usageCount}`);
      console.log(`    - Variables: ${template.variables.length}`);
      console.log(`    - Contexts: ${template.contexts.length}`);
      console.log(`    - Template length: ${template.template.length} chars`);

      // Show first few lines of template
      const lines = template.template.split('\n').slice(0, 3);
      console.log(`    - Preview: ${lines.join(' | ')}`);
    });
  });

  // Check for key patterns we expect to find
  console.log('\n=== EXPECTED PATTERN VERIFICATION ===');

  const expectedPatterns = [
    { name: 'System Identity', pattern: /You are.*AI assistant/i },
    { name: 'Capabilities List', pattern: /# Capabilities/i },
    { name: 'Rules Section', pattern: /# Rules/i },
    { name: 'File Tree Context', pattern: /<fileTree>/i },
    { name: 'Steering Rules', pattern: /## Included Rules/i }
  ];

  expectedPatterns.forEach(({ name, pattern }) => {
    const found = Object.values(analysis.templates).flat().some(template =>
      pattern.test(template.template)
    );
    console.log(`${found ? '✓' : '✗'} ${name}: ${found ? 'Found' : 'Missing'}`);
  });

  // Variable analysis
  console.log('\n=== VARIABLE ANALYSIS ===');
  const allVariables = Object.values(analysis.templates).flat()
    .flatMap(t => t.variables);

  const variableCounts = {};
  allVariables.forEach(variable => {
    variableCounts[variable] = (variableCounts[variable] || 0) + 1;
  });

  const sortedVariables = Object.entries(variableCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

  console.log('Top 10 most common variables:');
  sortedVariables.forEach(([variable, count]) => {
    console.log(`  - "${variable}": ${count} occurrences`);
  });

  // Quality recommendations
  console.log('\n=== QUALITY RECOMMENDATIONS ===');

  const recommendations = [];

  if (analysis.summary.totalVariables > 50) {
    recommendations.push('Consider filtering out noise variables (very long or complex strings)');
  }

  if (analysis.summary.uniqueTemplates < 5) {
    recommendations.push('Consider expanding template detection to include more pattern types');
  }

  const avgUsage = Object.values(analysis.templates).flat()
    .reduce((sum, t) => sum + t.usageCount, 0) / analysis.summary.uniqueTemplates;

  if (avgUsage < 2) {
    recommendations.push('Many templates have low usage - consider merging similar templates');
  }

  if (recommendations.length === 0) {
    console.log('✓ Extraction quality looks good!');
  } else {
    recommendations.forEach(rec => console.log(`- ${rec}`));
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

// Run verification
verifyExtraction();
