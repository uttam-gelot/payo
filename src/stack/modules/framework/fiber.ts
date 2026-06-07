import type { TechModule } from '../../types';

/** Fiber — Go fasthttp-based framework. */
export const fiber: TechModule = {
  id: 'fiber',
  title: 'Fiber',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'go' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'fiber', label: 'Fiber' }],
  questions: () => [
    {
      id: 'fiber.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'layered', label: 'handler / service / repository', hint: 'recommended' },
        { value: 'flat', label: 'Flat package layout' },
      ],
    },
    {
      id: 'fiber.validation',
      type: 'confirm',
      summary: 'Validator',
      message: 'Use go-playground/validator for request validation?',
      recommended: true,
    },
  ],
};
