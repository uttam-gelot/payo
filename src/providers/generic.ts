import type { AiProvider } from '../generator/types';

/** Fallback for 'other' and any custom AI-tool string; static-only. */
export const genericProvider: AiProvider = {
  id: 'other',
  displayName: 'Other',
  knownArtifacts: ['AI_RULES.md'],
};
