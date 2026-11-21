/**
 * What every skill prompt shares, so skills written in parallel agree.
 *
 * Skills are authored concurrently by separate agent runs, each given only the
 * rule sections its own topic needs (see `sectionsFor`). That keeps prompts
 * small, but it let one skill say "run `bun test`" while the testing skill said
 * "never use `bun test`, use Vitest", and let five skills invent five names for
 * the same auth guard. Two short blocks close that gap without sending every
 * answer to every skill:
 *
 *  - Shared facts: the cross-cutting answers every skill can touch (test runner,
 *    formatter, class sorting, auth, API prefix, which checks a hook runs).
 *  - Ownership: each cross-cutting concept is defined by exactly one skill; the
 *    others refer to it by name instead of inventing their own version.
 */
import type { Answers } from '../questions/types';
import { resolveCommands } from './commands';
import {
  automatedSummary,
  blockedActions,
  hookPlanFrom,
  manualVerifyTools,
  verifyToolsPhrase,
} from './hookplan';
import { hasTesting } from '../stack/predicates';
import { pmRun } from '../stack/commands';
import { classSortRule } from '../stack/modules/styling/tailwind';
import { authStrategyLine } from './describe';

/** A "set" string answer, or undefined for empty / 'none'. */
function val(a: Answers, key: string): string | undefined {
  const v = a[key];
  return typeof v === 'string' && v.length > 0 && v !== 'none' ? v : undefined;
}

/**
 * The cross-cutting facts as bullet lines, or [] when none apply. Each line is a
 * decision already made by the answers; skills must not contradict it.
 */
export function sharedFactLines(a: Answers): string[] {
  const lines: string[] = [];

  if (hasTesting(a)) {
    const runner = val(a, 'testRunner');
    const e2e = val(a, 'e2eTool');
    const cmd = resolveCommands(a).test ?? pmRun(a, 'test');
    const parts = [
      runner && `${runner} for unit and integration tests`,
      e2e && `${e2e} for end-to-end tests`,
    ].filter(Boolean);
    const runners = parts.length ? `${parts.join('; ')}. ` : '';
    lines.push(
      `- Tests: ${runners}Run them with \`${cmd}\`. Do not name or add any other test runner.`,
    );
  }

  const fmt = val(a, 'formatter');
  const lint = val(a, 'linter');
  if (fmt || lint) {
    const tools = [fmt && `formatter ${fmt}`, lint && `linter ${lint}`].filter(Boolean).join(', ');
    lines.push(`- Tooling: ${tools}. Do not name or add any other formatter or linter.`);
  }

  const sort = classSortRule(a);
  if (sort) lines.push(`- Tailwind class order: ${sort}`);

  const auth = val(a, 'authApproach');
  if (auth) {
    const strategy = val(a, 'authStrategy');
    lines.push(`- Auth: ${auth}.`);
    if (strategy) lines.push(authStrategyLine(strategy));
  }

  if (val(a, 'apiArchitecture') && a.detectEverything !== true)
    lines.push('- API: versioned under a `/v1` URL prefix.');

  const plan = hookPlanFrom(a);
  const automated = automatedSummary(plan);
  if (automated) {
    const manual = manualVerifyTools(a, plan);
    lines.push(
      `- Checks: ${automated}, and blocks ${blockedActions(plan) ?? 'the commit or push'} on ` +
        'failure. Never tell the assistant to run those checks by hand (not "before finishing", ' +
        'not "after editing"). ' +
        (manual.length
          ? `It still runs ${verifyToolsPhrase(manual)} itself, since no hook does. `
          : '') +
        'A "before finishing" list may name only checks no hook runs, such as a type check or a build.',
    );
  }
  return lines;
}

/** The shared-facts prompt block, or '' when there are no facts to pin. */
export function sharedFactsBlock(a: Answers): string {
  const lines = sharedFactLines(a);
  if (lines.length === 0) return '';
  return [
    'Fixed project decisions (shared by every skill; never contradict them, and never ' +
      'describe a different tool or command for the same job):',
    ...lines,
  ].join('\n');
}

/**
 * Each cross-cutting concept and the skills that may define it, in priority
 * order: the first one selected for this run owns it. Folder layout falls back
 * to the overview when no framework skill exists; error classes fall back to
 * the API skill, then coding standards, when no logging skill is generated.
 */
const OWNERSHIP: ReadonlyArray<{ concept: string; owners: readonly string[] }> = [
  {
    concept: 'the folder layout and where each kind of module lives',
    owners: ['framework-conventions', 'project-overview'],
  },
  {
    concept:
      'the user identity and session shape (including any tenant or organisation id and its ' +
      'name), auth guard function names, and token or session verification',
    owners: ['auth'],
  },
  {
    concept: 'error classes, error codes, and the logger module',
    owners: ['error-handling-logging', 'api-conventions', 'coding-standards'],
  },
  {
    concept:
      'API paths and versioning, the response envelope, pagination, the status-code mapping, ' +
      'and where request/response schemas live and how they are named',
    owners: ['api-conventions'],
  },
  {
    concept: 'the test runner, test file locations and naming, and test commands',
    owners: ['testing'],
  },
  {
    concept: 'formatter, linter, and package-manager commands and their config',
    owners: ['tooling'],
  },
  {
    concept: 'which checks run when (git hooks, before a commit or push)',
    owners: ['git-workflow'],
  },
  {
    concept: 'environment variable handling and the env config module',
    owners: ['coding-standards'],
  },
  {
    concept: 'database schemas, queries, and migrations',
    owners: ['data-layer'],
  },
  { concept: 'client and UI state stores', owners: ['state-management'] },
  { concept: 'README and doc-comment rules', owners: ['documentation'] },
];

/** The skill that owns each concept this run, keyed by concept. */
function resolveOwners(selected: ReadonlySet<string>): Array<{ concept: string; owner: string }> {
  const out: Array<{ concept: string; owner: string }> = [];
  for (const { concept, owners } of OWNERSHIP) {
    const owner = owners.find((o) => selected.has(o));
    if (owner) out.push({ concept, owner });
  }
  return out;
}

/**
 * The ownership block for one skill's prompt: what it defines, and what it must
 * leave to the other skills being written in parallel. '' when there is nothing
 * to coordinate (a single-skill run).
 */
export function ownershipBlock(skillId: string, selectedIds: readonly string[]): string {
  const resolved = resolveOwners(new Set(selectedIds));
  const mine = resolved.filter((r) => r.owner === skillId);
  const theirs = resolved.filter((r) => r.owner !== skillId);
  if (mine.length === 0 && theirs.length === 0) return '';

  const lines = [
    'Ownership: the other skills are written at the same time by separate runs, and you cannot ' +
      'see them. To keep them consistent, each concept below is defined in exactly one skill.',
  ];
  if (mine.length)
    lines.push(
      `- This skill defines: ${mine.map((m) => m.concept).join('; ')}. Pick one name for each ` +
        'thing and use it everywhere in this file.',
    );
  if (theirs.length) {
    lines.push(
      '- Defined by other skills. Do not define, rename, or restate these here. When a rule ' +
        'touches one, refer to the owning skill by name (for example "see the `auth` skill"). ' +
        'Do not invent names, file paths, or signatures for them, including in code examples; ' +
        'keep examples to your own topic or write a comment such as `// see the auth skill`:',
    );
    for (const t of theirs) lines.push(`  - ${t.concept}: \`${t.owner}\``);
  }
  return lines.join('\n');
}
