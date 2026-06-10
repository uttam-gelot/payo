import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

/** Astro — content-focused meta-framework (frontend or full-stack). */
export const astro: TechModule = {
  id: 'astro',
  title: 'Astro',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType !== 'backend',
  options: () => [{ value: 'astro', label: 'Astro' }],
  questions: () => [
    {
      id: 'astro.rendering',
      type: 'select',
      summary: 'Rendering',
      message: 'Output mode?',
      options: [
        { value: 'static', label: 'Static (SSG)', hint: 'recommended' },
        { value: 'hybrid', label: 'Hybrid / on-demand SSR' },
      ],
    },
    {
      id: 'astro.islands',
      type: 'select',
      summary: 'UI islands',
      message: 'Interactive UI islands?',
      options: [
        { value: 'none', label: 'None (content site)', hint: 'recommended' },
        { value: 'react', label: 'React islands' },
        { value: 'vue', label: 'Vue islands' },
        { value: 'svelte', label: 'Svelte islands' },
      ],
    },
    {
      id: 'astro.content',
      type: 'confirm',
      summary: 'Content Collections',
      message: 'Use Content Collections for content?',
      recommended: true,
    },
  ],
  scaffold: (a) => pmCreate(a, 'astro'),
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
