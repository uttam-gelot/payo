/**
 * Skill taxonomy: the fixed set of rule/skill documents payo asks the
 * selected AI agent to generate. Provider-agnostic — each spec gates itself
 * on the collected answers and supplies the task instruction for one doc.
 */
import type { Answers } from '../questions/types';
import {
  auditReceiptCommand,
  automatedSummary,
  hookPlanFrom,
  isAutomated,
  manualVerifyTools,
  verifyToolsPhrase,
} from './hookplan';

export interface SkillSpec {
  /** Stable id; also used as the native filename stem and frontmatter `name`. */
  id: string;
  /** Human-friendly name, shown in the CLI report and as the section heading. */
  title: string;
  /**
   * One-line "when to use this skill" summary. Emitted as the provider's
   * frontmatter `description` — the field agents like Claude use to decide
   * whether to load the skill, so it must read as a trigger, not a title.
   */
  description: string;
  /**
   * Optional answer-dependent override for `description`. When present, its
   * result replaces `description` at selection time (see `selectSkills`), so
   * frontmatter and the AGENTS index reflect the chosen answers, not a default.
   */
  describe?(a: Answers): string;
  /** Whether this skill applies to the current answers. */
  appliesTo(a: Answers): boolean;
  /** Task instruction for the agent (project context is added by the caller). */
  buildPrompt(a: Answers): string;
  /**
   * Optional deterministic body for the no-CLI floor. When set, `runStatic`
   * writes this instead of the generic "see AGENTS.md" pointer — for skills
   * whose content is a fixed procedure, not stack-derived guidance.
   */
  staticBody?(a: Answers): string;
}

/** A string answer is "set" when it is a non-empty value other than 'none'. */
function has(a: Answers, key: string): boolean {
  const v = a[key];
  return typeof v === 'string' && v.length > 0 && v !== 'none';
}

/** Read a "set" string answer, or undefined. */
function val(a: Answers, key: string): string | undefined {
  return has(a, key) ? (a[key] as string) : undefined;
}

/**
 * True on the "detect everything" path: the project already exists and its code is
 * the source of truth. Skill prompts then document the conventions ACTUALLY present
 * and omit anything the project does not do, instead of prescribing defaults.
 */
function fromCode(a: Answers): boolean {
  return a.detectEverything === true;
}

/** A directive appended to convention skills so the agent documents reality, not defaults. */
const SOURCE_OF_TRUTH =
  ' This is an existing codebase: document ONLY the conventions it actually follows, ' +
  'inferred from the current code — omit anything the project does not do, and do not ' +
  'introduce conventions it has not already adopted.';

/** Prose describing a branch-naming answer; falls back to a custom (Other) value. */
const BRANCH_NAMING_DESC: Record<string, string> = {
  'type-slash': 'type-prefixed branches (feature/…, fix/…, chore/…)',
  ticket: 'ticket-keyed branches (e.g. ABC-123-short-description)',
  kebab: 'plain kebab-case branch names',
  none: 'no enforced branch-naming convention',
};

/** Prose describing a commit-message answer; falls back to a custom (Other) value. */
const COMMIT_CONVENTION_DESC: Record<string, string> = {
  conventional: 'Conventional Commits (type(scope): description)',
  ticket: 'ticket-prefixed commit messages (e.g. ABC-123: description)',
  freeform: 'free-form commit messages',
  none: 'no enforced commit-message convention',
};

function branchNamingDesc(v: string): string {
  return BRANCH_NAMING_DESC[v] ?? `the "${v}" branch-naming convention`;
}

function commitConventionDesc(v: string): string {
  return COMMIT_CONVENTION_DESC[v] ?? `the "${v}" commit-message convention`;
}

