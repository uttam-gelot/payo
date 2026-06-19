import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Better Auth — keyed by the `authApproach` answer value. */
export const betterAuth: TechModule = {
  id: 'better-auth',
  title: 'Better Auth',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'better-auth',
  questions: () => [
    {
      id: 'better-auth.methods',
      type: 'multiselect',
      summary: 'Auth methods',
      message: 'Which auth methods?',
      options: [
        { value: 'email-password', label: 'Email + password', hint: 'recommended' },
        { value: 'social', label: 'Social / OAuth providers' },
        { value: 'magic-link', label: 'Magic link' },
        { value: 'passkey', label: 'Passkeys / WebAuthn' },
      ],
      required: false,
    },
  ],
  guidance: (a) => {
    const methods = Array.isArray(a['better-auth.methods'])
      ? (a['better-auth.methods'] as string[])
      : [];
    const lines = [
      '- Define one `betterAuth` server instance (plugins, providers, DB adapter) and a matching client; import both from a single module.',
      '- Mount the framework handler at the auth route and call it through the typed client — do not hand-roll endpoints Better Auth already exposes.',
      '- Read sessions server-side via the instance API; enable cookie caching for hot paths but treat the DB as the source of truth.',
      '- Add capabilities (organizations, 2FA, passkeys) as plugins rather than custom code; keep the secret + provider keys in env vars.',
    ];
    if (methods.includes('passkey'))
      lines.push(
        '- Configure the passkey/WebAuthn plugin; offer passkeys alongside a fallback method, not as the sole option.',
      );
    if (methods.includes('magic-link'))
      lines.push('- Rate-limit magic-link requests and expire links quickly.');
    return guidanceSection('Authentication — Better Auth', lines);
  },
};
