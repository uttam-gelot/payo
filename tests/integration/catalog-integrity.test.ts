import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index';
import { listModules } from '../../src/stack/registry';
import { recommendedAnswer } from '../../src/questions/recommend';
import { frameworkOptions, ormOptions } from '../../src/questions/options';
import { allContexts } from '../fixtures';

/** Structural invariants the hand-written module catalog must uphold. */
describe('module catalog integrity', () => {
  const modules = listModules();

  it('module ids are unique', () => {
    const ids = modules.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each option value equals its module id (so expandSelected resolves follow-ups)', () => {
    const mismatches: string[] = [];
    for (const m of modules) {
      for (const o of m.options?.({}) ?? []) {
        if (o.value !== m.id) mismatches.push(`${m.id} -> ${o.value}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every module follow-up question has a recommended default', () => {
    const missing: string[] = [];
    for (const m of modules) {
      for (const q of m.questions({})) {
        if (recommendedAnswer(q, {}) === undefined) missing.push(`${m.id}/${q.id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('at most one recommended framework / ORM per context', () => {
    const multi: string[] = [];
    for (const a of allContexts) {
      if (frameworkOptions(a).filter((o) => o.hint === 'recommended').length > 1)
        multi.push(`framework ${String(a.language)}/${String(a.projectType)}`);
      if (ormOptions(a).filter((o) => o.hint === 'recommended').length > 1)
        multi.push(`orm ${String(a.language)}/${String(a.database)}`);
    }
    expect(multi).toEqual([]);
  });
});
