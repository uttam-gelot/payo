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

  it('describes a centralized in-house logger when logger=custom', () => {
    const skill = selectSkills({ ...contexts.tsBackend, logger: 'custom' }).find(
      (s) => s.id === 'error-handling-logging',
    );
    const prompt = skill?.buildPrompt({ ...contexts.tsBackend, logger: 'custom' }) ?? '';
    expect(prompt).toContain('centralized logger');
    expect(prompt).toContain('no third-party logging library');
    expect(prompt).not.toContain('selected logger (custom)');
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
