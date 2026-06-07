import { describe, it, expect } from 'bun:test';
import { tsconfig } from '../../src/stack/modules/config/tsconfig';
import type { Answers } from '../../src/questions/types';

const ids = (a: Answers): string[] => tsconfig.questions(a).map((q) => q.id);
const recValue = (a: Answers, id: string): string | undefined =>
  tsconfig
    .questions(a)
    .find((q) => q.id === id)
    ?.options?.find((o) => o.hint === 'recommended')?.value;

describe('tsconfig module', () => {
  it('applies only to TypeScript', () => {
    expect(tsconfig.appliesTo({ language: 'typescript' })).toBe(true);
    expect(tsconfig.appliesTo({ language: 'javascript' })).toBe(false);
    expect(tsconfig.appliesTo({ language: 'python' })).toBe(false);
  });

  it('asks the four key compiler questions', () => {
    expect(ids({ language: 'typescript' })).toEqual([
      'tsconfig.strict',
      'tsconfig.target',
      'tsconfig.module-resolution',
      'tsconfig.path-aliases',
    ]);
  });

  it('module-resolution default is context-aware', () => {
    expect(
      recValue({ language: 'typescript', projectType: 'backend' }, 'tsconfig.module-resolution'),
    ).toBe('nodenext');
    expect(
      recValue({ language: 'typescript', projectType: 'full-stack' }, 'tsconfig.module-resolution'),
    ).toBe('bundler');
  });
});