// Declared in order of importance — this drives the section order when a
// single-file tool (e.g. Codex AGENTS.md) merges the skills into one doc.
const skills: SkillSpec[] = [
  {
    id: 'project-overview',
    title: 'Project Overview',
    description:
      "This project's purpose, scope, and high-level architecture, and how its stack fits together.",
    appliesTo: () => true,
    buildPrompt: () =>
      'Summarize this specific project for an AI coding assistant: its purpose and scope (from the ' +
      'project description), the high-level architecture, and how the selected stack fits together. ' +
      'Keep it concise and factual — describe THIS project, not software in general.',
  },
  {
    id: 'coding-standards',
    title: 'Coding Standards',
    description:
      'Naming, file organization, error handling, and environment/secret conventions for this codebase.',
    appliesTo: () => true,
    buildPrompt: (a): string => {
      const lang = val(a, 'language');
      const standards = Array.isArray(a.codingStandards) ? a.codingStandards.join(', ') : undefined;
      const validation = val(a, 'validation');
      const base =
        `Write the coding standards and conventions the assistant must follow for ${lang ?? 'the chosen language'}` +
        (standards ? `, applying the selected standards (${standards})` : '') +
        ': naming, file organization, error handling, and language-idiomatic best practices. ' +
        'Include environment and configuration handling: keep configuration and secrets in environment ' +
        'variables, commit a .env.example documenting every required variable (never commit a real .env), ' +
        'and validate required variables at startup.';
      const envGuarded =
        a.envExampleOnly === true
          ? base +
            ' The assistant must never read or open the real .env file; rely on .env.example for the ' +
            'list of required variable names.'
          : base;
      return validation
        ? envGuarded +
            ` Validate inputs and external data at trust boundaries using the selected validation ` +
            `library (${validation}), and derive types from the schemas where possible.`
        : envGuarded;
    },
  },
  {
    id: 'framework-conventions',
    title: 'Framework Conventions',
    description:
      'Idiomatic patterns, project structure, and common pitfalls for the chosen framework.',
    appliesTo: (a) => has(a, 'framework'),
    buildPrompt: (a): string => {
      const fw = val(a, 'framework');
      return (
        `Write framework-specific conventions and best practices for ${fw ?? 'the chosen framework'}, ` +
        'incorporating the framework follow-up choices in the Tech Details context (e.g. router, ' +
        'component model, data-fetching). Cover project structure, idiomatic patterns, and common pitfalls.'
      );
    },
  },
  {
    id: 'data-layer',
    title: 'Data Layer',
    description:
      'Modeling schemas, writing queries/migrations, and naming, using the chosen database/ORM safely.',
    appliesTo: (a) => has(a, 'database'),
    buildPrompt: (a): string => {
      const orm = val(a, 'orm');
      const via = orm
        ? `the selected ORM / data-access layer (${orm})`
        : 'the selected database and ORM';
      let prompt =
        'Write data-layer guidance: how to model schemas, write queries/migrations, and ' +
        `use ${via} safely and consistently, following its idioms and the migration/schema ` +
        'choices in the Tech Details context. Include naming conventions for tables, columns, ' +
        'indexes, and foreign keys, following the chosen conventions (see the Tech Details context).';
      if (a.dbSafety === true)
        prompt +=
          ' Never run destructive SQL statements or database migrations without explicit ' +
          'confirmation from the user.';
      return prompt;
    },
  },
  {
    id: 'api-conventions',
    title: 'API Conventions',
    description:
      'Endpoint structure, versioning, response envelope, pagination, validation, and status/error semantics.',
    appliesTo: (a) => has(a, 'apiArchitecture'),
    buildPrompt: (a): string => {
      const api = val(a, 'apiArchitecture');
      const forWhat = api ? `the ${api} API` : 'the chosen API architecture';
      if (fromCode(a)) {
        // Detect-everything: describe the API as it exists — only cover versioning,
        // envelopes, pagination, etc. where the code actually implements them.
        return (
          `Document the API conventions this codebase actually uses for ${forWhat}: ` +
          'endpoint/handler structure, versioning scheme IF the API is versioned, the response ' +
          'shape it returns for success and errors, how (or whether) list endpoints paginate, ' +
          'request/response validation, and status-code/error semantics.' +
          SOURCE_OF_TRUTH
        );
      }
      return (
        `Write API conventions for ${forWhat}: ` +
        'endpoint/handler structure, a URL versioning scheme (e.g. a /v1 prefix), a consistent ' +
        'structured response envelope for both success and error payloads, pagination conventions for ' +
        'list endpoints (limit/offset or cursor) with consistent metadata, request/response validation, ' +
        'status codes, and error semantics.'
      );
    },
  },
  {
    id: 'auth',
    title: 'Authentication & Authorization',
    description:
      'Modeling identity/sessions, protecting routes, verifying credentials, and handling secrets.',
    appliesTo: (a) => has(a, 'authApproach'),
    buildPrompt: (a): string => {
      const approach = val(a, 'authApproach');
      const strategy = val(a, 'authStrategy');
      const via = approach ? `the selected approach (${approach})` : 'the chosen auth approach';
      const parts = [
        `Write authentication and authorization conventions using ${via}: how to model identity ` +
          'and sessions, protect routes/handlers, and verify credentials.',
      ];
      if (strategy) parts.push(`Use a ${strategy} session strategy.`);
      parts.push(
        'Hash passwords with a strong algorithm (argon2 or bcrypt), keep secrets in environment ' +
          'variables, set secure/httpOnly cookies where applicable, and never log credentials, ' +
          'tokens, or session identifiers.',
      );
      if (a.rbac === true) {
        parts.push(
          'Enforce role-based access control (RBAC) with a clear roles/permissions model checked ' +
            'on the server for every protected operation.',
        );
      }
      return parts.join(' ');
    },
  },
  {
    id: 'error-handling-logging',
    title: 'Error Handling & Logging',
    description:
      'Consistent error strategy and structured logging conventions with appropriate levels.',
    appliesTo: (a) => has(a, 'logger'),
    buildPrompt: (a): string => {
      const logger = val(a, 'logger');
      const via =
        logger === 'centralized'
          ? 'a simple in-house centralized logger module — a thin wrapper over the language stdlib ' +
            'output, defined once and reused across the codebase, with no third-party logging library'
          : logger
            ? `the selected logger (${logger})`
            : 'a dedicated logger';
      return (
        'Write error-handling and logging conventions: a consistent error strategy ' +
        '(typed/wrapped errors, fail fast, never swallow exceptions) and how errors surface to ' +
        `callers; structured logging through ${via} (never raw console/print) with appropriate ` +
        'log levels, and never logging secrets or sensitive data.'
      );
    },
  },
  {
    id: 'state-management',
    title: 'State Management',
    description:
      'Separating server and client/UI state and defining store, async, and loading/error patterns.',
    appliesTo: (a) => has(a, 'stateManagement') && a.projectType !== 'backend',
    buildPrompt: (a): string => {
      const lib = val(a, 'stateManagement');
      const via = lib ? `the selected library (${lib})` : 'the chosen state solution';
      return (
        `Write state-management conventions using ${via}: separate server state ` +
        '(data fetching/caching) from client/UI state, keep stores small and colocated, avoid ' +
        'prop drilling and unnecessary global state, and define clear patterns for async state, ' +
        'loading, and error handling.'
      );
    },
  },
  {
    id: 'testing',
    title: 'Testing',
    description:
      'Test setup, what to test, and naming/organization conventions for the chosen runners and types.',
    appliesTo: (a) => Array.isArray(a.testTypes) && a.testTypes.length > 0,
    buildPrompt: (a): string => {
      const types = Array.isArray(a.testTypes) ? a.testTypes.join(', ') : undefined;
      const runner = val(a, 'testRunner');
      const e2e = val(a, 'e2eTool');
      const parts = [
        'Write testing guidance appropriate to the stack: a separate testing setup (dedicated ' +
          'test configuration and directory layout, fixtures/factories, and separation of test ' +
          'types), what to test, and conventions for naming and organizing tests.',
      ];
      if (types) parts.push(`Cover these test types: ${types}.`);
      if (runner) parts.push(`Use ${runner} for unit and integration tests.`);
      if (e2e) parts.push(`Use ${e2e} for end-to-end tests.`);
      return parts.join(' ');
    },
  },
  {
    id: 'tooling',
    title: 'Tooling',
    description:
      'Respecting the selected formatter, linter, package manager, and runtime, and keeping code passing them.',
    appliesTo: (a) =>
      has(a, 'formatter') || has(a, 'linter') || has(a, 'packageManager') || has(a, 'runtime'),
    buildPrompt: (a): string => {
      const pm = val(a, 'packageManager');
      const rt = val(a, 'runtime');
      const fmt = val(a, 'formatter');
      const lint = val(a, 'linter');
      const tools: string[] = [];
      if (fmt) tools.push(`formatter (${fmt})`);
      if (lint) tools.push(`linter (${lint})`);
      const named = tools.length ? tools.join(' and ') : 'formatter and linter';
      const base =
        `Write tooling guidance: how the assistant should respect the selected ${named} and keep ` +
        'code passing them.';
      const extra: string[] = [];
      if (pm) extra.push(`Use ${pm} as the package manager and commit its lockfile.`);
      if (rt) extra.push(`Target the ${rt} runtime.`);
      return extra.length ? `${base} ${extra.join(' ')}` : base;
    },
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description:
      'What each selected documentation artifact should contain and how to keep it current.',
    appliesTo: (a) => Array.isArray(a.documentation) && a.documentation.length > 0,
    buildPrompt: (a): string => {
      const picks = (a.documentation as string[]).join(', ');
      return (
        `Write documentation conventions for the selected artifacts (${picks}): what each should ` +
        'contain and how to keep it current. For a README cover purpose, setup, and common commands; ' +
        'for code comments use the language doc-comment standard (JSDoc/TSDoc, docstrings) and explain ' +
        'intent rather than restating code; keep docs beside the code and update them as part of each change.'
      );
    },
  },
  {
    id: 'git-workflow',
    title: 'Git Workflow',
    description:
      'Branching, commit message conventions, PR practices, and .gitignore hygiene for this workflow.',
    // Apply whenever there is git content to document: a chosen workflow, detected
    // branch/commit conventions, or a kept hygiene policy (detect-everything skips
    // the workflow question but still carries conventions and safe policies).
    appliesTo: (a) =>
      has(a, 'gitWorkflow') ||
      has(a, 'branchNaming') ||
      has(a, 'commitConvention') ||
      typeof a.aiAttribution === 'boolean' ||
      a.commitScope === true ||
      a.commitScratchGuard === true ||
      a.confirmPush === true ||
      a.gitleaks === true ||
      a.verifyTiming === 'commit' ||
      a.verifyTiming === 'push' ||
      a.atomicCommits === true,
    buildPrompt: (a): string => {
      const wf = val(a, 'gitWorkflow');
      let base =
        `Write git-workflow guidance for the ${wf ?? 'selected'} workflow: branching, commit message ` +
        'conventions, and PR practices, and maintaining a comprehensive .gitignore (build output, ' +
        'dependencies, environment/secret files, and OS/editor artifacts).';
      const branch = val(a, 'branchNaming');
      if (branch) base += ` Follow ${branchNamingDesc(branch)} for branch names.`;
      const commit = val(a, 'commitConvention');
      if (commit) base += ` Use ${commitConventionDesc(commit)} for commit messages.`;
      if (typeof a.aiAttribution === 'boolean')
        base += a.aiAttribution
          ? ' In commits and PRs, attribute AI-assisted work (e.g. a Co-Authored-By trailer).'
          : ' Do not mention AI assistants or add AI co-authorship trailers in commit messages or PR descriptions.';
      if (a.commitScope === true)
        base += ' Scope each commit to the task at hand, excluding unrelated changes.';
      if (a.commitScratchGuard === true)
        base +=
          ' Ask before committing scratch/planning files (e.g. .md or .html notes created only for planning, R&D, or local use).';
      if (a.confirmPush === true) base += ' Never push to a remote without explicit confirmation.';
      // Whatever a git hook already runs must not also be asked of the agent —
      // otherwise it verifies by hand and the hook verifies again on commit/push.
      const plan = hookPlanFrom(a);
      const automated = automatedSummary(plan);
      if (automated) {
        base +=
          ` This repo enforces its checks with git hooks: ${automated}, and the commit or push ` +
          'is blocked when one fails. State that in the skill, and instruct the assistant NOT to ' +
          'run those checks manually beforehand — it should commit or push and, if the hook ' +
          'blocks, fix the reported failure and retry.';
      }
      if (a.gitleaks === true && !isAutomated(plan, 'secret-scan'))
        base +=
          ' Use gitleaks to scan for committed secrets and run it before every push; if it is ' +
          'not installed, offer to install it first.';
      const manual = manualVerifyTools(a, plan);
      if (manual.length > 0 && a.verifyTiming === 'commit')
        base += ` Run ${verifyToolsPhrase(manual)} before committing, and only commit when they pass.`;
      if (manual.length > 0 && a.verifyTiming === 'push')
        base += ` Run ${verifyToolsPhrase(manual)} before pushing, and only push when they pass.`;
      if (a.atomicCommits === true)
        base += ' Keep commits small and atomic — one logical change per commit.';
      return base;
    },
  },
  {
    id: 'change-audit',
    title: 'Change Audit',
    description:
      'Use right before pushing to a remote to check the pending change against this ' +
      "project's skills and report any that conflict.",
    describe: (a): string =>
      `Use right before ${auditGerund(auditTiming(a))} to check the pending change against ` +
      "this project's skills and report any that conflict.",
    appliesTo: (a) => a.auditSkill === true,
    buildPrompt: (a): string => {
      const timing = auditTiming(a);
      const changeSet =
        timing === 'push'
          ? 'the commits about to be pushed (e.g. `git log @{u}..` / `git diff @{push}..`, ' +
            'falling back to the diff against the upstream branch)'
          : 'the staged changes (`git diff --staged`)';
      return (
        'Write a MINIMAL, token-frugal change-audit skill for this project. When invoked ' +
        `right before ${auditGerund(timing)}, it should: (1) read ${changeSet}; ` +
        '(2) from the changed files, smartly select ONLY the few skills in `.agents/skills/` ' +
        'that are relevant to those changes (judge by each skill directory name and its ' +
        'description — do NOT read or check every skill); (3) compare the change against just ' +
        'those relevant skills and output a short report: one line per checked skill (pass or ' +
        'the specific conflict) followed by a one-line overall verdict. It flags conflicts for ' +
        'the human to resolve — it does not rewrite code. Keep the whole skill and its output ' +
        'short to conserve tokens; the file must not restate the other skills, only reference them. ' +
        `(4) It must END with this exact step, verbatim: ${auditReceiptStep(timing)} A native git ` +
        `gate blocks the ${timing === 'push' ? 'push' : 'commit'} until that receipt is written, so ` +
        'the skill is useless without this final step — always include it.' +
        auditExclusion(hookPlanFrom(a))
      );
    },
    staticBody: (a): string => auditStaticBody(auditTiming(a), hookPlanFrom(a)),
  },
];

