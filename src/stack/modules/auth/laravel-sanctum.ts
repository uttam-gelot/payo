import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Laravel Sanctum — keyed by the `authApproach` answer value. */
export const laravelSanctum: TechModule = {
  id: 'laravel-sanctum',
  title: 'Laravel Sanctum',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'laravel-sanctum',
  questions: () => [
    {
      id: 'laravel-sanctum.mode',
      type: 'select',
      summary: 'Sanctum mode',
      message: 'Sanctum authentication mode?',
      options: [
        { value: 'spa', label: 'SPA (cookie / session)', hint: 'recommended' },
        { value: 'token', label: 'API tokens (mobile / third-party)' },
      ],
    },
  ],
  guidance: (a) => {
    const spa = a['laravel-sanctum.mode'] !== 'token';
    const lines = spa
      ? [
          '- SPA mode: authenticate through the session cookie + CSRF; call `/sanctum/csrf-cookie` before login and keep the SPA on a first-party (stateful) domain.',
          '- Configure `SANCTUM_STATEFUL_DOMAINS` and `config/cors.php` (`supports_credentials => true`) to your frontend origin only — never `*`.',
          '- Protect routes with the `auth:sanctum` middleware; rely on the session guard, not manual token parsing.',
        ]
      : [
          '- API-token mode: issue tokens with `$user->createToken(name, abilities)`; scope abilities narrowly and check them with `tokenCan()`.',
          '- Store only the hashed token (Sanctum does this); return the plaintext once at creation and never log it.',
          '- Protect routes with `auth:sanctum`; revoke tokens on logout (`$user->tokens()->delete()`) and support per-token expiry.',
        ];
    lines.push(
      '- Hash passwords with Laravel’s `Hash` facade (bcrypt/argon2); never store or compare plaintext.',
    );
    return guidanceSection('Authentication — Laravel Sanctum', lines);
  },
};
