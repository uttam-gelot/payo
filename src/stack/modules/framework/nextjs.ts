import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';

export const nextjs: TechModule = {
  id: 'nextjs',
  title: 'Next.js',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType !== 'backend',
  // Recommended default for full-stack; on frontend, React is the recommended default.
  options: (a) => [
    {
      value: 'nextjs',
      label: 'Next.js',
      ...(a.projectType === 'full-stack' ? { hint: 'recommended' } : {}),
    },
  ],
  questions: () => [
    {
      id: 'nextjs.router',
      type: 'select',
      summary: 'Router',
      message: 'Which router?',
      options: [
        { value: 'app', label: 'App Router (app/)', hint: 'recommended' },
        { value: 'pages', label: 'Pages Router (pages/)' },
      ],
    },
    {
      id: 'nextjs.components',
      type: 'select',
      summary: 'Component model',
      message: 'Default component model?',
      options: [
        { value: 'server', label: 'Server Components by default', hint: 'recommended' },
        { value: 'client', label: 'Client Components by default' },
      ],
      when: (a) => a['nextjs.router'] === 'app',
    },
    {
      id: 'nextjs.data',
      type: 'select',
      summary: 'Data fetching',
      message: 'Primary data-fetching approach?',
      options: [
        { value: 'server-fetch', label: 'fetch() in Server Components', hint: 'recommended' },
        { value: 'route-handlers', label: 'Route Handlers (app/api)' },
        { value: 'client-query', label: 'Client-side (TanStack Query / SWR)' },
      ],
    },
  ],
};
