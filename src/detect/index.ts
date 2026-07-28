/**
 * Stack auto-detection for existing projects. Reads the project's manifests and
 * returns the core questionnaire answers it can infer with high confidence, so
 * the interview can pre-fill them instead of asking what the manifest already
 * knows. Returns an empty result for a greenfield dir (no manifest) — callers
 * then run the normal flow unchanged.
 */
import path from 'path';
import type { DetectionResult, PackageSummary } from './types';
import { EMPTY_DETECTION } from './types';
import { detectNode } from './node';
import { detectPython } from './python';
import { detectGo } from './go';
import { detectRust } from './rust';
import { detectPhp } from './php';
import { detectDotnet } from './dotnet';
import { detectJava } from './java';
import { detectRuby } from './ruby';
import { detectGit } from './git';
import { enumerateWorkspaces } from './workspaces';
import { scriptSignals } from './scripts';
import { detectHooks } from './hooks';

export type { DetectionResult, DetectionSource, PackageSummary } from './types';
export type { DetectedHooks, HookCapability, HookCoverage, HookRunner, HookStage } from './hooks';

/** Detectors in priority order — used to break ties when several manifests coexist. */
const DETECTORS = [
  detectNode,
  detectPython,
  detectGo,
  detectRust,
  detectPhp,
  detectDotnet,
  detectJava,
  detectRuby,
];

/**
 * Detect the stack of a single directory. When more than one ecosystem's
 * manifest is present (polyglot dir), prefer the one that yielded a framework;
 * otherwise the highest-priority manifest. A single ecosystem is chosen so the
 * seeded answers never mix conflicting languages. Never recurses into workspace
 * members — that is `detectStack`'s job — so a member's own detection is flat.
 */
function detectAt(cwd: string): DetectionResult {
  // A malformed manifest must never crash the CLI: a detector that throws is
  // treated as "no match" so the remaining detectors (and greenfield fallback)
  // still work. Stage 1 stays the always-safe floor.
  const found = DETECTORS.map((d) => {
    try {
      return d(cwd);
    } catch {
      return null;
    }
  }).filter((r): r is DetectionResult => r !== null);
  if (found.length === 0) return EMPTY_DETECTION;
  const withFramework = found.find((r) => 'framework' in r.answers);
  return coherent(withFramework ?? found[0]);
}

