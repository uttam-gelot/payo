/**
 * Recommended-default derivation. A question's recommended answer comes from
 * its option(s) carrying `hint: 'recommended'` (select/multiselect) or from an
 * explicit `recommended` field (confirm/text). `undefined` means "no default",
 * which makes a group ineligible for the one-shot recommended skip.
 */
import type { Answers, Question } from './types';
import { resolveOptions } from './runner';

/** The recommended answer for a question, or undefined when none is defined. */
export function recommendedAnswer(
  q: Question,
  a: Answers,
): string | string[] | boolean | undefined {
  switch (q.type) {
    case 'select': {
      const hinted = resolveOptions(q, a).find((o) => o.hint === 'recommended');
      if (hinted) return hinted.value;
      return typeof q.recommended === 'string' ? q.recommended : undefined;
    }
    case 'multiselect': {
      const hinted = resolveOptions(q, a)
        .filter((o) => o.hint === 'recommended')
        .map((o) => o.value);
      if (hinted.length) return hinted;
      return Array.isArray(q.recommended) ? q.recommended : undefined;
    }
    case 'confirm':
      return typeof q.recommended === 'boolean' ? q.recommended : undefined;
    case 'text':
      return typeof q.recommended === 'string' ? q.recommended : undefined;
  }
}

/** Concise label for a question in the defaults note: `summary`, or message cleaned. */
export function questionSummary(q: Question): string {
  if (q.summary) return q.summary;
  return q.message
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\?\s*$/, '')
    .trim();
}

/** Human-readable label for a question's recommended answer, for the defaults note. */
export function recommendedLabel(q: Question, a: Answers): string {
  const value = recommendedAnswer(q, a);
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  const options = resolveOptions(q, a);
  // Keep the note compact: drop the explanatory tail after an em dash.
  const labelOf = (v: string): string =>
    (options.find((o) => o.value === v)?.label ?? v).split(' — ')[0].trim();
  if (Array.isArray(value)) return value.map(labelOf).join(', ');
  return labelOf(value);
}
