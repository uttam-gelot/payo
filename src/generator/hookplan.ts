/**
 * The hook plan: what the mechanical git hook will actually run, decided ONCE
 * before generation starts.
 *
 * Two layers used to reason about verification independently — the hook writer
 * emitted commands, and the generated prose separately told the agent to run the
 * same commands by hand. The agent obeyed the prose, then the hook ran
 * everything a second time on `git push`. A single plan removes that: the
 * partition below is the one source of truth for "who runs this check", and both
 * the hook writer and the prose read it.
 *
 * A check lands in exactly one bucket:
 *   write    — Payo writes it into the hook config
 *   covered  — the repo's existing runner already does it; nobody needs to add it
 *   deferred — wanted, but no hook will run it (the user kept their setup, or the
 *              runner cannot be safely edited) — so the prose must keep asking the
 *              agent to run it manually
 */
import type { Answers } from '../questions/types';
import {
  detectHooks,
  coversCapability,
  emptyCoverage,
  HOOK_STAGES,
  type DetectedHooks,
  type HookCapability,
  type HookCoverage,
  type HookRunner,
  type HookStage,
} from '../detect/hooks';
import { resolveCommands } from './commands';
import { pmExec, pmRun } from '../stack/commands';
import { hasTesting } from '../stack/predicates';

/** One command the hook layer wants run at a git stage. */
export interface PlannedCheck {
  /** Stable hook-entry name; also the idempotency key inside the config. */
  name: string;
  /** Shell command to run. */
  run: string;
  stage: HookStage;
  /** The class of check this is, for matching against existing coverage. */
  capability: HookCapability;
}

export interface HookPlan {
  /**
   * The runner that will carry the checks — the one the repo already uses, or
   * the one the user picked for a repo that has none.
   */
  runner: HookRunner;
  /**
   * True when Payo creates that runner's config from scratch rather than
   * merging into a config the developer wrote.
   */
  greenfield: boolean;
  /** The config path the checks are written to (or read from). */
  configPath?: string;
  write: PlannedCheck[];
  covered: PlannedCheck[];
  deferred: PlannedCheck[];
  /** True when Payo writes no hook config at all for this repo. */
  readOnly: boolean;
}

export const EMPTY_PLAN: HookPlan = {
  runner: 'lefthook',
  greenfield: true,
  write: [],
  covered: [],
  deferred: [],
  readOnly: true,
};

/**
 * Runners whose config Payo can extend without rewriting a line the developer
 * wrote. simple-git-hooks is excluded: its config maps a stage to ONE command
 * string, so adding a check means editing the user's own command.
 */
const WRITABLE_RUNNERS = new Set<HookRunner>(['lefthook', 'husky', 'pre-commit', 'native']);

/**
 * Where a runner's config goes when Payo is the one creating it. Only the
 * writable runners can be chosen, so simple-git-hooks has no entry.
 */
const GREENFIELD_CONFIG: Partial<Record<HookRunner, string>> = {
  lefthook: 'lefthook.yml',
  husky: '.husky',
  'pre-commit': '.pre-commit-config.yaml',
  // A committed directory rather than `.git/hooks`, which git never tracks.
  native: '.githooks',
};

/**
 * The runner to set up on a repo that has none, or undefined when the user
 * declined one. An unset or unrecognised answer falls back to lefthook: that
 * keeps sessions written before this question existed — and programmatic
 * `generate()` callers, which never run the interview — generating what they
 * always did.
 */
function chosenRunner(a: Answers): HookRunner | undefined {
  const v = a.hookRunner;
  if (v === 'none') return undefined;
  return typeof v === 'string' && v in GREENFIELD_CONFIG ? (v as HookRunner) : 'lefthook';
}

/**
 * Non-mutating check command per linter, keyed by the `linter` answer. Tools
 * that only run through a build (Checkstyle, PMD, SpotBugs, Roslyn analyzers)
 * are absent on purpose — there is no standalone command to put in a hook, and a
 * wrong one would block every commit.
 */
const LINT_COMMANDS: Record<string, (a: Answers) => string> = {
  eslint: (a) => pmExec(a, 'eslint .'),
  biome: (a) => pmExec(a, 'biome lint .'),
  oxlint: (a) => pmExec(a, 'oxlint'),
  standardjs: (a) => pmExec(a, 'standard'),
  ruff: () => 'ruff check .',
  flake8: () => 'flake8',
  'golangci-lint': () => 'golangci-lint run',
  clippy: () => 'cargo clippy -- -D warnings',
  phpstan: () => 'vendor/bin/phpstan analyse',
  psalm: () => 'vendor/bin/psalm',
  rubocop: () => 'bundle exec rubocop',
};

/**
 * Check-only (never rewriting) command per formatter, keyed by the `formatter`
 * answer. A hook that reformats files behind the developer's back would leave
 * the commit and the working tree disagreeing, so every entry is a --check form.
 */
