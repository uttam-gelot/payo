import type { AiProvider } from '../generator/types';

export const codexProvider: AiProvider = {
  id: 'codex',
  displayName: 'Codex CLI',
  knownArtifacts: ['AGENTS.md'],
  agent: {
    binary: 'codex',
    buildArgs: (p) => ['exec', p],
  },
};
