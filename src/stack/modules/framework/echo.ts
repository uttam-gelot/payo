import type { TechModule } from '../../types';

/** Echo — Go HTTP framework. */
export const echo: TechModule = {
  id: 'echo',
  title: 'Echo',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'go' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'echo', label: 'Echo' }],
  questions: () => [
    {
      id: 'echo.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'layered', label: 'handler / service / repository', hint: 'recommended' },
        { value: 'flat', label: 'Flat package layout' },
      ],
    },
    {
      id: 'echo.validation',
      type: 'confirm',
      summary: 'Validator',
      message: 'Use a custom Validator (go-playground/validator) for request binding?',
      recommended: true,
    },
  ],
  scaffold: () => 'go mod init <module>',
  devCommand: () => 'go run ./...',
  testCommand: () => 'go test ./...',
  buildCommand: () => 'go build ./...',
};
