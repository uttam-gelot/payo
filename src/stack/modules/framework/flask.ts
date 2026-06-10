import type { TechModule } from '../../types';

/** Flask — Python micro backend framework. */
export const flask: TechModule = {
  id: 'flask',
  title: 'Flask',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'python' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'flask', label: 'Flask' }],
  questions: () => [
    {
      id: 'flask.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'app-factory', label: 'App factory + blueprints', hint: 'recommended' },
        { value: 'single', label: 'Single-module app' },
      ],
    },
    {
      id: 'flask.api',
      type: 'select',
      summary: 'API extension',
      message: 'API layer?',
      options: [
        { value: 'smorest', label: 'flask-smorest (OpenAPI)', hint: 'recommended' },
        { value: 'restful', label: 'Flask-RESTful' },
        { value: 'plain', label: 'Plain views' },
      ],
    },
  ],
  devCommand: () => 'flask run --debug',
  testCommand: () => 'pytest',
};
