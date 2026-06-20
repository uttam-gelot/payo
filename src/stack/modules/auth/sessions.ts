import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for custom server-side sessions (Go) — keyed by the `authApproach` answer value. */
export const sessions: TechModule = {
  id: 'sessions',
  title: 'Custom sessions',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'sessions',
  questions: () => [
    {
      id: 'sessions.store',
      type: 'select',
      summary: 'Session store',
      message: 'Where are sessions stored?',
      options: [
        {
          value: 'server-store',
          label: 'Server store (Redis/DB), id in cookie',
          hint: 'recommended',
        },
        { value: 'cookie-store', label: 'Encrypted cookie store' },
      ],
    },
  ],
  guidance: (a) => {
    const serverStore = a['sessions.store'] !== 'cookie-store';
    const lines = [
      '- Generate session ids from a CSPRNG with enough entropy; send them in httpOnly + SameSite + Secure cookies, never in URLs or JS-readable storage.',
      serverStore
        ? '- Keep session data in a server-side store (Redis/DB) keyed by the id; the cookie holds only the opaque id, so you can revoke and expire centrally.'
        : '- With a cookie store, encrypt and sign (authenticated encryption) the payload; rotate keys and keep the payload small — it travels on every request.',
      '- Regenerate the session id on privilege change (login) to prevent fixation; expire idle and absolute sessions, and destroy server-side on logout.',
      '- Hash passwords with bcrypt/argon2; keep store and signing secrets in env, and enforce authorization checks server-side every request.',
    ];
    return guidanceSection('Authentication — Custom sessions', lines);
  },
};
