import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for the Rust `oauth2` crate — keyed by the `authApproach` answer value. */
export const oauth2: TechModule = {
  id: 'oauth2',
  title: 'oauth2 crate',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'oauth2',
  questions: () => [
    {
      id: 'oauth2.flow',
      type: 'select',
      summary: 'Grant flow',
      message: 'Primary grant flow?',
      options: [
        { value: 'auth-code-pkce', label: 'Authorization code + PKCE', hint: 'recommended' },
        { value: 'client-credentials', label: 'Client credentials (service-to-service)' },
      ],
    },
  ],
  guidance: (a) => {
    const pkce = a['oauth2.flow'] !== 'client-credentials';
    const lines = [
      '- Build the client with provider endpoints and credentials from env; keep the client secret server-only.',
      pkce
        ? '- Use the authorization-code flow with PKCE and a random `state`; verify `state` on callback and validate any OIDC `id_token` (issuer, audience, nonce, expiry) before trusting identity.'
        : '- Use client-credentials only for service-to-service calls; scope the token tightly and cache it until shortly before expiry rather than re-requesting per call.',
      '- After exchanging the code, establish your own server-side session/token rather than calling the provider on every request.',
      '- Validate access tokens (signature via JWKS, expiry, scopes) before authorizing; never trust unverified claims.',
    ];
    return guidanceSection('Authentication — oauth2 crate', lines);
  },
};
