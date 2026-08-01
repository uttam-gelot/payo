import { describe, it, expect } from 'bun:test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import {
  desiredChecks,
  planHooks,
  isAutomated,
  runnerLabel,
  type HookPlan,
} from '../../src/generator/hookplan';

const NODE = {
  language: 'typescript',
  packageManager: 'bun',
  testRunner: 'bun-test',
  linter: 'eslint',
  formatter: 'prettier',
};

const write = (dir: string, rel: string, body: string): void => {
  const abs = join(dir, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
};

describe('desiredChecks', () => {
  it('covers all three verify tools at the stage verifyTiming names', () => {
    const checks = desiredChecks({ ...NODE, verifyTiming: 'push' });
    expect(checks.map((c) => c.capability).sort()).toEqual(['format', 'lint', 'verify']);
    expect(checks.every((c) => c.stage === 'pre-push')).toBe(true);
    expect(checks.find((c) => c.capability === 'lint')?.run).toBe('bunx eslint .');
    expect(checks.find((c) => c.capability === 'format')?.run).toBe('bunx prettier --check .');
  });

  it('pins the secret scan to pre-push regardless of verify timing', () => {
    const checks = desiredChecks({ ...NODE, gitleaks: true, verifyTiming: 'commit' });
    const scan = checks.find((c) => c.capability === 'secret-scan')!;
    expect(scan.stage).toBe('pre-push');
    expect(checks.find((c) => c.capability === 'verify')?.stage).toBe('pre-commit');
  });

  it('only emits a formatter check that cannot rewrite files', () => {
    const py = desiredChecks({ language: 'python', formatter: 'black', verifyTiming: 'commit' });
    expect(py.find((c) => c.capability === 'format')?.run).toBe('black --check .');
  });

  it('skips a tool with no standalone hook command', () => {
    // Checkstyle only runs through the build — a guessed command would block
    // every commit, so no check is emitted for it.
    const java = desiredChecks({ language: 'java', linter: 'checkstyle', verifyTiming: 'commit' });
    expect(java.some((c) => c.capability === 'lint')).toBe(false);
  });

  it('does not emit the same command twice when one tool lints and formats', () => {
    const ruby = desiredChecks({
      language: 'ruby',
      linter: 'rubocop',
      formatter: 'rubocop',
      verifyTiming: 'commit',
    });
    expect(ruby.filter((c) => c.run === 'bundle exec rubocop').length).toBe(1);
  });

  it('emits nothing without gitleaks or a verify timing', () => {
    expect(desiredChecks(NODE)).toEqual([]);
  });
});

describe('planHooks — greenfield', () => {
  it('writes every wanted check when the repo has no runner', () =>
    inTempProject(() => {
      const plan = planHooks({ ...NODE, gitleaks: true, verifyTiming: 'push' });
      // An unanswered hookRunner keeps the historical default.
      expect(plan.runner).toBe('lefthook');
      expect(plan.greenfield).toBe(true);
      expect(runnerLabel(plan)).toBe('lefthook');
      expect(plan.write.length).toBe(4);
      expect(plan.covered).toEqual([]);
      expect(plan.deferred).toEqual([]);
      expect(plan.readOnly).toBe(false);
    }));

  it('is readOnly when the answers ask for no checks', () =>
    inTempProject(() => {
      expect(planHooks(NODE).readOnly).toBe(true);
    }));

  it('carries the chosen runner and its config path', () =>
    inTempProject(() => {
      const wanted = { ...NODE, gitleaks: true, verifyTiming: 'push' };
      const cases: [string, string][] = [
        ['lefthook', 'lefthook.yml'],
        ['husky', '.husky'],
        ['pre-commit', '.pre-commit-config.yaml'],
        ['native', '.githooks'],
      ];
      for (const [hookRunner, configPath] of cases) {
        const plan = planHooks({ ...wanted, hookRunner });
        expect(plan.runner).toBe(hookRunner as HookPlan['runner']);
        expect(plan.greenfield).toBe(true);
        expect(plan.configPath).toBe(configPath);
        expect(plan.write.length).toBe(4);
        expect(runnerLabel(plan)).toBe(hookRunner);
      }
    }));

  it('defers every check when the user wants no runner at all', () =>
    inTempProject(() => {
      const plan = planHooks({ ...NODE, gitleaks: true, verifyTiming: 'push', hookRunner: 'none' });
      expect(plan.write).toEqual([]);
      expect(plan.deferred.length).toBe(4);
      expect(plan.configPath).toBeUndefined();
      expect(plan.readOnly).toBe(true);
      // Nothing is automated, so the prose must keep asking for all of it.
      expect(isAutomated(plan, 'verify')).toBe(false);
    }));
});

describe('planHooks — existing runner', () => {
  it('marks a capability the runner already has as covered, at either stage', () =>
    inTempProject((dir) => {
      // Tests run at pre-commit; asking for them again at pre-push would just
      // double the wait.
      write(dir, '.husky/pre-commit', '#!/usr/bin/env sh\nbun test\n');
      const plan = planHooks({ ...NODE, verifyTiming: 'push', hookPolicy: 'merge' });
      expect(plan.runner).toBe('husky');
      expect(plan.covered.map((c) => c.capability)).toEqual(['verify']);
      expect(plan.write.map((c) => c.capability).sort()).toEqual(['format', 'lint']);
    }));

  it('recognises a different tool in the same capability class', () =>
    inTempProject((dir) => {
      write(dir, '.husky/pre-push', '#!/usr/bin/env sh\ntrufflehog filesystem .\n');
      const plan = planHooks({ ...NODE, gitleaks: true, hookPolicy: 'merge' });
      expect(plan.covered.map((c) => c.capability)).toEqual(['secret-scan']);
      expect(plan.write).toEqual([]);
    }));

  it('defers everything when the user keeps their setup', () =>
    inTempProject((dir) => {
      write(dir, '.husky/pre-commit', '#!/usr/bin/env sh\nnpx lint-staged\n');
      const plan = planHooks({
        ...NODE,
        gitleaks: true,
        verifyTiming: 'push',
        hookPolicy: 'leave',
      });
      expect(plan.write).toEqual([]);
      expect(plan.readOnly).toBe(true);
      expect(plan.covered.map((c) => c.capability)).toEqual(['lint']);
      expect(plan.deferred.map((c) => c.capability).sort()).toEqual([
        'format',
        'secret-scan',
        'verify',
      ]);
    }));

  it('never writes into simple-git-hooks, whatever the policy', () =>
    inTempProject((dir) => {
      write(dir, 'package.json', JSON.stringify({ 'simple-git-hooks': { 'pre-commit': 'echo' } }));
      const plan = planHooks({ ...NODE, gitleaks: true, hookPolicy: 'merge' });
      expect(plan.runner).toBe('simple-git-hooks');
      expect(plan.write).toEqual([]);
      expect(plan.deferred.map((c) => c.capability)).toEqual(['secret-scan']);
    }));

  it('prefers the coverage recorded during detection over re-reading the repo', () =>
    inTempProject(() => {
      const plan = planHooks({
        ...NODE,
        gitleaks: true,
        hookPolicy: 'merge',
        existingHooks: {
          runner: 'lefthook',
          configPath: 'lefthook.yml',
          coverage: { 'pre-commit': [], 'pre-push': ['secret-scan'] },
        },
      });
      expect(plan.runner).toBe('lefthook');
      expect(plan.covered.map((c) => c.capability)).toEqual(['secret-scan']);
    }));
});

describe('isAutomated', () => {
  it('is true for a check any hook runs, written or already present', () =>
    inTempProject((dir) => {
      write(dir, '.husky/pre-push', '#!/usr/bin/env sh\ngitleaks detect\n');
      const plan = planHooks({
        ...NODE,
        gitleaks: true,
        verifyTiming: 'push',
        hookPolicy: 'merge',
      });
      expect(isAutomated(plan, 'secret-scan')).toBe(true); // covered
      expect(isAutomated(plan, 'verify')).toBe(true); // written
    }));

  it('is false for a deferred check — nobody runs it', () =>
    inTempProject((dir) => {
      write(dir, '.husky/pre-commit', '#!/usr/bin/env sh\necho hi\n');
      const plan = planHooks({ ...NODE, gitleaks: true, hookPolicy: 'leave' });
      expect(isAutomated(plan, 'secret-scan')).toBe(false);
    }));

  it('is false without a plan', () => {
    expect(isAutomated(undefined, 'verify')).toBe(false);
  });
});
