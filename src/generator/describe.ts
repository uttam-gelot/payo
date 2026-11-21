/**
 * Prose for answers that reach AGENTS.md and the skill prompts.
 *
 * Two jobs. First, map option ids to readable text, so the always-loaded
 * AGENTS.md never says "soc" or "Use a standard layout.". Second, keep free text
 * the user typed (an "Other" answer, the project description) from being stated
 * as a project rule: it is tidied and marked as a user note, and the skill
 * prompts are told to restate it in clean terms. Tool names are not free text:
 * a short custom value like "my-orm" stays verbatim.
 */

/** Four or more words reads as a description, not a tool or library name. */
export function isFreeText(v: string): boolean {
  return v.trim().split(/\s+/).length >= 4;
}

/**
 * Light, meaning-preserving cleanup of user-typed text: collapse runs of spaces
 * (newlines kept, so lists survive), capitalize sentence starts, and end with a
 * full stop. It never rewrites words; spelling stays the user's.
 */
export function tidyText(v: string): string {
  const collapsed = v
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
  const capitalized = collapsed.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_m, lead: string, c: string) => lead + c.toUpperCase(),
  );
  return /[.!?:)`]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** A bullet that quotes a user's own description without making it a rule. */
export function userNote(label: string, v: string): string {
  return `- ${label} (user note, in their words): ${tidyText(v)}`;
}

const STRUCTURE_LINE: Record<string, string> = {
  standard: "Use the framework's default folder layout.",
  'feature-based': 'Organize code by feature (vertical slices).',
  ddd: 'Organize code by domain, following Domain-Driven Design (DDD).',
};

/** Body of the Folder Structure section for a non-monorepo `structure` answer. */
export function structureLine(v: string): string {
  if (STRUCTURE_LINE[v]) return STRUCTURE_LINE[v];
  return isFreeText(v) ? userNote('Folder layout', v).slice(2) : `Use a ${v} layout.`;
}

/**
 * The workflow answers as rules. "standard" deliberately says nothing about
 * commit messages: the commit-convention answer owns that, and the option
 * label's "conventional commits" would contradict a ticket-prefixed choice.
 */
const GIT_WORKFLOW_LINE: Record<string, string> = {
  standard:
    'Work on feature branches and merge through pull requests; do not commit directly to the default branch.',
  minimal: 'Direct commits to the default branch are allowed; keep each commit self-contained.',
};

/** Opening line of the Git Workflow section for a `gitWorkflow` answer. */
export function gitWorkflowLine(v: string): string {
  if (GIT_WORKFLOW_LINE[v]) return GIT_WORKFLOW_LINE[v];
  return isFreeText(v) ? userNote('Git workflow', v).slice(2) : `Follow the ${v} workflow.`;
}

/** The workflow named for a skill prompt, e.g. "standard workflow (feature branches, …)". */
export function gitWorkflowPhrase(v: string | undefined): string {
  if (!v) return 'selected workflow';
  if (GIT_WORKFLOW_LINE[v]) return `${v} workflow (${GIT_WORKFLOW_LINE[v]})`;
  return isFreeText(v) ? `workflow the user described as: "${v.trim()}"` : `${v} workflow`;
}

const CODING_STANDARD_LINE: Record<string, string> = {
  DRY: "DRY: don't repeat yourself",
  modular: 'Modular architecture',
  soc: 'Separation of concerns',
  solid: 'SOLID principles',
  functional: 'Functional style with pure functions',
  'strict-types': 'Strict type safety',
};

/** One coding-standards bullet body for an option id or a custom entry. */
export function codingStandardLine(v: string): string {
  return CODING_STANDARD_LINE[v] ?? (isFreeText(v) ? tidyText(v) : v);
}

const AUTH_STRATEGY_LINE: Record<string, string> = {
  session: 'server-side session cookies',
  jwt: 'stateless JWT (access + refresh tokens)',
  provider: 'provider-managed (hosted) sessions',
};

/** The Authentication section's session-strategy bullet. */
export function authStrategyLine(v: string): string {
  if (AUTH_STRATEGY_LINE[v]) return `- Session strategy: ${AUTH_STRATEGY_LINE[v]}`;
  return isFreeText(v) ? userNote('Session strategy', v) : `- Session strategy: ${v}`;
}

/** The session strategy as a sentence for the auth skill prompt. */
export function authStrategyPrompt(v: string): string {
  if (AUTH_STRATEGY_LINE[v]) return `Use ${AUTH_STRATEGY_LINE[v]}.`;
  if (isFreeText(v))
    return (
      `The user described the session strategy in their own words: "${v.trim()}". ` +
      'Interpret what they want, choose one concrete strategy that fits the stack, and state it ' +
      'plainly. Do not quote their wording.'
    );
  return `Use a ${v} session strategy.`;
}

/**
 * Replace em dashes in Payo-authored text when the user chose the no-em-dash
 * convention. Only for text Payo wrote: a title "A — B" becomes "A: B", a
 * sentence break becomes "; ", and a lone dash (a table placeholder) becomes "-".
 */
export function stripEmDashes(text: string, isTitle = false): string {
  return text.replace(/\s+—\s+/g, isTitle ? ': ' : '; ').replace(/—/g, '-');
}
