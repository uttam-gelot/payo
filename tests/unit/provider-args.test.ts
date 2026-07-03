import { describe, it, expect } from 'bun:test';
import { claudeProvider } from '../../src/providers/claude';
import { copilotProvider } from '../../src/providers/copilot';
import { cursorProvider } from '../../src/providers/cursor';
import { antigravityProvider } from '../../src/providers/antigravity';

/**
 * Regression tests for the exact CLI flags each spawned agent runs with.
 * These flags are the security boundary between a prompt that quotes
 * untrusted text and the agent's ability to act on it — a broadened flag
 * (e.g. --allow-all-tools) must fail review, not slip through silently.
 */
describe('provider agent buildArgs', () => {
  const prompt = 'PROMPT';

  it('claude: bypasses permissions but only for Write/Edit tools', () => {
    expect(claudeProvider.agent?.buildArgs(prompt)).toEqual([
      '-p',
      prompt,
      '--allowedTools',
      'Write',
      'Edit',
      '--permission-mode',
      'bypassPermissions',
    ]);
  });

  it('copilot: auto-approves file writes only, never --allow-all-tools', () => {
    const args = copilotProvider.agent?.buildArgs(prompt) ?? [];
    expect(args).toEqual(['-p', prompt, '-s', '--no-ask-user', '--allow-tool', 'write']);
    expect(args).not.toContain('--allow-all-tools');
  });

  it('antigravity: skips permission prompts but sandboxes the terminal', () => {
    expect(antigravityProvider.agent?.buildArgs(prompt)).toEqual([
      '-p',
      prompt,
      '--dangerously-skip-permissions',
      '--sandbox',
    ]);
  });

  it('cursor: print mode with --force (no narrower flag exists)', () => {
    expect(cursorProvider.agent?.buildArgs(prompt)).toEqual([
      '-p',
      prompt,
      '--force',
      '--output-format',
      'text',
    ]);
  });
});
