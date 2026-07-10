/**
 * Stack auto-detection for existing projects. Reads the project's manifests and
 * returns the core questionnaire answers it can infer with high confidence, so
 * the interview can pre-fill them instead of asking what the manifest already
 * knows. Returns an empty result for a greenfield dir (no manifest) — callers
 * then run the normal flow unchanged.
 */
import type { DetectionResult } from './types';
import { EMPTY_DETECTION } from './types';
import { detectNode } from './node';
import { detectPython } from './python';
import { detectGo } from './go';
import { detectRust } from './rust';
import { detectPhp } from './php';
import { detectDotnet } from './dotnet';
import { detectJava } from './java';

export type { DetectionResult, DetectionSource } from './types';

/** Detectors in priority order — used to break ties when several manifests coexist. */
const DETECTORS = [
  detectNode,
  detectPython,
  detectGo,
  detectRust,
  detectPhp,
  detectDotnet,
  detectJava,
];

/**
 * Detect the stack rooted at `cwd`. When more than one ecosystem's manifest is
 * present (polyglot / monorepo root), prefer the one that yielded a framework;
 * otherwise the highest-priority manifest. A single ecosystem is chosen so the
 * seeded answers never mix conflicting languages.
 */
export function detectStack(cwd: string = process.cwd()): DetectionResult {
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
