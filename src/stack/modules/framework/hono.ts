import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';

/** Hono — lightweight backend framework, multi-runtime. */
export const hono: TechModule = {
  id: 'hono',
  title: 'Hono',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'hono', label: 'Hono' }],
  questions: () => [
    {
      id: 'hono.runtime',
      type: 'select',
      summary: 'Runtime',
      message: 'Target runtime?',
      options: [
        { value: 'bun', label: 'Bun', hint: 'recommended' },
        { value: 'node', label: 'Node.js' },
        { value: 'cloudflare', label: 'Cloudflare Workers' },
        { value: 'deno', label: 'Deno' },
      ],
    },
    {
      id: 'hono.validation',
      type: 'select',
      summary: 'Validation',
      message: 'Request validation?',
      options: [
        { value: 'zod-validator', label: '@hono/zod-validator', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ],
    },
    {
      id: 'hono.rpc',
      type: 'confirm',
      summary: 'Hono RPC client',
      message: 'Expose the typed Hono RPC client?',
      recommended: false,
    },
  ],
};
