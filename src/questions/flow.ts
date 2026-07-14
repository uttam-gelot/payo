/**
 * The questionnaire flow: an ordered list of producers. Core questions are
 * one-question producers; expansion points inject the selected module's
 * follow-up questions. Importing this module registers all tech modules.
 */
import type { Answers, FlowSection, Question } from './types';
import * as opt from './options';
import { getModule, modulesFor } from '../stack/registry';
import { dbFamily, hasModeledDb } from '../stack/predicates';
import '../stack/modules/index'; // side-effect: register modules

/**
 * The module backing the answer at `key`. `database` canonicalizes through
 * `dbFamily` so alias engines (neon/supabase/cockroachdb/mariadb/turso) get
 * their wire-compatible engine's follow-ups instead of a silent no-module miss.
 */
const selectedModule = (key: string, a: Answers): ReturnType<typeof getModule> =>
  getModule(key === 'database' ? dbFamily(a) : a[key]);

/**
 * A recommendable section for whichever tech module is stored at `key`. The
 * gate title comes from the selected module, and its follow-up questions can be
 * skipped in favor of the module's recommended defaults.
 */
const expandSelected = (key: string): FlowSection => ({
  recommendable: true,
  gate: (a): { id: string; title: string } | null => {
    const m = selectedModule(key, a);
    return m ? { id: `${m.id}.__recommended`, title: m.title ?? m.id } : null;
  },
  questions: (a) => selectedModule(key, a)?.questions(a) ?? [],
});

