import { describe, it, expect } from 'bun:test';
import { parseArgs, versionText, helpText } from '../../src/cli/argv';
import pkg from '../../package.json';
import { config } from '../../src/config';

describe('parseArgs', () => {
  it('returns run for no arguments', () => {
    expect(parseArgs([])).toBe('run');
  });

  it('recognizes --version and -v', () => {
    expect(parseArgs(['--version'])).toBe('version');
    expect(parseArgs(['-v'])).toBe('version');
  });

  it('recognizes --help and -h', () => {
    expect(parseArgs(['--help'])).toBe('help');
    expect(parseArgs(['-h'])).toBe('help');
  });

  it('flags any other argument as unknown', () => {
    expect(parseArgs(['--yes'])).toEqual({ unknown: '--yes' });
    expect(parseArgs(['init'])).toEqual({ unknown: 'init' });
  });

  it('reports the first argument when several are passed', () => {
    expect(parseArgs(['--nope', '--version'])).toEqual({ unknown: '--nope' });
  });
});

describe('versionText', () => {
  it('matches the package.json version', () => {
    expect(versionText()).toBe(pkg.version);
  });
});

describe('helpText', () => {
  it('documents usage, every env var, and the repo URL', () => {
    const help = helpText();
    expect(help).toContain('Usage:');
    expect(help).toContain('--version');
    expect(help).toContain('--help');
    for (const env of ['PAYO_CONCURRENCY', 'PAYO_RETRIES', 'PAYO_AGENT_TIMEOUT_MS', 'PAYO_DIR']) {
      expect(help).toContain(env);
    }
    expect(help).toContain('https://github.com/uttam-gelot/payo');
  });

  it('prints the defaults the config actually uses', () => {
    // The help text drifted from config once already (it advertised a 120s agent
    // timeout for two releases after the real default moved to 420s).
    const help = helpText();
    expect(help).toContain(`default: ${config.generation.concurrency()}`);
    expect(help).toContain(`default: ${config.generation.retries()}`);
    expect(help).toContain(`default: ${config.agent.timeoutMs()}`);
  });
});
