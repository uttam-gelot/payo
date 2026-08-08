import type { AiProvider } from '../generator/types';

// Static-only: the `zed` binary is a GUI launcher, not a headless agent runner, so
// Zed authors nothing. Unlike Claude Code and Windsurf it needs no discovery shim —
// it reads `.agents/skills/` and AGENTS.md natively.
//
// `.rules` is Zed's own instruction file and is claimed by no other provider, so it
// identifies Zed uniquely. `.zed/settings.json` is deliberately NOT listed: every Zed
// user has one whether or not they use AI, and knownArtifacts feeds the CLI's
// "Existing AI config detected" notice (see detect/aiconfig.ts).
export const zedProvider: AiProvider = {
  id: 'zed',
  displayName: 'Zed',
  knownArtifacts: ['.rules'],
};
