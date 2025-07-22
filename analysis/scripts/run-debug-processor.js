/**
 * Script to run the debug data processor
 */

const DebugDataProcessor = require('./debug-data-processor');

async function main() {
  console.log('Starting debug data processing...\n');

  const processor = new DebugDataProcessor('debug');

  try {
    // Process all debug data
    const processedData = await processor.processAllData();

    // Print summary
    processor.printSummary();

    // Save processed data
    processor.saveToFile('analysis/debug-processed-data.json');

    console.log('\n=== PROCESSING COMPLETE ===');
    console.log('Processed data available in analysis/debug-processed-data.json');

  } catch (error) {
    console.error('Fatal error during processing:', error);
    process.exit(1);
  }
}

// Run the processor
if (require.main === module) {
  main();
}

module.exports = { main };
