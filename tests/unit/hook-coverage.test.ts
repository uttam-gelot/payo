import { describe, it, expect } from 'bun:test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import { capabilitiesIn, detectHooks, coversCapability } from '../../src/detect/hooks';

const write = (dir: string, rel: string, body: string): void => {
  const abs = join(dir, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
};

describe('capabilitiesIn', () => {
  it('recognises secret scanners beyond gitleaks', () => {
    expect(capabilitiesIn('trufflehog filesystem .')).toEqual(['secret-scan']);
    expect(capabilitiesIn('detect-secrets scan')).toEqual(['secret-scan']);
    expect(capabilitiesIn('ggshield secret scan pre-commit')).toContain('secret-scan');
  });

  it('recognises test runners across ecosystems', () => {
    for (const cmd of ['bun test', 'pnpm run test', 'pytest -q', 'go test ./...', 'cargo test']) {
      expect(capabilitiesIn(cmd)).toContain('verify');
    }
  });

  it('does not read the bare word "test" inside another token as a test run', () => {
    // The previous whole-file /\btest\b/ suppressed the verify check on repos
    // that ran no tests at all.
    expect(capabilitiesIn('run: echo "latest release"')).not.toContain('verify');
    expect(capabilitiesIn('run: ./scripts/protest.sh')).not.toContain('verify');
  });

  it('treats lint-staged as lint coverage', () => {
    expect(capabilitiesIn('npx lint-staged')).toContain('lint');
  });

  it('separates format from lint', () => {
    expect(capabilitiesIn('prettier --check .')).toContain('format');
    expect(capabilitiesIn('eslint .')).toEqual(['lint']);
  });

  it('is empty for blank text', () => {
    expect(capabilitiesIn('   \n ')).toEqual([]);
  });
});

describe('detectHooks — per-stage coverage', () => {
  it('returns null when the repo has no runner', () =>
    inTempProject(() => {
      expect(detectHooks()).toBeNull();
    }));

  it('attributes lefthook commands to the stage that declares them', () =>
    inTempProject((dir) => {
      write(
        dir,
        'lefthook.yml',
        [
          'pre-commit:',
          '  commands:',
          '    lint:',
          '      run: eslint .',
          'pre-push:',
          '  commands:',
          '    secrets:',
          '      run: gitleaks detect',
          '',
        ].join('\n'),
      );
      const hooks = detectHooks()!;
      expect(hooks.runner).toBe('lefthook');
      expect(hooks.coverage['pre-commit']).toEqual(['lint']);
      expect(hooks.coverage['pre-push']).toEqual(['secret-scan']);
      expect(coversCapability(hooks.coverage, 'verify')).toBe(false);
    }));

  it('reads husky hook scripts per stage', () =>
    inTempProject((dir) => {
      write(dir, '.husky/pre-commit', '#!/usr/bin/env sh\nnpx lint-staged\n');
      write(dir, '.husky/pre-push', '#!/usr/bin/env sh\nbun test\n');
      const hooks = detectHooks()!;
      expect(hooks.runner).toBe('husky');
      expect(hooks.coverage['pre-commit']).toEqual(['lint']);
      expect(hooks.coverage['pre-push']).toEqual(['verify']);
    }));

  it('defaults a pre-commit-framework hook to the commit stage unless it declares push', () =>
    inTempProject((dir) => {
      write(
        dir,
        '.pre-commit-config.yaml',
        [
          'repos:',
          '  - repo: local',
          '    hooks:',
          '      - id: black',
          '        entry: black',
          '      - id: pytest',
          '        entry: pytest',
          '        stages: [push]',
          '',
        ].join('\n'),
      );
      const hooks = detectHooks()!;
      expect(hooks.runner).toBe('pre-commit');
      expect(hooks.coverage['pre-commit']).toEqual(['format']);
      expect(hooks.coverage['pre-push']).toEqual(['verify']);
    }));

  it('detects simple-git-hooks configured in package.json', () =>
    inTempProject((dir) => {
      write(
        dir,
        'package.json',
        JSON.stringify({ 'simple-git-hooks': { 'pre-commit': 'npx eslint .' } }),
      );
      const hooks = detectHooks()!;
      expect(hooks.runner).toBe('simple-git-hooks');
      expect(hooks.configPath).toBe('package.json');
      expect(hooks.coverage['pre-commit']).toEqual(['lint']);
    }));

  it('detects lefthook installed from npm with no config file', () =>
    inTempProject((dir) => {
      write(dir, 'package.json', JSON.stringify({ devDependencies: { lefthook: '^1.0.0' } }));
      expect(detectHooks()?.runner).toBe('lefthook');
    }));

  it('detects a committed .githooks directory as a native runner', () =>
    inTempProject((dir) => {
      write(dir, '.githooks/pre-push', '#!/bin/sh\ngitleaks detect\n');
      const hooks = detectHooks()!;
      expect(hooks.runner).toBe('native');
      expect(hooks.configPath).toBe('.githooks');
      expect(hooks.coverage['pre-push']).toEqual(['secret-scan']);
    }));

  it('reports empty coverage for a runner whose hooks do nothing recognisable', () =>
    inTempProject((dir) => {
      write(dir, '.husky/pre-commit', '#!/usr/bin/env sh\necho hi\n');
      const hooks = detectHooks()!;
      expect(hooks.coverage['pre-commit']).toEqual([]);
      expect(hooks.coverage['pre-push']).toEqual([]);
    }));
});
