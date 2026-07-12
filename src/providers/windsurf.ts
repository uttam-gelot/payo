import type { AiProvider } from '../generator/types';

// Static-only: Windsurf has no headless CLI runner, so it relies on the
// universal AGENTS.md entrypoint and its `.windsurf/skills` discovery shim.
export const windsurfProvider: AiProvider = {
  id: 'windsurf',
  displayName: 'Windsurf',
  knownArtifacts: ['.windsurfrules'],
};
