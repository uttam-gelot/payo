import type { TechModule } from '../../types';

/** Litestar — Python async backend framework. */
export const litestar: TechModule = {
  id: 'litestar',
  title: 'Litestar',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'python' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'litestar', label: 'Litestar' }],
  questions: () => [
    {
      id: 'litestar.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'controllers', label: 'Controllers + dependency injection', hint: 'recommended' },
        { value: 'handlers', label: 'Function handlers' },
      ],
    },
    {
      id: 'litestar.validation',
      type: 'select',
      summary: 'Models / validation',
      message: 'Model / validation layer?',
      options: [
        { value: 'msgspec', label: 'msgspec structs', hint: 'recommended' },
        { value: 'pydantic', label: 'Pydantic models' },
      ],
    },
  ],
  devCommand: () => 'litestar run --reload',
  testCommand: () => 'pytest',
};
