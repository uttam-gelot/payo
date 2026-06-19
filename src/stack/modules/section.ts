import type { RuleSection } from '../../generator/types';

/**
 * Wraps a module's guidance lines into the single-section shape `guidance()`
 * returns. Keeps the `[{ title, body: lines.join('\n') }]` boilerplate in one
 * place so every styling/auth module reads as just a title + its lines.
 */
export const guidanceSection = (title: string, lines: string[]): RuleSection[] => [
  { title, body: lines.join('\n') },
];
