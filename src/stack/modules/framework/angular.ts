import type { TechModule } from '../../types';
import { pmRun } from '../../commands';

/** Angular SPA framework (TypeScript only). */
export const angular: TechModule = {
  id: 'angular',
  title: 'Angular',
  category: 'framework',
  appliesTo: (a) => a.language === 'typescript' && a.projectType === 'frontend',
  options: () => [{ value: 'angular', label: 'Angular' }],
  questions: () => [
    {
      id: 'angular.components',
      type: 'select',
      summary: 'Component model',
      message: 'Component model?',
      options: [
        { value: 'standalone', label: 'Standalone components', hint: 'recommended' },
        { value: 'ngmodules', label: 'NgModules' },
      ],
    },
    {
      id: 'angular.state',
      type: 'select',
      summary: 'State management',
      message: 'State management approach?',
      options: [
        { value: 'signals', label: 'Signals', hint: 'recommended' },
        { value: 'ngrx', label: 'NgRx' },
        { value: 'services', label: 'Plain services' },
      ],
    },
    {
      id: 'angular.ssr',
      type: 'confirm',
      summary: 'SSR (Angular Universal)',
      message: 'Use server-side rendering (Angular Universal)?',
      recommended: false,
    },
  ],
  scaffold: () => 'npx -p @angular/cli ng new <app>',
  devCommand: (a) => pmRun(a, 'start'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