const FORMAT_COMMANDS: Record<string, (a: Answers) => string> = {
  prettier: (a) => pmExec(a, 'prettier --check .'),
  biome: (a) => pmExec(a, 'biome format .'),
  dprint: (a) => pmExec(a, 'dprint check'),
  black: () => 'black --check .',
  ruff: () => 'ruff format --check .',
  // `gofmt -l` lists offenders but still exits 0 — the emptiness test is what fails.
  gofmt: () => 'test -z "$(gofmt -l .)"',
  rustfmt: () => 'cargo fmt --check',
  pint: () => 'vendor/bin/pint --test',
  'php-cs-fixer': () => 'vendor/bin/php-cs-fixer fix --dry-run --diff',
  'dotnet-format': () => 'dotnet format --verify-no-changes',
  csharpier: () => 'dotnet csharpier --check .',
  standard: () => 'bundle exec standardrb',
};

/** A "set" string answer, or undefined for empty / 'none'. */
function val(a: Answers, key: string): string | undefined {
  const v = a[key];
  return typeof v === 'string' && v.length > 0 && v !== 'none' ? v : undefined;
}

/**
 * Every check the answers ask for, before any of them is matched against what
 * the repo already does. gitleaks scans before push (its convention); the
 * formatter, linter and tests land together at whichever stage `verifyTiming`
 * names — that question asks about all three.
 */
export function desiredChecks(a: Answers): PlannedCheck[] {
  const checks: PlannedCheck[] = [];
  if (a.gitleaks === true) {
    checks.push({
      name: 'payo-secret-scan',
      run: 'gitleaks detect --redact',
      stage: 'pre-push',
      capability: 'secret-scan',
    });
  }

  const stage: HookStage | undefined =
    a.verifyTiming === 'commit' ? 'pre-commit' : a.verifyTiming === 'push' ? 'pre-push' : undefined;
  if (!stage) return checks;

  // Prefer the framework's own test command; fall back to the package manager's
  // `test` script for stacks without a framework module (e.g. a plain CLI), but
  // only when the user actually chose a testing setup.
  const test = resolveCommands(a).test ?? (hasTesting(a) ? pmRun(a, 'test') : undefined);
  if (test) checks.push({ name: 'payo-verify', run: test, stage, capability: 'verify' });

  const lint = LINT_COMMANDS[val(a, 'linter') ?? '']?.(a);
  if (lint) checks.push({ name: 'payo-lint', run: lint, stage, capability: 'lint' });

  const format = FORMAT_COMMANDS[val(a, 'formatter') ?? '']?.(a);
  // RuboCop and StandardRB serve as both linter and formatter — one entry is enough.
  if (format && !checks.some((c) => c.run === format)) {
    checks.push({ name: 'payo-format', run: format, stage, capability: 'format' });
  }
  return checks;
}

/** Normalize a coverage map that may have round-tripped through JSON. */
function normalizeCoverage(raw: unknown): HookCoverage {
  const out = emptyCoverage();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const stage of HOOK_STAGES) {
    const caps = src[stage];
    if (Array.isArray(caps))
      out[stage] = caps.filter((c): c is HookCapability => typeof c === 'string');
  }
  return out;
}

/** The existing hook setup detection recorded onto the answers, if it did. */
function recordedHooks(a: Answers): DetectedHooks | null {
  const recorded = a.existingHooks;
  if (!recorded || typeof recorded !== 'object') return null;
  const r = recorded as Record<string, unknown>;
  if (typeof r.runner !== 'string' || typeof r.configPath !== 'string') return null;
  return {
    runner: r.runner as HookRunner,
    configPath: r.configPath,
    coverage: normalizeCoverage(r.coverage),
  };
}

/**
 * The existing hook setup, preferring what detection already recorded and
 * falling back to reading the repo so a programmatic caller gets the same answer.
 */
function existingHooks(a: Answers, cwd: string): DetectedHooks | null {
  return recordedHooks(a) ?? detectHooks(cwd);
}

/**
 * Partition the wanted checks against what the repo already has. Reads the
 * filesystem; writes nothing.
 */
export function planHooks(a: Answers, cwd: string = process.cwd()): HookPlan {
  const desired = desiredChecks(a);
  const existing = existingHooks(a, cwd);

  if (!existing) {
    // No runner to respect — the user's pick decides who carries the checks.
    // "None" is not a refusal of the checks themselves: they land in `deferred`
    // so the generated prose keeps asking the agent to run them by hand.
    const runner = chosenRunner(a);
    return {
      runner: runner ?? 'lefthook',
      greenfield: true,
      configPath: runner ? GREENFIELD_CONFIG[runner] : undefined,
      write: runner ? desired : [],
      covered: [],
      deferred: runner ? [] : desired,
      readOnly: !runner || desired.length === 0,
    };
  }

  // A repo's hook setup is a deliberate choice, so Payo touches it only on an
  // explicit `merge`. Anything else — including no answer at all — leaves it be.
  const merge = a.hookPolicy === 'merge' && WRITABLE_RUNNERS.has(existing.runner);
  const write: PlannedCheck[] = [];
  const covered: PlannedCheck[] = [];
  const deferred: PlannedCheck[] = [];

  for (const check of desired) {
    // Stage-agnostic: a repo running its tests at pre-commit does not also need
    // them at pre-push, and adding them there would just double the wait. The
    // covered entry is re-pinned to the stage the runner ACTUALLY uses, so prose
    // built from the plan cannot claim the wrong one. Its `run` still holds the
    // command Payo would have written — the repo's own may differ, which is why
    // covered checks are only ever described by capability.
    const at = HOOK_STAGES.find((s) => existing.coverage[s].includes(check.capability));
    if (at) covered.push({ ...check, stage: at });
    else if (merge) write.push(check);
    else deferred.push(check);
  }

  return {
    runner: existing.runner,
    greenfield: false,
    configPath: existing.configPath,
    write,
    covered,
    deferred,
    readOnly: write.length === 0,
  };
}

