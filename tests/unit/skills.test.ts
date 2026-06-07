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

  it('always includes project-overview, coding-standards and testing', () => {
    const got = ids(contexts.tsBackend);
    expect(got).toContain('project-overview');
    expect(got).toContain('coding-standards');
    expect(got).toContain('testing');
  });
});
