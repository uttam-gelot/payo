import { describe, it, expect } from 'bun:test';
import { selectSkills } from '../../src/generator/skills';
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

  it('adds .env-read guidance to coding-standards when envExampleOnly is set', () => {
    const a: Answers = { ...contexts.tsBackend, envExampleOnly: true };
    const skill = selectSkills(a).find((s) => s.id === 'coding-standards');
    expect(skill?.buildPrompt(a)).toContain('never read or open the real .env file');

    const without = selectSkills(contexts.tsBackend).find((s) => s.id === 'coding-standards');
    expect(without?.buildPrompt(contexts.tsBackend)).not.toContain(
      'never read or open the real .env file',
    );
  });
});
