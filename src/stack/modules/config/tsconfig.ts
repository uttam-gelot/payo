import type { TechModule } from '../../types';
import { isTs } from '../../predicates';

/**
 * TypeScript compiler config. Not a selectable tech — it applies whenever the
 * language is TypeScript, so it has no options() and gates purely on appliesTo.
 * Only the highest-impact knobs are asked.
 */
export const tsconfig: TechModule = {
  id: 'tsconfig',
  title: 'TypeScript Config',
  category: 'config',
  appliesTo: (a) => isTs(a),
  questions: (a) => [
    {
      id: 'tsconfig.strict',
      type: 'confirm',
      summary: 'Strict mode',
      message: 'Enable TypeScript strict mode (strict: true)?',
      recommended: true,
    },
    {
      id: 'tsconfig.target',
      type: 'select',
      summary: 'Compile target',
      message: 'Compilation target (compilerOptions.target)?',
      options: [
        { value: 'ES2022', label: 'ES2022', hint: 'recommended' },
        { value: 'ESNext', label: 'ESNext' },
        { value: 'ES2020', label: 'ES2020' },
      ],
    },
    {
      id: 'tsconfig.module-resolution',
      type: 'select',
      summary: 'Module resolution',
      message: 'Module resolution (compilerOptions.moduleResolution)?',
      // Bundler for app/UI projects; NodeNext for plain backends.
      options:
        a.projectType === 'backend'
          ? [
              { value: 'nodenext', label: 'NodeNext (Node ESM)', hint: 'recommended' },
              { value: 'bundler', label: 'Bundler' },
              { value: 'node', label: 'Node (classic / CommonJS)' },
            ]
          : [
              { value: 'bundler', label: 'Bundler', hint: 'recommended' },
              { value: 'nodenext', label: 'NodeNext (Node ESM)' },
              { value: 'node', label: 'Node (classic / CommonJS)' },
            ],
    },
    {
      id: 'tsconfig.path-aliases',
      type: 'confirm',
      summary: 'Path aliases',
      message: 'Use path aliases (e.g. @/* via baseUrl/paths)?',
      recommended: true,
    },
  ],
};
