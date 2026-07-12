import type { AiProvider } from '../generator/types';

export const cursorProvider: AiProvider = {
  id: 'cursor',
  displayName: 'Cursor',
  knownArtifacts: ['.cursorrules', '.cursor/rules'],
  agent: {
    binary: 'cursor-agent',
    // --output-format text keeps stdout clean; --force allows file writes.
    // cursor-agent has no flag-level tool allowlist (only user/project config
    // files, which payo must not mutate), so --force stays; the fenced prompt
    // and post-run output validation are the injection mitigations here.
    buildArgs: (p) => ['-p', p, '--force', '--output-format', 'text'],
  },
};
