import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/**
 * Auth module: keyed by the `authApproach` answer value. Adds Clerk-specific
 * follow-ups and guidance that complement the generic Authentication section.
 */
export const clerk: TechModule = {
  id: 'clerk',
  title: 'Clerk',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'clerk',
  questions: () => [
    {
      id: 'clerk.protection',
      type: 'select',
      summary: 'Route protection',
      message: 'How are protected routes guarded?',
      options: [
        {
          value: 'middleware',
          label: 'clerkMiddleware (matcher in middleware)',
          hint: 'recommended',
        },
        { value: 'per-route', label: 'Per-route auth() checks' },
      ],
    },
    {
      id: 'clerk.orgs',
      type: 'confirm',
      summary: 'Organizations',
      message: 'Use Clerk Organizations for multi-tenancy?',
      recommended: false,
    },
  ],
  guidance: (a) => {
    const lines = [
      a['clerk.protection'] === 'per-route'
        ? '- Guard protected handlers with `auth()` per route; redirect/401 when there is no session.'
        : '- Centralize route protection in `clerkMiddleware` with a route matcher; keep per-route checks for fine-grained cases only.',
      '- Read identity server-side via `auth()` / `currentUser()`; never trust a client-supplied user id.',
      '- Gate UI with `<SignedIn>` / `<SignedOut>`; never use them as the only access control — always re-check on the server.',
      '- Keep Clerk keys in env vars; the secret key is server-only and must never reach the client bundle.',
    ];
    if (a['clerk.orgs'] === true)
      lines.push(
        '- Scope data and permissions by the active Clerk Organization; check org membership/role on every protected operation.',
      );
    return guidanceSection('Authentication — Clerk', lines);
  },
};
