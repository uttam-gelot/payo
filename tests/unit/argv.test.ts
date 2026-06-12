import { describe, it, expect } from 'bun:test';
import { parseArgs, versionText, helpText } from '../../src/cli/argv';
import pkg from '../../package.json';

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
});
