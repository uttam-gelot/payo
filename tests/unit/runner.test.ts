import { describe, it, expect } from 'bun:test';
import { OTHER, offersOther, parseCustom, mergeMultiselect } from '../../src/questions/runner';
import type { Option, Question } from '../../src/questions/types';

const select = (over: Partial<Question> = {}): Question => ({
  id: 'q',
  type: 'select',
  message: 'pick',
  ...over,
});

const opts = (...values: string[]): Option<string>[] =>
  values.map((value) => ({ value, label: value }));

describe('offersOther', () => {
  it('offers Other by default (no allowOther flag)', () => {
    expect(offersOther(select(), opts('a', 'b'))).toBe(true);
  });

  it('suppresses Other when allowOther is false', () => {
    expect(offersOther(select({ allowOther: false }), opts('a', 'b'))).toBe(false);
  });

  it('does not double-add when a custom/other option already exists', () => {
    expect(offersOther(select(), opts('a', 'custom'))).toBe(false);
    expect(offersOther(select(), opts('a', 'other'))).toBe(false);
  });

  it("treats 'none' as a real choice, still offering Other", () => {
    expect(offersOther(select(), opts('a', 'none'))).toBe(true);
  });
});

describe('parseCustom', () => {
  it('splits, trims, and drops empties', () => {
    expect(parseCustom('a, b ,  c', [])).toEqual(['a', 'b', 'c']);
    expect(parseCustom(' , ,', [])).toEqual([]);
  });

  it('de-duplicates against itself and the already-chosen values', () => {
    expect(parseCustom('a, a, b', ['b'])).toEqual(['a']);
  });
});

describe('mergeMultiselect', () => {
  it('merges custom values and removes the OTHER sentinel', () => {
    expect(mergeMultiselect(['unit', OTHER], 'a, b')).toEqual(['unit', 'a', 'b']);
  });

  it('returns the picks unchanged when no custom text is added', () => {
    expect(mergeMultiselect(['unit', 'integration'], '')).toEqual(['unit', 'integration']);
  });

  it('does not duplicate a custom value that was already picked', () => {
    expect(mergeMultiselect(['unit', OTHER], 'unit, e2e')).toEqual(['unit', 'e2e']);
  });
});
