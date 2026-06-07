import { mock, describe, it, expect, beforeEach, afterAll } from 'bun:test';
import * as realRunner from '../../src/questions/runner';
import * as realClack from '@clack/prompts';
import { recommendedAnswer } from '../../src/questions/recommend';
import { freshSession } from '../fixtures';
import type { Answers, Question } from '../../src/questions/types';

// Silence the engine's recommended-settings panels in test output.
void mock.module('@clack/prompts', () => ({ ...realClack, note: () => undefined }));

/**
 * Drive the real `runFlow` with a scripted prompt layer. We mock only
 * `runner.runQuestion` (keeping the real `resolveOptions`, which `recommend.ts`
 * depends on), so question identity stays available via `q.id`:
 *  - gate confirms ('*.__recommended') return `gateDecision`;
 *  - otherwise return a scripted answer, falling back to the recommended value.
 */
let gateDecision = false;
let scripted: Record<string, unknown> = {};
let asked: string[] = [];

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

// Import after the mock is registered.
const { runFlow } = await import('../../src/questions/engine');
const { flow } = await import('../../src/questions/flow');
const { clearSession } = await import('../../src/state/index');

/** A mid-flow session: stack questions already answered, groups still ahead. */
const BASE: Answers = {
  aiTool: 'claude',
  projectType: 'full-stack',
  projectDefinition: 'x',
  language: 'typescript',
  framework: 'nextjs',
  apiArchitecture: 'rest',
  stylingLibrary: 'tailwind',
  database: 'postgresql',
  orm: 'prisma',
  logger: 'pino',
};

beforeEach(() => {
  gateDecision = false;
  scripted = {};
  asked = [];
});

afterAll(() => clearSession());

describe('runFlow — recommended (accept-all gates)', () => {
  it('applies recommended values and skips every group question', async () => {
    gateDecision = true;
    const session = await runFlow(flow, freshSession(BASE));
    const a = session.answers;

    // values come from the recommended plan, not from asking
    expect(a['nextjs.router']).toBe('app');
    expect(a['prisma.migrations']).toBe('migrate');
    expect(a.authApproach).toBe('authjs');
    expect(a.testTypes).toEqual(['unit', 'integration']);
    expect(a.e2eTool).toBeUndefined();

    // every gate was accepted, so no group question was actually asked
    expect(asked.filter((id) => !id.endsWith('__recommended'))).toEqual([]);
  });
});

describe('runFlow — manual (decline-all gates)', () => {
  it('asks each question and honors when-skips', async () => {
    gateDecision = false;
    scripted = {
      // framework follow-up: pages router ⇒ nextjs.components is when-skipped
      'nextjs.router': 'pages',
      // auth none ⇒ authStrategy + rbac are when-skipped
      authApproach: 'none',
      // pick e2e ⇒ the e2eTool question becomes askable
      testTypes: ['unit', 'e2e'],
      e2eTool: 'cypress',
    };
    const session = await runFlow(flow, freshSession(BASE));
    const a = session.answers;

    // declined gate was recorded as false (proves the manual branch ran)
    expect(a['conventions.__recommended']).toBe(false);

    // when-skips
    expect(a['nextjs.router']).toBe('pages');
    expect(a['nextjs.components']).toBeUndefined();
    expect(a.authStrategy).toBeUndefined();
    expect(a.rbac).toBeUndefined();
    expect(asked).not.toContain('nextjs.components');
    expect(asked).not.toContain('authStrategy');

    // e2e selected ⇒ e2eTool was asked and recorded
    expect(asked).toContain('e2eTool');
    expect(a.e2eTool).toBe('cypress');
  });
});
