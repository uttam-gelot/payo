import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for tower-sessions (Rust) — keyed by the `authApproach` answer value. */
export const towerSessions: TechModule = {
  id: 'tower-sessions',
  title: 'tower-sessions',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'tower-sessions',
  questions: () => [
    {
      id: 'tower-sessions.store',
      type: 'select',
      summary: 'Session store',
      message: 'Backing store for sessions?',
      options: [
        { value: 'db-redis', label: 'Postgres/Redis store', hint: 'recommended' },
        { value: 'memory', label: 'In-memory (dev only)' },
      ],
    },
  ],
  guidance: (a) => {
    const persistent = a['tower-sessions.store'] !== 'memory';
    const lines = [
      '- Add the `SessionManagerLayer` to the tower/Axum service; configure httpOnly + SameSite + Secure cookies and a sane expiry.',
      persistent
        ? '- Use a persistent store (Postgres/Redis) so sessions survive restarts and can be revoked centrally; run the store migration as part of setup.'
        : '- The in-memory store is for development only — sessions vanish on restart and do not scale across instances; switch to Postgres/Redis before production.',
      '- Store only an opaque user reference in the session; load user/permissions server-side and re-check authorization on every protected handler.',
      '- Cycle the session id on login (and clear on logout) to prevent fixation; pair with argon2/bcrypt password hashing and env-held secrets.',
    ];
    return guidanceSection('Authentication — tower-sessions', lines);
  },
};
