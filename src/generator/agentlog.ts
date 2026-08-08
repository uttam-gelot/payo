/**
 * On-disk record of a failed agent run. A one-line reason in the CLI cannot
 * carry why a CLI agent declined — the cause is usually buried in a transcript
 * that opens with a session banner. Failures write the full retained output to
 * `.payo/logs/`, so a failed generation is diagnosable after the fact.
 */
import path from 'path';
import { config } from '../config';
import { writeFileAtomic } from '../fsutil';
import type { AgentTranscript } from './agent';

const LOGS_SUBDIR = 'logs';

/** Filesystem-safe log name for one skill's attempt. */
function logName(skillId: string, attempt: number): string {
  return `${skillId.replace(/[^a-zA-Z0-9._-]/g, '-')}-attempt${attempt}.log`;
}

/** Outcome of an attempted log write: at most one of `path` / `error` is set. */
export interface AgentLogResult {
  /** Project-relative log path, set only when the write succeeded. */
  path?: string;
  /** Human-readable failure, set only when the write itself failed. */
  error?: string;
}

/**
 * Write one failed run's transcript. Returns the project-relative log path for
 * the failure report, an error describing why the write failed, or `{}` when
 * there was nothing to record — logging must never turn a recoverable
 * generation failure into a crash, but a write failure must stay visible to
 * the caller rather than vanish silently.
 */
export function writeAgentLog(
  skillId: string,
  attempt: number,
  reason: string,
  prompt: string,
  transcript?: AgentTranscript,
): AgentLogResult {
  if (!transcript) return {};
  const abs = path.join(config.payo.dir(), LOGS_SUBDIR, logName(skillId, attempt));
  const body = [
    `# payo agent log — ${skillId} (attempt ${attempt})`,
    `when: ${new Date().toISOString()}`,
    `cwd: ${process.cwd()}`,
    `argv: ${transcript.argv.join(' ')}`,
    `outcome: ${reason}`,
    '',
    '--- prompt ---',
    prompt,
    '',
    '--- stdout (tail) ---',
    transcript.stdout,
    '',
    '--- stderr (tail) ---',
    transcript.stderr,
    '',
  ].join('\n');
  try {
    writeFileAtomic(abs, body);
    return { path: path.relative(process.cwd(), abs) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
