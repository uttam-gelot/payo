import type { TechModule } from '../../types';

/** Django — Python full-featured backend framework. */
export const django: TechModule = {
  id: 'django',
  title: 'Django',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'python' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'django', label: 'Django' }],
  questions: () => [
    {
      id: 'django.api',
      type: 'select',
      summary: 'API layer',
      message: 'API layer?',
      options: [
        { value: 'drf', label: 'Django REST Framework', hint: 'recommended' },
        { value: 'ninja', label: 'Django Ninja' },
        { value: 'plain', label: 'Plain Django views' },
      ],
    },
    {
      id: 'django.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Project structure?',
      options: [
        { value: 'apps', label: 'Apps-based (per domain)', hint: 'recommended' },
        { value: 'monolith', label: 'Single app' },
      ],
    },
    {
      id: 'django.settings',
      type: 'select',
      summary: 'Settings',
      message: 'Settings layout?',
      options: [
        { value: 'split', label: 'Split settings (base/dev/prod)', hint: 'recommended' },
        { value: 'single', label: 'Single settings module' },
      ],
    },
  ],
};