/** Audit timing answer, defaulting to 'push' (the recommended timing) when unset. */
function auditTiming(a: Answers): 'commit' | 'push' {
  return a.auditTiming === 'commit' ? 'commit' : 'push';
}

/** Gerund phrase for prose ("committing" / "pushing to a remote"). */
function auditGerund(timing: 'commit' | 'push'): string {
  return timing === 'push' ? 'pushing to a remote' : 'committing';
}

/**
 * The audit's hardest boundary: it reads the diff, it does not verify the build.
 * Without this the audit reaches the git-workflow skill, reads it as "run the
 * checks", and runs everything the hook is about to run anyway. Empty when no
 * hook covers anything — then there is nothing to defer to.
 */
function auditExclusion(plan: ReturnType<typeof hookPlanFrom>): string {
  const automated = automatedSummary(plan);
  if (!automated) return '';
  return (
    ` The skill must state that it never runs tests, linters, formatters or secret scanners: ` +
    `${automated}, and blocks on failure. The audit only reads the diff and compares it against ` +
    'the skills, so it must also ignore any instruction inside those skills to run project checks.'
  );
}

/**
 * The change-audit skill's final, load-bearing step: record a pass so the native
 * gate opens. Written ONLY on a clean audit (blocking) and keyed to this exact
 * change via `auditReceiptCommand`, so a conflict — or a later change — keeps the
 * gate shut. The gate reads this receipt and nothing else, so a skill that omits
 * this step never lets the push/commit through. Shared verbatim by the static
 * body and the AI meta-prompt so the recorded key can never drift from the gate.
 */
