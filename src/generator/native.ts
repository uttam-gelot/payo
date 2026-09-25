/**
 * Version-aware shim decisions. A tool that learns to read part of the universal
 * layout (e.g. Claude Code reading `AGENTS.md`) no longer needs the shim Payo
 * writes for it — but only from the version that added the support, so older
 * installs keep theirs. Providers declare those thresholds (`nativeSince`); this
 * module probes the installed CLIs once and reports which features each selected
 * tool reads natively.
 *
 * The CLI stashes the result on the answers under `NATIVE_KEY` before generation,
 * so `predictTargets` and `generate` read one decision and never probe. With no
 * stash (programmatic callers, tests) every shim is written, as before. Anything
 * unknown — tool not installed, version unreadable — keeps the shim: skipping
 * one a tool still needs would hide the generated rules from it.
 */
import type { Answers } from '../questions/types';
import type { AgentRunner, AiProvider, NativeFeature } from './types';
import { getProvider } from '../providers/index';
import { isAvailable, installedVersion } from './agent';

/** Answers key the CLI stashes the detection under. */
export const NATIVE_KEY = 'nativeSupport';

/** Per tool id, the features its installed CLI reads natively. */
export type NativeSupport = Record<string, NativeFeature[]>;

/** Injectable probes so detection can be unit-tested without real CLIs. */
export interface NativeDeps {
  resolveProvider: (id: string) => AiProvider | undefined;
  isAvailable: (runner: AgentRunner) => boolean;
  installedVersion: (runner: AgentRunner) => string | undefined;
}

const defaultDeps: NativeDeps = { resolveProvider: getProvider, isAvailable, installedVersion };

/** True when dotted `version` is at or above `min`; missing segments count as 0. */
export function versionAtLeast(version: string, min: string): boolean {
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

/**
 * Probe each tool whose provider declares `nativeSince` and report the features
 * its installed version reads natively. Tools with nothing native are omitted.
 */
export function detectNative(tools: string[], deps: NativeDeps = defaultDeps): NativeSupport {
  const out: NativeSupport = {};
  for (const id of tools) {
    const provider = deps.resolveProvider(id);
    const since = provider?.nativeSince;
    const runner = provider?.agent;
    if (!since || !runner || !deps.isAvailable(runner)) continue;
    const version = deps.installedVersion(runner);
    if (!version) continue;
    const features = (Object.entries(since) as [NativeFeature, string][])
      .filter(([, min]) => versionAtLeast(version, min))
      .map(([feature]) => feature);
    if (features.length > 0) out[id] = features;
  }
  return out;
}

/** Whether the stashed detection says `tool` reads `feature` natively. */
export function readsNatively(answers: Answers, tool: string, feature: NativeFeature): boolean {
  const stash = answers[NATIVE_KEY];
  if (!stash || typeof stash !== 'object') return false;
  const features = (stash as Record<string, unknown>)[tool];
  return Array.isArray(features) && features.includes(feature);
}
