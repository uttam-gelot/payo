/**
 * The questionnaire flow: an ordered list of producers. Core questions are
 * one-question producers; expansion points inject the selected module's
 * follow-up questions. Importing this module registers all tech modules.
 */
import type { FlowSection, Question } from './types';
import * as opt from './options';
import { getModule, modulesFor } from '../stack/registry';
import { hasModeledDb } from '../stack/predicates';
import { config } from '../config';
import '../stack/modules/index'; // side-effect: register modules

/**
 * A recommendable section for whichever tech module is stored at `key`. The
 * gate title comes from the selected module, and its follow-up questions can be
 * skipped in favor of the module's recommended defaults.
 */
const expandSelected = (key: string): FlowSection => ({
  recommendable: true,
  gate: (a): { id: string; title: string } | null => {
    const m = getModule(a[key]);
    return m ? { id: `${m.id}.__recommended`, title: m.title ?? m.id } : null;
  },
  questions: (a) => getModule(a[key])?.questions(a) ?? [],
});

const core: Record<string, Question> = {
  aiTool: {
    id: 'aiTool',
    type: 'select',
    message: 'Which AI coding tool are you using?',
    optionsFrom: opt.aiToolOptions,
    // Closed set: only natively-supported tools, no free-text Other.
    allowOther: false,
  },
  projectType: {
    id: 'projectType',
    type: 'select',
    message: 'What type of project is this?',
    options: opt.projectTypeOptions,
  },
  projectDefinition: {
    id: 'projectDefinition',
    type: 'text',
    message: 'Describe your project in 1–2 sentences.',
    placeholder: 'e.g. REST API for an e-commerce platform',
    validate: (input) => {
      const max = config.questionnaire.maxDescriptionChars;
      if (!input?.trim()) return 'Please provide a short description.';
      if (input.trim().length > max) return `Keep it under ${max} characters.`;
      return undefined;
    },
  },
  language: {
    id: 'language',
    type: 'select',
    message: 'Primary language?',
    optionsFrom: opt.languageOptions,
  },
  framework: {
    id: 'framework',
    type: 'select',
    message: 'Framework?',
    optionsFrom: opt.frameworkOptions,
  },
  apiArchitecture: {
    id: 'apiArchitecture',
    type: 'select',
    message: 'API Architecture?',
    options: opt.apiArchitectureOptions,
    when: (a) => a.projectType !== 'frontend',
  },
  styling: {
    id: 'stylingLibrary',
    type: 'select',
    message: 'Styling / UI Library?',
    options: opt.stylingOptions,
    when: (a) => a.projectType !== 'backend',
  },
  database: {
    id: 'database',
    type: 'select',
    message: 'Database?',
    options: opt.databaseOptions,
  },
  orm: {
    id: 'orm',
    type: 'select',
    summary: 'ORM / data access',
    message: 'ORM / data-access layer?',
    optionsFrom: opt.ormOptions,
    when: (a) => hasModeledDb(a),
  },
  structure: {
    id: 'structure',
    type: 'select',
    summary: 'Folder structure',
    message: 'Codebase folder structure?',
    options: opt.structureOptions,
  },
  codingStandards: {
    id: 'codingStandards',
    type: 'multiselect',
    summary: 'Coding standards',
    message: 'Coding standards? (space to select, enter to confirm)',
    options: opt.codingStandardOptions,
    required: true,
  },
  documentation: {
    id: 'documentation',
    type: 'multiselect',
    summary: 'Documentation',
    message: 'Which docs should the assistant maintain? (space to select, enter to confirm)',
    options: opt.documentationOptions,
    required: false,
  },
  formatter: {
    id: 'formatter',
    type: 'select',
    summary: 'Formatter',
    message: 'Code Formatter?',
    optionsFrom: opt.formatterOptions,
  },
  linter: {
    id: 'linter',
    type: 'select',
    summary: 'Linter',
    message: 'Code Linter?',
    optionsFrom: opt.linterOptions,
  },
  gitWorkflow: {
    id: 'gitWorkflow',
    type: 'select',
    summary: 'Git workflow',
    message: 'Git workflow standards?',
    options: opt.gitWorkflowOptions,
  },
  aiAttribution: {
    id: 'aiAttribution',
    type: 'confirm',
    summary: 'AI attribution in commits/PRs',
    message: 'Mention the AI assistant (e.g. a Co-Authored-By trailer) in commits and PRs?',
    recommended: false,
  },
  logger: {
    id: 'logger',
    type: 'select',
    summary: 'Logger',
    message: 'Logging library?',
    optionsFrom: opt.loggerOptions,
  },
  testTypes: {
    id: 'testTypes',
    type: 'multiselect',
    summary: 'Test types',
    message: 'Which kinds of tests? (space to select, enter to confirm)',
    optionsFrom: opt.testTypeOptions,
    required: true,
  },
  testRunner: {
    id: 'testRunner',
    type: 'select',
    summary: 'Test runner',
    message: 'Test runner for unit / integration tests?',
    optionsFrom: opt.testRunnerOptions,
  },
  e2eTool: {
    id: 'e2eTool',
    type: 'select',
    summary: 'E2E tool',
    message: 'End-to-end testing tool?',
    options: opt.e2eToolOptions,
    when: (a) => Array.isArray(a.testTypes) && a.testTypes.includes('e2e'),
  },
  authApproach: {
    id: 'authApproach',
    type: 'select',
    summary: 'Auth approach',
    message: 'Authentication approach?',
    optionsFrom: opt.authApproachOptions,
  },
  authStrategy: {
    id: 'authStrategy',
    type: 'select',
    summary: 'Session strategy',
    message: 'Session strategy?',
    options: opt.authStrategyOptions,
    when: (a) => a.projectType !== 'frontend' && a.authApproach !== 'none',
  },
  rbac: {
    id: 'rbac',
    type: 'confirm',
    summary: 'Role-based access control',
    message: 'Use role-based access control (RBAC)?',
    recommended: false,
    when: (a) => a.authApproach !== 'none',
  },
  packageManager: {
    id: 'packageManager',
    type: 'select',
    summary: 'Package manager',
    message: 'Package manager?',
    optionsFrom: opt.packageManagerOptions,
    when: (a) =>
      a.language === 'typescript' || a.language === 'javascript' || a.language === 'python',
  },
  runtime: {
    id: 'runtime',
    type: 'select',
    summary: 'Runtime',
    message: 'JavaScript runtime?',
    options: opt.runtimeOptions,
    when: (a) => a.language === 'typescript' || a.language === 'javascript',
  },
  validation: {
    id: 'validation',
    type: 'select',
    summary: 'Validation',
    message: 'Validation library?',
    optionsFrom: opt.validationOptions,
  },
  stateManagement: {
    id: 'stateManagement',
    type: 'select',
    summary: 'State management',
    message: 'State management?',
    optionsFrom: opt.stateManagementOptions,
    when: (a) => a.projectType !== 'backend',
  },
};

