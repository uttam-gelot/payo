import { describe, it, expect } from 'bun:test';
import { registerModule, getModule, listModules, modulesFor } from '../../src/stack/registry';
import '../../src/stack/modules/index';
import type { TechModule } from '../../src/stack/types';

describe('registry', () => {
  it('getModule returns a registered module by id', () => {
    expect(getModule('prisma')?.id).toBe('prisma');
    expect(getModule('nope')).toBeUndefined();
    expect(getModule(123)).toBeUndefined();
  });

  it('listModules includes built-in modules', () => {
    const ids = listModules().map((m) => m.id);
    expect(ids).toContain('nextjs');
    expect(ids).toContain('fastapi');
  });

  it('modulesFor filters by category and appliesTo', () => {
    const fw = modulesFor('framework', { language: 'go', projectType: 'backend' });
    expect(fw.map((m) => m.id).sort()).toEqual(['chi', 'echo', 'fiber', 'gin']);
  });

  it('registerModule adds a module retrievable by id', () => {
    const m: TechModule = {
      id: '__registry_test__',
      title: 'T',
      category: 'framework',
      appliesTo: () => false,
      questions: () => [],
    };
    registerModule(m);
    expect(getModule('__registry_test__')).toBe(m);
  });
});
