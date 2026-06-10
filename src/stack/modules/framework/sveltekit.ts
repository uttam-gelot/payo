import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

/** SvelteKit — Svelte meta-framework (frontend or full-stack). */
export const sveltekit: TechModule = {
  id: 'sveltekit',
  title: 'SvelteKit',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType !== 'backend',
  options: () => [{ value: 'sveltekit', label: 'SvelteKit' }],
  questions: () => [
    {
      id: 'sveltekit.rendering',
      type: 'select',
      summary: 'Rendering',
      message: 'Rendering mode?',
      options: [
        { value: 'ssr', label: 'Server-side rendering (SSR)', hint: 'recommended' },
        { value: 'ssg', label: 'Static (adapter-static)' },
        { value: 'spa', label: 'SPA' },
      ],
    },
    {
      id: 'sveltekit.adapter',
      type: 'select',
      summary: 'Adapter',
      message: 'Deployment adapter?',
      options: [
        { value: 'auto', label: 'adapter-auto', hint: 'recommended' },
        { value: 'node', label: 'adapter-node' },
        { value: 'vercel', label: 'adapter-vercel' },
        { value: 'cloudflare', label: 'adapter-cloudflare' },
      ],
    },
  ],
  scaffold: (a) => pmCreate(a, 'svelte'),
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
