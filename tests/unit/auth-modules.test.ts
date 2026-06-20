import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index';
import { getModule } from '../../src/stack/registry';
import { buildBaseRules, renderMarkdown } from '../../src/generator/rules';
import { contexts } from '../fixtures';
import type { Answers } from '../../src/questions/types';

const md = (a: Answers): string => renderMarkdown('G', buildBaseRules(a));

describe('auth modules', () => {
  const authIds = [
    'clerk',
    'authjs',
    'better-auth',
    'supabase-auth',
    'auth0',
    'cognito',
    'passport',
    'custom',
    'custom-jwt',
    'django-allauth',
    'django-auth',
    'authlib',
    'fastapi-users',
    'golang-jwt',
    'goth',
    'sessions',
    'jsonwebtoken',
    'tower-sessions',
    'oauth2',
  ];

  it('registers the auth modules under their answer-value ids', () => {
    for (const id of authIds) {
      expect(getModule(id)?.category).toBe('auth');
    }
  });

  it('expose no selectable options (lists stay in authApproachOptions)', () => {
    for (const id of authIds) {
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

  it('emits a DIY hashing rule for a custom-jwt approach', () => {
    const out = md({ ...contexts.tsFullstack, authApproach: 'custom-jwt' });
    expect(out).toContain('## Authentication — Custom JWT / Sessions');
    expect(out).toContain('argon2');
  });

  it('contributes nothing for the none auth approach', () => {
    const out = md({ ...contexts.tsFullstack, authApproach: 'none' });
    expect(out).not.toContain('## Authentication — ');
  });
});
