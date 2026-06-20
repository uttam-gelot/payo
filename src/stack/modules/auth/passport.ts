import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Passport.js — keyed by the `authApproach` answer value. */
export const passport: TechModule = {
  id: 'passport',
  title: 'Passport',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'passport',
  questions: () => [
    {
      id: 'passport.session',
      type: 'select',
      summary: 'Session model',
      message: 'How are authenticated requests tracked?',
      options: [
        {
          value: 'session-cookie',
          label: 'Server session + cookie (express-session)',
          hint: 'recommended',
        },
        { value: 'jwt', label: 'Stateless JWT strategy' },
      ],
    },
  ],
  guidance: (a) => {
    const jwt = a['passport.session'] === 'jwt';
    const lines = [
      '- Configure one Passport strategy per auth method (local, OAuth provider, JWT) and keep verify callbacks thin — look up the user, return it or fail.',
      '- Hash passwords with bcrypt/argon2 in the local strategy; compare with the library’s constant-time verify, never plain equality.',
      jwt
        ? '- With the JWT strategy, keep the signing secret in env, set a short expiry, and verify signature + expiry on every request; do not store sensitive data in the payload.'
        : '- With sessions, use `express-session` with a server-side store (Redis/DB), httpOnly + SameSite + Secure cookies, and regenerate the session id on login to prevent fixation.',
      '- Guard protected routes with a single `ensureAuthenticated` middleware; re-check authorization server-side, never trust client flags.',
    ];
    return guidanceSection('Authentication — Passport', lines);
  },
};
