import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry (framework vocab reads it)
import { optionValuesFor, hasVocab } from '../../src/detect/optionVocab';

describe('optionVocab', () => {
  it('returns the option values for a static-list id', () => {
    const db = optionValuesFor('database');
    expect(db).toContain('postgresql');
    expect(db).toContain('mongodb');
  });

  it('resolves answer-dependent vocab — formatter switches by language', () => {
    expect(optionValuesFor('formatter', { language: 'python' })).toContain('black');
    expect(optionValuesFor('formatter', { language: 'python' })).not.toContain('prettier');
    expect(optionValuesFor('formatter', { language: 'typescript' })).toContain('prettier');
  });

  it('resolves framework vocab from project shape + language', () => {
    const fw = optionValuesFor('framework', { projectType: 'full-stack', language: 'typescript' });
    expect(fw).toContain('nextjs');
    expect(fw).toContain('none');
  });

  it('returns [] for unknown ids', () => {
    expect(optionValuesFor('totallyMadeUp')).toEqual([]);
    expect(hasVocab('totallyMadeUp')).toBe(false);
  });

  it('returns [] for non-enumerable tsconfig.* ids', () => {
    expect(optionValuesFor('tsconfig.strict')).toEqual([]);
    expect(hasVocab('tsconfig.strict')).toBe(false);
  });

  it('reports hasVocab true for mapped ids', () => {
    for (const id of ['framework', 'database', 'logger', 'structure', 'testTypes']) {
      expect(hasVocab(id)).toBe(true);
    }
  });
});