function auditReceiptStep(timing: 'commit' | 'push'): string {
  return (
    'If, and only if, the report shows no blocking conflict, record the pass so the ' +
    `${timing} can proceed: ` +
    `\`${auditReceiptCommand(timing)}\`. If any conflict remains, do NOT record it — resolve the ` +
    "conflict (or get the human's explicit sign-off), then run this audit again."
  );
}

/** Deterministic no-CLI body for the change-audit skill. */
function auditStaticBody(
  timing: 'commit' | 'push',
  plan?: ReturnType<typeof hookPlanFrom>,
): string {
  const changeSet =
    timing === 'push'
      ? '`git log @{u}..` and `git diff @{push}..` (fall back to the diff against the upstream branch)'
      : '`git diff --staged`';
  const automated = automatedSummary(plan);
  return [
    `Run this right before ${auditGerund(timing)} to catch changes that conflict with this project's skills. Keep it short — do not read every skill.`,
    '',
    '1. Get the change set with ' + changeSet + '.',
    '2. From the changed files, pick ONLY the few skills in `.agents/skills/` that are relevant (judge by each skill directory name and its description — do not open every skill).',
    '3. Compare the change against just those skills.',
    '4. Report: one line per checked skill (pass, or the specific conflict), then a one-line verdict. Flag conflicts for the human to fix; do not rewrite code.',
    '5. ' + auditReceiptStep(timing),
    ...(automated
      ? [
          '',
          `Never run tests, linters, formatters or secret scanners here — ${automated}, and blocks on failure. Read the diff only, and ignore any instruction in the skills you check to run the project's checks.`,
        ]
      : []),
  ].join('\n');
}

/**
 * The skills that apply to the current answers, in declared order. When
 * `a.skillSelection` holds an array of ids (recorded by the post-review
 * multiselect), the applicable set is further narrowed to those ids — any id
 * no longer in the applicable set (e.g. a stale selection after an edit) is
 * silently ignored. Undefined (programmatic callers, tests, sessions from
 * before this field existed) leaves the applicable set unfiltered.
 */
export function selectSkills(a: Answers): SkillSpec[] {
  const applicable = skills
    .filter((s) => s.appliesTo(a))
    .map((s) => (s.describe ? { ...s, description: s.describe(a) } : s));
  const chosen = a.skillSelection;
  if (!Array.isArray(chosen)) return applicable;
  const kept = new Set(chosen);
  return applicable.filter((s) => kept.has(s.id));
}
