/**
 * Deterministic Stage-1 detection of git conventions from LOCAL history.
 *
 * Reads branch names and recent commit subjects with `git` and classifies the
 * project's branch-naming and commit-message conventions. Everything stays
 * local — nothing here is ever sent to the LLM (see tiers.ts §10) — so the
 * privacy cost is capped at "what your own `git log`/`git branch` already show".
 *
 * Every read is guarded: outside a repo, without git installed, or on any error,
 * an empty result is returned and the caller falls back unchanged.
 */
import { spawnSync } from 'child_process';
import type { DetectionResult, DetectionSource } from './types';
import { EMPTY_DETECTION } from './types';

/** How many recent commit subjects to sample when inferring the convention. */
const COMMIT_SAMPLE = 30;

/** Default/long-lived branches that carry no naming convention signal. */
const BASE_BRANCHES = new Set(['main', 'master', 'develop', 'development', 'trunk', 'HEAD']);

/** Branch-prefix types that indicate a `type/slug` convention. */
const BRANCH_TYPES =
  /^(feat|feature|fix|bugfix|hotfix|chore|docs|doc|refactor|test|release|ci|perf|build|style|spike|exp)\//i;

/** A ticket key like ABC-123 or JIRA-1 at the start of a string. */
const TICKET = /^[A-Z][A-Z0-9]+-\d+/;

/** A Conventional Commit subject: `type(scope)!: description`. */
const CONVENTIONAL =
  /^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|revert)(\([^)]+\))?!?:\s/i;

/** Plain kebab-case slug (lowercase words joined by hyphens), no path separator. */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)+$/;

/** Run a git command in `cwd`, returning trimmed stdout lines, or null on any failure. */
function git(cwd: string, args: string[]): string[] | null {
  try {
    const res = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 3000 });
    if (res.status !== 0 || typeof res.stdout !== 'string') return null;
    return res.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

/** True when `cwd` is inside a git work tree. */
function isRepo(cwd: string): boolean {
  const out = git(cwd, ['rev-parse', '--is-inside-work-tree']);
  return out?.[0] === 'true';
}

/** The value that a strict majority (> half) of `samples` satisfies, else undefined. */
function majority(samples: string[], test: (s: string) => boolean): boolean {
  if (samples.length === 0) return false;
  const hits = samples.filter(test).length;
  return hits * 2 > samples.length;
}

/** Branch names worth classifying — remotes stripped of `origin/`, base branches dropped. */
function branchSlugs(cwd: string): string[] {
  const raw = git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes']);
  if (!raw) return [];
  const seen = new Set<string>();
  for (const ref of raw) {
    // Strip only a leading remote name (origin/, upstream/), keeping type
    // prefixes like `feature/`. Drop the remote HEAD alias (e.g. `origin`).
    const slug = /^(origin|upstream)\//.test(ref) ? ref.replace(/^[^/]+\//, '') : ref;
    if (!slug || BASE_BRANCHES.has(slug)) continue;
    seen.add(slug);
  }
  return [...seen];
}

/** Infer the branch-naming convention from sampled branch slugs, or undefined. */
export function classifyBranches(slugs: string[]): string | undefined {
  if (slugs.length === 0) return undefined;
  if (majority(slugs, (s) => BRANCH_TYPES.test(s))) return 'type-slash';
  if (majority(slugs, (s) => TICKET.test(s))) return 'ticket';
  if (majority(slugs, (s) => KEBAB.test(s))) return 'kebab';
  return undefined; // no clear pattern — do not guess
}

/** Infer the commit-message convention from sampled subjects, or undefined. */
export function classifyCommits(subjects: string[]): string | undefined {
  if (subjects.length === 0) return undefined;
  if (majority(subjects, (s) => CONVENTIONAL.test(s))) return 'conventional';
  if (majority(subjects, (s) => TICKET.test(s))) return 'ticket';
  return 'freeform'; // commits exist but follow no structured convention
}

/**
 * Detect git branch-naming and commit conventions for the repo at `cwd`. Returns
 * an empty result when `cwd` is not a git repo (or git is unavailable), so the
 * caller's merge is a no-op.
 */
export function detectGit(cwd: string): DetectionResult {
  if (!isRepo(cwd)) return EMPTY_DETECTION;

  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = 'git';
    }
  };

  set('branchNaming', classifyBranches(branchSlugs(cwd)));
  const subjects = git(cwd, ['log', `-n${COMMIT_SAMPLE}`, '--format=%s']) ?? [];
  set('commitConvention', classifyCommits(subjects));

  return { answers, sources };
}
