import type { AiProvider } from '../generator/types';

export const claudeProvider: AiProvider = {
  id: 'claude',
  displayName: 'Claude (Anthropic)',
  knownArtifacts: ['CLAUDE.md', '.claude/skills'],
  agent: {
    binary: 'claude',
    // Headless writes require bypassPermissions: acceptEdits still prompts on new-file
    // creation, and -p has no interactive approver, so files never get written otherwise.
    // The Write/Edit allowlist (space-separated — it is variadic) constrains the bypassed
    // agent to file writes, so it cannot run arbitrary bash.
    buildArgs: (p) => [
      '-p',
      p,
      '--allowedTools',
      'Write',
      'Edit',
      '--permission-mode',
      'bypassPermissions',
    ],
  },
};