const core: Record<string, Question> = {
  aiTool: {
    id: 'aiTool',
    type: 'select',
    summary: 'Generator CLI',
    message: 'Which AI CLI should Payo use to write your skills?',
    optionsFrom: opt.aiToolOptions,
    // Closed set: only providers with a CLI runner, no free-text Other.
    allowOther: false,
  },
  supportTools: {
    id: 'supportTools',
    type: 'multiselect',
    summary: 'Supported tools',
    message: 'Which AI tools should the generated skills support?',
    optionsFrom: opt.supportToolOptions,
    // Preselect the generator CLI's own tool; the user adds any others.
    initialFrom: opt.defaultSupportTools,
    required: true,
    allowOther: false,
  },
  projectType: {
    id: 'projectType',
    type: 'select',
    message: 'What type of project is this?',
    options: opt.projectTypeOptions,
    // Closed set: every supported shape is listed, no free-text Other.
    allowOther: false,
  },
  projectDefinition: {
    id: 'projectDefinition',
    type: 'text',
    message: 'Describe your project (a few sentences — the more detail, the better).',
    placeholder: opt.projectDefinitionPlaceholder,
    validate: (input) => {
      if (!input?.trim()) return 'Please provide a short description.';
      return undefined;
    },
  },
  language: {
    id: 'language',
    type: 'select',
    message: 'Primary language?',
    optionsFrom: opt.languageOptions,
    // Closed set: every downstream option list (framework, formatter, linter,
    // test runner…) is keyed by these languages; a free-text language would
    // produce an empty, broken flow.
    allowOther: false,
  },
  framework: {
    id: 'framework',
    type: 'select',
    message: 'Framework?',
    optionsFrom: opt.frameworkOptions,
    // Standalone scripts have no framework; CLI tools get arg-parsing libs.
    when: (a) => a.projectType !== 'script',
  },
  apiArchitecture: {
    id: 'apiArchitecture',
    type: 'select',
    message: 'API architecture?',
    options: opt.apiArchitectureOptions,
    when: (a) => opt.hasServer(a),
  },
  styling: {
    id: 'stylingLibrary',
    type: 'select',
    message: 'Styling / UI library?',
    options: opt.stylingOptions,
    when: (a) => opt.hasUI(a),
  },
  database: {
    id: 'database',
    type: 'select',
    message: 'Database?',
    options: opt.databaseOptions,
    when: (a) => a.projectType !== 'frontend',
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
    message: 'Coding standards?',
    options: opt.codingStandardOptions,
    required: true,
  },
  documentation: {
    id: 'documentation',
    type: 'multiselect',
    summary: 'Documentation',
    message: 'Which docs should the assistant maintain?',
    options: opt.documentationOptions,
    required: false,
  },
  formatter: {
    id: 'formatter',
    type: 'select',
    summary: 'Formatter',
    message: 'Code formatter?',
    optionsFrom: opt.formatterOptions,
  },
  linter: {
    id: 'linter',
    type: 'select',
    summary: 'Linter',
    message: 'Code linter?',
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
  commitScope: {
    id: 'commitScope',
    type: 'confirm',
    summary: 'Task-scoped commits',
    message: 'Limit each commit to changes for the task at hand, excluding unrelated edits?',
    recommended: true,
  },
  commitScratchGuard: {
    id: 'commitScratchGuard',
    type: 'confirm',
    summary: 'Confirm scratch files',
    message:
      'Ask before committing scratch files (e.g. .md or .html notes created only for planning, R&D, or local use)?',
    recommended: true,
  },
  confirmPush: {
    id: 'confirmPush',
    type: 'confirm',
    summary: 'Confirm before push',
    message: 'Ask before pushing to a remote (never push automatically)?',
    recommended: true,
  },
  verifyTiming: {
    id: 'verifyTiming',
    type: 'select',
    summary: 'Verify timing',
    message: 'When should the formatter, linter, and tests run (and pass) in the git workflow?',
    options: opt.verifyTimingOptions,
    allowOther: false,
  },
  atomicCommits: {
    id: 'atomicCommits',
    type: 'confirm',
    summary: 'Atomic commits',
    message: 'Keep commits small and atomic (one logical change each)?',
    recommended: true,
  },
  envExampleOnly: {
    id: 'envExampleOnly',
    type: 'confirm',
    summary: 'Use .env.example only',
    message:
      'Forbid the assistant from reading the real .env, requiring it to work from .env.example instead?',
    recommended: true,
  },
  logger: {
    id: 'logger',
    type: 'select',
    summary: 'Logger',
    message: 'Logging library?',
    optionsFrom: opt.loggerOptions,
    // Closed set: the "centralized" choice already covers a bespoke logger.
    allowOther: false,
  },
  testTypes: {
    id: 'testTypes',
    type: 'multiselect',
    summary: 'Test types',
    message: 'Which kinds of tests?',
    optionsFrom: opt.testTypeOptions,
    required: true,
  },
  testRunner: {
    id: 'testRunner',
    type: 'select',
    summary: 'Test runner',
    message: 'Test runner for unit / integration tests?',
    optionsFrom: opt.testRunnerOptions,
    when: (a) =>
      Array.isArray(a.testTypes) &&
      (a.testTypes.includes('unit') || a.testTypes.includes('integration')),
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
    // Login/identity is a UI or server concern — not a standalone CLI / script.
    when: (a) => !opt.isStandalone(a),
  },
  authStrategy: {
    id: 'authStrategy',
    type: 'select',
    summary: 'Session strategy',
    message: 'Session strategy?',
    options: opt.authStrategyOptions,
    when: (a) => opt.hasServer(a) && a.authApproach !== 'none',
  },
  rbac: {
    id: 'rbac',
    type: 'confirm',
    summary: 'Role-based access control',
    message: 'Use role-based access control (RBAC)?',
    recommended: false,
    when: (a) => !opt.isStandalone(a) && a.authApproach !== 'none',
  },
  packageManager: {
    id: 'packageManager',
    type: 'select',
    summary: 'Package manager',
    message: 'Package manager?',
    optionsFrom: opt.packageManagerOptions,
    when: (a) =>
      a.language === 'typescript' ||
      a.language === 'javascript' ||
      a.language === 'python' ||
      a.language === 'java',
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
    when: (a) => opt.hasUI(a),
  },
  auditSkill: {
    id: 'auditSkill',
    type: 'confirm',
    summary: 'Change-audit skill',
    message:
      'Add a change-audit skill that reviews your pending changes against these project skills before you commit or push?',
    recommended: false,
  },
  auditTiming: {
    id: 'auditTiming',
    type: 'select',
    summary: 'Audit timing',
    message: 'When should the change-audit run?',
    options: opt.auditTimingOptions,
    allowOther: false,
    when: (a) => a.auditSkill === true,
  },
};

/** Wrap stack-defining single questions — asked individually, no recommended gate. */
const single = (...qs: Question[]): FlowSection => ({ questions: () => qs });

export const flow: FlowSection[] = [
  single(core.aiTool),
  single(core.supportTools),
  single(core.projectType),
  single(core.projectDefinition),
  single(core.language),
  single(core.framework),
  expandSelected('framework'),
  single(core.apiArchitecture),
  single(core.styling),
  expandSelected('stylingLibrary'),
  single(core.database),
  expandSelected('database'),
  single(core.orm),
  expandSelected('orm'),
  // Authentication topic group — approach, session strategy, and RBAC.
  // Intentionally ungated by projectType: approach + RBAC apply to client-side
  // auth too (Clerk/Supabase SDKs in a frontend app). Only authStrategy (server
  // sessions) is frontend-gated, on the question itself.
  {
    recommendable: true,
    gate: () => ({ id: 'auth.__recommended', title: 'Authentication' }),
    questions: () => [core.authApproach, core.authStrategy, core.rbac],
  },
  expandSelected('authApproach'),
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
      core.commitScope,
      core.commitScratchGuard,
      core.confirmPush,
      core.verifyTiming,
      core.atomicCommits,
      core.envExampleOnly,
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
  // Opt-in change-audit skill — asked explicitly on every project; the timing
  // follow-up only surfaces once opted in.
  single(core.auditSkill, core.auditTiming),
];
