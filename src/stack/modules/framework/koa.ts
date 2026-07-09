import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmRun } from '../../commands';

/** Koa backend framework — minimal middleware core, async/await native. */
export const koa: TechModule = {
  id: 'koa',
  title: 'Koa',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'koa', label: 'Koa' }],
  questions: () => [
    {
      id: 'koa.router',
      type: 'select',
      summary: 'Router',
      message: 'Routing?',
      options: [
        { value: '@koa/router', label: '@koa/router', hint: 'recommended' },
        { value: 'koa-router', label: 'koa-router (legacy)' },
        { value: 'none', label: 'None (manual)' },
      ],
    },
    {
      id: 'koa.bodyparser',
      type: 'confirm',
      summary: 'Body parser',
      message: 'Use @koa/bodyparser for request bodies?',
      recommended: true,
    },
    {
      id: 'koa.security',
      type: 'confirm',
      summary: 'Security middleware',
      message: 'Use security middleware (@koa/cors, koa-helmet)?',
      recommended: true,
    },
  ],
  // No official generator; commands map to the skeleton's package.json scripts.
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
