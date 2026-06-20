import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Authlib (OAuth/OIDC) — keyed by the `authApproach` answer value. */
export const authlib: TechModule = {
  id: 'authlib',
  title: 'Authlib (OAuth/OIDC)',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'authlib',
  questions: () => [
    {
      id: 'authlib.role',
      type: 'select',
      summary: 'Role',
      message: 'Authlib is used as the…',
      options: [
        { value: 'client', label: 'OAuth/OIDC client (login via provider)', hint: 'recommended' },
        { value: 'resource-server', label: 'Resource server (validate bearer tokens)' },
        { value: 'provider', label: 'Authorization server (issue tokens)' },
      ],
    },
  ],
  guidance: (a) => {
    const role = a['authlib.role'];
    const lines = [
      '- Register OAuth/OIDC clients through Authlib’s integration for your framework; keep client id/secret and signing keys in env vars.',
      role === 'resource-server'
        ? '- As a resource server, validate the bearer token (signature via JWKS, issuer, audience, expiry, scopes) on every request and authorize from verified scopes.'
        : role === 'provider'
          ? '- As an authorization server, use Authlib’s grant classes; enforce PKCE for public clients, short-lived access tokens, and rotating refresh tokens.'
          : '- As a client, use the authorization-code flow with PKCE and `state`; validate the OIDC `id_token` (issuer, audience, nonce, expiry) before trusting the identity.',
      '- Never accept tokens without verifying the signature against the provider’s JWKS; do not trust unverified claims.',
    ];
    return guidanceSection('Authentication — Authlib', lines);
  },
};
