import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';

/** Fallback for 'other' and any custom AI-tool string. */
export const genericProvider: AiProvider = {
  id: 'other',
  displayName: 'Other',
  generate: (ctx) => [{ path: 'AI_RULES.md', content: renderMarkdown('AI Rules', ctx.sections) }],
};
