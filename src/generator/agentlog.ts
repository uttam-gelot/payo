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

/**
 * Write one failed run's transcript. Returns the project-relative log path for
 * the failure report, or undefined when there was nothing to record or the write
 * failed — logging must never turn a recoverable generation failure into a crash.
 */
export function writeAgentLog(
  skillId: string,
  attempt: number,
  reason: string,
  prompt: string,
  transcript?: AgentTranscript,
): string | undefined {
  if (!transcript) return undefined;
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
    return path.relative(process.cwd(), abs);
  } catch {
    return undefined;
  }
}