/** Pull a string answer for the per-package summary, or undefined. */
function str(a: DetectionResult['answers'], key: string): string | undefined {
  const v = a[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Answer ids that describe the repository rather than one app. In a hoisted
 * monorepo these live at the root (shared lockfile, shared prettier config,
 * root test runner), so the root's value wins over a member-primary's — the
 * member usually has none of its own, and when it does the root still governs
 * installs and tooling.
 */
const REPO_LEVEL_IDS = new Set([
  'packageManager',
  'runtime',
  'formatter',
  'linter',
  'testRunner',
  'e2eTool',
  'testTypes',
  'validation',
]);

function isRepoLevel(id: string): boolean {
  return REPO_LEVEL_IDS.has(id) || id.startsWith('tsconfig.');
}

/** Languages whose presence marks a backend package (they never render a UI). */
const SERVER_LANGUAGES = new Set(['rust', 'go', 'python', 'java', 'csharp', 'php', 'ruby']);

/** True when a package's detection reads as a backend (server) component. */
function isBackendish(r: DetectionResult): boolean {
  const type = str(r.answers, 'projectType');
  if (type === 'backend' || type === 'full-stack') return true;
  const lang = str(r.answers, 'language');
  return lang !== undefined && SERVER_LANGUAGES.has(lang);
}

/**
 * Classify the repo's shape from all of its packages instead of the primary
 * alone: a React member next to a Rust workspace is a full-stack repo, not a
 * frontend. Conservative — only overrides when both shapes (or only backends)
 * are clearly present; anything ambiguous keeps the primary's own value.
 */
function aggregateProjectType(
  current: string | undefined,
  results: DetectionResult[],
): string | undefined {
  const backend = results.some(isBackendish);
  const frontend = results.some((r) => str(r.answers, 'projectType') === 'frontend');
  if (backend && frontend) return 'full-stack';
  if (backend && current === undefined) return 'backend';
  return current;
}

/**
 * Fold the root package.json script hints into a detection result — fill-only:
 * script-invoked languages widen `secondary` (and promote a frontend to
 * full-stack, since they imply a server-side component the manifests hid), and
 * an e2e hint seeds the test answers when detection found none. A hint never
 * overrides a manifest- or lockfile-derived fact.
 */
function applyScriptHints(result: DetectionResult, cwd: string): DetectionResult {
  const hints = scriptSignals(cwd);
  if (hints.languages.size === 0 && hints.e2e === undefined) return result;

  const answers = { ...result.answers };
  const sources = { ...result.sources };
  const secondary = result.secondary ? [...result.secondary] : [];

  const primary = str(answers, 'language');
  for (const lang of hints.languages) {
    if (lang !== primary && !secondary.includes(lang)) secondary.push(lang);
  }
  if (hints.languages.size > 0 && str(answers, 'projectType') === 'frontend') {
    answers.projectType = 'full-stack';
    sources.projectType = 'config';
  }

  if (hints.e2e !== undefined && !('testTypes' in answers)) {
    answers.testTypes = ['unit', 'integration', 'e2e'];
    sources.testTypes = 'config';
    // 'vitest' marks vitest-driven e2e — a test runner, not an e2eTool option.
    if (hints.e2e !== 'vitest' && !('e2eTool' in answers)) {
      answers.e2eTool = hints.e2e;
      sources.e2eTool = 'config';
    }
  }

  return { ...result, answers, sources, ...(secondary.length > 0 ? { secondary } : {}) };
}

/** Unique languages across root + members, minus the primary's — hybrid-repo evidence. */
function secondaryLanguages(primary: string | undefined, results: DetectionResult[]): string[] {
  const out: string[] = [];
  for (const r of results) {
    const lang = str(r.answers, 'language');
    if (lang === undefined || lang === primary || out.includes(lang)) continue;
    // A JS member in a TS repo (or vice versa) is the same stack, not a hybrid.
    const jsTs = new Set(['javascript', 'typescript']);
    if (primary !== undefined && jsTs.has(primary) && jsTs.has(lang)) continue;
    out.push(lang);
  }
  return out;
}

/** Condense a member's detection into the summary the generator renders. */
function summarize(rel: string, result: DetectionResult): PackageSummary {
  return {
    path: rel,
    language: str(result.answers, 'language'),
    framework: str(result.answers, 'framework'),
    projectType: str(result.answers, 'projectType'),
    database: str(result.answers, 'database'),
  };
}

/**
 * Fold a nested workspace's many same-language members into their root's entry
 * (a Cargo workspace's 8 crates become `services (8 packages)`) so the
 * workspace notes stay readable. Small groups keep their per-member lines —
 * only above 4 does the list stop carrying information worth the space.
 */
function collapsePackages(pkgs: PackageSummary[]): PackageSummary[] {
  const drop = new Set<string>();
  const counts = new Map<string, number>();
  for (const parent of pkgs) {
    const children = pkgs.filter(
      (c) =>
        c.path.startsWith(`${parent.path}/`) && c.language === parent.language && !drop.has(c.path),
    );
    if (children.length > 4) {
      counts.set(parent.path, children.length);
      for (const c of children) drop.add(c.path);
    }
  }
  if (drop.size === 0) return pkgs;
  return pkgs
    .filter((p) => !drop.has(p.path))
    .map((p) => (counts.has(p.path) ? { ...p, memberCount: counts.get(p.path) } : p));
}

/**
 * Detect the stack rooted at `cwd`. For a monorepo, enumerate the workspace
 * members and detect each one, then surface a single primary app stack (the
 * root if it already has a framework, else the first member that does, else
 * the first member with a language) merged with the root's repo-level tooling
 * facts, plus a per-package summary the generator turns into workspace notes.
 * The repo's projectType is aggregated across packages (frontend member +
 * backend members → full-stack) and extra languages land in `secondary`.
 * `structure` is forced to `monorepo`. A non-monorepo repo returns the plain
 * single-directory detection unchanged.
 */
export function detectStack(cwd: string = process.cwd()): DetectionResult {
  // Git branch/commit conventions are repo-level (independent of ecosystem and
  // of workspace members), so they merge onto whichever primary stack is chosen.
  const gitConv = detectGit(cwd);
  const root = withGit(detectAt(cwd), gitConv);
  // Repo-level like the git conventions: hooks live at the root even in a monorepo.
  const hooks = detectHooks(cwd) ?? undefined;

  const members = enumerateWorkspaces(cwd);
  if (members.length === 0) return withHooks(applyScriptHints(root, cwd), hooks);

  const detected = members.map((rel) => ({ rel, result: detectAt(path.join(cwd, rel)) }));

  // Pick the stack that best represents the repo. A monorepo root manifest is
  // often just workspace config + shared tooling, so a member's app stack is
  // usually the real answer — but the root's repo-level facts (lockfile,
  // runtime, formatter, test runner) must survive the member taking over.
  const memberWithFramework = detected.find((d) => 'framework' in d.result.answers)?.result;
  const memberWithLanguage = detected.find((d) => 'language' in d.result.answers)?.result;
  const appPrimary =
    'framework' in root.answers ? root : (memberWithFramework ?? memberWithLanguage ?? root);

  const answers = { ...appPrimary.answers };
  const sources = { ...appPrimary.sources };
  for (const [id, value] of Object.entries(root.answers)) {
    if (!isRepoLevel(id)) continue;
    answers[id] = value;
    if (root.sources[id] !== undefined) sources[id] = root.sources[id];
  }

  // A hoisted member often has no tsconfig or typescript dep of its own, so it
  // reads as javascript even though the repo is TypeScript — the root knows best.
  if (str(root.answers, 'language') === 'typescript' && str(answers, 'language') === 'javascript') {
    answers.language = 'typescript';
    if (root.sources.language !== undefined) sources.language = root.sources.language;
  }

  const allResults = [root, ...detected.map((d) => d.result)];
  const aggregated = aggregateProjectType(str(answers, 'projectType'), allResults);
  if (aggregated !== undefined && aggregated !== answers.projectType) {
    answers.projectType = aggregated;
    sources.projectType = 'config';
  }

  answers.structure = 'monorepo';
  sources.structure = 'config';

  const base = withGit(coherent({ answers, sources }), gitConv);
  const secondary = secondaryLanguages(str(base.answers, 'language'), allResults);
  return withHooks(
    applyScriptHints(
      {
        ...base,
        ...(secondary.length > 0 ? { secondary } : {}),
        packages: collapsePackages(detected.map((d) => summarize(d.rel, d.result))),
      },
      cwd,
    ),
    hooks,
  );
}

/** Attach the detected hook runner, when the repo has one. */
function withHooks(result: DetectionResult, hooks: DetectionResult['hooks']): DetectionResult {
  return hooks ? { ...result, hooks } : result;
}

/** Merge repo-level git conventions onto a detection result (git fills, never overrides). */
function withGit(result: DetectionResult, git: DetectionResult): DetectionResult {
  if (Object.keys(git.answers).length === 0) return result;
  return {
    ...result,
    answers: { ...git.answers, ...result.answers },
    sources: { ...git.sources, ...result.sources },
  };
}

/**
 * Keep seeded answers consistent with the flow's gating: the ORM question only
 * appears once a database is chosen (`hasModeledDb`), so an ORM detected without
 * a database would be orphaned. Drop it — the interview re-asks it after the DB.
 */
function coherent(result: DetectionResult): DetectionResult {
  if ('orm' in result.answers && !('database' in result.answers)) {
    const answers = { ...result.answers };
    const sources = { ...result.sources };
    delete answers.orm;
    delete sources.orm;
    return { answers, sources };
  }
  return result;
}
