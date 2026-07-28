/**
 * Minimal argv handling for the flags payo supports. The CLI is interactive by
 * design, so this stays a hand-rolled dispatcher rather than a parsing library:
 * known informational flags short-circuit before the questionnaire, and any
 * unrecognized argument errors out instead of silently starting the interview.
 */
import pkg from '../../package.json';

export type ArgAction = 'run' | 'version' | 'help' | { unknown: string };

/** Decide what to do with `process.argv.slice(2)`. */
export function parseArgs(argv: string[]): ArgAction {
  const first = argv[0];
  if (first === undefined) return 'run';
  if (first === '--version' || first === '-v') return 'version';
  if (first === '--help' || first === '-h') return 'help';
  return { unknown: first };
}

export function versionText(): string {
  return pkg.version;
}

export function helpText(): string {
  return [
    `payo v${pkg.version} — generate AI-assistant guidance files for your project`,
    '',
    'Usage:',
    '  payo            Start the interactive questionnaire',
    '  payo --version  Print the version and exit',
    '  payo --help     Show this help and exit',
    '',
    'Payo interviews you about your stack and conventions, then writes one',
    'universal layout every skills-compatible tool reads (AGENTS.md plus',
    '.agents/skills/**). Interrupted? Just re-run — your answers are saved.',
    '',
    'Environment variables:',
    '  PAYO_CONCURRENCY       Max parallel agent runs (default: 4)',
    '  PAYO_RETRIES           Extra attempts after a failed run (default: 1)',
    '  PAYO_AGENT_TIMEOUT_MS  Per-run agent timeout in ms (default: 420000)',
    '  PAYO_DIR               Working dir for session state (default: ./.payo)',
    '',
    'Docs & issues: https://github.com/uttam-gelot/payo',
  ].join('\n');
}
