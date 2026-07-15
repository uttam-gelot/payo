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

export type { DetectionResult, DetectionSource, PackageSummary } from './types';

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
 * Detect the stack rooted at `cwd`. For a monorepo, enumerate the workspace
 * members and detect each one, then surface a single primary stack (the root if
 * it already has a framework, else the first member that does, else the first
 * member with a language) plus a per-package summary the generator turns into
 * workspace notes. `structure` is forced to `monorepo`. A non-monorepo repo
 * returns the plain single-directory detection unchanged.
 */
export function detectStack(cwd: string = process.cwd()): DetectionResult {
  // Git branch/commit conventions are repo-level (independent of ecosystem and
  // of workspace members), so they merge onto whichever primary stack is chosen.
  const gitConv = detectGit(cwd);
  const root = withGit(detectAt(cwd), gitConv);

  const members = enumerateWorkspaces(cwd);
  if (members.length === 0) return root;

  const detected = members.map((rel) => ({ rel, result: detectAt(path.join(cwd, rel)) }));

  // Pick the stack that best represents the repo. A monorepo root manifest is
  // often just workspace config + shared tooling, so a member's app stack is
  // usually the real answer.
  const memberWithFramework = detected.find((d) => 'framework' in d.result.answers)?.result;
  const memberWithLanguage = detected.find((d) => 'language' in d.result.answers)?.result;
  const primary =
    'framework' in root.answers ? root : (memberWithFramework ?? memberWithLanguage ?? root);

  const base = withGit(
    coherent({
      answers: { ...primary.answers, structure: 'monorepo' },
      sources: { ...primary.sources, structure: 'config' },
    }),
    gitConv,
  );
  return { ...base, packages: detected.map((d) => summarize(d.rel, d.result)) };
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
