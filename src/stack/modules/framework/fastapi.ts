import type { TechModule } from '../../types';

/** FastAPI — Python async backend framework. Recommended Python default. */
export const fastapi: TechModule = {
  id: 'fastapi',
  title: 'FastAPI',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'python' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'fastapi', label: 'FastAPI', hint: 'recommended' }],
  questions: () => [
    {
      id: 'fastapi.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'routers', label: 'APIRouters + dependency injection', hint: 'recommended' },
        { value: 'single', label: 'Single-module app' },
      ],
    },
    {
      id: 'fastapi.async',
      type: 'select',
      summary: 'Concurrency',
      message: 'Endpoint concurrency model?',
      options: [
        { value: 'async', label: 'async def endpoints', hint: 'recommended' },
        { value: 'sync', label: 'sync def endpoints' },
      ],
    },
    {
      id: 'fastapi.server',
      type: 'select',
      summary: 'ASGI server',
      message: 'ASGI server?',
      options: [
        { value: 'uvicorn', label: 'uvicorn', hint: 'recommended' },
        { value: 'gunicorn-uvicorn', label: 'gunicorn + uvicorn workers' },
        { value: 'hypercorn', label: 'hypercorn' },
      ],
    },
  ],
};
