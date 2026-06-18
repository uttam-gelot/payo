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
let gateDecision: unknown = false;
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

/** A frontend persona with DB left unanswered, so their gates decide. */
const FRONTEND: Answers = {
  aiTool: 'claude',
  projectType: 'frontend',
  projectDefinition: 'x',
  language: 'typescript',
  framework: 'react',
};

describe('runFlow — persona gates', () => {
  it('does not ask database or orm for a frontend project, but asks logger', async () => {
    gateDecision = false; // customize every group
    const session = await runFlow(flow, freshSession(FRONTEND));
    const a = session.answers;

    expect(asked).not.toContain('database');
    expect(asked).not.toContain('orm');
    expect(a.database).toBeUndefined();
    expect(a.orm).toBeUndefined();

    // Browser apps still log — the question is asked, defaulting to a centralized wrapper.
    expect(asked).toContain('logger');
    expect(a.logger).toBe('centralized');
  });

  it('skips testRunner when only e2e is selected, asks it for unit/integration', async () => {
    gateDecision = false;
    scripted = { testTypes: ['e2e'], e2eTool: 'cypress' };
    let a = (await runFlow(flow, freshSession(FRONTEND))).answers;
    expect(asked).not.toContain('testRunner');
    expect(a.testRunner).toBeUndefined();
    expect(asked).toContain('e2eTool');

    asked = [];
    scripted = { testTypes: ['unit'] };
    a = (await runFlow(flow, freshSession(FRONTEND))).answers;
    expect(asked).toContain('testRunner');
  });
});

describe('runFlow — skip (skip every group)', () => {
  it('records skip sentinels and asks no group question', async () => {
    gateDecision = 'skip';
    const session = await runFlow(flow, freshSession(BASE));
    const a = session.answers;

    // select / text questions stored as 'none' (treated as unset by the generator)
    expect(a['nextjs.router']).toBe('none');
    expect(a.authApproach).toBe('none');
    expect(a.structure).toBe('none');
    // multiselect skipped to an empty list, confirm to false
    expect(a.testTypes).toEqual([]);
    expect(a.codingStandards).toEqual([]);
    expect(a.aiAttribution).toBe(false);
    expect(a.commitScope).toBe(false);
    expect(a.commitScratchGuard).toBe(false);
    expect(a.confirmPush).toBe(false);
    expect(a.verifyBeforeCommit).toBe(false);
    expect(a.atomicCommits).toBe(false);

    // when-gated-by-skip questions never surface: authStrategy needs auth !== none,
    // and testRunner needs unit/integration in testTypes (skipped to []).
    expect(a.authStrategy).toBeUndefined();
    expect(a.testRunner).toBeUndefined();
    expect(a.e2eTool).toBeUndefined();

    // nothing was actually asked — every group was skipped at the gate
    expect(asked.filter((id) => !id.endsWith('__recommended'))).toEqual([]);
  });
});
