import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for fastapi-users — keyed by the `authApproach` answer value. */
export const fastapiUsers: TechModule = {
  id: 'fastapi-users',
  title: 'fastapi-users',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'fastapi-users',
  questions: () => [
    {
      id: 'fastapi-users.transport',
      type: 'select',
      summary: 'Token transport',
      message: 'How are tokens carried?',
      options: [
        { value: 'cookie', label: 'Cookie transport (httpOnly)', hint: 'recommended' },
        { value: 'bearer', label: 'Bearer header (Authorization)' },
      ],
    },
  ],
  guidance: (a) => {
    const cookie = a['fastapi-users.transport'] !== 'bearer';
    const lines = [
      '- Wire the `FastAPIUsers` instance with your user model, user manager, and an auth backend; mount its routers rather than hand-writing register/login/reset endpoints.',
      '- Protect routes with the `current_active_user` dependency; require verified/active users for sensitive operations.',
      cookie
        ? '- Use the cookie transport with httpOnly + SameSite + Secure cookies so the JWT is not reachable from JS; keep the cookie lifetime short.'
        : '- Use the bearer transport and have clients send `Authorization: Bearer`; keep access-token lifetimes short and never persist tokens in insecure storage.',
      '- Keep the JWT secret/lifetime in env; fastapi-users hashes passwords with a strong default — do not bypass its password helper.',
    ];
    return guidanceSection('Authentication — fastapi-users', lines);
  },
};
