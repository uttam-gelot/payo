import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index';
import { getModule } from '../../src/stack/registry';
import { buildBaseRules, renderMarkdown } from '../../src/generator/rules';
import { contexts } from '../fixtures';
import type { Answers } from '../../src/questions/types';

const md = (a: Answers): string => renderMarkdown('G', buildBaseRules(a));

describe('auth modules', () => {
  it('registers the auth modules under their answer-value ids', () => {
    for (const id of ['clerk', 'authjs', 'better-auth', 'supabase-auth']) {
      expect(getModule(id)?.category).toBe('auth');
    }
  });

  it('expose no selectable options (lists stay in authApproachOptions)', () => {
    for (const id of ['clerk', 'authjs', 'better-auth', 'supabase-auth']) {
      expect(typeof getModule(id)?.options).toBe('undefined');
    }
  });

  it('emits a Clerk guidance section alongside the generic Authentication section', () => {
    const out = md({ ...contexts.tsFullstack, authApproach: 'clerk' });
    expect(out).toContain('## Authentication\n');
    expect(out).toContain('## Authentication — Clerk');
    expect(out).toContain('clerkMiddleware');
  });

  it('Clerk guidance honors the per-route protection choice', () => {
    const out = md({
      ...contexts.tsFullstack,
      authApproach: 'clerk',
      'clerk.protection': 'per-route',
    });
    expect(out).toContain('auth()` per route');
    expect(out).not.toContain('Centralize route protection');
  });

  it('contributes nothing for an unbacked auth approach (e.g. passport)', () => {
    const out = md({ ...contexts.tsFullstack, authApproach: 'passport' });
    expect(out).not.toContain('## Authentication — ');
    expect(out).toContain('- Auth approach: passport');
  });
});