/** Wrap stack-defining single questions — asked individually, no recommended gate. */
const single = (...qs: Question[]): FlowSection => ({ questions: () => qs });

export const flow: FlowSection[] = [
  single(core.aiTool),
  single(core.projectType),
  single(core.projectDefinition),
  single(core.language),
  single(core.framework),
  expandSelected('framework'),
  single(core.apiArchitecture),
  single(core.styling),
  single(core.database),
  expandSelected('database'),
  single(core.orm),
  expandSelected('orm'),
  // Authentication topic group — approach, session strategy, and RBAC.
  {
    recommendable: true,
    gate: () => ({ id: 'auth.__recommended', title: 'Authentication' }),
    questions: () => [core.authApproach, core.authStrategy, core.rbac],
  },
  // Conventions topic group — one recommended gate covers structure, standards,
  // documentation, and git workflow.
  {
    recommendable: true,
    gate: () => ({ id: 'conventions.__recommended', title: 'Conventions' }),
    questions: () => [
      core.structure,
      core.codingStandards,
      core.documentation,
      core.gitWorkflow,
      core.aiAttribution,
    ],
  },
  // Validation & state-management topic group (state asked only outside backend).
  {
    recommendable: true,
    gate: () => ({ id: 'appconv.__recommended', title: 'Validation & State' }),
    questions: () => [core.validation, core.stateManagement],
  },
  // Tooling topic group — package manager, runtime, formatter + linter.
  {
    recommendable: true,
    gate: () => ({ id: 'tooling.__recommended', title: 'Tooling' }),
    questions: () => [core.packageManager, core.runtime, core.formatter, core.linter],
  },
  // TypeScript compiler config — only surfaces when the language is TypeScript.
  {
    recommendable: true,
    gate: (a) =>
      modulesFor('config', a).length
        ? { id: 'tsconfig.__recommended', title: 'TypeScript Config' }
        : null,
    questions: (a) => modulesFor('config', a).flatMap((m) => m.questions(a)),
  },
  single(core.logger),
  // Testing topic group — kinds, runner, and E2E tool (E2E asked only when selected).
  {
    recommendable: true,
    gate: () => ({ id: 'testing.__recommended', title: 'Testing' }),
    questions: () => [core.testTypes, core.testRunner, core.e2eTool],
  },
];
