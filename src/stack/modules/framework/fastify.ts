import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';

/** Fastify backend framework. */
export const fastify: TechModule = {
  id: 'fastify',
  title: 'Fastify',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'fastify', label: 'Fastify' }],
  questions: () => [
    {
      id: 'fastify.validation',
      type: 'select',
      summary: 'Schema validation',
      message: 'Schema / validation approach?',
      options: [
        { value: 'typebox', label: 'JSON Schema via TypeBox', hint: 'recommended' },
        { value: 'zod', label: 'Zod (fastify-type-provider-zod)' },
      ],
    },
    {
      id: 'fastify.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'plugins', label: 'Plugin-based (encapsulation)', hint: 'recommended' },
        { value: 'layered', label: 'Layered routes / services' },
      ],
    },
    {
      id: 'fastify.logging',
      type: 'confirm',
      summary: 'Built-in pino logging',
      message: 'Use the built-in pino logger?',
      recommended: true,
    },
  ],
};
