import type { TechModule } from '../../types';

/** Actix Web — Rust web framework. */
export const actix: TechModule = {
  id: 'actix',
  title: 'Actix Web',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'rust' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'actix', label: 'Actix Web' }],
  questions: () => [
    {
      id: 'actix.state',
      type: 'select',
      summary: 'Shared state',
      message: 'Shared application state?',
      options: [
        { value: 'app-data', label: 'web::Data<T> app state', hint: 'recommended' },
        { value: 'extension', label: 'Request extensions' },
      ],
    },
    {
      id: 'actix.errors',
      type: 'confirm',
      summary: 'ResponseError',
      message: 'Implement ResponseError for typed error responses?',
      recommended: true,
    },
  ],
};
