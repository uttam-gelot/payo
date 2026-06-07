import type { TechModule } from '../../types';

/** Gin — Go HTTP framework. Recommended Go default. */
export const gin: TechModule = {
  id: 'gin',
  title: 'Gin',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'go' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'gin', label: 'Gin', hint: 'recommended' }],
  questions: () => [
    {
      id: 'gin.structure',
      type: 'select',
      summary: 'Structure',
      message: 'Application structure?',
      options: [
        { value: 'layered', label: 'handler / service / repository', hint: 'recommended' },
        { value: 'flat', label: 'Flat package layout' },
      ],
    },
    {
      id: 'gin.validation',
      type: 'confirm',
      summary: 'Binding + validator',
      message: 'Use binding + go-playground/validator for request validation?',
      recommended: true,
    },
    {
      id: 'gin.config',
      type: 'select',
      summary: 'Config',
      message: 'Configuration loading?',
      options: [
        { value: 'env', label: 'Environment variables', hint: 'recommended' },
        { value: 'viper', label: 'Viper' },
      ],
    },
  ],
};
