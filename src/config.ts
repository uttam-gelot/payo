/**
 * Central runtime configuration. Every tunable knob and its environment-variable
 * override lives here, so behavior is configured in one place instead of being
 * scattered across modules. Env-backed values are exposed as functions so an
 * override set at runtime (or in a test) is always honored, not frozen at import.
 */
import path from 'path';

/** Parse an int env var, falling back when unset/invalid or below `min`. */
function intEnv(name: string, fallback: number, min: number): number {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v >= min ? v : fallback;
}

export const config = {
  /** Skill-generation orchestration. */
  generation: {
    /** Max agent subprocesses running at once (>=1). Env: PAYO_CONCURRENCY. */
    concurrency: (): number => intEnv('PAYO_CONCURRENCY', 4, 1),
    /** Extra attempts after a skill's first failure (>=0). Env: PAYO_RETRIES. */
    retries: (): number => intEnv('PAYO_RETRIES', 1, 0),
  },

  /** Headless CLI-agent execution. */
  agent: {
    /**
     * Hard wall-clock cap per run (ms). Env: PAYO_AGENT_TIMEOUT_MS.
     * Authoring one SKILL.md routinely takes minutes on a loaded machine — with
     * several agents in flight at once, 2 minutes killed healthy runs.
     */
    timeoutMs: (): number => intEnv('PAYO_AGENT_TIMEOUT_MS', 420_000, 1),
    /** Timeout for the `which <binary>` availability probe (ms). */
    availabilityProbeMs: 5_000,
    /** Timeout for the `<binary> --help` flag-support probe (ms). */
    helpProbeMs: 10_000,
    /** Max bytes of help output read by the flag-support probe. */
    helpMaxBytes: 1_000_000,
    /** Max bytes retained (tail) per output stream of a run. */
    outputCapBytes: 32_000,
    /** Chars of that tail surfaced inline in the failure diagnostic. */
    outputDetailChars: 300,
  },

  /** Project-local working dir for all payo state (session, staging). */
  payo: {
    /** Root holding the session file and single-file staging. Env: PAYO_DIR. */
    dir: (): string => process.env.PAYO_DIR ?? path.join(process.cwd(), '.payo'),
  },
} as const;
