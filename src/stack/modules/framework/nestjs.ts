import type { TechModule } from '../../types';
import { pmRun } from '../../commands';

export const nestjs: TechModule = {
  id: 'nestjs',
  title: 'NestJS',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'typescript' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  // Recommended default for a TypeScript backend; on full-stack, Next.js leads.
  options: (a) => [
    {
      value: 'nestjs',
      label: 'NestJS',
      ...(a.projectType === 'backend' ? { hint: 'recommended' } : {}),
    },
  ],
  questions: () => [
    {
      id: 'nestjs.arch',
      type: 'select',
      summary: 'Application structure',
      message: 'NestJS application structure?',
      options: [
        { value: 'modular', label: 'Modular (feature modules)', hint: 'recommended' },
        { value: 'monorepo', label: 'Monorepo (Nx / workspaces)' },
      ],
    },
    {
      id: 'nestjs.validation',
      type: 'confirm',
      summary: 'Request validation (class-validator + DTOs)',
      message: 'Use class-validator + DTOs for request validation?',
      recommended: true,
    },
    {
      id: 'nestjs.config',
      type: 'select',
      summary: 'Configuration',
      message: 'Configuration approach?',
      options: [
        { value: 'config-module', label: '@nestjs/config', hint: 'recommended' },
        { value: 'raw-env', label: 'Raw process.env' },
      ],
    },
  ],
  scaffold: () => 'npx @nestjs/cli new <app>',
  devCommand: (a) => pmRun(a, 'start:dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
