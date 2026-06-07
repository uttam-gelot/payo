import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';

/** Express backend framework. Recommended default for a JavaScript backend. */
export const express: TechModule = {
  id: 'express',
  title: 'Express',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  // Recommended for a JS backend; on TS, NestJS leads.
  options: (a) => [
    {
      value: 'express',
      label: 'Express',
      ...(a.projectType === 'backend' && a.language === 'javascript'
        ? { hint: 'recommended' }
        : {}),
    },
  ],
  questions: () => [
    {
      id: 'express.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        {
          value: 'layered',
          label: 'Layered (routes / controllers / services)',
          hint: 'recommended',
        },
        { value: 'mvc', label: 'MVC' },
      ],
    },
    {
      id: 'express.security',
      type: 'confirm',
      summary: 'Security middleware',
      message: 'Use security middleware (helmet, cors)?',
      recommended: true,
    },
  ],
};
