import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

/** Remix / React Router 7 framework mode (frontend or full-stack). */
export const remix: TechModule = {
  id: 'remix',
  title: 'Remix / React Router 7',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType !== 'backend',
  options: () => [{ value: 'remix', label: 'Remix / React Router 7' }],
  questions: () => [
    {
      id: 'remix.variant',
      type: 'select',
      summary: 'Variant',
      message: 'Which variant?',
      options: [
        { value: 'react-router-7', label: 'React Router 7 (framework mode)', hint: 'recommended' },
        { value: 'classic-remix', label: 'Classic Remix' },
      ],
    },
    {
      id: 'remix.rendering',
      type: 'select',
      summary: 'Rendering',
      message: 'Rendering mode?',
      options: [
        { value: 'ssr', label: 'Server-side rendering (loaders/actions)', hint: 'recommended' },
        { value: 'ssg', label: 'Static prerender' },
      ],
    },
  ],
  scaffold: (a) => pmCreate(a, 'remix'),
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
