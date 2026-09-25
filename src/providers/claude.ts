import type { AiProvider } from '../generator/types';

export const claudeProvider: AiProvider = {
  id: 'claude',
  displayName: 'Claude (Anthropic)',
  knownArtifacts: ['CLAUDE.md', '.claude/skills'],
  // 2.1.277 reads AGENTS.md when a project has no CLAUDE.md; 2.1.281 extends that
  // to Bedrock, Vertex, Foundry, LLM gateways and telemetry-off sessions, so it is
  // the first version where the CLAUDE.md shim is redundant everywhere. Skills are
  // still discovered only under `.claude/skills`, so that shim stays.
  nativeSince: { agentsMd: '2.1.281' },
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