/**
 * True when the repo has a runner Payo could extend AND some wanted check it
 * does not already cover — i.e. when asking the user about their hooks is worth
 * a question. False on a greenfield repo (nothing to respect) and on a repo that
 * already covers everything (nothing to add).
 */
export function hasUnaddressedHookWork(a: Answers): boolean {
  // Answers-only, never the filesystem: like every other `when`, whether the
  // question is asked must depend on the interview, not on the process's cwd.
  const existing = recordedHooks(a);
  if (!existing || !WRITABLE_RUNNERS.has(existing.runner)) return false;
  return desiredChecks(a).some((c) => !coversCapability(existing.coverage, c.capability));
}

/**
 * True when the repo has no hook runner at all yet still wants checks run — i.e.
 * when asking WHICH runner to set up is worth a question. False once a runner is
 * present (that repo gets the `hookPolicy` question instead) and false when no
 * check was asked for, since there would be nothing for a runner to carry.
 */
export function needsHookRunnerChoice(a: Answers): boolean {
  // Answers-only, never the filesystem — same contract as hasUnaddressedHookWork.
  return recordedHooks(a) === null && desiredChecks(a).length > 0;
}

/** Answer key carrying the plan from `generate` to the rule and skill builders. */
export const HOOK_PLAN_KEY = 'hookPlan';

/** The plan stashed on the answers by `generate`, when there is one. */
export function hookPlanFrom(a: Answers): HookPlan | undefined {
  const v = a[HOOK_PLAN_KEY];
  return v && typeof v === 'object' ? (v as HookPlan) : undefined;
}

/** The checks a hook will run — Payo's own plus the ones already in place. */
export function automatedChecks(plan: HookPlan | undefined): PlannedCheck[] {
  return plan ? [...plan.write, ...plan.covered] : [];
}

/** True when some hook runs `cap`, so the agent must not run it by hand. */
export function isAutomated(plan: HookPlan | undefined, cap: HookCapability): boolean {
  return automatedChecks(plan).some((c) => c.capability === cap);
}

/** The runner name to use in prose, e.g. "lefthook" or "husky". */
export function runnerLabel(plan: HookPlan): string {
  return plan.runner;
}

/**
 * How a capability reads in prose. Capabilities, not commands: a `covered` check
 * carries the command Payo WOULD have written, while the repo's own hook may run
 * a different tool for the same job — naming the class is the only phrasing that
 * is true for both buckets.
 */
const CAPABILITY_PHRASE: Record<HookCapability, string> = {
  'secret-scan': 'a secret scan',
  verify: 'the tests',
  lint: 'the linter',
  format: 'a format check',
};

/** "a" / "a and b" / "a, b, and c" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * One sentence naming what runs automatically, e.g. "`lefthook` runs the linter
 * and the tests at pre-commit, and a secret scan at pre-push". Undefined when no
 * hook covers anything — callers then keep their manual instructions.
 */
export function automatedSummary(plan: HookPlan | undefined): string | undefined {
  const checks = automatedChecks(plan);
  if (!plan || checks.length === 0) return undefined;
  const perStage = HOOK_STAGES.map((stage) => {
    const caps = checks
      .filter((c) => c.stage === stage)
      .map((c) => CAPABILITY_PHRASE[c.capability]);
    return caps.length > 0 ? `${joinList(caps)} at ${stage}` : undefined;
  }).filter((p): p is string => p !== undefined);
  return `\`${runnerLabel(plan)}\` runs ${perStage.join(', and ')}`;
}

/**
 * The verification tools the agent still has to run by hand — the selected ones
 * minus whatever a hook already covers. Empty means the agent should run none of
 * them, which is the whole point: the hook will.
 */
export function manualVerifyTools(a: Answers, plan: HookPlan | undefined): string[] {
  return [
    val(a, 'formatter') && !isAutomated(plan, 'format') ? 'formatter' : undefined,
    val(a, 'linter') && !isAutomated(plan, 'lint') ? 'linter' : undefined,
    hasTesting(a) && !isAutomated(plan, 'verify') ? 'tests' : undefined,
  ].filter((t): t is string => t !== undefined);
}

/** Those tools as prose: "the formatter, linter, and tests". */
export function verifyToolsPhrase(tools: string[]): string {
  return tools.length === 0 ? "the project's checks" : `the ${joinList(tools)}`;
}
