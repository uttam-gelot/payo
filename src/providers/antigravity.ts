import type { AiProvider } from '../generator/types';

export const antigravityProvider: AiProvider = {
  id: 'antigravity',
  displayName: 'Antigravity (Google)',
  knownArtifacts: ['AGENTS.md', '.agents/skills'],
  agent: {
    binary: 'agy',
    // -p/--print runs one headless prompt; --dangerously-skip-permissions
    // auto-approves tool calls so file writes happen without interactive prompts.
    // --sandbox re-restricts the terminal, so the auto-approval cannot be
    // steered into running shell commands by prompt-injected content.
    buildArgs: (p) => ['-p', p, '--dangerously-skip-permissions', '--sandbox'],
  },
};
