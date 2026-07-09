import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Laravel Breeze — keyed by the `authApproach` answer value. */
export const laravelBreeze: TechModule = {
  id: 'laravel-breeze',
  title: 'Laravel Breeze',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'laravel-breeze',
  questions: () => [],
  guidance: () =>
    guidanceSection('Authentication — Laravel Breeze', [
      '- Breeze scaffolds the auth controllers, routes, and views — treat the generated code as yours: customize in place rather than fighting the defaults.',
      '- Keep registration/login/password-reset flows on the built-in session guard; protect app routes with the `auth` (and `verified`) middleware.',
      '- Enforce email verification (`MustVerifyEmail`) for sensitive areas and rate-limit the login route (Breeze wires this by default — keep it).',
      '- Passwords hash via the `Hash` facade; never weaken the default bcrypt/argon2 cost or store plaintext.',
    ]),
};
