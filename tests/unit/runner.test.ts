import { describe, it, expect } from 'bun:test';
import {
  OTHER,
  offersOther,
  parseCustom,
  mergeMultiselect,
  multiselectSeed,
  hoistRecommended,
  resolveOptions,
  reviewAction,
  selectAnswerToEdit,
  detectionSummaryLines,
  confirmSkillSelection,
} from '../../src/questions/runner';
import { validationOptions } from '../../src/questions/options';
import type { Option, Question } from '../../src/questions/types';
import type { SkillSpec } from '../../src/generator/skills';

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

describe('reviewAction', () => {
  it('returns the chosen action verbatim', async () => {
    expect(await reviewAction(() => Promise.resolve('generate'))).toBe('generate');
    expect(await reviewAction(() => Promise.resolve('edit'))).toBe('edit');
  });
});

describe('selectAnswerToEdit', () => {
  const items = [
    { id: 'framework', label: 'Framework: Next.js' },
    { id: 'logger', label: 'Logger: pino' },
  ];

  it('returns the picked answer id', async () => {
    expect(await selectAnswerToEdit(items, () => Promise.resolve('logger'))).toBe('logger');
  });

  it('maps the Back sentinel to undefined', async () => {
    expect(await selectAnswerToEdit(items, () => Promise.resolve('__back__'))).toBeUndefined();
  });
});

const spec = (id: string): SkillSpec => ({
  id,
  title: id,
  description: `${id} description`,
  appliesTo: () => true,
  buildPrompt: () => '',
});

describe('confirmSkillSelection', () => {
  it('skips the prompt and returns all ids when fewer than 2 specs apply', async () => {
    let called = false;
    const ask = () => {
      called = true;
      return Promise.resolve([]);
    };
    expect(await confirmSkillSelection([], ask)).toEqual([]);
    expect(await confirmSkillSelection([spec('testing')], ask)).toEqual(['testing']);
    expect(called).toBe(false);
  });

  it('preselects every skill and returns the picked ids verbatim', async () => {
    const specs = [spec('testing'), spec('auth')];
    let seenInitialValues: string[] | undefined;
    const picked = await confirmSkillSelection(specs, (o) => {
      seenInitialValues = o.initialValues;
      return Promise.resolve(['testing']);
    });
    expect(seenInitialValues).toEqual(['testing', 'auth']);
    expect(picked).toEqual(['testing']);
  });

  it('allows an empty selection (required: false)', async () => {
    const specs = [spec('testing'), spec('auth')];
    const picked = await confirmSkillSelection(specs, () => Promise.resolve([]));
    expect(picked).toEqual([]);
  });
});

describe('detectionSummaryLines', () => {
  it('lists every recorded id, including ones that used to be applied silently', () => {
    const lines = detectionSummaryLines({
      answers: {
        language: 'typescript',
        apiArchitecture: 'trpc',
        testTypes: ['unit', 'e2e'],
        e2eTool: 'playwright',
        authApproach: 'authjs',
        'tsconfig.strict': true,
        'tsconfig.path-aliases': true,
      },
    });
    const blob = lines.join('\n');
    for (const label of ['API architecture', 'Test types', 'E2E tool', 'Auth', 'TS strict']) {
      expect(blob).toContain(label);
    }
    // Order follows the questionnaire: apiArchitecture before authApproach.
    expect(blob.indexOf('API architecture')).toBeLessThan(blob.indexOf('Auth'));
  });

  it('names the existing hook runner and what each stage covers', () => {
    // The hookPolicy question cannot name the runner (messages are static), so
    // this line is the user's only chance to see what they are deciding about.
    const line = detectionSummaryLines({
      answers: { language: 'typescript' },
      hooks: {
        runner: 'husky',
        configPath: '.husky',
        coverage: { 'pre-commit': ['lint', 'format'], 'pre-push': ['verify'] },
      },
    }).find((l) => l.includes('Git hooks'))!;
    expect(line).toContain('husky (.husky)');
    expect(line).toContain('pre-commit: lint, format');
    expect(line).toContain('pre-push: tests');
  });

  it('says so when a detected runner runs nothing recognisable', () => {
    const line = detectionSummaryLines({
      answers: { language: 'typescript' },
      hooks: {
        runner: 'native',
        configPath: '.githooks',
        coverage: { 'pre-commit': [], 'pre-push': [] },
      },
    }).find((l) => l.includes('Git hooks'))!;
    expect(line).toContain('no recognised checks');
  });

  it('returns no lines when nothing was detected', () => {
    expect(detectionSummaryLines({ answers: {} })).toEqual([]);
  });
});

describe('multiselectSeed', () => {
  const options: Option<string>[] = [
    { value: 'unit', label: 'Unit', hint: 'recommended' },
    { value: 'integration', label: 'Integration', hint: 'recommended' },
    { value: 'e2e', label: 'E2E' },
  ];

  it('pre-checks the recommended options when there is no prior answer', () => {
    expect(multiselectSeed(undefined, options)).toEqual(['unit', 'integration']);
  });

  it('a prior answer wins over the recommendation, filtered to valid options', () => {
    expect(multiselectSeed(['e2e', 'gone'], options)).toEqual(['e2e']);
  });

  it('an explicitly empty prior selection stays empty', () => {
    expect(multiselectSeed([], options)).toEqual([]);
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
