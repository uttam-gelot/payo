import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { generate } from '../../src/generator/index';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';
import type { Answers } from '../../src/questions/types';

/** A repo that already lints staged files through husky, and nothing more. */
function seedHusky(dir: string): string {
  const hook = '#!/usr/bin/env sh\nnpx lint-staged\n';
  mkdirSync(join(dir, '.husky'), { recursive: true });
  writeFileSync(join(dir, '.husky/pre-commit'), hook);
  return hook;
}

const withHusky = (extra: Answers = {}): Answers => ({
  ...fullStackAnswers('claude'),
  gitleaks: true,
  existingHooks: {
    runner: 'husky',
    configPath: '.husky',
    coverage: { 'pre-commit': ['lint'], 'pre-push': [] },
  },
  ...extra,
});

describe('generate() — an existing hook runner', () => {
  beforeEach(() => setAgentOverride({ isAvailable: false }));
  afterEach(() => resetAgentOverride());

  it('is left byte-identical when the user keeps their setup', async () => {
    await inTempProject(async (dir) => {
      const before = seedHusky(dir);
      await generate(withHusky({ hookPolicy: 'leave' }));

      expect(readFileSync(join(dir, '.husky/pre-commit'), 'utf-8')).toBe(before);
      expect(existsSync(join(dir, '.husky/pre-push'))).toBe(false);
      // And no second runner is dropped in beside theirs.
      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);
    });
  });

  it('still gets full guidance for the checks nothing runs', async () => {
    await inTempProject(async (dir) => {
      seedHusky(dir);
      await generate(withHusky({ hookPolicy: 'leave' }));

      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      // husky lints, so the agent is told not to; nothing else is automated.
      expect(agents).toContain('`husky` runs the linter at pre-commit');
      expect(agents).toContain('Scan for secrets with gitleaks');
      expect(agents).toContain('Run the formatter and tests before pushing');
    });
  });

  it('adds only the uncovered checks when the user opts into merging', async () => {
    await inTempProject(async (dir) => {
      seedHusky(dir);
      await generate(withHusky({ hookPolicy: 'merge' }));

      const preCommit = readFileSync(join(dir, '.husky/pre-commit'), 'utf-8');
      expect(preCommit).toContain('npx lint-staged'); // their line, untouched
      expect(preCommit).not.toContain('payo-lint'); // lint already covered

      const prePush = readFileSync(join(dir, '.husky/pre-push'), 'utf-8');
      expect(prePush).toContain('payo-secret-scan');
      expect(prePush).toContain('payo-verify');
      expect(prePush).toContain('payo-format');
      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);

      // Now that the hook runs them, the agent is told to stop doing so.
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(agents).toContain('Do not run those checks yourself first');
      expect(agents).not.toContain('Scan for secrets with gitleaks');
    });
  });

  it('writes lefthook.yml only when the repo has no runner of its own', async () => {
    await inTempProject(async (dir) => {
      await generate({ ...fullStackAnswers('claude'), gitleaks: true });
      const yml = readFileSync(join(dir, 'lefthook.yml'), 'utf-8');
      expect(yml).toContain('payo-secret-scan');
      expect(yml).toContain('payo-verify');
      expect(yml).toContain('payo-lint');
      expect(yml).toContain('payo-format');
    });
  });

  it('ignores a runner choice on a repo that already has one', async () => {
    await inTempProject(async (dir) => {
      // The question is never asked here, but a resumed session could still
      // carry the answer — it must not create a second runner beside theirs.
      const before = seedHusky(dir);
      await generate(withHusky({ hookPolicy: 'leave', hookRunner: 'lefthook' }));

      expect(readFileSync(join(dir, '.husky/pre-commit'), 'utf-8')).toBe(before);
      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);
    });
  });
});

describe('generate() — a greenfield repo with a chosen runner', () => {
  beforeEach(() => setAgentOverride({ isAvailable: false }));
  afterEach(() => resetAgentOverride());

  it('writes that runner and names it in the generated guidance', async () => {
    await inTempProject(async (dir) => {
      await generate({ ...fullStackAnswers('claude'), gitleaks: true, hookRunner: 'husky' });

      expect(readFileSync(join(dir, '.husky/pre-push'), 'utf-8')).toContain('payo-secret-scan');
      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);
      expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('`husky` runs');
    });
  });

  it('writes no runner, and keeps the manual instructions, when none is chosen', async () => {
    await inTempProject(async (dir) => {
      await generate({ ...fullStackAnswers('claude'), gitleaks: true, hookRunner: 'none' });

      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);
      expect(existsSync(join(dir, '.husky'))).toBe(false);
      // Nothing is automated, so the agent is still asked to do it all by hand.
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(agents).toContain('Scan for secrets with gitleaks');
      expect(agents).not.toContain('runs the linter');
    });
  });
});
