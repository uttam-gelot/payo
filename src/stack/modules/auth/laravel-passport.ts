import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Laravel Passport — keyed by the `authApproach` answer value. */
export const laravelPassport: TechModule = {
  id: 'laravel-passport',
  title: 'Laravel Passport',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'laravel-passport',
  questions: () => [],
  guidance: () =>
    guidanceSection('Authentication — Laravel Passport', [
      '- Passport is a full OAuth2 server — reach for it only when you need OAuth2 grants (third-party clients, authorization-code flow); prefer Sanctum for first-party SPAs/tokens.',
      '- Use the authorization-code grant with PKCE for public clients; avoid the password grant (deprecated in OAuth2.1).',
      '- Scope access tokens narrowly and check scopes with the `scope`/`scopes` middleware; keep token lifetimes short and issue refresh tokens.',
      '- Keep the Passport signing keys (`storage/oauth-*.key`) out of version control and readable only by the app user.',
      '- Protect API routes with the `auth:api` guard; hash passwords with the `Hash` facade.',
    ]),
};
