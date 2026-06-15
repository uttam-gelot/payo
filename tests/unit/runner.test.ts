import { describe, it, expect } from 'bun:test';
import {
  OTHER,
  offersOther,
  parseCustom,
  mergeMultiselect,
  hoistRecommended,
  resolveOptions,
} from '../../src/questions/runner';
import { validationOptions } from '../../src/questions/options';
import type { Option, Question } from '../../src/questions/types';

// NOTE: reviewAction / selectAnswerToEdit are thin @clack `select` wrappers; their
// behavior (action verbatim, __back__ → undefined) is covered order-independently by
// tests/integration/edit-review-loop.test.ts. Mocking @clack here would collide with
// the global @clack mocks in the integration files (bun mock.module is process-wide).

const select = (over: Partial<Question> = {}): Question => ({
  id: 'q',
  type: 'select',
  message: 'pick',
  ...over,
});

const opts = (...values: string[]): Option<string>[] =>
  values.map((value) => ({ value, label: value }));

const rec = (value: string): Option<string> => ({ value, label: value, hint: 'recommended' });

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

describe('hoistRecommended', () => {
  const vals = (o: Option<string>[]): string[] => o.map((x) => x.value);

  it('moves a single recommended option to the front, keeping the rest in order', () => {
    expect(vals(hoistRecommended([opts('a', 'b')[0], rec('c'), opts('a', 'b')[1]]))).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('groups multiple recommended hints at the front in their original order', () => {
    const o = [opts('a')[0], rec('b'), opts('c')[0], rec('d')];
    expect(vals(hoistRecommended(o))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns the list unchanged when none are recommended', () => {
    const o = opts('a', 'b', 'c');
    expect(hoistRecommended(o)).toBe(o);
  });

  it('returns the list unchanged when all are recommended', () => {
    const o = [rec('a'), rec('b')];
    expect(hoistRecommended(o)).toBe(o);
  });

  it('keeps a trailing none last when the recommended one is hoisted', () => {
    const o = [opts('a')[0], rec('b'), opts('none')[0]];
    expect(vals(hoistRecommended(o))).toEqual(['b', 'a', 'none']);
  });
});

describe('resolveOptions', () => {
  it('hoists the recommended option from a dynamic builder (NestJS validation)', () => {
    const q = select({ optionsFrom: validationOptions });
    const resolved = resolveOptions(q, { language: 'typescript', framework: 'nestjs' });
    expect(resolved[0]?.value).toBe('class-validator');
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
