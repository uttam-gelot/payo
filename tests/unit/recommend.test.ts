import { describe, it, expect } from 'bun:test';
import {
  recommendedAnswer,
  recommendedLabel,
  questionSummary,
} from '../../src/questions/recommend';
import type { Question } from '../../src/questions/types';

describe('recommendedAnswer', () => {
  it('select: returns the hinted option value', () => {
    const q: Question = {
      id: 'x',
      type: 'select',
      message: '',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', hint: 'recommended' },
      ],
    };
    expect(recommendedAnswer(q, {})).toBe('b');
  });

  it('select: undefined when no hint and no recommended field', () => {
    const q: Question = {
      id: 'x',
      type: 'select',
      message: '',
      options: [{ value: 'a', label: 'A' }],
    };
    expect(recommendedAnswer(q, {})).toBeUndefined();
  });

  it('select: resolves dynamic optionsFrom', () => {
    const q: Question = {
      id: 'x',
      type: 'select',
      message: '',
      optionsFrom: () => [{ value: 'z', label: 'Z', hint: 'recommended' }],
    };
    expect(recommendedAnswer(q, {})).toBe('z');
  });

  it('multiselect: returns all hinted values', () => {
    const q: Question = {
      id: 'x',
      type: 'multiselect',
      message: '',
      options: [
        { value: 'a', label: 'A', hint: 'recommended' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C', hint: 'recommended' },
      ],
    };
    expect(recommendedAnswer(q, {})).toEqual(['a', 'c']);
  });

  it('confirm / text: read the recommended field', () => {
    expect(
      recommendedAnswer({ id: 'c', type: 'confirm', message: '', recommended: true }, {}),
    ).toBe(true);
    expect(recommendedAnswer({ id: 't', type: 'text', message: '', recommended: 'hi' }, {})).toBe(
      'hi',
    );
    expect(recommendedAnswer({ id: 'c', type: 'confirm', message: '' }, {})).toBeUndefined();
  });
});

describe('recommendedLabel', () => {
  it('strips the explanatory tail after an em dash', () => {
    const q: Question = {
      id: 'g',
      type: 'select',
      message: '',
      options: [
        { value: 'standard', label: 'Standard — conventional commits', hint: 'recommended' },
      ],
    };
    expect(recommendedLabel(q, {})).toBe('Standard');
  });

  it('renders booleans as Yes/No', () => {
    expect(recommendedLabel({ id: 'c', type: 'confirm', message: '', recommended: true }, {})).toBe(
      'Yes',
    );
  });

  it('returns an em dash when there is no default', () => {
    expect(
      recommendedLabel(
        { id: 'x', type: 'select', message: '', options: [{ value: 'a', label: 'A' }] },
        {},
      ),
    ).toBe('—');
  });
});

describe('questionSummary', () => {
  it('prefers the summary field', () => {
    expect(questionSummary({ id: 'x', type: 'select', message: 'Long?', summary: 'Short' })).toBe(
      'Short',
    );
  });

  it('falls back to a cleaned message', () => {
    expect(questionSummary({ id: 'x', type: 'select', message: 'Pick one (a/b)?' })).toBe(
      'Pick one',
    );
  });
});
