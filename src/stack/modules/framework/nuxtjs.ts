import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

/** Nuxt — Vue meta-framework (frontend or full-stack). */
export const nuxtjs: TechModule = {
  id: 'nuxtjs',
  title: 'Nuxt',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType !== 'backend',
  options: () => [{ value: 'nuxtjs', label: 'Nuxt' }],
  questions: () => [
    {
      id: 'nuxtjs.rendering',
      type: 'select',
      summary: 'Rendering',
      message: 'Rendering mode?',
      options: [
        { value: 'ssr', label: 'Universal (SSR)', hint: 'recommended' },
        { value: 'ssg', label: 'Static (SSG)' },
        { value: 'spa', label: 'Client-only (SPA)' },
      ],
    },
    {
      id: 'nuxtjs.data',
      type: 'select',
      summary: 'Data fetching',
      message: 'Primary data-fetching approach?',
      options: [
        { value: 'use-fetch', label: 'useFetch / useAsyncData', hint: 'recommended' },
        { value: 'external-client', label: 'External client (TanStack Query / ofetch)' },
      ],
    },
  ],
  scaffold: (a) => pmCreate(a, 'nuxt'),
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
