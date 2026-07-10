import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for OmniAuth — keyed by the `authApproach` answer value. */
export const omniauth: TechModule = {
  id: 'omniauth',
  title: 'OmniAuth',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'omniauth',
  questions: () => [],
  guidance: () =>
    guidanceSection('Authentication — OmniAuth', [
      '- Add `omniauth-rails_csrf_protection` and make the request phase POST-only — a GET request phase is a known CSRF/login-CSRF vector.',
      '- Whitelist the exact providers and scopes you use; request the minimum scopes and store only the identity fields you need (provider + uid + email).',
      '- Look users up by `(provider, uid)`, not by email alone, so a spoofed or reused email cannot hijack an account; verify `info.email` is provider-verified before trusting it.',
      '- Keep client IDs/secrets in encrypted credentials or ENV — never commit them; use HTTPS callback URLs registered with each provider.',
      '- Pair OmniAuth with your own user model or Devise (`:omniauthable`) for session management rather than treating the OAuth token as the session.',
      '- Handle the failure endpoint (`/auth/failure`) and validate the `state` parameter to defend against CSRF on the callback.',
    ]),
};
