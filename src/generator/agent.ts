/**
 * Headless agent execution. Shells out to the user's installed, already-authed
 * CLI agent so payo never manages API keys. Every failure path is non-fatal:
 * callers fall back to static template generation. `runAgent` is async so the
 * orchestrator can run independent skills concurrently in a bounded pool.
 */
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { config } from '../config';
import type { AgentCaps, AgentRunner } from './types';

/** The PATH-probe command for a platform: `where` on Windows, `which` elsewhere. */
export const probeCommand = (platform: NodeJS.Platform = process.platform): string =>
  platform === 'win32' ? 'where' : 'which';

/** True if the runner's binary is resolvable on PATH. */
export function isAvailable(runner: AgentRunner): boolean {
  try {
    const res = spawnSync(probeCommand(), [runner.binary], {
      timeout: config.agent.availabilityProbeMs,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

/** Help text per `binary + helpArgs`, so each CLI is probed at most once. */
const helpCache = new Map<string, string>();

/** Reset the memoized help probes (tests; a CLI upgrade mid-process is not a case). */
export function clearCapsCache(): void {
  helpCache.clear();
}

/**
 * Read a CLI's help output. Some CLIs print help on stderr or exit non-zero for
 * `--help`, so both streams are merged and the exit code ignored — an empty
 * result just means "unknown", handled by the caller.
 */
function helpText(runner: AgentRunner): string {
  const args = runner.helpArgs ?? ['--help'];
  const key = `${runner.binary} ${args.join(' ')}`;
  const cached = helpCache.get(key);
  if (cached !== undefined) return cached;
  let text = '';
  try {
    const res = spawnSync(runner.binary, args, {
      timeout: config.agent.helpProbeMs,
      encoding: 'utf-8',
      maxBuffer: config.agent.helpMaxBytes,
    });
    text = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  } catch {
    text = '';
  }
  helpCache.set(key, text);
  return text;
}

/**
 * Flag support for the installed CLI. A flag counts as supported only when the
 * help text lists it, so a newer-version flag is dropped rather than passed to
 * an older CLI that would abort on an unknown argument. When the probe yields
 * nothing (help unavailable), every flag is reported unsupported: the resulting
 * bare invocation is the widest-compatible one.
 */
export function capsFor(runner: AgentRunner): AgentCaps {
  const text = helpText(runner);
  return {
    // Word-boundary match so `--sandbox` does not also match `--sandbox-mode`
    // and, more importantly, `--add-dir` is not matched inside another flag.
    supports: (flag) => new RegExp(`${flag}(?![\\w-])`).test(text),
  };
}

/** Outcome of the post-selection agent readiness check. */
export interface AgentCheckResult {
  ok: boolean;
  /** Why the check failed: binary missing on PATH, or it ran but didn't behave. */
  reason?: 'not-found' | 'failed';
  /** Short diagnostic when reason is 'failed'. */
  detail?: string;
}

/**
 * Confirms the selected CLI is not just on PATH but actually runs headlessly and
 * responds — catches an installed-but-unauthenticated or otherwise broken CLI
 * right after the user picks it, instead of failing silently at generation time.
 */
export async function checkAgentReady(runner: AgentRunner): Promise<AgentCheckResult> {
  if (!isAvailable(runner)) return { ok: false, reason: 'not-found' };
  const result = await runAgent(
    { ...runner, timeoutMs: config.agent.helloTestMs() },
    'Reply with the single word: ready',
  );
  return result.ok
    ? { ok: true }
    : { ok: false, reason: 'failed', detail: result.stderr ?? result.stdout };
}

export interface AgentResult {
  ok: boolean;
  /** Short diagnostic when ok is false. */
  stderr?: string;
  /**
   * One-line tail of the agent's output. Agents that decline the work (sandbox
   * denial, untrusted directory, permission refusal) still exit 0 and explain
   * themselves in their transcript, so the caller needs it to report why nothing
   * was written.
   */
  stdout?: string;
  /** Full retained transcript (both streams, tails), for the on-disk agent log. */
  transcript?: AgentTranscript;
}

/** Retained output of one run, labelled by stream, for writing to a log file. */
export interface AgentTranscript {
  argv: string[];
  stdout: string;
  stderr: string;
}

/**
 * Run one prompt to completion in the project cwd. The agent is expected to
 * write files itself. Timeout sends SIGTERM (guards the cursor-agent hang bug).
 * Resolves (never rejects) so a failed run is just `{ ok: false }` — including
 * when `spawn()` itself throws synchronously (e.g. an npm-installed CLI's
 * .cmd/.ps1 shim on Windows, which can hit this instead of the normal async
 * 'error' event).
 */
export function runAgent(runner: AgentRunner, prompt: string): Promise<AgentResult> {
  return new Promise((resolve) => {
    const useStdin = runner.promptViaStdin ?? false;
    let args: string[] = [];
    let child: ChildProcess;
    try {
      args = runner.buildArgs(useStdin ? '' : prompt, capsFor(runner));
      child = spawn(runner.binary, args, {
        cwd: process.cwd(),
        // stdin only when we feed the prompt; both output streams are captured —
        // an agent that refuses the task narrates it on stdout and still exits 0.
        stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        ok: false,
        stderr: err instanceof Error ? err.message : String(err),
        transcript: { argv: [runner.binary, ...args], stdout: '', stderr: '' },
      });
      return;
    }

    let stderr = '';
    let stdout = '';
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Escalate to SIGKILL as cleanup, but resolve now: don't wait on the
      // child's `close` event, which Bun on Linux does not reliably emit after
      // a signal kill (would otherwise hang past the wall-clock cap).
      const sigkill = setTimeout(() => child.kill('SIGKILL'), 2_000);
      sigkill.unref?.();
      finish({ ok: false, stderr: 'timed out', stdout: tail(), transcript: transcript() });
    }, runner.timeoutMs ?? config.agent.timeoutMs());

    /**
     * The end of the run's output, collapsed to one line for a single-line
     * report. Agents open with a banner and close with the reason they stopped,
     * so the tail is the informative end; stderr is preferred when present
     * because that is where a hard failure is reported.
     */
    const tail = (): string | undefined => {
      const text = (stderr || stdout).replace(/\s+/g, ' ').trim();
      return text ? text.slice(-config.agent.outputDetailChars) : undefined;
    };

    const transcript = (): AgentTranscript => ({ argv: [runner.binary, ...args], stdout, stderr });

    const finish = (result: AgentResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    // Both streams keep the tail, not the head: CLIs open with a session banner
    // and report the actual failure last, so a head-capped buffer shows only the
    // banner. Slicing on every chunk bounds memory to the cap.
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-config.agent.outputCapBytes);
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = (stdout + chunk.toString()).slice(-config.agent.outputCapBytes);
    });

    if (useStdin) {
      child.stdin?.on('error', () => {}); // ignore EPIPE if the child exits early
      child.stdin?.end(prompt);
    }

    child.on('error', (err) =>
      finish({ ok: false, stderr: err.message, transcript: transcript() }),
    );
    child.on('close', (code) => {
      const base = { stdout: tail(), transcript: transcript() };
      if (timedOut) return finish({ ok: false, stderr: 'timed out', ...base });
      // The exit code, not a slice of the banner: the readable detail is the
      // tail carried in `stdout`, and the full transcript goes to the log.
      if (code !== 0) return finish({ ok: false, stderr: `exited with code ${code}`, ...base });
      finish({ ok: true, ...base });
    });
  });
}
