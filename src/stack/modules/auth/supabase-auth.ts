import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Auth module for Supabase Auth — keyed by the `authApproach` answer value. */
export const supabaseAuth: TechModule = {
  id: 'supabase-auth',
  title: 'Supabase Auth',
  category: 'auth',
  appliesTo: (a) => a.authApproach === 'supabase-auth',
  questions: () => [
    {
      id: 'supabase-auth.authz',
      type: 'select',
      summary: 'Authorization',
      message: 'Primary authorization mechanism?',
      options: [
        { value: 'rls', label: 'Row Level Security (RLS) policies', hint: 'recommended' },
        { value: 'app-layer', label: 'Application-layer checks' },
      ],
    },
    {
      id: 'supabase-auth.ssr',
      type: 'confirm',
      summary: 'SSR cookies',
      message: 'Use @supabase/ssr for cookie-based sessions?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const rls = a['supabase-auth.authz'] !== 'app-layer';
    const lines = [
      rls
        ? '- Enforce authorization with Row Level Security policies on every table; treat RLS as the real access boundary, not client checks.'
        : '- Enforce authorization in the application layer; still enable RLS as a backstop so a leaked anon key cannot read everything.',
      '- Use the anon key on the client (RLS-scoped); keep the service-role key server-only — it bypasses RLS and must never reach the browser.',
      '- Get the user from `supabase.auth.getUser()` (verifies the JWT) rather than trusting `getSession()` on the server.',
    ];
    lines.push(
      a['supabase-auth.ssr'] === true
        ? '- Manage sessions with `@supabase/ssr` using cookies; create a fresh server client per request and refresh tokens in middleware.'
        : '- Manage the session client-side and pass the access token explicitly to server calls.',
    );
    return guidanceSection('Authentication — Supabase Auth', lines);
  },
};
