import type { AiProvider } from '../generator/types';

export const copilotProvider: AiProvider = {
  id: 'copilot',
  displayName: 'GitHub Copilot',
  knownArtifacts: ['.github/copilot-instructions.md', '.github/instructions'],
  agent: {
    binary: 'copilot',
    // -s silences session metadata; --no-ask-user keeps it non-interactive.
    // --allow-tool write auto-approves file edits only — shell and other tools
    // stay denied, so prompt-injected content cannot execute commands.
    buildArgs: (p) => ['-p', p, '-s', '--no-ask-user', '--allow-tool', 'write'],
  },
};
