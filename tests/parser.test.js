const { parseInput } = require('../src/modules/input_parser');

async function run() {
  const description = 'Create a Book model with title and author';
  try {
    // Since parseInput calls the real AI, this test demonstrates the extraction helpers only via direct calls.
    console.log('Manual test placeholder: run the parser with an actual prompt in the running server.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
