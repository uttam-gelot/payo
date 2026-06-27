/**
 * Stage 2 — LLM-assisted detection (see STACK_DETECTION_RND.md §5/§8).
 *
 * Runs after the deterministic Stage-1 analyzer, on the user's own agent (the
 * one picked in Q1). Additive only: it fills answer ids Stage 1 left blank and,
 * in "everything" mode, pre-fills the Tier-2 conventions visible from the tree.
 * Every value is validated against the option vocab and dropped if invalid.
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
import { TIER1 } from './tiers';
import { dirTree } from './tree';

export type DetectDepth = 'everything' | 'partial';

/** Tier-2 convention ids Stage 2 is allowed to hint (the rest stay manual, §10). */
const TIER2_HINTABLE = ['structure'];

/** Root manifests, in the same priority order as the Stage-1 detectors. */
const MANIFESTS = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'Pipfile',
];

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
function targetIds(base: DetectionResult, depth: DetectDepth): string[] {
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

/** Build the schema-constrained prompt: manifest + tree + per-id allowed values. */
export function buildPrompt(cwd: string, ids: string[], base: DetectionResult): string {
  const known = base.answers as Answers;
  const manifestFile = MANIFESTS.find((f) => exists(cwd, f));
  const manifestBody = manifestFile ? readText(cwd, manifestFile) : undefined;
  const tree = dirTree(cwd).join('\n');
  const schema = ids
    .map((id) => `- ${id}: one of [${optionValuesFor(id, known).join(', ')}]`)
    .join('\n');
  const target = path.join(config.payo.dir(), RESULT_FILE);

  return [
    "You are detecting a software project's stack from its manifest and directory layout.",
    'Use ONLY the information below. Do not read or guess at file contents you were not given.',
    '',
    `## Manifest (${manifestFile ?? 'none'})`,
    manifestBody ? '```\n' + manifestBody.slice(0, 8000) + '\n```' : '(none)',
    '',
    '## Directory tree (paths only)',
    '```\n' + tree + '\n```',
    '',
    '## Already known (do not change these)',
    Object.keys(known).length ? JSON.stringify(known, null, 0) : '(none)',
    '',
    '## Your task',
    'Fill in the fields below where you are confident. For each, the value MUST be',
    'exactly one of the listed options (or, for list fields, a subset of them).',
    'Omit any field you are unsure about — do not guess.',
    schema,
    '',
    `Write your answer as a single JSON object to the file: ${target}`,
    'The JSON keys are the field ids above; values are the chosen option string(s).',
    'Write nothing else.',
  ].join('\n');
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
): Promise<DetectionResult> {
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
    if (Object.keys(filled).length === 0) return base;

    const answers = { ...base.answers, ...filled };
    const sources = { ...base.sources };
    for (const id of Object.keys(filled)) sources[id] = 'llm';
    return { answers, sources };
  } catch {
    return base;
  } finally {
    deps.cleanup(cwd);
  }
}
