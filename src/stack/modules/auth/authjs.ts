import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Auth.js / NextAuth — keyed by the `authApproach` answer value. */
export const authjs: TechModule = {
  id: 'authjs',
  title: 'Auth.js / NextAuth',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'authjs',
  questions: () => [
    {
      id: 'authjs.session',
      type: 'select',
      summary: 'Session storage',
      message: 'Session strategy?',
      options: [
        { value: 'jwt', label: 'JWT (encrypted cookie, no DB)', hint: 'recommended' },
        { value: 'database', label: 'Database sessions (adapter)' },
      ],
    },
    {
      id: 'authjs.adapter',
      type: 'confirm',
      summary: 'Database adapter',
      message: 'Persist users/accounts via a database adapter?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const db = a['authjs.session'] === 'database';
    const lines = [
      '- Keep a single auth config (providers, callbacks, `pages`) as the one source of truth; import `auth()` from it everywhere.',
      db
        ? '- Use database sessions via the adapter; session lookups hit the store, so a DB adapter is required.'
        : '- Use JWT sessions (no session table); put only minimal, non-sensitive claims in the token.',
      '- Enrich identity in the `session`/`jwt` callbacks (e.g. role, id); never expose provider tokens to the client.',
      '- Protect routes server-side with `auth()`; treat the middleware matcher as defense-in-depth, not the only gate.',
      '- Keep `AUTH_SECRET` and provider credentials in env vars; never commit them.',
    ];
    if (a['authjs.adapter'] === true && !db)
      lines.push(
        '- Use the adapter to persist users/accounts even with JWT sessions, so account linking works.',
      );
    return guidanceSection('Authentication — Auth.js', lines);
  },
};
