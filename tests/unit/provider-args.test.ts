import { describe, it, expect } from 'bun:test';
import { claudeProvider } from '../../src/providers/claude';
import { copilotProvider } from '../../src/providers/copilot';
import { cursorProvider } from '../../src/providers/cursor';
import { antigravityProvider } from '../../src/providers/antigravity';
import { codexProvider } from '../../src/providers/codex';
import type { AgentCaps } from '../../src/generator/types';
import { SKILLS_ROOT } from '../../src/generator/universal';
import { join } from 'path';

/**
 * Regression tests for the exact CLI flags each spawned agent runs with.
 * These flags are the security boundary between a prompt that quotes
 * untrusted text and the agent's ability to act on it — a broadened flag
 * (e.g. --allow-all-tools) must fail review, not slip through silently.
 */
describe('provider agent buildArgs', () => {
  const prompt = 'PROMPT';
  /** A CLI new enough to advertise every flag payo may pass. */
  const modern: AgentCaps = { supports: () => true };
  /** An older CLI whose help lists none of them (unknown argv would abort it). */
  const legacy: AgentCaps = { supports: () => false };

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

  it('antigravity: pins the workspace to cwd, skips prompts, sandboxes the terminal', () => {
    expect(antigravityProvider.agent?.buildArgs(prompt, modern)).toEqual([
      '-p',
      prompt,
      '--add-dir',
      process.cwd(),
      '--dangerously-skip-permissions',
      '--sandbox',
    ]);
  });

  it('antigravity: omits --add-dir on a CLI that predates workspaces', () => {
    expect(antigravityProvider.agent?.buildArgs(prompt, legacy)).toEqual([
      '-p',
      prompt,
      '--dangerously-skip-permissions',
      '--sandbox',
    ]);
  });

  it('codex: exec with a workspace-write sandbox, usable outside a git repo', () => {
    const args = codexProvider.agent?.buildArgs(prompt, modern) ?? [];
    expect(args).toEqual([
      'exec',
      '--sandbox',
      'workspace-write',
      '--config',
      // The dot-root, not the deeper skills dir: codex may create a writable
      // root itself but not its read-only parent.
      `sandbox_workspace_write.writable_roots=[${JSON.stringify(
        join(process.cwd(), SKILLS_ROOT.split('/')[0]),
      )}]`,
      '--skip-git-repo-check',
      prompt,
    ]);
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args).not.toContain('danger-full-access');
  });

  it('codex: falls back to a bare exec when the installed CLI lacks the flags', () => {
    expect(codexProvider.agent?.buildArgs(prompt, legacy)).toEqual(['exec', prompt]);
  });

  it('codex: adds only the flags the installed CLI advertises', () => {
    const sandboxOnly: AgentCaps = { supports: (f) => f === '--sandbox' };
    const args = codexProvider.agent?.buildArgs(prompt, sandboxOnly) ?? [];
    // The sandbox needs its writable-roots override to be usable at all, so the
    // two travel together; the unadvertised git-repo flag is dropped.
    expect(args).toContain('--sandbox');
    expect(args).toContain('--config');
    expect(args).not.toContain('--skip-git-repo-check');
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
