import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for built-in Django auth — keyed by the `authApproach` answer value. */
export const djangoAuth: TechModule = {
  id: 'django-auth',
  title: 'Django auth (built-in)',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'django-auth',
  questions: () => [
    {
      id: 'django-auth.surface',
      type: 'select',
      summary: 'Auth surface',
      message: 'Where does auth live?',
      options: [
        { value: 'session-views', label: 'Server-rendered views + session', hint: 'recommended' },
        { value: 'drf-api', label: 'DRF API (token/session auth)' },
      ],
    },
  ],
  guidance: (a) => {
    const drf = a['django-auth.surface'] === 'drf-api';
    const lines = [
      '- Use `django.contrib.auth` for users, sessions, and password hashing (PBKDF2/argon2); never roll your own hashing or store raw passwords.',
      '- Gate access with `login_required`/`permission_required` (or `LoginRequiredMixin`) and the permission framework; check permissions server-side, not in templates only.',
      drf
        ? '- For the DRF API, configure `DEFAULT_AUTHENTICATION_CLASSES` + `DEFAULT_PERMISSION_CLASSES`; default to authenticated and use object-level permissions for ownership checks.'
        : '- Use the built-in `LoginView`/`LogoutView` and session middleware; rely on Django’s CSRF protection on every state-changing form.',
      '- Keep `SECRET_KEY` in env; in production set `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, and `SECURE_*` headers.',
    ];
    return guidanceSection('Authentication — Django auth', lines);
  },
};
