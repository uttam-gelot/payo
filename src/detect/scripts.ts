/**
 * Deterministic hints from the root package.json `scripts` block. A hybrid
 * repo's scripts often name the stacks its manifests hide from the root
 * ecosystem (`cargo build --workspace`, `bun --watch`, an e2e vitest config),
 * so they are cheap polyglot evidence. Hints are fill-only: detectStack uses
 * them to widen `secondary`/projectType and seed blank test answers, never to
 * override a manifest- or lockfile-derived fact.
 */
import { readJson } from './manifest';

export interface ScriptSignals {
  /** Languages the scripts invoke tooling for (rust, go, python). */
  languages: Set<string>;
  /** Runtimes the scripts run on (bun, deno). */
  runtimes: Set<string>;
  /** Detected e2e tool, or 'vitest' when a dedicated e2e vitest config is run. */
  e2e?: string;
}

const LANGUAGE_HINTS: readonly (readonly [RegExp, string])[] = [
  [/\bcargo\s+(build|run|test|check|clippy|fmt)\b/, 'rust'],
  [/\bgo\s+(build|run|test|vet)\b/, 'go'],
  [/\b(pytest|uv\s+run|poetry\s+run)\b/, 'python'],
];

const RUNTIME_HINTS: readonly (readonly [RegExp, string])[] = [
  [/\bbun(x)?\s/, 'bun'],
  [/\bdeno\s+(run|task|test)\b/, 'deno'],
];

const E2E_HINTS: readonly (readonly [RegExp, string])[] = [
  [/\bplaywright\b/, 'playwright'],
  [/\bcypress\b/, 'cypress'],
  // A vitest run pointed at a dedicated e2e config marks vitest-driven e2e.
  [/\bvitest\b[^&|;]*(--config\s+\S*e2e|vitest\.config\.e2e)/, 'vitest'],
];

/** Scan the root package.json scripts for stack hints; empty sets when none. */
export function scriptSignals(cwd: string): ScriptSignals {
  const out: ScriptSignals = { languages: new Set(), runtimes: new Set() };
  const pkg = readJson(cwd, 'package.json');
  const scripts = pkg?.scripts;
  if (!scripts || typeof scripts !== 'object') return out;
  for (const value of Object.values(scripts as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    for (const [re, lang] of LANGUAGE_HINTS) if (re.test(value)) out.languages.add(lang);
    for (const [re, rt] of RUNTIME_HINTS) if (re.test(value)) out.runtimes.add(rt);
    if (out.e2e === undefined) {
      for (const [re, tool] of E2E_HINTS) {
        if (re.test(value)) {
          out.e2e = tool;
          break;
        }
      }
    }
  }
  return out;
}
