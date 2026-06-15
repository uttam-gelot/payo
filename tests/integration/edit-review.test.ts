import { describe, it, expect, afterAll } from 'bun:test';
import {
  reconcile,
  editableItems,
  forgetSection,
  findQuestion,
  reviewLines,
} from '../../src/questions/engine';
import { flow } from '../../src/questions/flow';
import { clearSession } from '../../src/state/index';
import { freshSession } from '../fixtures';
import type { Answers } from '../../src/questions/types';

afterAll(() => clearSession());

/** Full-stack TS + Next.js with a framework follow-up already answered. */
const BASE: Answers = {
  aiTool: 'claude',
  projectType: 'full-stack',
  projectDefinition: 'x',
  language: 'typescript',
  framework: 'nextjs',
  'nextjs.router': 'app',
  database: 'none',
};

describe('reconcile — drops answers no longer reachable', () => {
  it('forgets framework follow-ups when the framework is changed away', () => {
    // Simulate the user editing `framework` from nextjs → none.
    const edited = freshSession({ ...BASE, framework: 'none' });
    const out = reconcile(flow, edited);

    expect(out.answers['nextjs.router']).toBeUndefined();
    expect(out.answered).not.toContain('nextjs.router');
    // The edited answer and unrelated answers are kept.
    expect(out.answers.framework).toBe('none');
    expect(out.answers.language).toBe('typescript');
  });

  it('keeps everything when nothing became unreachable', () => {
    const session = freshSession(BASE);
    const out = reconcile(flow, session);
    expect(out.answers['nextjs.router']).toBe('app');
    expect(out.answered).toContain('nextjs.router');
  });

  it('cascades: changing router app→pages drops the app-only components question', () => {
    // nextjs.components is gated on nextjs.router === 'app'
    // (src/stack/modules/framework/nextjs.ts).
    const session = freshSession({
      ...BASE,
      'nextjs.router': 'pages',
      'nextjs.components': 'server', // stale: only reachable under the app router
    });
    const out = reconcile(flow, session);
    expect(out.answers['nextjs.router']).toBe('pages');
    expect(out.answers['nextjs.components']).toBeUndefined();
    expect(out.answered).not.toContain('nextjs.components');
  });

  it('preserves an active gate decision', () => {
    const session = freshSession({ ...BASE, 'auth.__recommended': 'recommended' });
    const out = reconcile(flow, session);
    expect(out.answers['auth.__recommended']).toBe('recommended');
    expect(out.answered).toContain('auth.__recommended');
  });
});

describe('findQuestion', () => {
  const answers = { ...BASE };

  it('resolves a static core question', () => {
    expect(findQuestion(flow, answers, 'framework')?.id).toBe('framework');
  });

  it('resolves a module-injected follow-up', () => {
    expect(findQuestion(flow, answers, 'nextjs.router')?.id).toBe('nextjs.router');
  });

  it('returns undefined for an unknown id', () => {
    expect(findQuestion(flow, answers, 'does.not.exist')).toBeUndefined();
  });
});

describe('editableItems — ordering & content', () => {
  it('question rows match reviewLines order and content', () => {
    const session = freshSession(BASE);
    const questionLabels = editableItems(flow, session)
      .filter((i) => i.kind === 'question')
      .map((i) => i.label);
    // Each content question maps 1:1 to a review line, in the same order.
    expect(questionLabels).toEqual(reviewLines(flow, session.answers));
    // Ordered as the flow walks them.
    const ids = editableItems(flow, session).map((i) => i.id);
    expect(ids.indexOf('framework')).toBeLessThan(ids.indexOf('nextjs.router'));
  });

  it('includes multiselect and confirm answers as content rows', () => {
    const session = freshSession({
      ...BASE,
      codingStandards: ['DRY', 'SOLID'], // multiselect
      aiAttribution: true, // confirm
    });
    const ids = editableItems(flow, session)
      .filter((i) => i.kind === 'question')
      .map((i) => i.id);
    expect(ids).toContain('codingStandards');
    expect(ids).toContain('aiAttribution');
  });

  it('excludes unset (skipped) content answers but lists the section gate row', () => {
    // Skip Authentication: gate = 'skip', authApproach stored as the 'none' sentinel.
    const session = freshSession({
      ...BASE,
      'auth.__recommended': 'skip',
      authApproach: 'none',
    });
    const items = editableItems(flow, session);
    const ids = items.map((i) => i.id);

    expect(ids).toContain('framework'); // content question, editable
    expect(ids).not.toContain('authApproach'); // unset sentinel, hidden
    // The skipped section is reachable via its gate row.
    const gate = items.find((i) => i.id === 'auth.__recommended');
    expect(gate?.kind).toBe('gate');
    expect(gate?.label).toBe('Authentication settings: skipped');
  });

  it('labels the gate row by decision (recommended / customized / skipped)', () => {
    const label = (decision: string): string | undefined =>
      editableItems(flow, freshSession({ ...BASE, 'auth.__recommended': decision })).find(
        (i) => i.id === 'auth.__recommended',
      )?.label;
    expect(label('recommended')).toBe('Authentication settings: recommended');
    expect(label('customize')).toBe('Authentication settings: customized');
    expect(label('skip')).toBe('Authentication settings: skipped');
  });
});

describe('forgetSection — re-opening a section', () => {
  it('forgets the gate decision and every answer the section owns', () => {
    const session = freshSession({
      ...BASE,
      'auth.__recommended': 'recommended',
      authApproach: 'authjs',
      authStrategy: 'session',
      rbac: true,
    });
    const out = forgetSection(flow, session, 'auth.__recommended');

    for (const id of ['auth.__recommended', 'authApproach', 'authStrategy', 'rbac']) {
      expect(out.answers[id]).toBeUndefined();
      expect(out.answered).not.toContain(id);
    }
    // Unrelated answers untouched.
    expect(out.answers.framework).toBe('nextjs');
  });

  it('is a no-op for an unknown gate id', () => {
    const session = freshSession(BASE);
    expect(forgetSection(flow, session, 'nope.__recommended').answers).toEqual(session.answers);
  });
});
