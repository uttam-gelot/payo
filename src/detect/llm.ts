/**
 * Stage 2 — LLM-assisted detection (see STACK_DETECTION_RND.md §5/§8).
 *
 * Runs after the deterministic Stage-1 analyzer, on the user's own agent (the
 * one picked in Q1). Additive only: it fills answer ids Stage 1 left blank and,
 * in "everything" mode, pre-fills the Tier-2 conventions visible from the tree.
 * Every value is validated against the option vocab and dropped if invalid.
 * When the evidence contradicts a Stage-1 answer, the agent reports it on a
 * separate `__conflicts` channel instead of overriding — the CLI surfaces each
 * conflict for the user to arbitrate, so Stage 2 stays never-load-bearing.
 *
 * The prompt carries every root manifest (plus the manifest of each workspace
 * root whose language differs from the primary's), a paths-only directory
 * tree, and fenced excerpts of the project docs (README/CLAUDE.md/AGENTS.md) —
 * docs state outright what dependency lists only imply. The agent already runs
 * inside the repo with file access, so quoting these files does not widen the
 * trust boundary; they are fenced as data to blunt prompt injection.
 *
 * The agent writes its answer as JSON to a file (reusing `runAgent`, which drives
 * the agent headless and ignores stdout — the agent is expected to write files).
 * If no agent is available, or anything fails, the base result is returned
 * unchanged: the LLM layer is never load-bearing.
 */
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { getProvider } from '../providers/index';
import {
  isAvailable as defaultIsAvailable,
  runAgent as defaultRunAgent,
  type AgentResult,
} from '../generator/agent';
import type { AgentRunner } from '../generator/types';
import type { Answers } from '../questions/types';
import type { DetectionResult } from './types';
import { exists, readText } from './manifest';
import { optionValuesFor, hasVocab } from './optionVocab';
import { TIER1, TIER2_HINTABLE } from './tiers';
import { dirTree } from './tree';
import { docsExcerpt } from './docs';
import { fenceProjectData } from '../generator/rules';

export type DetectDepth = 'everything' | 'partial';

/** Root manifests, in the same priority order as the Stage-1 detectors. */
const MANIFESTS = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  'global.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'Pipfile',
];

/**
 * Manifest filename(s) per language, used to pull the manifest of a workspace
 * root whose language differs from the primary's (a hybrid repo's Rust
 * `services/Cargo.toml` next to the root `package.json`).
 */
const LANG_MANIFEST: Record<string, string[]> = {
  typescript: ['package.json'],
  javascript: ['package.json'],
  python: ['pyproject.toml', 'requirements.txt', 'Pipfile'],
  go: ['go.mod'],
  rust: ['Cargo.toml'],
  php: ['composer.json'],
  csharp: ['global.json', 'Directory.Packages.props'],
  java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  ruby: ['Gemfile'],
};

const RESULT_FILE = 'detection-llm.json';

/** Injectable seams so the pass can be unit-tested without a real subprocess. */
export interface LlmDeps {
  resolveRunner: (aiTool: string | undefined) => AgentRunner | undefined;
  isAvailable: (runner: AgentRunner) => boolean;
  runAgent: (runner: AgentRunner, prompt: string) => Promise<AgentResult>;
  /** Read + parse the JSON the agent wrote; undefined when absent/unparseable. */
  readResult: (cwd: string) => Record<string, unknown> | undefined;
  cleanup: (cwd: string) => void;
}

const resultPath = (): string => path.join(config.payo.dir(), RESULT_FILE);

