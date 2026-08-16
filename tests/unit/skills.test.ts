import { describe, it, expect } from 'bun:test';
import { selectSkills } from '../../src/generator/skills';
import { planHooks } from '../../src/generator/hookplan';
import { contexts } from '../fixtures';
import type { Answers } from '../../src/questions/types';

const ids = (a: Answers): string[] => selectSkills(a).map((s) => s.id);

describe('selectSkills', () => {
  it('includes auth, state-management and data-layer when applicable', () => {
    const got = ids({
      ...contexts.tsFullstack,
      authApproach: 'authjs',
      stateManagement: 'zustand',
    });
    expect(got).toContain('auth');
    expect(got).toContain('state-management');
    expect(got).toContain('data-layer');
  });

  it('includes documentation only when artifacts are selected', () => {
    expect(ids(contexts.tsBackend)).not.toContain('documentation');
    expect(ids({ ...contexts.tsBackend, documentation: ['readme'] })).toContain('documentation');
  });

  it('drops auth when set to none', () => {
    expect(ids({ ...contexts.tsBackend, authApproach: 'none' })).not.toContain('auth');
  });

  it('drops state-management for backend projects', () => {
    expect(ids({ ...contexts.tsBackend, stateManagement: 'zustand' })).not.toContain(
      'state-management',
    );
  });

  it('always includes project-overview and coding-standards', () => {
    const got = ids(contexts.tsBackend);
    expect(got).toContain('project-overview');
    expect(got).toContain('coding-standards');
  });

  it('includes testing only when test types are selected', () => {
    expect(ids(contexts.tsBackend)).not.toContain('testing');
    expect(ids({ ...contexts.tsBackend, testTypes: ['unit'] })).toContain('testing');
  });

  it('includes error-handling-logging only when a logger is set', () => {
    expect(ids(contexts.tsBackend)).not.toContain('error-handling-logging');
    expect(ids({ ...contexts.tsBackend, logger: 'pino' })).toContain('error-handling-logging');
  });

  it('describes a centralized in-house logger when logger=centralized', () => {
    const skill = selectSkills({ ...contexts.tsBackend, logger: 'centralized' }).find(
      (s) => s.id === 'error-handling-logging',
    );
    const prompt = skill?.buildPrompt({ ...contexts.tsBackend, logger: 'centralized' }) ?? '';
    expect(prompt).toContain('centralized logger');
    expect(prompt).toContain('no third-party logging library');
    expect(prompt).not.toContain('selected logger (centralized)');
  });

  it('git-workflow names the hook rather than re-ordering the same checks', () => {
    const base: Answers = {
      ...contexts.tsBackend,
      gitWorkflow: 'standard',
      gitleaks: true,
      verifyTiming: 'push',
      formatter: 'prettier',
      linter: 'eslint',
      testRunner: 'vitest',
      testTypes: ['unit'],
    };
    const prompt = (a: Answers): string =>
      selectSkills(a)
        .find((s) => s.id === 'git-workflow')!
        .buildPrompt(a);

    const hooked = prompt({ ...base, hookPlan: planHooks(base, '/nonexistent-greenfield') });
    expect(hooked).toContain('enforces its checks with git hooks');
    expect(hooked).toContain('NOT to run those checks manually');
    expect(hooked).not.toContain('Use gitleaks to scan');
    expect(hooked).not.toContain('before pushing, and only push when they pass');

    // No plan at all (a caller that never computed one) keeps every instruction.
    const plain = prompt(base);
    expect(plain).toContain('Use gitleaks to scan');
    expect(plain).toContain('before pushing, and only push when they pass');
  });

  it('includes change-audit only when opted in', () => {
    expect(ids(contexts.tsBackend)).not.toContain('change-audit');
    expect(ids({ ...contexts.tsBackend, auditSkill: true })).toContain('change-audit');
    expect(ids({ ...contexts.tsBackend, auditSkill: false })).not.toContain('change-audit');
  });

  it('change-audit body and prompt reflect the chosen timing and stay smart-select', () => {
    const commit: Answers = { ...contexts.tsBackend, auditSkill: true, auditTiming: 'commit' };
    const push: Answers = { ...contexts.tsBackend, auditSkill: true, auditTiming: 'push' };
    const skill = (a: Answers) => selectSkills(a).find((s) => s.id === 'change-audit')!;

    expect(skill(commit).staticBody!(commit)).toContain('committing');
    expect(skill(push).staticBody!(push)).toContain('pushing');
    expect(skill(push).buildPrompt(push)).toContain('git log @{u}..');
    // Must not tell the agent to read every skill.
    expect(skill(commit).buildPrompt(commit).toLowerCase()).toContain('do not read');
    expect(skill(commit).staticBody!(commit)).toContain('.agents/skills/');
  });

  it('change-audit ends by recording a pass, keyed to the gate for each timing', () => {
    const commit: Answers = { ...contexts.tsBackend, auditSkill: true, auditTiming: 'commit' };
    const push: Answers = { ...contexts.tsBackend, auditSkill: true, auditTiming: 'push' };
    const skill = (a: Answers) => selectSkills(a).find((s) => s.id === 'change-audit')!;

    // Blocking wording: the receipt is written only on a clean audit.
    const pushBody = skill(push).staticBody!(push);
    expect(pushBody).toContain('If, and only if, the report shows no blocking conflict');
    // Push keys the receipt on HEAD; commit on the staged-tree hash — same command
    // the native gate compares, so the two can never disagree.
    expect(pushBody).toContain(
      'git rev-parse HEAD 2>/dev/null > "$(git rev-parse --git-dir)/payo-audit-receipt"',
    );
    expect(skill(commit).staticBody!(commit)).toContain(
      'git diff --staged 2>/dev/null | git hash-object --stdin 2>/dev/null > "$(git rev-parse --git-dir)/payo-audit-receipt"',
    );
    // The AI meta-prompt carries the same final step.
    expect(skill(push).buildPrompt(push)).toContain('payo-audit-receipt');
  });

  it('change-audit refuses to re-run whatever the hook already runs', () => {
    // Without this the audit reads git-workflow, sees "run the checks", and runs
    // everything the hook is about to run on push.
    const base: Answers = {
      ...contexts.tsBackend,
      auditSkill: true,
      auditTiming: 'push',
      gitleaks: true,
      verifyTiming: 'push',
      linter: 'eslint',
      testRunner: 'vitest',
      testTypes: ['unit'],
    };
    const a: Answers = { ...base, hookPlan: planHooks(base, '/nonexistent-greenfield') };
    const skill = selectSkills(a).find((s) => s.id === 'change-audit')!;

    const body = skill.staticBody!(a);
    expect(body).toContain('Never run tests, linters, formatters or secret scanners here');
    expect(body).toContain('`lefthook` runs');
    expect(body).toContain('ignore any instruction');
    expect(skill.buildPrompt(a)).toContain('never runs tests, linters, formatters or secret');

    // No hook covers anything → nothing to defer to, so the exclusion is absent.
    const plain = selectSkills(base).find((s) => s.id === 'change-audit')!;
    expect(plain.staticBody!(base)).not.toContain('Never run tests');
    expect(plain.buildPrompt(base)).not.toContain('never runs tests');
  });

  it('change-audit description names only the chosen timing', () => {
    const spec = (a: Answers) => selectSkills(a).find((s) => s.id === 'change-audit')!;

    const commit = spec({ ...contexts.tsBackend, auditSkill: true, auditTiming: 'commit' });
    expect(commit.description).toContain('committing');
    expect(commit.description).not.toContain('pushing');

    const push = spec({ ...contexts.tsBackend, auditSkill: true, auditTiming: 'push' });
    expect(push.description).toContain('pushing to a remote');
    expect(push.description).not.toContain('committing');
  });

  it('api-conventions prescribes /v1 normally, documents reality under detect-everything', () => {
    const base: Answers = { ...contexts.tsBackend, apiArchitecture: 'rest' };
    const spec = (a: Answers) => selectSkills(a).find((s) => s.id === 'api-conventions')!;

    expect(spec(base).buildPrompt(base)).toContain('/v1');

    const detect: Answers = { ...base, detectEverything: true };
    const prompt = spec(detect).buildPrompt(detect);
    expect(prompt).not.toContain('/v1');
    expect(prompt).toContain('versioning scheme IF');
    expect(prompt.toLowerCase()).toContain('do not');
  });

  it('applies git-workflow when conventions/policies are set but gitWorkflow is skipped', () => {
    expect(ids({ ...contexts.tsBackend, gitWorkflow: 'none' })).not.toContain('git-workflow');
    expect(ids({ ...contexts.tsBackend, branchNaming: 'kebab' })).toContain('git-workflow');
    expect(ids({ ...contexts.tsBackend, confirmPush: true })).toContain('git-workflow');
  });

  it('git-workflow prompt includes detected branch/commit conventions', () => {
    const a: Answers = {
      ...contexts.tsBackend,
      gitWorkflow: 'standard',
      branchNaming: 'type-slash',
      commitConvention: 'conventional',
    };
    const prompt = selectSkills(a)
      .find((s) => s.id === 'git-workflow')!
      .buildPrompt(a);
    expect(prompt).toContain('type-prefixed branches');
    expect(prompt).toContain('Conventional Commits');
  });

  it('adds the destructive-SQL/migration guard to data-layer only when dbSafety is set', () => {
    const on: Answers = { ...contexts.tsBackend, dbSafety: true };
    const withGuard = selectSkills(on).find((s) => s.id === 'data-layer');
    expect(withGuard?.buildPrompt(on)).toContain('without explicit');

    const without = selectSkills(contexts.tsBackend).find((s) => s.id === 'data-layer');
    expect(without?.buildPrompt(contexts.tsBackend)).not.toContain('without explicit');
  });

  it('applies git-workflow and adds gitleaks guidance when gitleaks is set', () => {
    expect(ids({ ...contexts.tsBackend, gitleaks: true })).toContain('git-workflow');

    const a: Answers = { ...contexts.tsBackend, gitWorkflow: 'standard', gitleaks: true };
    const prompt = selectSkills(a)
      .find((s) => s.id === 'git-workflow')!
      .buildPrompt(a);
    expect(prompt).toContain('gitleaks');

    const off: Answers = { ...contexts.tsBackend, gitWorkflow: 'standard' };
    const offPrompt = selectSkills(off)
      .find((s) => s.id === 'git-workflow')!
      .buildPrompt(off);
    expect(offPrompt).not.toContain('gitleaks');
  });

  it('adds .env-read guidance to coding-standards when envExampleOnly is set', () => {
    const a: Answers = { ...contexts.tsBackend, envExampleOnly: true };
    const skill = selectSkills(a).find((s) => s.id === 'coding-standards');
    expect(skill?.buildPrompt(a)).toContain('never read or open the real .env file');

    const without = selectSkills(contexts.tsBackend).find((s) => s.id === 'coding-standards');
    expect(without?.buildPrompt(contexts.tsBackend)).not.toContain(
      'never read or open the real .env file',
    );
  });

  describe('skillSelection filter', () => {
    it('returns the full applicable set when skillSelection is unset (regression guard)', () => {
      expect(ids(contexts.tsBackend)).toEqual(
        ids({ ...contexts.tsBackend, skillSelection: undefined }),
      );
    });

    it('narrows to exactly the chosen ids, in declared order', () => {
      const all = ids(contexts.tsBackend);
      const got = ids({ ...contexts.tsBackend, skillSelection: ['coding-standards', 'tooling'] });
      expect(got).toEqual(all.filter((id) => ['coding-standards', 'tooling'].includes(id)));
    });

    it('silently ignores a selected id no longer in the applicable set', () => {
      const got = ids({ ...contexts.tsBackend, skillSelection: ['coding-standards', 'auth'] });
      expect(got).toEqual(['coding-standards']);
    });

    it('an empty selection yields no skills at all', () => {
      expect(ids({ ...contexts.tsBackend, skillSelection: [] })).toEqual([]);
    });
  });
});
