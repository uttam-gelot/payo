import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Goth (OAuth for Go) — keyed by the `authApproach` answer value. */
export const goth: TechModule = {
  id: 'goth',
  title: 'Goth (OAuth)',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'goth',
  questions: () => [
    {
      id: 'goth.session',
      type: 'confirm',
      summary: 'Server sessions',
      message: 'Persist login in a server-side session after the OAuth callback?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const lines = [
      '- Register each provider in one place with client id/secret and callback URL from env vars; never hard-code credentials.',
      '- Use Goth’s `gothic` handlers for begin-auth and callback; validate the `state` parameter to prevent CSRF on the OAuth flow.',
      '- On callback, map the provider profile to your own user record — do not trust the provider’s email as identity without your own account-linking rules.',
      '- Keep the session store secret in env and use httpOnly + Secure cookies.',
    ];
    if (a['goth.session'] === true)
      lines.push(
        '- After the callback, establish your own server-side session rather than re-running OAuth per request; check that session on every protected route.',
      );
    return guidanceSection('Authentication — Goth', lines);
  },
};
