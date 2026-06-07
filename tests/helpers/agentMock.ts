/**
 * Configurable, leak-safe mock of `src/generator/agent`. Importing this file
 * replaces `isAvailable`/`runAgent` with a wrapper that defaults to the REAL
 * implementations and only diverges when a test sets an override — so the mock
 * is harmless to any test file that doesn't opt in. (Pinning PATH does not work:
 * bun's spawnSync ignores runtime mutations to process.env.PATH, so the only
 * reliable way to control the agent gate in tests is to mock this module.)
 */
import { mock } from 'bun:test';
import * as realAgent from '../../src/generator/agent';
import type { AgentResult } from '../../src/generator/agent';
import type { AgentRunner } from '../../src/generator/types';

// Capture the real functions before the module record is replaced.
const realIsAvailable = realAgent.isAvailable;
const realRunAgent = realAgent.runAgent;

interface Override {
  isAvailable?: boolean;
  runAgent?: (runner: AgentRunner, prompt: string) => AgentResult | Promise<AgentResult>;
}

let override: Override | null = null;

export function setAgentOverride(o: Override): void {
  override = o;
}
export function resetAgentOverride(): void {
  override = null;
}

void mock.module('../../src/generator/agent', () => ({
  isAvailable: (runner: AgentRunner): boolean => override?.isAvailable ?? realIsAvailable(runner),
  runAgent: (runner: AgentRunner, prompt: string): AgentResult | Promise<AgentResult> =>
    override?.runAgent ? override.runAgent(runner, prompt) : realRunAgent(runner, prompt),
}));