export const defaultDeps: LlmDeps = {
  resolveRunner: (aiTool) => getProvider(aiTool)?.agent,
  isAvailable: defaultIsAvailable,
  runAgent: defaultRunAgent,
  readResult: () => {
    try {
      const raw = fs.readFileSync(resultPath(), 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  },
  cleanup: () => {
    try {
      fs.rmSync(resultPath(), { force: true });
    } catch {
      /* best-effort */
    }
  },
};

/** The answer ids Stage 2 should try to fill, given what Stage 1 already found. */
export function targetIds(base: DetectionResult, depth: DetectDepth): string[] {
  const have = new Set(Object.keys(base.answers));
  const ids: string[] = [];
  for (const id of TIER1) {
    if (!have.has(id) && hasVocab(id)) ids.push(id);
  }
  if (depth === 'everything') {
    for (const id of TIER2_HINTABLE) {
      if (!have.has(id) && hasVocab(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * Whether a Stage-2 pass would actually do work: an agent is available and there
 * is at least one id to fill. Lets the CLI show its "Analyzing…" spinner only
 * when the pass really runs, instead of lying on the no-op path.
 */
export function willLlmDetectRun(
  base: DetectionResult,
  aiTool: string | undefined,
  depth: DetectDepth,
  deps: LlmDeps = defaultDeps,
): boolean {
  const runner = deps.resolveRunner(aiTool);
  if (!runner || !deps.isAvailable(runner)) return false;
  return targetIds(base, depth).length > 0;
}

/** Per-manifest and total size caps for the prompt's manifest blocks. */
const MANIFEST_CAP = 6000;
const MANIFESTS_TOTAL_CAP = 24000;

/**
 * Every manifest worth showing the agent: all root manifests present, then the
 * manifest of each workspace root whose language differs from the primary's.
 * A polyglot repo would otherwise get contradictory context — `language:
 * python` but only a Node manifest.
 */
function gatherManifests(cwd: string, base: DetectionResult): { label: string; body: string }[] {
  const out: { label: string; body: string }[] = [];
  let budget = MANIFESTS_TOTAL_CAP;
  const push = (label: string, body: string | undefined): void => {
    if (body === undefined || budget <= 0) return;
    const cap = Math.min(MANIFEST_CAP, budget);
    const sliced = body.length > cap ? `${body.slice(0, cap)}\n…(truncated)` : body;
    out.push({ label, body: sliced });
    budget -= sliced.length;
  };

  for (const f of MANIFESTS) {
    if (exists(cwd, f)) push(f, readText(cwd, f));
  }

  const primary = typeof base.answers.language === 'string' ? base.answers.language : undefined;
  const seenLangs = new Set<string>();
  for (const p of base.packages ?? []) {
    if (!p.language || p.language === primary || seenLangs.has(p.language)) continue;
    const dir = path.join(cwd, p.path);
    const file = (LANG_MANIFEST[p.language] ?? []).find((f) => exists(dir, f));
    if (!file) continue;
    seenLangs.add(p.language);
    push(`${p.path}/${file}`, readText(dir, file));
  }
  return out;
}

/** Build the schema-constrained prompt: manifests + tree + docs + per-id allowed values. */
export function buildPrompt(cwd: string, ids: string[], base: DetectionResult): string {
  const known = base.answers as Answers;
  const manifests = gatherManifests(cwd, base);
  const tree = dirTree(cwd).join('\n');
  const docs = docsExcerpt(cwd);
  const schema = ids
    .map((id) => `- ${id}: one of [${optionValuesFor(id, known).join(', ')}]`)
    .join('\n');
  const target = path.join(config.payo.dir(), RESULT_FILE);

  const manifestBlocks =
    manifests.length > 0
      ? manifests.flatMap((m) => [`## Manifest: ${m.label}`, '```\n' + m.body + '\n```', ''])
      : ['## Manifest', '(none)', ''];

  // Conflicts are only solicited over ids Stage 1 answered AND that have a
  // vocabulary to validate a suggestion against.
  const conflictIds = Object.keys(known).filter((id) => hasVocab(id));
  const conflictBlock =
    conflictIds.length > 0
      ? [
          '## Conflicts',
          'If the documentation or manifests CLEARLY contradict one of the known values',
          'below, do NOT change it. Instead add an entry to a top-level "__conflicts"',
          'array in the same JSON file: {"id", "suggested", "evidence"} — "suggested"',
          'must be one of the allowed options, "evidence" a short quote (max ~200 chars).',
          'Report at most 5 conflicts; when in doubt, report nothing.',
          ...conflictIds.map(
            (id) =>
              `- (known) ${id}: currently ${JSON.stringify(known[id])}, allowed [${optionValuesFor(id, known).join(', ')}]`,
          ),
          '',
        ]
      : [];

  return [
    "You are detecting a software project's stack from its manifests, directory layout,",
    'and documentation excerpts.',
    'Use ONLY the information below. Do not read or guess at file contents you were not given.',
    '',
    ...manifestBlocks,
    '## Directory tree (paths only)',
    '```\n' + tree + '\n```',
    '',
    ...(docs !== undefined
      ? ['## Project documentation (excerpts)', fenceProjectData(docs), '']
      : []),
    '## Already known (do not change these)',
    Object.keys(known).length ? JSON.stringify(known, null, 0) : '(none)',
    '',
    '## Your task',
    'Fill in the fields below where you are confident. For each, the value MUST be',
    'exactly one of the listed options (or, for list fields, a subset of them).',
    'Omit any field you are unsure about — do not guess.',
    schema,
    '',
    ...conflictBlock,
    `Write your answer as a single JSON object to the file: ${target}`,
    'The JSON keys are the field ids above; values are the chosen option string(s).',
    'Write nothing else.',
  ].join('\n');
}

/** A Stage-2 disagreement with a Stage-1 answer, for the user to arbitrate. */
export interface DetectionConflict {
  id: string;
  suggested: string;
  evidence: string;
}

/** A detection result plus any conflicts Stage 2 reported. */
export type LlmDetection = DetectionResult & { conflicts?: DetectionConflict[] };

const MAX_CONFLICTS = 5;
const MAX_EVIDENCE = 200;

/**
 * Keep only well-formed conflicts: the id must be one Stage 1 answered, the
 * suggestion in-vocab and actually different. Everything else is dropped —
 * a noisy agent can never corrupt the session through this channel.
 */
function validateConflicts(raw: Record<string, unknown>, base: DetectionResult): DetectionConflict[] {
  const list = raw.__conflicts;
  if (!Array.isArray(list)) return [];
  const known = base.answers as Answers;
  const out: DetectionConflict[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (out.length >= MAX_CONFLICTS) break;
    if (item === null || typeof item !== 'object') continue;
    const { id, suggested, evidence } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof suggested !== 'string' || seen.has(id)) continue;
    if (!(id in base.answers) || base.answers[id] === suggested) continue;
    if (!new Set(optionValuesFor(id, known)).has(suggested)) continue;
    seen.add(id);
    out.push({
      id,
      suggested,
      evidence: typeof evidence === 'string' ? evidence.slice(0, MAX_EVIDENCE) : '',
    });
  }
  return out;
}

/** Keep only ids with a valid, in-vocab value; coerce list fields element-wise. */
function validate(
  raw: Record<string, unknown>,
  ids: Set<string>,
  base: DetectionResult,
): Partial<Answers> {
  const known = base.answers as Answers;
  const out: Partial<Answers> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!ids.has(id)) continue; // only ids we asked for
    if (id in base.answers) continue; // never override Stage 1
    const allowed = new Set(optionValuesFor(id, known));
    if (allowed.size === 0) continue;
    if (Array.isArray(value)) {
      const kept = value.filter((v): v is string => typeof v === 'string' && allowed.has(v));
      if (kept.length) out[id] = kept;
    } else if (typeof value === 'string' && allowed.has(value)) {
      out[id] = value;
    }
  }
  return out;
}

/**
 * Run the Stage-2 pass. Returns `base` unchanged when no agent is available or
 * anything fails; otherwise `base` merged with the validated LLM-filled ids.
 */
export async function llmDetect(
  base: DetectionResult,
  aiTool: string | undefined,
  depth: DetectDepth,
  cwd: string = process.cwd(),
  deps: LlmDeps = defaultDeps,
): Promise<LlmDetection> {
  const runner = deps.resolveRunner(aiTool);
  if (!runner || !deps.isAvailable(runner)) return base;

  const ids = targetIds(base, depth);
  if (ids.length === 0) return base;

  const idSet = new Set(ids);
  const prompt = buildPrompt(cwd, ids, base);

  try {
    deps.cleanup(cwd); // clear any stale result first
    const result = await deps.runAgent(runner, prompt);
    if (!result.ok) return base;
    const raw = deps.readResult(cwd);
    if (!raw) return base;

    const filled = validate(raw, idSet, base);
    const conflicts = validateConflicts(raw, base);
    if (Object.keys(filled).length === 0 && conflicts.length === 0) return base;

    const answers = { ...base.answers, ...filled };
    const sources = { ...base.sources };
    for (const id of Object.keys(filled)) sources[id] = 'llm';
    // Spread base so a monorepo's packages/secondary survive the Stage-2 merge.
    return { ...base, answers, sources, ...(conflicts.length > 0 ? { conflicts } : {}) };
  } catch {
    return base;
  } finally {
    deps.cleanup(cwd);
  }
}
