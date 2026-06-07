import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';

/** React SPA library. Recommended frontend default. */
export const react: TechModule = {
  id: 'react',
  title: 'React',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType === 'frontend',
  options: () => [{ value: 'react', label: 'React', hint: 'recommended' }],
  questions: () => [
    {
      id: 'react.buildTool',
      type: 'select',
      summary: 'Build tool',
      message: 'Build tool / bundler?',
      options: [
        { value: 'vite', label: 'Vite', hint: 'recommended' },
        { value: 'rsbuild', label: 'Rsbuild' },
        { value: 'webpack', label: 'Webpack' },
      ],
    },
    {
      id: 'react.router',
      type: 'select',
      summary: 'Routing',
      message: 'Client-side routing?',
      options: [
        { value: 'react-router', label: 'React Router', hint: 'recommended' },
        { value: 'tanstack-router', label: 'TanStack Router' },
        { value: 'none', label: 'None' },
      ],
    },
  ],
};
