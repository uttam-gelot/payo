import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for a hand-rolled/custom auth approach — keyed by the `authApproach` answer value. */
export const customAuth: TechModule = {
  id: 'custom',
  title: 'Custom Auth',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'custom',
  questions: () => [
    {
      id: 'custom.session',
      type: 'select',
      summary: 'Session model',
      message: 'How are sessions tracked?',
      options: [
        { value: 'server-session', label: 'Server-side session + cookie', hint: 'recommended' },
        { value: 'jwt', label: 'Signed JWT' },
      ],
    },
  ],
  guidance: (a) => {
    const jwt = a['custom.session'] === 'jwt';
    const lines = [
      '- Hash passwords with argon2id (or bcrypt) and a per-user salt; never store or log plaintext, and compare with the library’s constant-time verify.',
      jwt
        ? '- Sign tokens with a strong server-only secret/keypair, set short expiries, verify signature + expiry on every request, and keep no sensitive data in the payload; plan a revocation/refresh strategy.'
        : '- Store sessions server-side keyed by a high-entropy id; send it in an httpOnly + SameSite + Secure cookie, regenerate the id on login, and expire idle sessions.',
      '- Rate-limit and lock out repeated failed logins; use generic error messages so the response never reveals whether the account exists.',
      '- Keep all secrets in env vars; enforce authorization checks server-side on every protected route — never trust client-supplied identity or roles.',
    ];
    return guidanceSection('Authentication — Custom Auth', lines);
  },
};
