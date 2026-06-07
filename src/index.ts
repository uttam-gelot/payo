#!/usr/bin/env node

/**
 * payo — CLI entry point
 * Bootstraps the CLI and delegates to the main orchestrator.
 */

import { run } from './cli/index';

run().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
