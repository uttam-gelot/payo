import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for django-allauth — keyed by the `authApproach` answer value. */
export const djangoAllauth: TechModule = {
  id: 'django-allauth',
  title: 'django-allauth',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'django-allauth',
  questions: () => [
    {
      id: 'django-allauth.social',
      type: 'confirm',
      summary: 'Social login',
      message: 'Enable social/OAuth providers (socialaccount)?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const lines = [
      '- Let allauth own signup/login/email-verification/password-reset flows; configure behavior through `ACCOUNT_*` settings rather than overriding its views.',
      '- Build on Django’s auth user/session — keep `request.user`, `login_required`, and permission checks as the access boundary; allauth augments, it does not replace them.',
      '- Require verified email (`ACCOUNT_EMAIL_VERIFICATION = "mandatory"`) for sensitive actions; rely on Django’s PBKDF2/argon2 hashers (never store raw passwords).',
      '- Keep `SECRET_KEY` and provider credentials in env vars, not settings literals.',
    ];
    if (a['django-allauth.social'] === true)
      lines.push(
        '- Configure social providers via `SOCIALACCOUNT_PROVIDERS` with client id/secret from env; review the scopes requested and the signup-on-first-login behavior.',
      );
    return guidanceSection('Authentication — django-allauth', lines);
  },
};
