import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Auth0 — hosted provider, keyed by the `authApproach` answer value. */
export const auth0: TechModule = {
  id: 'auth0',
  title: 'Auth0',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'auth0',
  questions: () => [
    {
      id: 'auth0.tokens',
      type: 'select',
      summary: 'API authorization',
      message: 'How do APIs authorize requests?',
      options: [
        {
          value: 'access-token',
          label: 'Validate Auth0 access tokens (JWT/JWKS)',
          hint: 'recommended',
        },
        { value: 'session-only', label: 'Session cookie only (no separate API)' },
      ],
    },
  ],
  guidance: (a) => {
    const apiTokens = a['auth0.tokens'] !== 'session-only';
    const lines = [
      '- Use the official Auth0 SDK for login/logout/callback; do not hand-build the OAuth/OIDC redirect flow.',
      '- Keep the Auth0 domain, client ID, client secret, and any API audience in env vars; the client secret is server-only.',
      apiTokens
        ? '- Protect APIs by validating the access token against Auth0’s JWKS (issuer + audience + expiry) on every request; authorize from token scopes/permissions, not client claims.'
        : '- Rely on the SDK session cookie; re-check the session server-side on every protected route rather than trusting client state.',
      '- Store roles/permissions in Auth0 (RBAC) and read them from verified token claims; never trust a role sent from the browser.',
    ];
    return guidanceSection('Authentication — Auth0', lines);
  },
};
