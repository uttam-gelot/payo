import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Devise — keyed by the `authApproach` answer value. */
export const devise: TechModule = {
  id: 'devise',
  title: 'Devise',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'devise',
  questions: () => [],
  guidance: () =>
    guidanceSection('Authentication — Devise', [
      '- Devise is battle-tested — use its modules (`database_authenticatable`, `recoverable`, `confirmable`, `lockable`, `timeoutable`) instead of rolling your own auth.',
      '- Enforce email confirmation (`confirmable`) for sensitive apps and enable `lockable` to throttle brute-force attempts.',
      '- Permit extra sign-up/account fields via `configure_permitted_parameters` in a `before_action` — never disable Strong Parameters to accept them.',
      '- Passwords hash with bcrypt (Devise default); keep the cost factor at the default or higher and never store or log plaintext.',
      '- Protect controllers with `before_action :authenticate_user!`; scope every query to `current_user` to prevent broken object-level authorization.',
      '- Keep `config.secret_key` in encrypted credentials, rotate on compromise, and expire sessions with `timeoutable` for privileged areas.',
    ]),
};
