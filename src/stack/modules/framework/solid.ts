import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

/** SolidJS SPA framework. */
export const solid: TechModule = {
  id: 'solid',
  title: 'Solid',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType === 'frontend',
  options: () => [{ value: 'solid', label: 'SolidJS' }],
  questions: () => [
    {
      id: 'solid.router',
      type: 'select',
      summary: 'Routing',
      message: 'Client-side routing?',
      options: [
        { value: 'solid-router', label: 'Solid Router', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ],
    },
    {
      id: 'solid.build',
      type: 'select',
      summary: 'Build tool',
      message: 'Build tool?',
      options: [
        { value: 'vite', label: 'Vite', hint: 'recommended' },
        { value: 'other', label: 'Other' },
      ],
    },
  ],
  scaffold: (a) => pmCreate(a, 'solid'),
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
