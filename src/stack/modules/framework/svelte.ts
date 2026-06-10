import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

/** Svelte SPA framework (use SvelteKit for full-stack). */
export const svelte: TechModule = {
  id: 'svelte',
  title: 'Svelte',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType === 'frontend',
  options: () => [{ value: 'svelte', label: 'Svelte' }],
  questions: () => [
    {
      id: 'svelte.version',
      type: 'select',
      summary: 'Reactivity model',
      message: 'Reactivity model?',
      options: [
        { value: 'runes', label: 'Svelte 5 runes', hint: 'recommended' },
        { value: 'stores', label: 'Svelte 4 stores' },
      ],
    },
    {
      id: 'svelte.build',
      type: 'select',
      summary: 'Build tool',
      message: 'Build tool?',
      options: [
        { value: 'vite', label: 'Vite', hint: 'recommended' },
        { value: 'other', label: 'Other' },
      ],
    },
  ],
  scaffold: (a) => pmCreate(a, 'svelte'),
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
