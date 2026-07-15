import { mock, describe, it, expect, beforeEach, afterAll } from 'bun:test';
import * as realRunner from '../../src/questions/runner';
import * as realClack from '@clack/prompts';
import { recommendedAnswer } from '../../src/questions/recommend';
import { fullStackAnswers, freshSession } from '../fixtures';
import type { Answers, Question } from '../../src/questions/types';

// Silence the review/recommended panels in test output.
void mock.module('@clack/prompts', () => ({ ...realClack, note: () => undefined }));

/**
 * Drive the real `reviewAndEdit` with a scripted prompt layer:
 *  - `review` / `pickEdit` are injected directly into reviewAndEdit (no module
 *    mock), so the runner module's exports are never globally overridden — that
 *    used to leak into other files' tests depending on load order.
 *  - `runQuestion` is the one prompt runFlow reaches internally, so it is still
 *    mocked at the module level (same harmless override run-flow.test.ts uses):
 *    gate confirms answer `gateDecision`; otherwise a scripted value, falling
 *    back to the recommended one.
 */
let actions: ('generate' | 'edit')[] = [];
let editPicks: (string | undefined)[] = [];
let scripted: Record<string, unknown> = {};
let asked: string[] = [];
let gateDecision: unknown = 'customize';

void mock.module('../../src/questions/runner', () => ({
  ...realRunner,
  runQuestion: (q: Question, a: Answers): Promise<unknown> => {
    if (q.id.endsWith('__recommended')) return Promise.resolve(gateDecision);
    asked.push(q.id);
    if (q.id in scripted) return Promise.resolve(scripted[q.id]);
    const rec = recommendedAnswer(q, a);
    return Promise.resolve(rec !== undefined ? rec : '__unanswered__');
  },
}));

// Import after the mocks are registered.
const { reviewAndEdit } = await import('../../src/questions/engine');

/** Scripted prompts injected into reviewAndEdit. */
const prompts = {
  review: (): Promise<'generate' | 'edit'> => Promise.resolve(actions.shift() ?? 'generate'),
  pickEdit: (): Promise<string | undefined> => Promise.resolve(editPicks.shift()),
};
const { flow } = await import('../../src/questions/flow');
const { clearSession } = await import('../../src/state/index');

/** A fully-answered full-stack session with the Next.js follow-ups present. */
const seed = (): Answers => ({
  ...fullStackAnswers(),
  'nextjs.router': 'app',
  'nextjs.components': 'server',
  'nextjs.data': 'rsc',
});

beforeEach(() => {
  actions = [];
  editPicks = [];
  scripted = {};
  asked = [];
  gateDecision = 'customize';
});

afterAll(() => clearSession());

describe('reviewAndEdit', () => {
  it('generates immediately without asking anything', async () => {
    actions = ['generate'];
    const before = seed();
    const out = await reviewAndEdit(flow, freshSession(before), prompts);
    expect(asked).toEqual([]);
    expect(out.answers.logger).toBe(before.logger);
  });

  it('edits a single answer, then generates', async () => {
    actions = ['edit', 'generate'];
    editPicks = ['logger'];
    scripted = { logger: 'winston' };
    const out = await reviewAndEdit(flow, freshSession(seed()), prompts);
    expect(asked).toContain('logger');
    expect(out.answers.logger).toBe('winston');
  });

  it('editing framework → none drops the now-orphaned Next.js follow-ups', async () => {
    actions = ['edit', 'generate'];
    editPicks = ['framework'];
    scripted = { framework: 'none' };
    const out = await reviewAndEdit(flow, freshSession(seed()), prompts);

    expect(out.answers.framework).toBe('none');
    for (const id of ['nextjs.router', 'nextjs.components', 'nextjs.data']) {
      expect(out.answers[id]).toBeUndefined();
      expect(out.answered).not.toContain(id);
    }
    // No orphaned follow-up was re-asked.
    expect(asked.filter((id) => id.startsWith('nextjs.'))).toEqual([]);
  });

  it('re-opens a skipped section and re-drives it via the gate', async () => {
    // Start with Authentication skipped (gate + sentinel answers).
    const skipped = (): Answers => ({
      ...seed(),
      'auth.__recommended': 'skip',
      authApproach: 'none',
      authStrategy: 'none',
      rbac: false,
    });
    actions = ['edit', 'generate'];
    editPicks = ['auth.__recommended']; // pick the gate row
    gateDecision = 'recommended'; // re-decide: use recommended this time

    const out = await reviewAndEdit(flow, freshSession(skipped()), prompts);

    expect(out.answers['auth.__recommended']).toBe('recommended');
    expect(out.answers.authApproach).toBe('authjs'); // recommended value, no longer 'none'
  });

  it('marks a recommended section customized when one of its answers is edited', async () => {
    actions = ['edit', 'generate'];
    editPicks = ['testTypes'];
    scripted = {
      testTypes: ['unit', 'e2e'],
      e2eTool: 'cypress',
    };

    const out = await reviewAndEdit(
      flow,
      freshSession({
        ...seed(),
        'testing.__recommended': 'recommended',
      }),
      prompts,
    );

    expect(out.answers['testing.__recommended']).toBe('customize');
    expect(out.answers.testTypes).toEqual(['unit', 'e2e']);
    expect(asked).toContain('e2eTool');
    expect(out.answers.e2eTool).toBe('cypress');
  });

  it('treats Back as a no-op and returns unchanged on the next Generate', async () => {
    actions = ['edit', 'generate'];
    editPicks = [undefined]; // ← Back
    const before = seed();
    const out = await reviewAndEdit(flow, freshSession(before), prompts);
    expect(asked).toEqual([]);
    expect(out.answers).toEqual(before);
  });
});
