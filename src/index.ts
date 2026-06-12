#!/usr/bin/env node

/**
 * payo — CLI entry point
 * Bootstraps the CLI and delegates to the main orchestrator.
 */

import { run } from './cli/index';
import { parseArgs, versionText, helpText } from './cli/argv';

const action = parseArgs(process.argv.slice(2));
if (action === 'version') {
  console.log(versionText());
  process.exit(0);
} else if (action === 'help') {
  console.log(helpText());
  process.exit(0);
} else if (action !== 'run') {
  console.error(`Unknown option: ${action.unknown}\nRun with --help to see usage.`);
  process.exit(1);
}

run().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
