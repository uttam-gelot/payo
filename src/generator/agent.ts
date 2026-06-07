/**
 * Headless agent execution. Shells out to the user's installed, already-authed
 * CLI agent so payo never manages API keys. Every failure path is non-fatal:
 * callers fall back to static template generation. `runAgent` is async so the
 * orchestrator can run independent skills concurrently in a bounded pool.
 */
import { spawn, spawnSync } from 'child_process';
import { config } from '../config';
import type { AgentRunner } from './types';

/** True if the runner's binary is resolvable on PATH. */
export function isAvailable(runner: AgentRunner): boolean {
  try {
    const res = spawnSync('which', [runner.binary], { timeout: config.agent.availabilityProbeMs });
    return res.status === 0;
  } catch {
    return false;
  }
}

export interface AgentResult {
  ok: boolean;
  /** Short diagnostic when ok is false. */
  stderr?: string;
}

/**
 * Run one prompt to completion in the project cwd. The agent is expected to
 * write files itself. Timeout sends SIGTERM (guards the cursor-agent hang bug).
 * Resolves (never rejects) so a failed run is just `{ ok: false }`.
 */
export function runAgent(runner: AgentRunner, prompt: string): Promise<AgentResult> {
  return new Promise((resolve) => {
    const useStdin = runner.promptViaStdin ?? false;
    const args = runner.buildArgs(useStdin ? '' : prompt);
    const child = spawn(runner.binary, args, {
      cwd: process.cwd(),
      // stdin only when we feed the prompt; ignore stdout; capture stderr.
      stdio: [useStdin ? 'pipe' : 'ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
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
      finish({ ok: false, stderr: 'timed out' });
    }, runner.timeoutMs ?? config.agent.timeoutMs());

    const finish = (result: AgentResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < config.agent.stderrCapBytes) stderr += chunk.toString();
    });

    if (useStdin) {
      child.stdin?.on('error', () => {}); // ignore EPIPE if the child exits early
      child.stdin?.end(prompt);
    }

    child.on('error', (err) => finish({ ok: false, stderr: err.message }));
    child.on('close', (code) => {
      if (timedOut) return finish({ ok: false, stderr: 'timed out' });
      if (code !== 0) {
        const detail = stderr.trim().slice(0, config.agent.stderrDetailChars);
        return finish({ ok: false, stderr: detail || `exited with code ${code}` });
      }
      finish({ ok: true });
    });
  });
}
