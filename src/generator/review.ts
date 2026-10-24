/**
 * The opt-in `pr-review` skill (see CODE_REVIEW_SKILL_RND.md). The interview
 * options and the generated skill's run-time questions both read the choices
 * below, so the team defaults asked at `payo init` always map one-to-one onto
 * what the skill offers when a developer starts a review.
 */
import type { Answers } from '../questions/types';

/** One choice: a stable id, the short label the skill shows, and interview detail. */
export interface ReviewChoice {
  id: string;
  label: string;
  detail: string;
}

/** What the team will ask the skill to review (interview Q3). */
export const REVIEW_TARGETS: readonly ReviewChoice[] = [
  { id: 'local', label: 'Local changes', detail: 'uncommitted and staged changes' },
  { id: 'branch', label: 'Current branch', detail: 'the branch against its base branch' },
  {
    id: 'pr',
    label: 'A PR / MR by number',
    detail: 'GitHub, GitLab, or another host (fetched with git only)',
  },
];

/**
 * Focus buckets (interview Q4, run-time R1). Security is always offered in the
 * interview, but at run time the diff decides it, not the stack.
 */
export const REVIEW_FOCUS: readonly ReviewChoice[] = [
  {
    id: 'bugs',
    label: 'Bugs & correctness',
    detail: 'including performance bugs such as an N+1 query',
  },
  {
    id: 'security',
    label: 'Security & data safety',
    detail: 'offered on a review only when the diff touches auth, routes, input, data, or config',
  },
  { id: 'quality', label: 'Code quality', detail: "readability, naming, this project's skills" },
  { id: 'tests', label: 'Tests', detail: 'changed logic has a test that would fail if it broke' },
];

/** How findings are written (interview Q5). */
export const REVIEW_TONES: readonly ReviewChoice[] = [
  { id: 'terse', label: 'Terse', detail: 'one line each: label path:line problem. fix.' },
  {
    id: 'explanatory',
    label: 'Explanatory',
    detail: 'problem, why it matters, suggested fix, a short example when useful',
  },
  {
    id: 'mentoring',
    label: 'Mentoring',
    detail: 'explanatory, plus a pointer to the project skill, phrased as suggestions',
  },
];

/** The team's focus defaults when unanswered: bugs, security, quality, and tests when tested. */
export function defaultReviewFocus(a: Answers): string[] {
  const tested = Array.isArray(a.testTypes) && a.testTypes.length > 0;
  return ['bugs', 'security', 'quality', ...(tested ? ['tests'] : [])];
}
